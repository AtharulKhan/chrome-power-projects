// Session Management System
class SessionManager {
  constructor() {
    this.storageKey = "chrome_extension_sessions";
    this.autoBackupKey = "auto_backup_sessions";
    this.settingsKey = "session_settings";
    this.init();
  }

  async init() {
    // Set up auto-backup if enabled
    const settings = await this.getSettings();
    if (settings.autoBackup) {
      this.setupAutoBackup();
    }
  }

  // Get all saved sessions
  async getSessions() {
    const result = await chrome.storage.local.get([this.storageKey]);
    return result[this.storageKey] || {};
  }

  // Save a new session
  async saveSession(name, tabs = null) {
    if (!tabs) {
      tabs = await chrome.tabs.query({});
    }

    const sessions = await this.getSessions();
    const sessionData = {
      id: Date.now().toString(),
      name: name,
      tabs: tabs.map((tab) => ({
        url: tab.url,
        title: tab.title,
        pinned: tab.pinned,
        muted: tab.mutedInfo?.muted || false,
        groupId: tab.groupId,
        windowId: tab.windowId,
        index: tab.index,
        favIconUrl: tab.favIconUrl,
      })),
      created: Date.now(),
      lastAccessed: Date.now(),
      tabCount: tabs.length,
    };

    sessions[sessionData.id] = sessionData;
    await chrome.storage.local.set({ [this.storageKey]: sessions });
    return sessionData;
  }

  // Save selected tabs as session
  async saveSelectedSession(name, tabIds) {
    const allTabs = await chrome.tabs.query({});
    const selectedTabs = allTabs.filter((tab) => tabIds.includes(tab.id));

    return this.saveSession(name, selectedTabs);
  }

  // Restore a session
  async restoreSession(sessionId, inNewWindow = true) {
    const sessions = await this.getSessions();
    const session = sessions[sessionId];

    if (!session) {
      throw new Error("Session not found");
    }

    // Update last accessed time
    session.lastAccessed = Date.now();
    sessions[sessionId] = session;
    await chrome.storage.local.set({ [this.storageKey]: sessions });

    let createdTabs = [];

    if (inNewWindow) {
      // Create new window with first tab
      const firstTab = session.tabs[0];
      if (firstTab) {
        const window = await chrome.windows.create({
          url: firstTab.url,
          focused: true,
        });

        // Get the first tab that was created with the window
        const windowTabs = await chrome.tabs.query({ windowId: window.id });
        createdTabs.push(windowTabs[0]);

        // Open remaining tabs in the new window (not pinned)
        for (let i = 1; i < session.tabs.length; i++) {
          const tab = session.tabs[i];
          const newTab = await chrome.tabs.create({
            windowId: window.id,
            url: tab.url,
            pinned: false, // Don't pin tabs
            index: i, // Maintain order
          });
          createdTabs.push(newTab);
        }
      }
    } else {
      // Open tabs in current window (not pinned)
      for (const tab of session.tabs) {
        const newTab = await chrome.tabs.create({
          url: tab.url,
          pinned: false, // Don't pin tabs
        });
        createdTabs.push(newTab);
      }
    }

    // Create a tab group for the restored session
    if (createdTabs.length > 0) {
      try {
        // Group all the created tabs
        const tabIds = createdTabs.map((tab) => tab.id);
        const group = await chrome.tabs.group({ tabIds });

        // Set group title and color
        await chrome.tabGroups.update(group, {
          title: session.name,
          color: this.getRandomGroupColor(),
        });
      } catch (error) {
        console.log("Tab grouping not supported or failed:", error);
        // Fallback: tabs will remain ungrouped but not pinned
      }
    }

    return session;
  }

  // Get a random color for tab groups
  getRandomGroupColor() {
    const colors = [
      "grey",
      "blue",
      "red",
      "yellow",
      "green",
      "pink",
      "purple",
      "cyan",
      "orange",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Delete a session
  async deleteSession(sessionId) {
    const sessions = await this.getSessions();
    delete sessions[sessionId];
    await chrome.storage.local.set({ [this.storageKey]: sessions });
  }

  // Rename a session
  async renameSession(sessionId, newName) {
    const sessions = await this.getSessions();
    if (sessions[sessionId]) {
      sessions[sessionId].name = newName;
      await chrome.storage.local.set({ [this.storageKey]: sessions });
    }
  }

  // Auto-backup current session
  async autoBackup() {
    const tabs = await chrome.tabs.query({});
    const backupData = {
      tabs: tabs.map((tab) => ({
        url: tab.url,
        title: tab.title,
        pinned: tab.pinned,
        muted: tab.mutedInfo?.muted || false,
        groupId: tab.groupId,
        windowId: tab.windowId,
        index: tab.index,
      })),
      timestamp: Date.now(),
    };

    const result = await chrome.storage.local.get([this.autoBackupKey]);
    const backups = result[this.autoBackupKey] || [];

    // Keep only last 10 backups
    backups.push(backupData);
    if (backups.length > 10) {
      backups.shift();
    }

    await chrome.storage.local.set({ [this.autoBackupKey]: backups });
  }

  // Get auto-backup sessions
  async getAutoBackups() {
    const result = await chrome.storage.local.get([this.autoBackupKey]);
    return result[this.autoBackupKey] || [];
  }

  // Setup auto-backup alarm
  setupAutoBackup() {
    chrome.alarms.create("sessionAutoBackup", { periodInMinutes: 30 });
  }

  // Get session settings
  async getSettings() {
    const result = await chrome.storage.sync.get([this.settingsKey]);
    return (
      result[this.settingsKey] || {
        autoBackup: true,
        backupInterval: 30,
        maxBackups: 10,
      }
    );
  }

  // Update session settings
  async updateSettings(settings) {
    await chrome.storage.sync.set({ [this.settingsKey]: settings });
    if (settings.autoBackup) {
      this.setupAutoBackup();
    } else {
      chrome.alarms.clear("sessionAutoBackup");
    }
  }

  // Export session data
  async exportSessions() {
    const sessions = await this.getSessions();
    return JSON.stringify(sessions, null, 2);
  }

  // Import session data
  async importSessions(jsonData) {
    try {
      const importedSessions = JSON.parse(jsonData);
      const existingSessions = await this.getSessions();

      // Merge with existing sessions
      const mergedSessions = { ...existingSessions, ...importedSessions };
      await chrome.storage.local.set({ [this.storageKey]: mergedSessions });

      return Object.keys(importedSessions).length;
    } catch (error) {
      throw new Error("Invalid session data format");
    }
  }
}

// Fuzzy search implementation
class FuzzySearch {
  static search(query, items, keys = ["title", "url"]) {
    if (!query) return items;

    const queryLower = query.toLowerCase();
    const results = [];

    for (const item of items) {
      let score = 0;
      let matchFound = false;

      for (const key of keys) {
        const text = item[key] || "";
        const textLower = text.toLowerCase();

        // Exact match gets highest score
        if (textLower.includes(queryLower)) {
          score += 100;
          matchFound = true;
        }

        // Fuzzy match
        const fuzzyScore = this.fuzzyMatch(queryLower, textLower);
        if (fuzzyScore > 0) {
          score += fuzzyScore;
          matchFound = true;
        }
      }

      if (matchFound) {
        results.push({ ...item, _score: score });
      }
    }

    // Sort by score (highest first)
    return results.sort((a, b) => b._score - a._score);
  }

  static fuzzyMatch(pattern, text) {
    let score = 0;
    let patternIdx = 0;
    let textIdx = 0;

    while (patternIdx < pattern.length && textIdx < text.length) {
      if (pattern[patternIdx] === text[textIdx]) {
        score += 1;
        patternIdx++;
      }
      textIdx++;
    }

    // Return score only if all pattern characters were found
    return patternIdx === pattern.length ? score : 0;
  }
}

// Advanced search filters
class SearchFilters {
  static parseQuery(query) {
    const filters = {
      site: null,
      title: null,
      date: null,
      type: null,
      text: query,
    };

    // Parse operators like site:example.com, title:keyword, date:today
    const operatorRegex = /(\w+):([^\s]+)/g;
    let match;

    while ((match = operatorRegex.exec(query)) !== null) {
      const [fullMatch, operator, value] = match;
      filters[operator] = value;
      filters.text = filters.text.replace(fullMatch, "").trim();
    }

    return filters;
  }

  static applyFilters(items, filters) {
    return items.filter((item) => {
      // Site filter
      if (filters.site) {
        try {
          const itemDomain = new URL(item.url || "").hostname;
          if (!itemDomain.includes(filters.site)) return false;
        } catch {
          return false;
        }
      }

      // Title filter
      if (filters.title) {
        const title = (item.title || "").toLowerCase();
        if (!title.includes(filters.title.toLowerCase())) return false;
      }

      // Date filter
      if (filters.date) {
        const itemDate = new Date(item.lastVisitTime || item.lastAccessed || 0);
        const today = new Date();

        switch (filters.date) {
          case "today":
            if (itemDate.toDateString() !== today.toDateString()) return false;
            break;
          case "week":
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (itemDate < weekAgo) return false;
            break;
          case "month":
            const monthAgo = new Date(
              today.getTime() - 30 * 24 * 60 * 60 * 1000
            );
            if (itemDate < monthAgo) return false;
            break;
        }
      }

      // Type filter
      if (filters.type) {
        if (
          item.type &&
          item.type.toLowerCase() !== filters.type.toLowerCase()
        ) {
          return false;
        }
      }

      return true;
    });
  }
}

// Tab management utilities
class TabManager {
  // Group tabs by domain
  static async groupTabsByDomain() {
    const tabs = await chrome.tabs.query({});
    const domainGroups = {};

    tabs.forEach((tab) => {
      try {
        const domain = new URL(tab.url).hostname.replace(/^www\./, "");
        if (!domainGroups[domain]) {
          domainGroups[domain] = [];
        }
        domainGroups[domain].push(tab);
      } catch {
        // Invalid URL, skip
      }
    });

    return domainGroups;
  }

  // Auto-pin tabs based on rules
  static async autoPinTabs(rules) {
    const tabs = await chrome.tabs.query({});

    for (const tab of tabs) {
      for (const rule of rules) {
        if (this.matchesRule(tab, rule) && !tab.pinned) {
          await chrome.tabs.update(tab.id, { pinned: true });
          break;
        }
      }
    }
  }

  // Check if tab matches auto-pin rule
  static matchesRule(tab, rule) {
    switch (rule.type) {
      case "domain":
        try {
          const domain = new URL(tab.url).hostname;
          return rule.patterns.some((pattern) => domain.includes(pattern));
        } catch {
          return false;
        }
      case "title":
        return rule.patterns.some((pattern) =>
          (tab.title || "").toLowerCase().includes(pattern.toLowerCase())
        );
      case "url":
        return rule.patterns.some((pattern) =>
          (tab.url || "").toLowerCase().includes(pattern.toLowerCase())
        );
      default:
        return false;
    }
  }

  // Get inactive tabs
  static async getInactiveTabs(thresholdMinutes = 60) {
    const tabs = await chrome.tabs.query({});
    const threshold = Date.now() - thresholdMinutes * 60 * 1000;

    return tabs.filter(
      (tab) =>
        tab.lastAccessed &&
        tab.lastAccessed < threshold &&
        !tab.active &&
        !tab.pinned
    );
  }

  // Bulk operations
  static async bulkCloseTabs(tabIds) {
    await chrome.tabs.remove(tabIds);
  }

  static async bulkPinTabs(tabIds, pinned = true) {
    for (const tabId of tabIds) {
      await chrome.tabs.update(tabId, { pinned });
    }
  }

  static async bulkDuplicateTabs(tabIds) {
    const duplicatedTabs = [];
    for (const tabId of tabIds) {
      const tab = await chrome.tabs.get(tabId);
      const duplicated = await chrome.tabs.create({ url: tab.url });
      duplicatedTabs.push(duplicated);
    }
    return duplicatedTabs;
  }

  static async bulkMoveToWindow(tabIds, windowId) {
    await chrome.tabs.move(tabIds, { windowId, index: -1 });
  }

  // Copy URLs
  static async copyTabUrls(tabIds) {
    const tabs = await Promise.all(tabIds.map((id) => chrome.tabs.get(id)));
    const urls = tabs.map((tab) => tab.url).join("\n");

    // Copy to clipboard using the content script
    const activeTab = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (activeTab[0]) {
      await chrome.tabs.sendMessage(activeTab[0].id, {
        type: "COPY_TO_CLIPBOARD",
        text: urls,
      });
    }

    return urls;
  }
}

// Bookmark utilities
class BookmarkManager {
  // Get bookmark thumbnails (using favicon or screenshot)
  static async getBookmarkThumbnail(url) {
    try {
      // Try to get favicon first
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${
        new URL(url).hostname
      }&sz=32`;
      return faviconUrl;
    } catch {
      return null;
    }
  }

  // Bulk bookmark creation
  static async bulkCreateBookmarks(tabs, folderId = null) {
    const bookmarks = [];

    for (const tab of tabs) {
      const bookmark = await chrome.bookmarks.create({
        parentId: folderId || "1", // Default to bookmarks bar
        title: tab.title || tab.url,
        url: tab.url,
      });
      bookmarks.push(bookmark);
    }

    return bookmarks;
  }

  // Get bookmark folder structure
  static async getFolderStructure() {
    const tree = await chrome.bookmarks.getTree();
    return this.flattenBookmarkTree(tree[0]);
  }

  static flattenBookmarkTree(node, depth = 0) {
    const folders = [];

    if (node.children) {
      for (const child of node.children) {
        if (!child.url) {
          // It's a folder
          folders.push({
            id: child.id,
            title: child.title,
            depth: depth,
            path: this.getBookmarkPath(child),
          });
          folders.push(...this.flattenBookmarkTree(child, depth + 1));
        }
      }
    }

    return folders;
  }

  static getBookmarkPath(node) {
    const path = [];
    let current = node;

    while (current && current.title && current.parentId !== "0") {
      path.unshift(current.title);
      // This would need to be implemented with parent lookup
      break; // Simplified for now
    }

    return path.join(" / ");
  }
}

// Export classes for use in other files
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SessionManager,
    FuzzySearch,
    SearchFilters,
    TabManager,
    BookmarkManager,
  };
}
