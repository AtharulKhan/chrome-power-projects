let searchBarOverlay = null;
let selectedItems = new Set();
let currentMode = "search"; // 'search', 'sessions', 'bulk'
let currentSort = "relevance";
let currentFilters = {};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "TOGGLE_SEARCH_BAR") {
    if (searchBarOverlay && document.body.contains(searchBarOverlay)) {
      searchBarOverlay.remove();
      searchBarOverlay = null;
    } else {
      injectSearchBar();
    }
  }

  if (msg.type === "COPY_TO_CLIPBOARD") {
    navigator.clipboard
      .writeText(msg.text)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(() => {
        sendResponse({ success: false });
      });
    return true;
  }
});

function injectSearchBar() {
  if (searchBarOverlay) return;

  // Create overlay
  searchBarOverlay = document.createElement("div");
  searchBarOverlay.id = "floating-search-bar-overlay";
  searchBarOverlay.innerHTML = `
    <div id="floating-bar">
      <div id="mode-tabs">
        <button class="mode-tab active" data-mode="search">Search</button>
        <button class="mode-tab" data-mode="sessions">Sessions</button>
        <button class="mode-tab" data-mode="bulk">Bulk Actions</button>
      </div>
      
      <div id="search-mode" class="mode-content active">
        <div id="options">
          <label class="option">
            <input type="checkbox" id="opt-bookmarks" checked />
            <span>Favourites</span>
          </label>
          <label class="option">
            <input type="checkbox" id="opt-tabs" checked />
            <span>Tabs</span>
          </label>
          <label class="option">
            <input type="checkbox" id="opt-fuzzy" />
            <span>Fuzzy</span>
          </label>
          <label class="option" style="margin-left:18px;">
            <input type="checkbox" id="opt-regex" />
            <span>Regex</span>
          </label>
        </div>
        
        <div id="search-controls">
          <input
            type="text"
            id="search-input"
            placeholder="Search bookmarks, tabs, or history... (try: site:example.com, title:keyword, date:today)"
            autocomplete="off"
            autofocus
          />
          <div id="filter-sort-controls">
            <select id="sort-select">
              <option value="relevance">Relevance</option>
              <option value="alphabetical">Alphabetical</option>
              <option value="domain">Domain</option>
              <option value="lastAccessed">Last Accessed</option>
              <option value="created">Created</option>
            </select>
            <button id="multi-select-btn" title="Enable multi-select">Multi-Select</button>
          </div>
        </div>
      </div>
      
      <div id="sessions-mode" class="mode-content">
        <div id="session-controls">
          <input type="text" id="session-name" placeholder="Session name..." />
          <button id="save-session-btn">Save Selected Tabs</button>
          <button id="save-all-tabs-btn">Save All Tabs</button>
          <button id="auto-backup-btn">Auto-Backup: ON</button>
        </div>
        <div id="session-tab-selection" style="max-height: 200px; overflow-y: auto; margin-bottom: 16px; display: none;">
          <div style="font-size: 13px; color: #7a7e8c; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <span>Select tabs to save:</span>
            <div>
              <button id="select-all-session-tabs" style="padding: 4px 8px; font-size: 11px; border: 1px solid #5a6cff; background: #5a6cff; color: white; border-radius: 4px; cursor: pointer; margin-right: 4px;">Select All</button>
              <button id="deselect-all-session-tabs" style="padding: 4px 8px; font-size: 11px; border: 1px solid #e0e3ea; background: #f8fafd; color: #7a7e8c; border-radius: 4px; cursor: pointer;">Clear All</button>
            </div>
          </div>
          <div id="session-tabs-list"></div>
        </div>
        <div id="session-multi-controls" style="margin-bottom: 12px;">
          <button id="session-multi-select-btn">Multi-Select Sessions</button>
          <button id="delete-selected-sessions-btn" disabled>Delete Selected</button>
          <span id="selected-sessions-count" style="margin-left: 12px; font-size: 13px; color: #7a7e8c;"></span>
        </div>
        <div id="session-list"></div>
      </div>
      
      <div id="bulk-mode" class="mode-content">
        <div id="bulk-controls">
          <button id="select-all-tabs">Select All Tabs</button>
          <button id="select-inactive-tabs">Select Inactive</button>
          <button id="select-by-domain">Select by Domain</button>
          <button id="clear-selection">Clear Selection</button>
        </div>
        <div id="bulk-actions">
          <button id="bulk-close" disabled>Close Selected</button>
          <button id="bulk-pin" disabled>Pin Selected</button>
          <button id="bulk-duplicate" disabled>Duplicate Selected</button>
          <button id="bulk-bookmark" disabled>Bookmark Selected</button>
          <button id="copy-urls" disabled>Copy URLs</button>
        </div>
        <div id="bulk-results"></div>
      </div>
      
      <ul id="results"></ul>
      
      <div id="selection-info" style="display: none;">
        <span id="selection-count">0 selected</span>
        <button id="open-selected-tabs">Open in Tabs</button>
        <button id="open-selected-window">Open in Window</button>
        <button id="clear-selected">Clear</button>
      </div>
    </div>
  `;

  // Overlay styles
  Object.assign(searchBarOverlay.style, {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    zIndex: 2147483647,
    background: "rgba(30,34,50,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(2px)",
  });

  // Prevent scrolling when overlay is open
  document.body.style.overflow = "hidden";
  searchBarOverlay.addEventListener("click", (e) => {
    if (e.target === searchBarOverlay) {
      removeOverlay();
    }
  });

  document.body.appendChild(searchBarOverlay);

  // Inject styles
  injectSearchBarStyles();

  // Focus input
  const searchInput = searchBarOverlay.querySelector("#search-input");
  if (searchInput) searchInput.focus();

  // Logic
  setupSearchBarLogic(searchBarOverlay);
}

function removeOverlay() {
  if (searchBarOverlay) {
    searchBarOverlay.remove();
    searchBarOverlay = null;
    document.body.style.overflow = "";
  }
}

// Inject CSS for the floating bar
function injectSearchBarStyles() {
  if (document.getElementById("floating-search-bar-style")) return;
  const style = document.createElement("style");
  style.id = "floating-search-bar-style";
  style.textContent = `
  #floating-search-bar-overlay {
    animation: overlay-fade-in 0.22s cubic-bezier(.4,0,.2,1);
  }
  @keyframes overlay-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  #floating-bar {
    background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,255,0.9) 100%);
    border-radius: 24px;
    box-shadow: 
      0 20px 60px rgba(90, 108, 255, 0.15),
      0 8px 32px rgba(60, 60, 90, 0.12),
      0 2px 8px rgba(0,0,0,0.05),
      inset 0 1px 0 rgba(255,255,255,0.8);
    max-width: 720px;
    min-width: 420px;
    width: 100%;
    padding: 20px 40px 18px 40px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    backdrop-filter: blur(20px) saturate(180%);
    border: 2px solid transparent;
    background-clip: padding-box;
    position: relative;
    z-index: 10;
    opacity: 0;
    transform: translateY(32px) scale(0.96);
    animation: bar-fade-in 0.4s cubic-bezier(.25,.46,.45,.94) forwards;
  }
  
  #floating-bar::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 24px;
    padding: 2px;
    background: linear-gradient(135deg, 
      rgba(90, 108, 255, 0.3) 0%,
      rgba(139, 69, 255, 0.2) 25%,
      rgba(255, 107, 107, 0.2) 50%,
      rgba(255, 159, 67, 0.2) 75%,
      rgba(90, 108, 255, 0.3) 100%);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: xor;
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    animation: gradient-border 3s ease infinite;
    z-index: -1;
  }
  
  @keyframes gradient-border {
    0%, 100% { 
      background: linear-gradient(135deg, 
        rgba(90, 108, 255, 0.4) 0%,
        rgba(139, 69, 255, 0.3) 25%,
        rgba(255, 107, 107, 0.3) 50%,
        rgba(255, 159, 67, 0.3) 75%,
        rgba(90, 108, 255, 0.4) 100%);
    }
    50% { 
      background: linear-gradient(135deg, 
        rgba(255, 159, 67, 0.4) 0%,
        rgba(90, 108, 255, 0.3) 25%,
        rgba(139, 69, 255, 0.3) 50%,
        rgba(255, 107, 107, 0.3) 75%,
        rgba(255, 159, 67, 0.4) 100%);
    }
  }
  @keyframes bar-fade-in {
    from {
      opacity: 0;
      transform: translateY(32px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  
  /* Mode tabs */
  #mode-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 16px;
    background: #f0f2f8;
    border-radius: 12px;
    padding: 4px;
  }
  .mode-tab {
    flex: 1;
    padding: 8px 16px;
    border: none;
    background: transparent;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    color: #7a7e8c;
    cursor: pointer;
    transition: all 0.15s;
  }
  .mode-tab.active {
    background: #fff;
    color: #5a6cff;
    box-shadow: 0 2px 4px rgba(60,60,90,0.08);
  }
  .mode-tab:hover:not(.active) {
    background: rgba(255,255,255,0.5);
  }
  
  /* Mode content */
  .mode-content {
    display: none;
  }
  .mode-content.active {
    display: block;
  }
  
  /* Search controls */
  #search-controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  #filter-sort-controls {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  #sort-select {
    padding: 6px 10px;
    border: 1px solid #e0e3ea;
    border-radius: 6px;
    background: #f8fafd;
    font-size: 13px;
    outline: none;
  }
  #multi-select-btn {
    padding: 6px 12px;
    border: 1px solid #e0e3ea;
    border-radius: 6px;
    background: #f8fafd;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
  }
  #multi-select-btn.active {
    background: #5a6cff;
    color: white;
    border-color: #5a6cff;
  }
  
  /* Session controls */
  #session-controls {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  #session-name {
    flex: 1;
    min-width: 150px;
    padding: 8px 12px;
    border: 2px solid transparent;
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(248,250,255,0.9) 0%, rgba(240,242,248,0.9) 100%);
    font-size: 14px;
    outline: none;
    position: relative;
    transition: all 0.2s ease;
  }
  #session-name:focus {
    background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,255,0.95) 100%);
    border-color: rgba(90, 108, 255, 0.3);
    box-shadow: 0 0 0 3px rgba(90, 108, 255, 0.1);
  }
  #save-session-btn, #save-all-tabs-btn, #auto-backup-btn {
    padding: 8px 16px;
    border: 2px solid transparent;
    border-radius: 8px;
    background: linear-gradient(135deg, #5a6cff 0%, #7c3aed 100%);
    color: white;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
  }
  #save-session-btn::before, #save-all-tabs-btn::before, #auto-backup-btn.active::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%);
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  #save-session-btn:hover::before, #save-all-tabs-btn:hover::before, #auto-backup-btn.active:hover::before {
    opacity: 1;
  }
  #auto-backup-btn {
    background: linear-gradient(135deg, rgba(240,242,248,0.9) 0%, rgba(224,227,234,0.9) 100%);
    color: #7a7e8c;
    border-color: rgba(224,227,234,0.5);
  }
  #auto-backup-btn.active {
    background: linear-gradient(135deg, #5a6cff 0%, #7c3aed 100%);
    color: white;
    border-color: transparent;
  }
  
  /* Bulk controls */
  #bulk-controls, #bulk-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
    flex-wrap: wrap;
    justify-content: center;
  }
  #bulk-controls button, #bulk-actions button {
    padding: 6px 12px;
    border: 1px solid #e0e3ea;
    border-radius: 6px;
    background: #f8fafd;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }
  #bulk-actions button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  #bulk-actions button:not(:disabled):hover {
    background: #5a6cff;
    color: white;
    border-color: #5a6cff;
  }
  
  /* Bulk results */
  #bulk-results {
    max-height: 300px;
    overflow-y: auto;
    padding: 8px;
    background: #f8fafd;
    border-radius: 8px;
    border: 1px solid #e0e3ea;
  }
  
  /* Selection info */
  #selection-info {
    position: absolute;
    bottom: -50px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(90, 108, 255, 0.9);
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 13px;
    display: flex;
    gap: 12px;
    align-items: center;
    backdrop-filter: blur(8px);
  }
  #selection-info button {
    background: rgba(255,255,255,0.2);
    border: 1px solid rgba(255,255,255,0.3);
    color: white;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }
  #selection-info button:hover {
    background: rgba(255,255,255,0.3);
    border-color: rgba(255,255,255,0.5);
  }
  
  /* Multi-select mode */
  .multi-select-mode #results li {
    padding-left: 40px;
    position: relative;
  }
  .multi-select-mode #results li::before {
    content: '';
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    border: 2px solid #e0e3ea;
    border-radius: 4px;
    background: #f8fafd;
  }
  .multi-select-mode #results li.selected::before {
    background: #5a6cff;
    border-color: #5a6cff;
  }
  .multi-select-mode #results li.selected::after {
    content: '✓';
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    color: white;
    font-size: 12px;
    font-weight: bold;
  }
  
  /* Session list */
  .session-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    background: #f5f6fa;
    border-radius: 8px;
    margin-bottom: 8px;
  }
  .session-info {
    flex: 1;
  }
  .session-name {
    font-weight: 500;
    color: #222;
    margin-bottom: 4px;
  }
  .session-meta {
    font-size: 12px;
    color: #7a7e8c;
  }
  .session-actions {
    display: flex;
    gap: 8px;
  }
  .session-actions button {
    padding: 4px 8px;
    border: 1px solid #e0e3ea;
    border-radius: 4px;
    background: #f8fafd;
    font-size: 11px;
    cursor: pointer;
  }
  
  #results li {
    opacity: 0;
    transform: translateY(12px);
    animation: result-fade-in 0.28s cubic-bezier(.4,0,.2,1) forwards;
    animation-delay: 0.08s;
  }
  #results li:nth-child(1) { animation-delay: 0.08s; }
  #results li:nth-child(2) { animation-delay: 0.12s; }
  #results li:nth-child(3) { animation-delay: 0.16s; }
  #results li:nth-child(4) { animation-delay: 0.20s; }
  #results li:nth-child(5) { animation-delay: 0.24s; }
  @keyframes result-fade-in {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .result-meta {
    font-size: 12px;
    color: #a0a4b0;
    margin-left: 6px;
    margin-top: 2px;
    word-break: break-all;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .popup-btn {
    display: none;
    position: absolute;
    right: 18px;
    top: 50%;
    transform: translateY(-50%);
    background: #f5f6fa;
    color: #5a6cff;
    border: none;
    border-radius: 7px;
    font-size: 13px;
    padding: 4px 12px;
    box-shadow: 0 1px 4px rgba(60,60,90,0.07);
    cursor: pointer;
    opacity: 0.92;
    transition: opacity 0.13s, background 0.13s;
    z-index: 2;
  }
  #results li:hover .popup-btn,
  #results li:focus .popup-btn {
    display: block;
    opacity: 1;
  }
  #results li {
    position: relative;
  }
  .result-domain {
    color: #b0b4c0;
    font-size: 12px;
    margin-right: 8px;
  }
  .result-folder {
    color: #b0b4c0;
    font-size: 12px;
    margin-right: 8px;
    font-style: italic;
  }
  .result-url {
    color: #b0b4c0;
    font-size: 11px;
    margin-right: 8px;
    opacity: 0.7;
  }
  .result-badge {
    background: #e6e8f0;
    color: #7a7e8c;
    font-size: 11px;
    border-radius: 6px;
    padding: 2px 8px;
    margin-left: 4px;
    font-weight: 500;
    letter-spacing: 0.02em;
    display: inline-block;
  }
  .result-thumbnail {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    margin-right: 8px;
  }
  #options {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
    justify-content: center;
  }
  .option {
    display: flex;
    align-items: center;
    font-size: 15px;
    color: #222;
    background: #f5f6fa;
    border-radius: 8px;
    padding: 4px 10px;
    cursor: pointer;
    transition: background 0.15s;
    user-select: none;
  }
  .option:hover,
  .option input:focus + span {
    background: #e6e8f0;
  }
  .option input[type="checkbox"] {
    accent-color: #5a6cff;
    margin-right: 6px;
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: none;
    outline: none;
  }
  #search-input {
    font-size: 16px;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1.5px solid #e0e3ea;
    background: #f8fafd;
    outline: none;
    transition: border 0.15s, box-shadow 0.15s;
    box-shadow: 0 1px 2px rgba(60,60,90,0.04);
    width: 100%;
    box-sizing: border-box;
  }
  #search-input:focus {
    border: 1.5px solid #5a6cff;
    box-shadow: 0 2px 8px rgba(90,108,255,0.07);
  }
  #results {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 260px;
    overflow-y: auto;
  }
  #results li {
    padding: 14px 16px;
    border-radius: 12px;
    margin-bottom: 8px;
    font-size: 15px;
    color: #222;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    gap: 12px;
    position: relative;
    border: 1px solid transparent;
    overflow: hidden;
    min-height: 48px;
  }
  
  /* Result layout components */
  .result-favicon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
  }
  
  .result-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .result-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  
  .result-title {
    font-weight: 500;
    color: #222;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }
  
  .result-actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    opacity: 0.6;
    transition: opacity 0.15s ease;
  }
  
  #results li:hover .result-actions {
    opacity: 1;
  }
  
  /* Dynamic gradient backgrounds - will be set via JavaScript based on domain */
  #results li {
    /* Default fallback gradients */
  }
  
  /* Hover effects - enhanced dynamically */
  #results li:hover {
    transform: translateY(-1px);
    filter: brightness(1.05) saturate(1.1);
  }
  
  /* Animated gradient borders for selected items */
  #results li.selected::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 12px;
    padding: 2px;
    background: linear-gradient(45deg, 
      rgba(90, 108, 255, 0.6) 0%,
      rgba(139, 69, 255, 0.6) 25%,
      rgba(255, 107, 107, 0.6) 50%,
      rgba(255, 159, 67, 0.6) 75%,
      rgba(90, 108, 255, 0.6) 100%);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: xor;
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    animation: result-border-glow 2s ease infinite;
    z-index: -1;
  }
  
  @keyframes result-border-glow {
    0%, 100% { 
      background: linear-gradient(45deg, 
        rgba(90, 108, 255, 0.6) 0%,
        rgba(139, 69, 255, 0.6) 25%,
        rgba(255, 107, 107, 0.6) 50%,
        rgba(255, 159, 67, 0.6) 75%,
        rgba(90, 108, 255, 0.6) 100%);
    }
    50% { 
      background: linear-gradient(45deg, 
        rgba(255, 159, 67, 0.6) 0%,
        rgba(90, 108, 255, 0.6) 25%,
        rgba(139, 69, 255, 0.6) 50%,
        rgba(255, 107, 107, 0.6) 75%,
        rgba(255, 159, 67, 0.6) 100%);
    }
  }
  #results .result-type {
    font-size: 12px;
    color: #7a7e8c;
    background: #e0e3ea;
    border-radius: 6px;
    padding: 2px 7px;
    margin-right: 6px;
    font-weight: 500;
    letter-spacing: 0.03em;
  }
  
  /* Hierarchy tags for bookmark folders */
  .hierarchy-tag {
    font-size: 10px;
    font-weight: 600;
    border-radius: 4px;
    padding: 2px 6px;
    margin-right: 4px;
    display: inline-block;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    transition: all 0.15s ease;
  }
  
  .hierarchy-tag:hover {
    transform: translateY(-1px);
    filter: brightness(1.1) saturate(1.2);
  }
  `;
  document.head.appendChild(style);
}

// Enhanced search bar logic with all new features
function setupSearchBarLogic(root) {
  const options = {
    bookmarks: root.querySelector("#opt-bookmarks"),
    tabs: root.querySelector("#opt-tabs"),
    fuzzy: root.querySelector("#opt-fuzzy"),
    regex: root.querySelector("#opt-regex"),
  };
  const searchInput = root.querySelector("#search-input");
  const resultsList = root.querySelector("#results");
  const sortSelect = root.querySelector("#sort-select");
  const multiSelectBtn = root.querySelector("#multi-select-btn");
  const selectionInfo = root.querySelector("#selection-info");
  const selectionCount = root.querySelector("#selection-count");

  let isMultiSelectMode = false;
  let currentResults = [];

  // Mode switching
  setupModeHandlers(root);

  // Session management
  setupSessionHandlers(root);

  // Bulk actions
  setupBulkHandlers(root);

  // Load saved options from chrome.storage
  chrome.storage.sync.get(["searchOptions"], ({ searchOptions }) => {
    if (searchOptions) {
      options.bookmarks.checked = !!searchOptions.bookmarks;
      options.tabs.checked = !!searchOptions.tabs;
    } else {
      // Default: all checked
      options.bookmarks.checked = true;
      options.tabs.checked = true;
    }
    triggerSearch();
  });

  // Save options to chrome.storage when changed
  Object.values(options).forEach((checkbox) => {
    if (checkbox) {
      checkbox.addEventListener("change", () => {
        chrome.storage.sync.set({
          searchOptions: {
            bookmarks: options.bookmarks.checked,
            tabs: options.tabs.checked,
          },
        });
        triggerSearch();
      });
    }
  });

  // Multi-select toggle
  multiSelectBtn?.addEventListener("click", () => {
    isMultiSelectMode = !isMultiSelectMode;
    multiSelectBtn.classList.toggle("active", isMultiSelectMode);
    root.classList.toggle("multi-select-mode", isMultiSelectMode);
    selectedItems.clear();
    updateSelectionInfo();

    if (!isMultiSelectMode) {
      // Clear all selections
      root.querySelectorAll("#results li.selected").forEach((li) => {
        li.classList.remove("selected");
      });
    } else {
      // Re-render results to show checkboxes
      if (currentResults.length > 0) {
        renderResults(currentResults);
      }
    }
  });

  // Sort change handler
  sortSelect?.addEventListener("change", () => {
    currentSort = sortSelect.value;
    if (currentResults.length > 0) {
      renderResults(currentResults);
    }
  });

  // Debounce search input
  let debounceTimer = null;
  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(triggerSearch, 120);
  });

  // Initial search on load
  setTimeout(triggerSearch, 0);

  // Keyboard: Escape closes overlay
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      removeOverlay();
    }
  });

  // Focus trap: keep focus in input
  root.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      searchInput.focus();
    }
  });

  function updateSelectionInfo() {
    if (selectedItems.size > 0) {
      selectionCount.textContent = `${selectedItems.size} selected`;
      selectionInfo.style.display = "flex";
    } else {
      selectionInfo.style.display = "none";
    }
  }

  // Selection info button handlers
  const openSelectedTabsBtn = root.querySelector("#open-selected-tabs");
  const openSelectedWindowBtn = root.querySelector("#open-selected-window");
  const clearSelectedBtn = root.querySelector("#clear-selected");

  openSelectedTabsBtn?.addEventListener("click", () => {
    if (selectedItems.size === 0) return;

    Array.from(selectedItems).forEach((url) => {
      window.open(url, "_blank");
    });

    selectedItems.clear();
    updateSelectionInfo();

    // Clear visual selections
    root.querySelectorAll("#results li.selected").forEach((li) => {
      li.classList.remove("selected");
    });
  });

  openSelectedWindowBtn?.addEventListener("click", () => {
    if (selectedItems.size === 0) return;

    const urls = Array.from(selectedItems);

    // Open first URL in new window, then open rest as tabs in that window
    if (urls.length > 0) {
      const w = 1200,
        h = 800;
      const dualScreenLeft =
        window.screenLeft !== undefined ? window.screenLeft : window.screenX;
      const dualScreenTop =
        window.screenTop !== undefined ? window.screenTop : window.screenY;
      const width = window.innerWidth
        ? window.innerWidth
        : document.documentElement.clientWidth
        ? document.documentElement.clientWidth
        : screen.width;
      const height = window.innerHeight
        ? window.innerHeight
        : document.documentElement.clientHeight
        ? document.documentElement.clientHeight
        : screen.height;
      const left = dualScreenLeft + Math.max(0, (width - w) / 2);
      const top = dualScreenTop + Math.max(0, (height - h) / 2);

      // Open first URL in new window
      const newWindow = window.open(
        urls[0],
        "_blank",
        `width=${w},height=${h},left=${left},top=${top},noopener,noreferrer`
      );

      // Open remaining URLs as tabs in the same window (if possible)
      urls.slice(1).forEach((url) => {
        window.open(url, "_blank");
      });
    }

    selectedItems.clear();
    updateSelectionInfo();

    // Clear visual selections
    root.querySelectorAll("#results li.selected").forEach((li) => {
      li.classList.remove("selected");
    });
  });

  clearSelectedBtn?.addEventListener("click", () => {
    selectedItems.clear();
    updateSelectionInfo();

    // Clear visual selections
    root.querySelectorAll("#results li.selected").forEach((li) => {
      li.classList.remove("selected");
    });
  });

  async function triggerSearch() {
    const query = searchInput.value.trim();
    const selected = {
      bookmarks: options.bookmarks.checked,
      tabs: options.tabs.checked,
    };
    const regexMode = document.getElementById("opt-regex")?.checked;

    if (!query) {
      resultsList.innerHTML = "";
      return;
    }

    // Precedence: bookmarks > tabs > history
    let results = [];

    // Helper for case-insensitive substring match
    const matches = (str, q) =>
      str && q && str.toLowerCase().includes(q.toLowerCase());

    // Helper for regex match (title only)
    let regex = null;
    if (regexMode) {
      try {
        regex = new RegExp(query, "i");
      } catch {
        // Invalid regex, show no results
        renderResults([]);
        return;
      }
    }

    // Search bookmarks
    if (selected.bookmarks) {
      const bookmarks = await searchBookmarks(query);
      results = results.concat(
        bookmarks
          .filter((b) =>
            regexMode
              ? regex && (regex.test(b.title || "") || regex.test(b.url || ""))
              : matches(b.title, query) || matches(b.url, query)
          )
          .map((b) => ({
            type: "FAV",
            title: b.title,
            url: b.url,
            id: b.id,
          }))
      );
    }
    // Search tabs
    if (selected.tabs) {
      const tabs = await searchTabs(query);
      results = results.concat(
        tabs
          .filter((t) =>
            regexMode
              ? regex && (regex.test(t.title || "") || regex.test(t.url || ""))
              : matches(t.title, query) || matches(t.url, query)
          )
          .map((t) => ({
            type: "TAB",
            title: t.title,
            url: t.url,
            lastAccessed: t.lastAccessed,
          }))
      );
    }

    // Remove duplicates by URL, keep first occurrence (by precedence)
    const seen = new Set();
    const deduped = results.filter((item) => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });

    renderResults(deduped);
  }

  function renderResults(items) {
    resultsList.innerHTML = "";
    if (!items.length) {
      resultsList.innerHTML =
        '<li style="color:#888;text-align:center;">No results found</li>';
      return;
    }

    // Sort results based on current sort option
    const sortedItems = sortResults(items, currentSort);

    for (const item of sortedItems) {
      const li = document.createElement("li");
      li.tabIndex = 0;
      li.setAttribute("data-type", item.type); // Add data-type for gradient styling

      // Extract domain and url
      let domain = "";
      let url = item.url || "";
      try {
        if (url) domain = new URL(url).hostname.replace(/^www\./, "");
      } catch {}

      // Folder path (for bookmarks)
      let folderPath = "";
      let popupBtnHTML = `<button class="popup-btn" tabindex="-1" title="Open in popup window">Open in popup window</button>`;

      if (item.type === "FAV" && item.id) {
        // Async fetch, so show placeholder and update later
        li.innerHTML =
          renderResultHTML(item, domain, url, folderPath, null) + popupBtnHTML;
        getBookmarkFolderPath(item.id).then((path) => {
          li.querySelector(".result-folder").textContent = path
            ? path + " /"
            : "";
        });
        // Fetch last visit time from history for this bookmark's URL
        if (url) {
          chrome.runtime.sendMessage(
            { type: "SEARCH_HISTORY", query: url },
            (results) => {
              let lastVisit = null;
              if (results && results.length) {
                // Find the most recent visit time for this URL
                lastVisit = results
                  .filter((h) => h.url === url && h.lastVisitTime)
                  .map((h) => h.lastVisitTime)
                  .sort((a, b) => b - a)[0];
              }
              if (lastVisit) {
                const badge = li.querySelector(".result-badge");
                if (badge) {
                  badge.textContent = formatDateBadge(lastVisit);
                } else {
                  // Insert badge if not present
                  const meta = li.querySelector(".result-meta");
                  if (meta) {
                    meta.insertAdjacentHTML(
                      "beforeend",
                      `<span class="result-badge">${formatDateBadge(
                        lastVisit
                      )}</span>`
                    );
                  }
                }
              }
            }
          );
        }
      } else {
        // Last opened badge (for tabs/history)
        let lastOpened = null;
        if (item.type === "TAB" && item.lastAccessed) {
          lastOpened = formatDateBadge(item.lastAccessed);
        }
        if (item.type === "HIST" && item.lastVisitTime) {
          lastOpened = formatDateBadge(item.lastVisitTime);
        }
        li.innerHTML =
          renderResultHTML(item, domain, url, folderPath, lastOpened) +
          popupBtnHTML;
      }

      li.addEventListener("click", (e) => {
        if (isMultiSelectMode) {
          e.preventDefault();
          e.stopPropagation();

          // Toggle selection
          if (selectedItems.has(item.url)) {
            selectedItems.delete(item.url);
            li.classList.remove("selected");
          } else {
            selectedItems.add(item.url);
            li.classList.add("selected");
          }
          updateSelectionInfo();
        } else {
          if (item.url) window.open(item.url, "_blank");
        }
      });

      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          if (isMultiSelectMode) {
            // Toggle selection with Enter in multi-select mode
            if (selectedItems.has(item.url)) {
              selectedItems.delete(item.url);
              li.classList.remove("selected");
            } else {
              selectedItems.add(item.url);
              li.classList.add("selected");
            }
            updateSelectionInfo();
          } else {
            if (item.url) window.open(item.url, "_blank");
          }
        }
      });

      // Popup button logic
      const popupBtn = li.querySelector(".popup-btn");
      if (popupBtn) {
        popupBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (item.url) {
            // Center the popup window
            const w = 900,
              h = 700;
            const dualScreenLeft =
              window.screenLeft !== undefined
                ? window.screenLeft
                : window.screenX;
            const dualScreenTop =
              window.screenTop !== undefined
                ? window.screenTop
                : window.screenY;
            const width = window.innerWidth
              ? window.innerWidth
              : document.documentElement.clientWidth
              ? document.documentElement.clientWidth
              : screen.width;
            const height = window.innerHeight
              ? window.innerHeight
              : document.documentElement.clientHeight
              ? document.documentElement.clientHeight
              : screen.height;
            const left = dualScreenLeft + Math.max(0, (width - w) / 2);
            const top = dualScreenTop + Math.max(0, (height - h) / 2);
            window.open(
              item.url,
              "_blank",
              `popup,width=${w},height=${h},left=${left},top=${top},noopener,noreferrer`
            );
          }
        });
      }

      // Apply dynamic gradient based on domain and type
      applyDynamicGradient(li, item, domain);

      resultsList.appendChild(li);
    }
  }

  // Function to generate beautiful, varied gradients with random colors
  function applyDynamicGradient(element, item, domain) {
    // All beautiful gradient combinations - completely random selection
    const allGradients = [
      // Pink/Rose variations
      ["rgba(255, 182, 193, 0.15)", "rgba(255, 218, 185, 0.15)"],
      ["rgba(255, 192, 203, 0.15)", "rgba(255, 228, 196, 0.15)"],
      ["rgba(255, 160, 180, 0.15)", "rgba(255, 200, 170, 0.15)"],
      ["rgba(255, 175, 204, 0.15)", "rgba(255, 210, 180, 0.15)"],
      ["rgba(255, 155, 185, 0.15)", "rgba(255, 195, 165, 0.15)"],

      // Blue/Purple variations
      ["rgba(173, 216, 230, 0.15)", "rgba(221, 160, 221, 0.15)"],
      ["rgba(135, 206, 250, 0.15)", "rgba(186, 85, 211, 0.15)"],
      ["rgba(176, 224, 230, 0.15)", "rgba(218, 112, 214, 0.15)"],
      ["rgba(152, 251, 152, 0.15)", "rgba(147, 112, 219, 0.15)"],
      ["rgba(175, 238, 238, 0.15)", "rgba(199, 21, 133, 0.15)"],

      // Green/Yellow variations
      ["rgba(144, 238, 144, 0.15)", "rgba(255, 255, 224, 0.15)"],
      ["rgba(152, 251, 152, 0.15)", "rgba(255, 250, 205, 0.15)"],
      ["rgba(124, 252, 0, 0.15)", "rgba(255, 255, 240, 0.15)"],
      ["rgba(173, 255, 47, 0.15)", "rgba(255, 248, 220, 0.15)"],
      ["rgba(154, 205, 50, 0.15)", "rgba(255, 245, 238, 0.15)"],

      // Orange/Coral variations
      ["rgba(255, 160, 122, 0.15)", "rgba(255, 218, 185, 0.15)"],
      ["rgba(255, 127, 80, 0.15)", "rgba(255, 228, 196, 0.15)"],
      ["rgba(255, 165, 0, 0.15)", "rgba(255, 240, 245, 0.15)"],

      // Teal/Mint variations
      ["rgba(64, 224, 208, 0.15)", "rgba(175, 238, 238, 0.15)"],
      ["rgba(72, 209, 204, 0.15)", "rgba(224, 255, 255, 0.15)"],
      ["rgba(95, 158, 160, 0.15)", "rgba(240, 248, 255, 0.15)"],

      // Lavender/Purple variations
      ["rgba(221, 160, 221, 0.15)", "rgba(230, 230, 250, 0.15)"],
      ["rgba(186, 85, 211, 0.15)", "rgba(255, 240, 245, 0.15)"],
      ["rgba(147, 112, 219, 0.15)", "rgba(248, 248, 255, 0.15)"],

      // Peach/Cream variations
      ["rgba(255, 218, 185, 0.15)", "rgba(255, 248, 220, 0.15)"],
      ["rgba(255, 228, 196, 0.15)", "rgba(255, 250, 240, 0.15)"],
      ["rgba(255, 239, 213, 0.15)", "rgba(255, 245, 238, 0.15)"],
    ];

    // Randomly select a gradient
    const randomIndex = Math.floor(Math.random() * allGradients.length);
    const [color1, color2] = allGradients[randomIndex];

    // Create hover colors (more intense)
    const hoverColor1 = color1.replace("0.15", "0.25");
    const hoverColor2 = color2.replace("0.15", "0.25");

    // Apply gradient background
    element.style.background = `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`;
    element.style.borderColor = color1.replace("0.15", "0.2");

    // Store hover colors for dynamic hover effect
    element.setAttribute("data-hover-color1", hoverColor1);
    element.setAttribute("data-hover-color2", hoverColor2);
    element.setAttribute("data-hover-border", color1.replace("0.15", "0.4"));

    // Add enhanced hover listeners
    element.addEventListener("mouseenter", () => {
      element.style.background = `linear-gradient(135deg, ${hoverColor1} 0%, ${hoverColor2} 100%)`;
      element.style.borderColor = color1.replace("0.15", "0.4");
      element.style.boxShadow = `0 4px 12px ${color1.replace("0.15", "0.2")}`;
    });

    element.addEventListener("mouseleave", () => {
      element.style.background = `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`;
      element.style.borderColor = color1.replace("0.15", "0.2");
      element.style.boxShadow = "none";
    });
  }

  // Simple hash function for consistent domain-based colors
  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Sort results based on selected option
  function sortResults(items, sortBy) {
    const sorted = [...items];

    switch (sortBy) {
      case "alphabetical":
        return sorted.sort((a, b) =>
          (a.title || "").localeCompare(b.title || "")
        );

      case "domain":
        return sorted.sort((a, b) => {
          const domainA = getDomain(a.url);
          const domainB = getDomain(b.url);
          return domainA.localeCompare(domainB);
        });

      case "lastAccessed":
        return sorted.sort((a, b) => {
          const timeA = a.lastAccessed || a.lastVisitTime || 0;
          const timeB = b.lastAccessed || b.lastVisitTime || 0;
          return timeB - timeA; // Most recent first
        });

      case "created":
        return sorted.sort((a, b) => {
          // For bookmarks, we'd need to fetch creation time from Chrome API
          // For now, sort by type priority: FAV > TAB > HIST
          const typeOrder = { FAV: 0, TAB: 1, HIST: 2 };
          return typeOrder[a.type] - typeOrder[b.type];
        });

      case "relevance":
      default:
        // Keep original order (relevance-based from search)
        return sorted;
    }
  }

  function getDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  // Truncate URL with hover to show full URL
  function truncateUrl(url, maxLength = 50) {
    if (!url || url.length <= maxLength) return url;
    return url.substring(0, maxLength) + "...";
  }

  // Helper to render result HTML with metadata
  function renderResultHTML(item, domain, url, folderPath, lastOpened) {
    const truncatedUrl = truncateUrl(url, 40);
    const hierarchyTags = folderPath ? generateHierarchyTags(folderPath) : "";

    // Get favicon URL
    const faviconUrl = getFaviconUrl(url, item);

    return `
      <div class="result-favicon">
        <img src="${faviconUrl}" 
             width="20" height="20" 
             style="border-radius: 4px; object-fit: cover;"
             onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22%3E%3Crect width=%2216%22 height=%2216%22 fill=%22%23e0e3ea%22 rx=%223%22/%3E%3C/svg%3E'">
      </div>
      <div class="result-content">
        <div class="result-header">
          <span class="result-type">${item.type}</span>
          <span class="result-title">${escapeHTML(
            item.title || url || ""
          )}</span>
          ${lastOpened ? `<span class="result-badge">${lastOpened}</span>` : ""}
        </div>
        <div class="result-meta">
          ${hierarchyTags}
          ${
            domain
              ? `<span class="result-domain">${escapeHTML(domain)}</span>`
              : ""
          }
          ${
            url
              ? `<span class="result-url" title="${escapeHTML(
                  url
                )}">${escapeHTML(truncatedUrl)}</span>`
              : ""
          }
        </div>
      </div>
    `;
  }

  // Get favicon URL for a given URL and item
  function getFaviconUrl(url, item) {
    if (!url) {
      return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23e0e3ea" rx="3"/></svg>`;
    }

    try {
      const domain = new URL(url).hostname;
      // Use Google's favicon service as fallback, but try the site's favicon first
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23e0e3ea" rx="3"/></svg>`;
    }
  }

  // Generate colored hierarchy tags for bookmark folders
  function generateHierarchyTags(folderPath) {
    if (!folderPath) return "";

    const folders = folderPath.split(" / ").filter((f) => f.trim());
    const colors = [
      "#ff6b6b",
      "#4ecdc4",
      "#45b7d1",
      "#96ceb4",
      "#feca57",
      "#ff9ff3",
      "#54a0ff",
      "#5f27cd",
      "#00d2d3",
      "#ff9f43",
    ];

    return folders
      .map((folder, index) => {
        const color = colors[index % colors.length];
        return `<span class="hierarchy-tag" style="background: ${color}20; color: ${color}; border: 1px solid ${color}40;">${escapeHTML(
          folder
        )}</span>`;
      })
      .join("");
  }

  // Helper to get bookmark folder path by id
  function getBookmarkFolderPath(bookmarkId) {
    return new Promise((resolve) => {
      chrome.bookmarks.get(bookmarkId, (nodes) => {
        if (!nodes || !nodes.length) return resolve("");
        let node = nodes[0];
        let path = [];
        function traverseParent(id) {
          chrome.bookmarks.get(id, (parents) => {
            if (
              parents &&
              parents[0] &&
              parents[0].parentId &&
              parents[0].title
            ) {
              if (parents[0].parentId !== "0") {
                path.unshift(parents[0].title);
                traverseParent(parents[0].parentId);
              } else {
                resolve(path.join(" / "));
              }
            } else {
              resolve(path.join(" / "));
            }
          });
        }
        if (node.parentId && node.parentId !== "0") {
          traverseParent(node.parentId);
        } else {
          resolve("");
        }
      });
    });
  }

  // Helper to format last opened date as badge
  function formatDateBadge(ts) {
    const d = new Date(ts);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return Math.floor(diff / 60000) + " min ago";
    if (diff < 86400000) return Math.floor(diff / 3600000) + " hr ago";
    return d.toLocaleDateString();
  }

  // Search helpers
  function searchBookmarks(query) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "SEARCH_BOOKMARKS", query },
        (results) => {
          resolve((results || []).filter((b) => b.url));
        }
      );
    });
  }

  function searchTabs(query) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "SEARCH_TABS", query }, (results) => {
        resolve(results || []);
      });
    });
  }

  function searchHistory(query) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "SEARCH_HISTORY", query },
        (results) => {
          resolve((results || []).filter((h) => h.url));
        }
      );
    });
  }

  // Escape HTML for safe rendering
  function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, function (match) {
      const escape = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return escape[match];
    });
  }
}

// Mode switching handlers
function setupModeHandlers(root) {
  const modeTabs = root.querySelectorAll(".mode-tab");
  const modeContents = root.querySelectorAll(".mode-content");

  modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const mode = tab.dataset.mode;

      // Update active tab
      modeTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      // Update active content
      modeContents.forEach((content) => content.classList.remove("active"));
      root.querySelector(`#${mode}-mode`).classList.add("active");

      currentMode = mode;

      // Load mode-specific data
      if (mode === "sessions") {
        loadSessions(root);
      } else if (mode === "bulk") {
        loadBulkMode(root);
      }
    });
  });
}

// Session management handlers
function setupSessionHandlers(root) {
  const saveBtn = root.querySelector("#save-session-btn");
  const saveAllBtn = root.querySelector("#save-all-tabs-btn");
  const sessionName = root.querySelector("#session-name");
  const autoBackupBtn = root.querySelector("#auto-backup-btn");
  const sessionTabSelection = root.querySelector("#session-tab-selection");
  const sessionTabsList = root.querySelector("#session-tabs-list");

  let sessionSelectedTabs = new Set();

  // Show tab selection when "Save Selected Tabs" is clicked
  saveBtn?.addEventListener("click", async () => {
    const name = sessionName.value.trim();
    if (!name) {
      // Show tab selection interface
      sessionTabSelection.style.display = "block";
      await loadSessionTabs(root);
      return;
    }

    if (sessionSelectedTabs.size === 0) {
      // Show tab selection interface if no tabs selected
      sessionTabSelection.style.display = "block";
      await loadSessionTabs(root);
      alert("Please select tabs to save");
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: "SAVE_SELECTED_SESSION",
        name: name,
        tabIds: Array.from(sessionSelectedTabs),
      });

      if (response) {
        sessionName.value = "";
        sessionTabSelection.style.display = "none";
        sessionSelectedTabs.clear();
        loadSessions(root);
        alert(`Session "${name}" saved with ${sessionSelectedTabs.size} tabs!`);
      }
    } catch (error) {
      alert("Failed to save session");
    }
  });

  // Save all tabs
  saveAllBtn?.addEventListener("click", async () => {
    const name = sessionName.value.trim();
    if (!name) {
      alert("Please enter a session name");
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: "SAVE_SESSION",
        name: name,
      });

      if (response) {
        sessionName.value = "";
        sessionTabSelection.style.display = "none";
        loadSessions(root);
        alert(`Session "${name}" saved successfully!`);
      }
    } catch (error) {
      alert("Failed to save session");
    }
  });

  // Select All / Clear All handlers for session tabs
  const selectAllSessionTabsBtn = root.querySelector(
    "#select-all-session-tabs"
  );
  const deselectAllSessionTabsBtn = root.querySelector(
    "#deselect-all-session-tabs"
  );

  selectAllSessionTabsBtn?.addEventListener("click", async () => {
    const tabs = await chrome.runtime.sendMessage({
      type: "SEARCH_TABS",
      query: "",
    });

    if (tabs) {
      tabs.forEach((tab) => sessionSelectedTabs.add(tab.id));
      await loadSessionTabs(root); // Reload to show all selected
    }
  });

  deselectAllSessionTabsBtn?.addEventListener("click", async () => {
    sessionSelectedTabs.clear();
    await loadSessionTabs(root); // Reload to show none selected
  });

  // Load session tabs for selection
  async function loadSessionTabs(root) {
    const sessionTabsList = root.querySelector("#session-tabs-list");
    if (!sessionTabsList) return;

    try {
      const tabs = await chrome.runtime.sendMessage({
        type: "SEARCH_TABS",
        query: "",
      });

      sessionTabsList.innerHTML = "";

      if (!tabs || tabs.length === 0) {
        sessionTabsList.innerHTML =
          '<div style="text-align: center; color: #888; padding: 20px;">No tabs found</div>';
        return;
      }

      tabs.forEach((tab) => {
        const tabItem = document.createElement("div");
        tabItem.style.cssText = `
          display: flex;
          align-items: center;
          padding: 6px 8px;
          background: #f5f6fa;
          border-radius: 4px;
          margin-bottom: 2px;
          cursor: pointer;
          transition: background 0.15s;
        `;

        const isSelected = sessionSelectedTabs.has(tab.id);
        if (isSelected) {
          tabItem.style.background = "#e6f3ff";
        }

        tabItem.innerHTML = `
          <input type="checkbox" ${
            isSelected ? "checked" : ""
          } style="margin-right: 8px;">
          <img src="${
            tab.favIconUrl ||
            'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ddd"/></svg>'
          }" 
               width="14" height="14" style="margin-right: 6px; border-radius: 2px;">
          <div style="flex: 1; min-width: 0; font-size: 13px;">
            <div style="font-weight: 500; color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${escapeHTML(tab.title || tab.url)}
            </div>
          </div>
          ${
            tab.pinned
              ? '<span style="background: #5a6cff; color: white; font-size: 9px; padding: 1px 4px; border-radius: 3px; margin-left: 4px;">PIN</span>'
              : ""
          }
        `;

        tabItem.addEventListener("click", () => {
          const checkbox = tabItem.querySelector('input[type="checkbox"]');
          checkbox.checked = !checkbox.checked;

          if (checkbox.checked) {
            sessionSelectedTabs.add(tab.id);
            tabItem.style.background = "#e6f3ff";
          } else {
            sessionSelectedTabs.delete(tab.id);
            tabItem.style.background = "#f5f6fa";
          }
        });

        sessionTabsList.appendChild(tabItem);
      });
    } catch (error) {
      sessionTabsList.innerHTML =
        '<div style="text-align: center; color: #f44; padding: 20px;">Failed to load tabs</div>';
    }
  }

  autoBackupBtn?.addEventListener("click", async () => {
    // Toggle auto-backup setting
    const isActive = autoBackupBtn.classList.contains("active");
    autoBackupBtn.classList.toggle("active", !isActive);
    autoBackupBtn.textContent = isActive
      ? "Auto-Backup: OFF"
      : "Auto-Backup: ON";

    // Save setting
    await chrome.storage.sync.set({ autoBackup: !isActive });
  });

  // Load auto-backup setting
  chrome.storage.sync.get(["autoBackup"], (result) => {
    const isActive = result.autoBackup !== false; // Default to true
    autoBackupBtn?.classList.toggle("active", isActive);
    if (autoBackupBtn) {
      autoBackupBtn.textContent = isActive
        ? "Auto-Backup: ON"
        : "Auto-Backup: OFF";
    }
  });

  // Session multi-select handlers
  const sessionMultiSelectBtn = root.querySelector("#session-multi-select-btn");
  const deleteSelectedSessionsBtn = root.querySelector(
    "#delete-selected-sessions-btn"
  );
  const selectedSessionsCount = root.querySelector("#selected-sessions-count");
  const sessionMultiControls = root.querySelector("#session-multi-controls");

  let isSessionMultiSelectMode = false;
  let selectedSessions = new Set();

  sessionMultiSelectBtn?.addEventListener("click", () => {
    isSessionMultiSelectMode = !isSessionMultiSelectMode;
    sessionMultiSelectBtn.textContent = isSessionMultiSelectMode
      ? "Exit Multi-Select"
      : "Multi-Select Sessions";

    selectedSessions.clear();
    updateSessionSelectionInfo();
    loadSessions(root); // Reload to show/hide checkboxes
  });

  deleteSelectedSessionsBtn?.addEventListener("click", async () => {
    if (selectedSessions.size === 0) return;

    if (
      !confirm(
        `Are you sure you want to delete ${selectedSessions.size} session(s)?`
      )
    )
      return;

    try {
      for (const sessionId of selectedSessions) {
        await chrome.runtime.sendMessage({ type: "DELETE_SESSION", sessionId });
      }
      selectedSessions.clear();
      updateSessionSelectionInfo();
      loadSessions(root);
    } catch (error) {
      alert("Failed to delete sessions");
    }
  });

  function updateSessionSelectionInfo() {
    if (selectedSessions.size > 0) {
      selectedSessionsCount.textContent = `${selectedSessions.size} selected`;
      deleteSelectedSessionsBtn.disabled = false;
    } else {
      selectedSessionsCount.textContent = "";
      deleteSelectedSessionsBtn.disabled = true;
    }
  }

  // Store these functions for use in loadSessions
  root._sessionMultiSelectMode = () => isSessionMultiSelectMode;
  root._selectedSessions = selectedSessions;
  root._updateSessionSelectionInfo = updateSessionSelectionInfo;
}

// Load and display sessions
async function loadSessions(root) {
  const sessionList = root.querySelector("#session-list");
  if (!sessionList) return;

  try {
    const sessions = await chrome.runtime.sendMessage({ type: "GET_SESSIONS" });

    sessionList.innerHTML = "";

    if (!sessions || Object.keys(sessions).length === 0) {
      sessionList.innerHTML =
        '<div style="text-align: center; color: #888; padding: 20px;">No saved sessions</div>';
      return;
    }

    const isMultiSelectMode = root._sessionMultiSelectMode
      ? root._sessionMultiSelectMode()
      : false;
    const selectedSessions = root._selectedSessions || new Set();
    const updateSessionSelectionInfo =
      root._updateSessionSelectionInfo || (() => {});

    Object.values(sessions).forEach((session) => {
      const sessionItem = document.createElement("div");
      sessionItem.className = "session-item";

      if (isMultiSelectMode) {
        const isSelected = selectedSessions.has(session.id);
        sessionItem.style.cursor = "pointer";
        if (isSelected) {
          sessionItem.style.background = "#e6f3ff";
          sessionItem.style.borderColor = "#5a6cff";
        }

        sessionItem.innerHTML = `
          <div style="position: relative; margin-right: 12px;">
            <input type="checkbox" ${
              isSelected ? "checked" : ""
            } style="width: 18px; height: 18px; accent-color: #5a6cff; cursor: pointer;">
            ${
              isSelected
                ? '<span style="position: absolute; left: 3px; top: 1px; color: white; font-size: 12px; font-weight: bold; pointer-events: none;">✓</span>'
                : ""
            }
          </div>
          <div class="session-info">
            <div class="session-name">${escapeHTML(session.name)}</div>
            <div class="session-meta">${session.tabCount} tabs • ${formatDate(
          session.created
        )}</div>
          </div>
        `;

        sessionItem.addEventListener("click", (e) => {
          e.preventDefault();
          const checkbox = sessionItem.querySelector('input[type="checkbox"]');
          const checkmark = sessionItem.querySelector("span");

          checkbox.checked = !checkbox.checked;

          if (checkbox.checked) {
            selectedSessions.add(session.id);
            sessionItem.style.background = "#e6f3ff";
            sessionItem.style.borderColor = "#5a6cff";
            if (!checkmark) {
              checkbox.parentElement.insertAdjacentHTML(
                "beforeend",
                '<span style="position: absolute; left: 3px; top: 1px; color: white; font-size: 12px; font-weight: bold; pointer-events: none;">✓</span>'
              );
            }
          } else {
            selectedSessions.delete(session.id);
            sessionItem.style.background = "#f5f6fa";
            sessionItem.style.borderColor = "transparent";
            if (checkmark) {
              checkmark.remove();
            }
          }

          updateSessionSelectionInfo();
        });
      } else {
        sessionItem.innerHTML = `
          <div class="session-info">
            <div class="session-name">${escapeHTML(session.name)}</div>
            <div class="session-meta">${session.tabCount} tabs • ${formatDate(
          session.created
        )}</div>
          </div>
          <div class="session-actions">
            <button data-action="restore-new" data-session-id="${
              session.id
            }">New Window</button>
            <button data-action="restore-current" data-session-id="${
              session.id
            }">Current Window</button>
            <button data-action="delete" data-session-id="${
              session.id
            }">Delete</button>
          </div>
        `;

        // Add event listeners for session action buttons
        const actionButtons = sessionItem.querySelectorAll(
          ".session-actions button"
        );
        actionButtons.forEach((button) => {
          button.addEventListener("click", async (e) => {
            e.stopPropagation();
            const action = button.dataset.action;
            const sessionId = button.dataset.sessionId;

            if (action === "restore-new") {
              try {
                await chrome.runtime.sendMessage({
                  type: "RESTORE_SESSION",
                  sessionId,
                  inNewWindow: true,
                });
                removeOverlay();
              } catch (error) {
                alert("Failed to restore session");
              }
            } else if (action === "restore-current") {
              try {
                await chrome.runtime.sendMessage({
                  type: "RESTORE_SESSION",
                  sessionId,
                  inNewWindow: false,
                });
                removeOverlay();
              } catch (error) {
                alert("Failed to restore session");
              }
            } else if (action === "delete") {
              if (!confirm("Are you sure you want to delete this session?"))
                return;

              try {
                await chrome.runtime.sendMessage({
                  type: "DELETE_SESSION",
                  sessionId,
                });
                loadSessions(root);
              } catch (error) {
                alert("Failed to delete session");
              }
            }
          });
        });
      }

      sessionList.appendChild(sessionItem);
    });
  } catch (error) {
    sessionList.innerHTML =
      '<div style="text-align: center; color: #f44; padding: 20px;">Failed to load sessions</div>';
  }
}

// Bulk actions handlers
function setupBulkHandlers(root) {
  const selectAllBtn = root.querySelector("#select-all-tabs");
  const selectInactiveBtn = root.querySelector("#select-inactive-tabs");
  const selectByDomainBtn = root.querySelector("#select-by-domain");
  const clearSelectionBtn = root.querySelector("#clear-selection");

  const bulkCloseBtn = root.querySelector("#bulk-close");
  const bulkPinBtn = root.querySelector("#bulk-pin");
  const bulkDuplicateBtn = root.querySelector("#bulk-duplicate");
  const bulkBookmarkBtn = root.querySelector("#bulk-bookmark");
  const copyUrlsBtn = root.querySelector("#copy-urls");

  selectAllBtn?.addEventListener("click", async () => {
    const tabs = await chrome.runtime.sendMessage({
      type: "SEARCH_TABS",
      query: "",
    });
    displayBulkTabs(root, tabs || []);
  });

  selectInactiveBtn?.addEventListener("click", async () => {
    const tabs = await chrome.runtime.sendMessage({
      type: "GET_INACTIVE_TABS",
      thresholdMinutes: 60,
    });
    displayBulkTabs(root, tabs || []);
  });

  selectByDomainBtn?.addEventListener("click", async () => {
    const domain = prompt("Enter domain to select (e.g., example.com):");
    if (!domain) return;

    const tabs = await chrome.runtime.sendMessage({
      type: "SEARCH_TABS",
      query: "",
    });
    const filtered = (tabs || []).filter((tab) => {
      try {
        return new URL(tab.url).hostname.includes(domain);
      } catch {
        return false;
      }
    });
    displayBulkTabs(root, filtered);
  });

  clearSelectionBtn?.addEventListener("click", () => {
    selectedItems.clear();
    updateBulkButtons(root);
    const bulkResults = root.querySelector("#bulk-results");
    if (bulkResults) bulkResults.innerHTML = "";
  });

  // Bulk action handlers
  bulkCloseBtn?.addEventListener("click", async () => {
    if (selectedItems.size === 0) return;

    const tabIds = Array.from(selectedItems);
    try {
      await chrome.runtime.sendMessage({ type: "BULK_CLOSE_TABS", tabIds });
      selectedItems.clear();
      updateBulkButtons(root);
      loadBulkMode(root);
    } catch (error) {
      alert("Failed to close tabs");
    }
  });

  bulkPinBtn?.addEventListener("click", async () => {
    if (selectedItems.size === 0) return;

    const tabIds = Array.from(selectedItems);
    try {
      await chrome.runtime.sendMessage({
        type: "BULK_PIN_TABS",
        tabIds,
        pinned: true,
      });
      loadBulkMode(root);
    } catch (error) {
      alert("Failed to pin tabs");
    }
  });

  bulkDuplicateBtn?.addEventListener("click", async () => {
    if (selectedItems.size === 0) return;

    const tabIds = Array.from(selectedItems);
    try {
      await chrome.runtime.sendMessage({ type: "BULK_DUPLICATE_TABS", tabIds });
      loadBulkMode(root);
    } catch (error) {
      alert("Failed to duplicate tabs");
    }
  });

  bulkBookmarkBtn?.addEventListener("click", async () => {
    if (selectedItems.size === 0) return;

    const tabIds = Array.from(selectedItems);
    try {
      // Get tab details first
      const tabs = await chrome.runtime.sendMessage({
        type: "SEARCH_TABS",
        query: "",
      });
      const selectedTabs = (tabs || []).filter((tab) =>
        tabIds.includes(tab.id)
      );

      await chrome.runtime.sendMessage({
        type: "BULK_CREATE_BOOKMARKS",
        tabs: selectedTabs,
      });
      alert(`${selectedTabs.length} bookmarks created!`);
    } catch (error) {
      alert("Failed to create bookmarks");
    }
  });

  copyUrlsBtn?.addEventListener("click", async () => {
    if (selectedItems.size === 0) return;

    const tabIds = Array.from(selectedItems);
    try {
      await chrome.runtime.sendMessage({ type: "COPY_TAB_URLS", tabIds });
      alert("URLs copied to clipboard!");
    } catch (error) {
      alert("Failed to copy URLs");
    }
  });
}

// Load bulk mode data
async function loadBulkMode(root) {
  const tabs = await chrome.runtime.sendMessage({
    type: "SEARCH_TABS",
    query: "",
  });
  displayBulkTabs(root, tabs || []);
}

// Display tabs in bulk mode
function displayBulkTabs(root, tabs) {
  const bulkResults = root.querySelector("#bulk-results");
  if (!bulkResults) return;

  bulkResults.innerHTML = "";

  if (tabs.length === 0) {
    bulkResults.innerHTML =
      '<div style="text-align: center; color: #888; padding: 20px;">No tabs found</div>';
    return;
  }

  tabs.forEach((tab) => {
    const tabItem = document.createElement("div");
    tabItem.className = "bulk-tab-item";
    tabItem.style.cssText = `
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background: #f5f6fa;
      border-radius: 6px;
      margin-bottom: 4px;
      cursor: pointer;
      transition: background 0.15s;
    `;

    const isSelected = selectedItems.has(tab.id);
    if (isSelected) {
      tabItem.style.background = "#e6f3ff";
    }

    tabItem.innerHTML = `
      <input type="checkbox" ${
        isSelected ? "checked" : ""
      } style="margin-right: 8px;">
      <img src="${
        tab.favIconUrl ||
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ddd"/></svg>'
      }" 
           width="16" height="16" style="margin-right: 8px; border-radius: 2px;">
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 500; color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${escapeHTML(tab.title || tab.url)}
        </div>
        <div style="font-size: 12px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${escapeHTML(tab.url)}
        </div>
      </div>
      ${
        tab.pinned
          ? '<span style="background: #5a6cff; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">PINNED</span>'
          : ""
      }
    `;

    tabItem.addEventListener("click", () => {
      const checkbox = tabItem.querySelector('input[type="checkbox"]');
      checkbox.checked = !checkbox.checked;

      if (checkbox.checked) {
        selectedItems.add(tab.id);
        tabItem.style.background = "#e6f3ff";
      } else {
        selectedItems.delete(tab.id);
        tabItem.style.background = "#f5f6fa";
      }

      updateBulkButtons(root);
    });

    bulkResults.appendChild(tabItem);
  });

  updateBulkButtons(root);
}

// Update bulk action button states
function updateBulkButtons(root) {
  const buttons = root.querySelectorAll("#bulk-actions button");
  const hasSelection = selectedItems.size > 0;

  buttons.forEach((btn) => {
    btn.disabled = !hasSelection;
  });
}

// Global functions for session management
window.restoreSession = async function (sessionId, inNewWindow) {
  try {
    await chrome.runtime.sendMessage({
      type: "RESTORE_SESSION",
      sessionId,
      inNewWindow,
    });
    removeOverlay();
  } catch (error) {
    alert("Failed to restore session");
  }
};

window.deleteSession = async function (sessionId) {
  if (!confirm("Are you sure you want to delete this session?")) return;

  try {
    await chrome.runtime.sendMessage({ type: "DELETE_SESSION", sessionId });
    // Reload sessions if we're in session mode
    if (currentMode === "sessions" && searchBarOverlay) {
      loadSessions(searchBarOverlay);
    }
  } catch (error) {
    alert("Failed to delete session");
  }
};

// Helper functions
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (diff < 7 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString([], { weekday: "short" });
  } else {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
}

function escapeHTML(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, function (match) {
    const escape = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return escape[match];
  });
}
