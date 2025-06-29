// Import session manager utilities
importScripts("session-manager.js");

// Initialize managers
const sessionManager = new SessionManager();
const tabManager = TabManager;
const bookmarkManager = BookmarkManager;
const fuzzySearch = FuzzySearch;
const searchFilters = SearchFilters;

chrome.action.onClicked.addListener(async (tab) => {
  // Open the sidebar panel
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

// Enable the side panel on all tabs
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url) return;
  await chrome.sidePanel.setOptions({
    tabId,
    path: "sidebar.html",
    enabled: true,
  });
});

// Handle auto-backup alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sessionAutoBackup") {
    sessionManager.autoBackup();
  }
});

// Auto-pin rules on tab creation
chrome.tabs.onCreated.addListener(async (tab) => {
  // Get auto-pin rules from storage
  const result = await chrome.storage.sync.get(["autoPinRules"]);
  const rules = result.autoPinRules || [];

  if (rules.length > 0) {
    // Small delay to ensure tab is fully loaded
    setTimeout(() => {
      tabManager.autoPinTabs(rules);
    }, 1000);
  }
});

// Handle search requests from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SEARCH_BOOKMARKS") {
    chrome.bookmarks.search(msg.query, (results) => sendResponse(results));
    return true;
  }

  if (msg.type === "SEARCH_TABS") {
    chrome.tabs.query({}, (tabs) => {
      let filtered = tabs;

      // Apply fuzzy search if enabled
      if (msg.fuzzy) {
        filtered = fuzzySearch.search(msg.query, tabs, ["title", "url"]);
      } else {
        const lower = msg.query.toLowerCase();
        filtered = tabs.filter(
          (tab) =>
            (tab.title && tab.title.toLowerCase().includes(lower)) ||
            (tab.url && tab.url.toLowerCase().includes(lower))
        );
      }

      // Apply filters if provided
      if (msg.filters) {
        filtered = searchFilters.applyFilters(filtered, msg.filters);
      }

      // Apply sorting
      if (msg.sort) {
        filtered = sortResults(filtered, msg.sort);
      }

      sendResponse(filtered);
    });
    return true;
  }

  if (msg.type === "SEARCH_HISTORY") {
    const startTime = Date.now() - 1000 * 60 * 60 * 24 * 30;
    chrome.history.search(
      { text: msg.query, startTime, maxResults: 30 },
      (results) => {
        let filtered = results;

        // Apply fuzzy search if enabled
        if (msg.fuzzy) {
          filtered = fuzzySearch.search(msg.query, results, ["title", "url"]);
        }

        // Apply filters if provided
        if (msg.filters) {
          filtered = searchFilters.applyFilters(filtered, msg.filters);
        }

        sendResponse(filtered);
      }
    );
    return true;
  }

  // Session management
  if (msg.type === "SAVE_SESSION") {
    sessionManager.saveSession(msg.name, msg.tabs).then(sendResponse);
    return true;
  }

  if (msg.type === "SAVE_SELECTED_SESSION") {
    sessionManager.saveSelectedSession(msg.name, msg.tabIds).then(sendResponse);
    return true;
  }

  if (msg.type === "GET_SESSIONS") {
    sessionManager.getSessions().then(sendResponse);
    return true;
  }

  if (msg.type === "RESTORE_SESSION") {
    sessionManager
      .restoreSession(msg.sessionId, msg.inNewWindow)
      .then(sendResponse);
    return true;
  }

  if (msg.type === "DELETE_SESSION") {
    sessionManager.deleteSession(msg.sessionId).then(sendResponse);
    return true;
  }

  // Tab management
  if (msg.type === "BULK_CLOSE_TABS") {
    tabManager.bulkCloseTabs(msg.tabIds).then(sendResponse);
    return true;
  }

  if (msg.type === "BULK_PIN_TABS") {
    tabManager.bulkPinTabs(msg.tabIds, msg.pinned).then(sendResponse);
    return true;
  }

  if (msg.type === "BULK_DUPLICATE_TABS") {
    tabManager.bulkDuplicateTabs(msg.tabIds).then(sendResponse);
    return true;
  }

  if (msg.type === "BULK_MOVE_TABS") {
    tabManager.bulkMoveToWindow(msg.tabIds, msg.windowId).then(sendResponse);
    return true;
  }

  if (msg.type === "COPY_TAB_URLS") {
    tabManager.copyTabUrls(msg.tabIds).then(sendResponse);
    return true;
  }

  if (msg.type === "GET_INACTIVE_TABS") {
    tabManager.getInactiveTabs(msg.thresholdMinutes).then(sendResponse);
    return true;
  }

  if (msg.type === "GROUP_TABS_BY_DOMAIN") {
    tabManager.groupTabsByDomain().then(sendResponse);
    return true;
  }

  // Bookmark management
  if (msg.type === "BULK_CREATE_BOOKMARKS") {
    bookmarkManager
      .bulkCreateBookmarks(msg.tabs, msg.folderId)
      .then(sendResponse);
    return true;
  }

  if (msg.type === "GET_BOOKMARK_FOLDERS") {
    bookmarkManager.getFolderStructure().then(sendResponse);
    return true;
  }

  if (msg.type === "GET_BOOKMARK_THUMBNAIL") {
    bookmarkManager.getBookmarkThumbnail(msg.url).then(sendResponse);
    return true;
  }
});

// Helper function to sort results
function sortResults(items, sortType) {
  switch (sortType) {
    case "alphabetical":
      return items.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    case "domain":
      return items.sort((a, b) => {
        try {
          const domainA = new URL(a.url || "").hostname;
          const domainB = new URL(b.url || "").hostname;
          return domainA.localeCompare(domainB);
        } catch {
          return 0;
        }
      });
    case "lastAccessed":
      return items.sort(
        (a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0)
      );
    case "created":
      return items.sort((a, b) => (b.created || 0) - (a.created || 0));
    default:
      return items;
  }
}
