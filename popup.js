const options = {
  bookmarks: document.getElementById("opt-bookmarks"),
  tabs: document.getElementById("opt-tabs"),
  history: document.getElementById("opt-history"),
};
const searchInput = document.getElementById("search-input");
const resultsList = document.getElementById("results");

// Load saved options from chrome.storage
chrome.storage.sync.get(["searchOptions"], ({ searchOptions }) => {
  if (searchOptions) {
    options.bookmarks.checked = !!searchOptions.bookmarks;
    options.tabs.checked = !!searchOptions.tabs;
    options.history.checked = !!searchOptions.history;
  }
});

// Save options to chrome.storage when changed
Object.values(options).forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    chrome.storage.sync.set({
      searchOptions: {
        bookmarks: options.bookmarks.checked,
        tabs: options.tabs.checked,
        history: options.history.checked,
      },
    });
    triggerSearch();
  });
});

// Debounce search input
let debounceTimer = null;
searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(triggerSearch, 120);
});

// Initial search on load
window.addEventListener("DOMContentLoaded", triggerSearch);

async function triggerSearch() {
  const query = searchInput.value.trim();
  const selected = {
    bookmarks: options.bookmarks.checked,
    tabs: options.tabs.checked,
    history: options.history.checked,
  };
  if (!query) {
    resultsList.innerHTML = "";
    return;
  }

  // Precedence: bookmarks > tabs > history
  let results = [];
  if (selected.bookmarks) {
    const bookmarks = await searchBookmarks(query);
    results = results.concat(
      bookmarks.map((b) => ({
        type: "FAV",
        title: b.title,
        url: b.url,
      }))
    );
  }
  if (selected.tabs) {
    const tabs = await searchTabs(query);
    results = results.concat(
      tabs.map((t) => ({
        type: "TAB",
        title: t.title,
        url: t.url,
      }))
    );
  }
  if (selected.history) {
    const history = await searchHistory(query);
    results = results.concat(
      history.map((h) => ({
        type: "HIST",
        title: h.title,
        url: h.url,
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
  for (const item of items) {
    const li = document.createElement("li");
    li.tabIndex = 0;
    li.innerHTML = `
      <span class="result-type">${item.type}</span>
      <span class="result-title" style="flex:1;">${escapeHTML(
        item.title || item.url || ""
      )}</span>
      <svg width="16" height="16" style="margin-left:4px;opacity:0.5;" viewBox="0 0 20 20"><path fill="currentColor" d="M7.05 4.05a.75.75 0 0 1 1.06 0l5.25 5.25a.75.75 0 0 1 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06L11.19 10 7.05 5.86a.75.75 0 0 1 0-1.06z"/></svg>
    `;
    li.addEventListener("click", () => {
      if (item.url) chrome.tabs.create({ url: item.url });
    });
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && item.url) chrome.tabs.create({ url: item.url });
    });
    resultsList.appendChild(li);
  }
}

// Search helpers
function searchBookmarks(query) {
  return new Promise((resolve) => {
    chrome.bookmarks.search(query, (results) => {
      // Only return bookmark nodes with a URL (not folders)
      resolve(results.filter((b) => b.url));
    });
  });
}

function searchTabs(query) {
  return new Promise((resolve) => {
    chrome.tabs.query({}, (tabs) => {
      const lower = query.toLowerCase();
      resolve(
        tabs.filter(
          (tab) =>
            (tab.title && tab.title.toLowerCase().includes(lower)) ||
            (tab.url && tab.url.toLowerCase().includes(lower))
        )
      );
    });
  });
}

function searchHistory(query) {
  return new Promise((resolve) => {
    const startTime = Date.now() - 1000 * 60 * 60 * 24 * 30; // last 30 days
    chrome.history.search(
      { text: query, startTime, maxResults: 30 },
      (results) => {
        resolve(results.filter((h) => h.url));
      }
    );
  });
}

// Escape HTML for safe rendering
function escapeHTML(str) {
  let s = str;
  s = s.replace(/&/g, "\u0026amp;");
  s = s.replace(/</g, "\u0026lt;");
  s = s.replace(/>/g, "\u0026gt;");
  s = s.replace(/"/g, "\u0026quot;");
  return s;
}
