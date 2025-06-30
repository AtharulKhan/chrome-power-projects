// Power-Project Sidebar JavaScript
class PowerProjectSidebar {
  constructor() {
    this.tabs = [];
    this.groups = [];
    this.recentlyClosed = [];
    this.bookmarks = [];
    this.savedGroups = [];
    this.searchQuery = "";
    this.sortType = "default";
    this.collapsedSections = new Set();
    this.collapsedGroups = new Set();
    this.searchResults = { tabs: [], bookmarks: [], groups: [] };
    this.selectedTabs = new Set();
    this.selectionMode = false;
    this.refreshTimeout = null;
    this.collapsedWindows = new Set();
    this.isRefreshing = false;
    this.lastRefreshTime = 0;
    this.minRefreshInterval = 1000; // Minimum 1 second between refreshes
    this.collapsedSavedGroups = new Set(); // Track collapsed saved groups
    this.currentWindowId = null; // Track current active window
    this.projects = []; // Store projects
    this.activeProjectId = null; // Track active project
    this.activeTabSection = "groups"; // Track active tab section
    this.projectsMinimized = false; // Track projects bar state
    this.savedGroupsSearchQuery = ""; // Track saved groups search
    this.projectsSearchQuery = ""; // Track projects search
    this.projectsSearchVisible = false; // Track projects search visibility
    this.projectsModalSearchQuery = ""; // Track projects modal search

    // Search filters
    this.searchFilters = {
      tabs: true,
      bookmarks: true,
      groups: true,
      projects: true,
    };

    this.init();
  }

  clearSearch() {
    document.getElementById("search-results-section").style.display = "none";
    // Show the tab navigation when not searching
    document.querySelector(".tab-navigation").style.display = "flex";
    // Show the active tab panel
    this.showActiveTabPanel();
  }

  showActiveTabPanel() {
    // Hide all panels
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.remove("active");
    });

    // Show active panel
    const activePanel = document.getElementById(
      `${this.activeTabSection}-section`
    );
    if (activePanel) {
      activePanel.classList.add("active");
    }
  }

  async init() {
    await this.loadTabs();
    await this.loadGroups();
    await this.loadBookmarks();
    await this.loadSavedGroups();
    await this.loadProjects();
    await this.getCurrentWindow();
    this.setupEventListeners();
    this.render();
    this.updateTabCount();
    this.renderProjects();
    this.startAutoRefresh();

    // Auto-focus the search input when sidebar opens
    setTimeout(() => {
      const searchInput = document.getElementById("search-input");
      if (searchInput) {
        searchInput.focus();
      }
    }, 100);
  }

  async loadTabs() {
    try {
      this.tabs = await chrome.tabs.query({});
      // Get current active tab
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      this.activeTabId = activeTab?.id;
    } catch (error) {
      console.error("Error loading tabs:", error);
    }
  }

  async loadGroups() {
    try {
      this.groups = await chrome.tabGroups.query({});
      // Make all groups collapsed by default
      this.groups.forEach((group) => {
        this.collapsedGroups.add(group.id);
      });
    } catch (error) {
      console.error("Error loading groups:", error);
    }
  }

  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll(".tab-nav-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const section = e.target.dataset.section;
        this.switchTabSection(section);
      });
    });

    // Projects minimize button
    document
      .getElementById("minimize-projects")
      .addEventListener("click", () => {
        this.toggleProjectsBar();
      });

    // Search functionality
    const searchInput = document.getElementById("search-input");
    const clearSearch = document.getElementById("clear-search");

    searchInput.addEventListener("input", (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      clearSearch.style.display = this.searchQuery ? "block" : "none";

      if (this.searchQuery) {
        this.performSearch(this.searchQuery);
        document.getElementById("search-results-section").style.display =
          "block";
        // Hide tab navigation when searching
        document.querySelector(".tab-navigation").style.display = "none";
        // Hide all tab panels
        document.querySelectorAll(".tab-panel").forEach((panel) => {
          panel.classList.remove("active");
        });
      } else {
        this.clearSearch();
      }
    });

    clearSearch.addEventListener("click", () => {
      searchInput.value = "";
      this.searchQuery = "";
      clearSearch.style.display = "none";
      this.clearSearch();
    });

    // Sort functionality
    const sortSelect = document.getElementById("sort-tabs");
    sortSelect.addEventListener("change", (e) => {
      this.sortType = e.target.value;
      this.filterAndRender();
    });

    // Quick actions - now in header
    document
      .getElementById("suspend-inactive")
      .addEventListener("click", () => {
        this.suspendInactiveTabs();
      });

    document.getElementById("group-by-domain").addEventListener("click", () => {
      this.groupTabsByDomain();
    });

    document.getElementById("new-group-btn").addEventListener("click", () => {
      this.createNewGroup();
    });

    // Settings dropdown functionality
    document
      .getElementById("settings-dropdown-btn")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleSettingsDropdown();
      });

    // Settings export/import via dropdown
    document.getElementById("export-data-btn").addEventListener("click", () => {
      this.exportAllData();
      this.hideSettingsDropdown();
    });

    document.getElementById("import-data-btn").addEventListener("click", () => {
      document.getElementById("import-data-file").click();
      this.hideSettingsDropdown();
    });

    document
      .getElementById("import-data-file")
      .addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          this.importAllData(file);
          e.target.value = ""; // Reset file input
        }
      });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".settings-dropdown-container")) {
        this.hideSettingsDropdown();
      }
    });

    // Backup functionality in projects modal
    document
      .getElementById("export-backup-btn")
      .addEventListener("click", () => {
        this.exportAllData();
      });

    document
      .getElementById("import-backup-btn")
      .addEventListener("click", () => {
        document.getElementById("import-backup-file").click();
      });

    document
      .getElementById("import-backup-file")
      .addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          this.importAllData(file);
          e.target.value = ""; // Reset file input
        }
      });

    // Selection controls
    document
      .getElementById("suspend-selected")
      .addEventListener("click", () => {
        this.suspendSelectedTabs();
      });

    document.getElementById("close-selected").addEventListener("click", () => {
      this.closeSelectedTabs();
    });

    document
      .getElementById("cancel-selection")
      .addEventListener("click", () => {
        this.exitSelectionMode();
      });

    // Event delegation for dynamically created elements
    document.addEventListener("click", (e) => {
      // Hide context menu on any click
      this.hideContextMenu();

      const target = e.target;
      const tabItem = target.closest(".tab-item");
      const button = target.closest("button");

      // Handle tab actions
      if (button && tabItem) {
        e.preventDefault();
        e.stopPropagation();
        const tabId = parseInt(tabItem.dataset.tabId);

        if (button.title === "Add to Project") {
          this.addTabToProject(tabId);
        } else if (button.title === "Open in New Window") {
          this.openTabInNewWindow(tabId);
        } else if (button.title === "Pin Tab") {
          this.pinTab(tabId);
        } else if (button.title === "Unpin Tab") {
          this.unpinTab(tabId);
        } else if (button.title === "Duplicate Tab") {
          this.duplicateTab(tabId);
        } else if (button.title === "Close Tab") {
          this.closeTab(tabId);
        } else if (button.title === "Restore Tab") {
          const sessionId = tabItem.dataset.sessionId;
          this.restoreTab(sessionId);
        }
      }

      // Handle group headers and actions
      const groupHeader = target.closest(".group-header");
      if (groupHeader) {
        const groupId = parseInt(
          groupHeader.closest(".tab-group").dataset.groupId
        );

        if (target.closest(".group-title")) {
          e.preventDefault();
          this.toggleGroupCollapse(groupId);
        } else if (button) {
          e.preventDefault();
          e.stopPropagation();
          if (button.title === "Add to Project") {
            this.addTabGroupToProject(groupId);
          } else if (button.title === "Update in Project") {
            this.showUpdateProjectModal(groupId);
          } else if (button.title === "Save Group") {
            this.saveCurrentGroupWithTags(groupId);
          } else if (button.title === "Close Group") {
            this.closeGroup(groupId);
          }
        }
      }

      // Handle window collapse
      const windowHeader = target.closest(".window-header");
      if (windowHeader) {
        e.preventDefault();
        const windowSection = windowHeader.closest(".window-section");
        if (windowSection) {
          const windowId = parseInt(windowSection.dataset.windowId);
          this.toggleWindowCollapse(windowId);
        }
      }

      // Handle tab info clicks
      const tabInfo = target.closest(".tab-info");
      if (tabInfo && tabItem) {
        e.preventDefault();
        const tabId = parseInt(tabItem.dataset.tabId);
        if (tabId) {
          // Check if we're in search results - if so, open in new tab instead of switching
          const isInSearchResults = target.closest("#search-results-section");
          if (isInSearchResults) {
            // Find the tab and create a new tab with its URL
            const tab = this.tabs.find((t) => t.id === tabId);
            if (tab) {
              chrome.tabs.create({ url: tab.url });
            }
          } else {
            this.switchToTab(tabId);
          }
        }
      }

      // Handle saved group headers and actions (mirroring tab groups pattern)
      const savedGroupHeader = target.closest(".saved-group-header");
      if (savedGroupHeader) {
        const savedGroupId =
          savedGroupHeader.closest(".saved-group").dataset.savedGroupId;

        if (target.closest(".saved-group-title")) {
          e.preventDefault();
          this.toggleSavedGroupCollapse(savedGroupId);
        } else if (button) {
          e.preventDefault();
          e.stopPropagation();
          if (button.title === "Add to Project") {
            this.addSavedGroupToProject(savedGroupId);
          } else if (button.title === "Edit Group Name") {
            this.editSavedGroupName(savedGroupId);
          } else if (button.title === "Restore in Current Window") {
            this.restoreSavedGroup(savedGroupId, false);
          } else if (button.title === "Restore in New Window") {
            this.restoreSavedGroup(savedGroupId, true);
          } else if (button.title === "Delete Saved Group") {
            this.deleteSavedGroup(savedGroupId);
          }
        }
      }

      // Handle saved tab clicks
      const savedTabItem = target.closest(".saved-tab-item");
      if (savedTabItem && !button) {
        e.preventDefault();
        const tabUrl = savedTabItem.dataset.tabUrl;
        if (tabUrl) {
          this.openSavedTabInCurrentWindow(tabUrl);
        }
      }

      // Handle bookmark clicks
      const bookmarkItem = target.closest(".bookmark-item");
      if (bookmarkItem) {
        const url = bookmarkItem.dataset.bookmarkUrl;
        if (button && button.title === "Open in Current Tab") {
          e.preventDefault();
          e.stopPropagation();
          this.openBookmark(url, false);
        } else if (button && button.title === "Open in Popup Window") {
          e.preventDefault();
          e.stopPropagation();
          this.openInPopupWindow(url);
        } else if (!button && target.closest(".tab-info")) {
          e.preventDefault();
          // Check if we're in search results - if so, open in new tab instead of current tab
          const isInSearchResults = target.closest("#search-results-section");
          if (isInSearchResults) {
            this.openBookmark(url, true); // Open in new tab
          } else {
            this.openBookmark(url); // Open in current tab (default behavior)
          }
        }
      }

      // Handle Google search clicks
      const googleSearchOption = target.closest(".google-search-option");
      if (googleSearchOption) {
        e.preventDefault();
        e.stopPropagation();
        const query = googleSearchOption.dataset.searchQuery;
        if (query) {
          this.searchOnGoogle(query);
        }
      }
    });

    // Event delegation for search filter checkboxes
    document.addEventListener("change", (e) => {
      if (e.target.id && e.target.id.startsWith("filter-")) {
        const filterType = e.target.id.replace("filter-", "");
        if (this.searchFilters.hasOwnProperty(filterType)) {
          this.searchFilters[filterType] = e.target.checked;
          // Re-render search results with updated filters
          if (this.searchQuery) {
            this.renderSearchResults();
          }
        }
      }
    });

    // Context menu
    document.addEventListener("contextmenu", (e) => {
      if (e.target.closest(".tab-item")) {
        e.preventDefault();
        this.showContextMenu(e, e.target.closest(".tab-item"));
      } else if (e.target.closest(".saved-group")) {
        e.preventDefault();
        this.showSavedGroupContextMenu(e, e.target.closest(".saved-group"));
      }
    });

    // Chrome API listeners - only update active tab, no auto-refresh
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.activeTabId = activeInfo.tabId;
      this.updateActiveTab();
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      // Ctrl+K - Focus search bar
      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        document.getElementById("search-input").focus();
      }

      // Alt+K - Suspend all tabs
      if (e.altKey && e.key === "k") {
        e.preventDefault();
        this.suspendInactiveTabs();
      }

      // Alt+P - Open projects modal
      if (e.altKey && e.key === "p") {
        e.preventDefault();
        this.openProjectsManager();
      }
    });

    // Listen for messages from background script (global keyboard shortcuts)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "FOCUS_SEARCH") {
        document.getElementById("search-input").focus();
      } else if (message.type === "OPEN_PROJECTS") {
        this.openProjectsManager();
      }
    });

    // Keyboard shortcuts modal
    document
      .getElementById("keyboard-shortcuts-btn")
      .addEventListener("click", () => {
        document.getElementById("keyboard-shortcuts-modal").style.display =
          "flex";
      });

    document
      .getElementById("close-keyboard-shortcuts-modal")
      .addEventListener("click", () => {
        document.getElementById("keyboard-shortcuts-modal").style.display =
          "none";
      });

    // Projects functionality
    document
      .getElementById("search-projects-btn")
      .addEventListener("click", () => {
        this.toggleProjectSearch();
      });

    // Projects search input
    document
      .getElementById("projects-search")
      .addEventListener("input", (e) => {
        this.projectsSearchQuery = e.target.value.toLowerCase();
        this.renderProjects();
      });

    // Saved groups search input
    document
      .getElementById("saved-groups-search")
      .addEventListener("input", (e) => {
        this.savedGroupsSearchQuery = e.target.value.toLowerCase();
        this.renderSavedGroups();
      });

    document
      .getElementById("save-project-btn")
      .addEventListener("click", () => {
        this.saveCurrentWindowAsProject();
      });

    document
      .getElementById("manage-projects-btn")
      .addEventListener("click", () => {
        this.openProjectsManager();
      });

    // Event delegation for project items
    document.getElementById("projects-list").addEventListener("click", (e) => {
      const projectItem = e.target.closest(".project-item");
      if (projectItem) {
        const projectId = projectItem.dataset.projectId;
        this.switchToProject(projectId);
      }
    });

    // Event delegation for project tabs in search results
    document.addEventListener("click", (e) => {
      const projectTabItem = e.target.closest(".project-tab-item");
      if (projectTabItem && e.target.closest("#search-results-section")) {
        e.preventDefault();
        const tabUrl = projectTabItem.dataset.tabUrl;
        if (tabUrl) {
          chrome.tabs.create({ url: tabUrl });
        }
      }
    });

    // Right-click context menu for projects
    document
      .getElementById("projects-list")
      .addEventListener("contextmenu", (e) => {
        const projectItem = e.target.closest(".project-item");
        if (projectItem) {
          e.preventDefault();
          const projectId = projectItem.dataset.projectId;
          this.editProject(projectId);
        }
      });

    // Projects modal search
    document
      .getElementById("projects-modal-search")
      .addEventListener("input", (e) => {
        this.projectsModalSearchQuery = e.target.value.toLowerCase();
        this.renderProjectsModal();
      });

    // Modal event listeners
    document
      .getElementById("close-projects-modal")
      .addEventListener("click", () => {
        this.closeModals();
      });

    document
      .getElementById("close-new-project-modal")
      .addEventListener("click", () => {
        this.closeModals();
      });

    document
      .getElementById("new-project-modal-btn")
      .addEventListener("click", () => {
        this.openNewProjectModal();
      });

    document
      .getElementById("cancel-new-project")
      .addEventListener("click", () => {
        this.closeModals();
      });

    // Don't add a click listener here - it will be set dynamically
    // based on whether we're creating or editing a project

    // Add to Project Modal event listeners
    document
      .getElementById("close-add-to-project-modal")
      .addEventListener("click", () => {
        this.closeAddToProjectModal();
      });

    document
      .getElementById("add-to-existing-project")
      .addEventListener("click", () => {
        this.showExistingProjectSelection();
      });

    document
      .getElementById("create-new-project-for-add")
      .addEventListener("click", () => {
        this.showNewProjectCreation();
      });

    document
      .getElementById("cancel-add-to-project")
      .addEventListener("click", () => {
        this.closeAddToProjectModal();
      });

    document
      .getElementById("confirm-add-to-project")
      .addEventListener("click", () => {
        this.confirmAddToProject();
      });

    document
      .getElementById("cancel-create-project-add")
      .addEventListener("click", () => {
        this.closeAddToProjectModal();
      });

    document
      .getElementById("confirm-create-project-add")
      .addEventListener("click", () => {
        this.confirmCreateAndAddToProject();
      });

    // Close modals when clicking outside
    document.querySelectorAll(".modal-overlay").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          this.closeModals();
        }
      });
    });

    // Event delegation for project modal buttons
    document
      .getElementById("projects-list-modal")
      .addEventListener("click", (e) => {
        const button = e.target.closest("button");
        if (!button) return;

        const projectCard = button.closest(".project-card");
        if (!projectCard) return;

        const projectId = projectCard.dataset.projectId;
        if (!projectId) return;

        if (button.title === "Edit Project") {
          this.editProject(projectId);
        } else if (button.title === "Open Project") {
          this.openProjectFromModal(projectId);
        } else if (button.title === "Delete Project") {
          this.confirmDeleteProject(projectId);
        }
      });
  }

  switchTabSection(section) {
    // Update active button
    document.querySelectorAll(".tab-nav-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
    document
      .querySelector(`[data-section="${section}"]`)
      .classList.add("active");

    // Update active panel
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.remove("active");
    });
    document.getElementById(`${section}-section`).classList.add("active");

    // Save active section
    this.activeTabSection = section;
  }

  toggleProjectsBar() {
    const projectsBar = document.querySelector(".projects-bar");
    this.projectsMinimized = !this.projectsMinimized;

    if (this.projectsMinimized) {
      projectsBar.classList.add("minimized");
    } else {
      projectsBar.classList.remove("minimized");
    }
  }

  debouncedRefresh() {
    // Prevent rapid refreshes
    const now = Date.now();
    if (now - this.lastRefreshTime < this.minRefreshInterval) {
      return;
    }

    // Clear existing timeout
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    // Set new timeout
    this.refreshTimeout = setTimeout(() => {
      if (!this.isRefreshing) {
        this.refresh();
      }
    }, 500); // Increased delay to 500ms
  }

  async refresh() {
    if (this.isRefreshing) return;

    this.isRefreshing = true;
    this.lastRefreshTime = Date.now();

    try {
      // Save current UI state before refresh
      const savedCollapsedGroups = new Set(this.collapsedGroups);
      const savedCollapsedWindows = new Set(this.collapsedWindows);

      await this.loadTabs();
      await this.loadGroups();

      // Restore UI state
      this.collapsedGroups = savedCollapsedGroups;
      this.collapsedWindows = savedCollapsedWindows;

      this.render();
      this.updateTabCount();
    } finally {
      this.isRefreshing = false;
    }
  }

  updateTabCount() {
    const badge = document.getElementById("tab-count");
    badge.textContent = this.tabs.length;
  }

  updateActiveTab() {
    document.querySelectorAll(".tab-item").forEach((item) => {
      item.classList.remove("active");
    });

    const activeItem = document.querySelector(
      `[data-tab-id="${this.activeTabId}"]`
    );
    if (activeItem) {
      activeItem.classList.add("active");
    }
  }

  async filterAndRender() {
    let filteredTabs = [...this.tabs];

    // Apply search filter
    if (this.searchQuery) {
      filteredTabs = filteredTabs.filter(
        (tab) =>
          tab.title.toLowerCase().includes(this.searchQuery) ||
          tab.url.toLowerCase().includes(this.searchQuery)
      );
    }

    // Apply sorting
    filteredTabs = this.sortTabs(filteredTabs);

    await this.renderTabs(filteredTabs);
  }

  sortTabs(tabs) {
    switch (this.sortType) {
      case "alphabetical":
        return tabs.sort((a, b) => a.title.localeCompare(b.title));
      case "domain":
        return tabs.sort((a, b) => {
          const domainA = new URL(a.url).hostname;
          const domainB = new URL(b.url).hostname;
          return domainA.localeCompare(domainB);
        });
      case "recent":
        return tabs.sort(
          (a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0)
        );
      default:
        return tabs.sort((a, b) => a.index - b.index);
    }
  }

  async render() {
    this.renderGroups();
    await this.filterAndRender();
    this.renderSavedGroups();
  }

  async renderGroups() {
    const container = document.getElementById("groups-content");

    // Get all windows
    const windows = await chrome.windows.getAll();

    // Create a map of windowId to groups
    const windowToGroups = new Map();

    // Group the groups by their windowId
    this.groups.forEach((group) => {
      if (!windowToGroups.has(group.windowId)) {
        windowToGroups.set(group.windowId, []);
      }
      windowToGroups.get(group.windowId).push(group);
    });

    // Render groups organized by window
    let html = "";
    let windowIndex = 0;

    for (const window of windows) {
      const groupsInWindow = windowToGroups.get(window.id) || [];

      if (groupsInWindow.length > 0) {
        windowIndex++;
        const isWindowCollapsed = this.collapsedWindows.has(window.id);
        html += `
          <div class="window-section" data-window-id="${window.id}">
            <h4 class="window-header" style="padding: 8px 20px; margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; cursor: pointer; display: flex; align-items: center; justify-content: space-between;">
              <span>Window ${windowIndex}</span>
              <svg class="collapse-icon ${
                isWindowCollapsed ? "collapsed" : ""
              }" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
              </svg>
            </h4>
            <div class="window-groups" style="display: ${
              isWindowCollapsed ? "none" : "block"
            }">
            ${groupsInWindow
              .map((group) => {
                const groupTabs = this.tabs.filter(
                  (tab) => tab.groupId === group.id
                );
                return `
              <div class="tab-group" data-group-id="${group.id}">
                <div class="group-header" style="cursor: pointer;">
                  <div class="group-title">
                    <div class="group-color" style="background-color: ${
                      group.color
                    }"></div>
                    ${group.title || "Unnamed Group"}
                    <span class="group-count">${groupTabs.length}</span>
                    <svg class="collapse-icon ${
                      this.collapsedGroups.has(group.id) ? "collapsed" : ""
                    }" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                    </svg>
                  </div>
                  <div class="group-actions">
                    <button class="tab-action-btn" data-group-id="${
                      group.id
                    }" title="Add to Project">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2zM15 16h-2v-2H9v-2h4V10h2v2h4v2h-4v2z"/>
                      </svg>
                    </button>
                    <button class="tab-action-btn" data-group-id="${
                      group.id
                    }" title="Update in Project">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21 10.12h-6.78l2.74-2.82c-2.73-2.7-7.15-2.8-9.88-.1-2.73 2.71-2.73 7.08 0 9.79 2.73 2.71 7.15 2.71 9.88 0C18.32 15.65 19 14.08 19 12.1h2c0 1.98-.88 4.55-2.64 6.29-3.51 3.48-9.21 3.48-12.72 0-3.5-3.47-3.53-9.11-.02-12.58 3.51-3.47 9.14-3.47 12.65 0L21 3v7.12z"/>
                      </svg>
                    </button>
                    <button class="tab-action-btn" data-group-id="${
                      group.id
                    }" title="Save Group">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                      </svg>
                    </button>
                    <button class="tab-action-btn" data-group-id="${
                      group.id
                    }" title="Close Group">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <div class="group-tabs" id="group-tabs-${
                  group.id
                }" style="display: ${
                  this.collapsedGroups.has(group.id) ? "none" : "block"
                }">
                  ${groupTabs.map((tab) => this.createTabHTML(tab)).join("")}
                </div>
              </div>
            `;
              })
              .join("")}
            </div>
          </div>
        `;
      }
    }

    if (html === "") {
      container.innerHTML =
        '<div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 13px;">No tab groups</div>';
    } else {
      container.innerHTML = html;
    }
  }

  async renderTabs(tabs) {
    const container = document.getElementById("tabs-content");

    // Filter out tabs that are in groups
    const ungroupedTabs = tabs.filter(
      (tab) => tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE
    );

    if (ungroupedTabs.length === 0) {
      container.innerHTML =
        '<div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 13px;">No ungrouped tabs</div>';
      return;
    }

    // Get all windows
    const windows = await chrome.windows.getAll();

    // Group ungrouped tabs by window
    const windowToTabs = new Map();
    ungroupedTabs.forEach((tab) => {
      if (!windowToTabs.has(tab.windowId)) {
        windowToTabs.set(tab.windowId, []);
      }
      windowToTabs.get(tab.windowId).push(tab);
    });

    // Render tabs organized by window
    let html = "";
    let windowIndex = 0;

    for (const window of windows) {
      const tabsInWindow = windowToTabs.get(window.id) || [];

      if (tabsInWindow.length > 0) {
        windowIndex++;
        const isWindowCollapsed = this.collapsedWindows.has(window.id);
        html += `
          <div class="window-section" data-window-id="${window.id}">
            <h4 class="window-header" style="padding: 8px 20px; margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; cursor: pointer; display: flex; align-items: center; justify-content: space-between;">
              <span>Window ${windowIndex}</span>
              <svg class="collapse-icon ${
                isWindowCollapsed ? "collapsed" : ""
              }" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
              </svg>
            </h4>
            <div class="window-tabs" style="display: ${
              isWindowCollapsed ? "none" : "block"
            }">
              ${tabsInWindow.map((tab) => this.createTabHTML(tab)).join("")}
            </div>
          </div>
        `;
      }
    }

    container.innerHTML = html;
  }

  createTabHTML(tab) {
    const isActive = tab.id === this.activeTabId;
    const isPinned = tab.pinned;
    const isSuspended = tab.discarded;

    return `
      <div class="tab-item ${isActive ? "active" : ""} ${
      isPinned ? "pinned" : ""
    } ${isSuspended ? "suspended" : ""}" 
           data-tab-id="${tab.id}">
        <img class="tab-favicon" 
             src="${
               tab.favIconUrl ||
               'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%23999" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>'
             }" 
             alt="">
        <div class="tab-info">
          <div class="tab-title">${tab.title}</div>
          <div class="tab-url">${new URL(tab.url).hostname}</div>
          ${isPinned ? '<div class="pinned-tag">PINNED</div>' : ""}
        </div>
        <div class="tab-actions">
          <button class="tab-action-btn" title="Add to Project">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2zM15 16h-2v-2H9v-2h4V10h2v2h4v2h-4v2z"/>
            </svg>
          </button>
          <button class="tab-action-btn" title="Open in New Window">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
            </svg>
          </button>
          ${
            isPinned
              ? `<button class="tab-action-btn" title="Unpin Tab">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 9V4l1 1 2-2V2h-1l-2 2-1-1v5c0 1.11-.89 2-2 2h-2v6l-1 1-1-1v-6H7c-1.11 0-2-.89-2-2V4L4 3 2 5v1l2 2 1-1v5h2v6l1 1 1-1v-6h2c1.11 0 2 .89 2 2z"/>
              </svg>
            </button>`
              : `<button class="tab-action-btn" title="Pin Tab">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 9V4l1 1 2-2V2h-1l-2 2-1-1v5c0 1.11-.89 2-2 2h-2v6l-1 1-1-1v-6H7c-1.11 0-2-.89-2-2V4L4 3 2 5v1l2 2 1-1v5h2v6l1 1 1-1v-6h2c1.11 0 2 .89 2 2z"/>
              </svg>
            </button>`
          }
          ${
            isPinned
              ? ""
              : `<button class="tab-action-btn close" title="Close Tab">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>`
          }
        </div>
      </div>
    `;
  }

  toggleSection(section) {
    if (this.collapsedSections.has(section)) {
      this.collapsedSections.delete(section);
    } else {
      this.collapsedSections.add(section);
    }
    this.render();
  }

  showContextMenu(event, tabItem) {
    const menu = document.getElementById("context-menu");
    const tabId = parseInt(tabItem.dataset.tabId);

    menu.style.display = "block";
    menu.style.left = event.pageX + "px";
    menu.style.top = event.pageY + "px";

    // Add click handlers for context menu items
    menu.querySelectorAll(".context-item").forEach((item) => {
      item.onclick = (e) => {
        e.preventDefault();
        const action = item.dataset.action;
        this.handleContextMenuAction(action, tabId);
        this.hideContextMenu();
      };
    });
  }

  hideContextMenu() {
    document.getElementById("context-menu").style.display = "none";
    document.getElementById("saved-group-context-menu").style.display = "none";

    // Remove the dynamically created move-to-group menu
    const moveToGroupMenu = document.getElementById("move-to-group-menu");
    if (moveToGroupMenu) {
      moveToGroupMenu.remove();
    }
  }

  showSavedGroupContextMenu(event, savedGroupElement) {
    const menu = document.getElementById("saved-group-context-menu");
    const savedGroupId = savedGroupElement.dataset.savedGroupId;

    menu.style.display = "block";
    menu.style.left = event.pageX + "px";
    menu.style.top = event.pageY + "px";

    // Add click handlers for context menu items
    menu.querySelectorAll(".context-item").forEach((item) => {
      item.onclick = (e) => {
        e.preventDefault();
        const action = item.dataset.action;
        this.handleSavedGroupContextMenuAction(action, savedGroupId);
        this.hideContextMenu();
      };
    });
  }

  handleSavedGroupContextMenuAction(action, savedGroupId) {
    switch (action) {
      case "restore-current":
        this.restoreSavedGroup(savedGroupId, false);
        break;
      case "restore-new":
        this.restoreSavedGroup(savedGroupId, true);
        break;
      case "add-to-project":
        this.addSavedGroupToProject(savedGroupId);
        break;
      case "edit-name":
        this.editSavedGroupName(savedGroupId);
        break;
      case "delete-project":
        this.confirmDeleteSavedGroup(savedGroupId);
        break;
    }
  }

  async confirmDeleteSavedGroup(savedGroupId) {
    const savedGroup = this.savedGroups.find((g) => g.id === savedGroupId);
    if (!savedGroup) return;

    if (
      confirm(
        `Are you sure you want to delete the project "${savedGroup.name}"?`
      )
    ) {
      await this.deleteSavedGroup(savedGroupId);
    }
  }

  async showMoveToGroupMenu(tabId) {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    // Get groups in the same window as the tab
    const groupsInWindow = this.groups.filter((group) => {
      const tabsInGroup = this.tabs.filter((t) => t.groupId === group.id);
      return tabsInGroup.length > 0 && tabsInGroup[0].windowId === tab.windowId;
    });

    if (groupsInWindow.length === 0) {
      alert("No groups available in this window. Create a group first.");
      return;
    }

    // Create a submenu for groups
    const moveToGroupMenu = document.createElement("div");
    moveToGroupMenu.id = "move-to-group-menu";
    moveToGroupMenu.className = "context-menu";
    moveToGroupMenu.style.position = "absolute";
    moveToGroupMenu.style.display = "block";

    // Position it next to the main context menu
    const contextMenu = document.getElementById("context-menu");
    const rect = contextMenu.getBoundingClientRect();
    moveToGroupMenu.style.left = `${rect.right}px`;
    moveToGroupMenu.style.top = `${rect.top}px`;

    // Add groups to the menu
    let menuHTML = "";
    groupsInWindow.forEach((group) => {
      const tabCount = this.tabs.filter((t) => t.groupId === group.id).length;
      menuHTML += `
        <div class="context-item move-to-group-item" data-group-id="${
          group.id
        }" data-tab-id="${tabId}">
          <span class="group-color" style="background-color: ${
            group.color
          }; width: 12px; height: 12px; border-radius: 50%; display: inline-block; margin-right: 8px;"></span>
          ${group.title || "Unnamed Group"} (${tabCount})
        </div>
      `;
    });

    // Add option to create new group
    menuHTML += `
      <div class="context-separator"></div>
      <div class="context-item move-to-new-group" data-tab-id="${tabId}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
        Create New Group
      </div>
    `;

    moveToGroupMenu.innerHTML = menuHTML;
    document.body.appendChild(moveToGroupMenu);

    // Add click handlers
    moveToGroupMenu.querySelectorAll(".move-to-group-item").forEach((item) => {
      item.addEventListener("click", async (e) => {
        e.preventDefault();
        const groupId = parseInt(item.dataset.groupId);
        const tabId = parseInt(item.dataset.tabId);
        await this.moveTabToGroup(tabId, groupId);
        this.hideContextMenu();
      });
    });

    // Handle create new group option
    const newGroupOption = moveToGroupMenu.querySelector(".move-to-new-group");
    if (newGroupOption) {
      newGroupOption.addEventListener("click", async (e) => {
        e.preventDefault();
        const tabId = parseInt(newGroupOption.dataset.tabId);
        await this.moveTabToNewGroup(tabId);
        this.hideContextMenu();
      });
    }
  }

  async moveTabToGroup(tabId, groupId) {
    try {
      await chrome.tabs.group({ tabIds: [tabId], groupId });
      this.debouncedRefresh();
    } catch (error) {
      console.error("Error moving tab to group:", error);
      alert(
        "Failed to move tab to group. The tab might be pinned or the group might be in a different window."
      );
    }
  }

  async moveTabToNewGroup(tabId) {
    try {
      const groupName = prompt("Enter name for the new group:");
      if (!groupName) return;

      const groupId = await chrome.tabs.group({ tabIds: [tabId] });
      await chrome.tabGroups.update(groupId, {
        title: groupName,
        color: "blue",
      });
      this.debouncedRefresh();
    } catch (error) {
      console.error("Error creating new group:", error);
      alert("Failed to create new group. The tab might be pinned.");
    }
  }

  handleContextMenuAction(action, tabId) {
    switch (action) {
      case "switch":
        this.switchToTab(tabId);
        break;
      case "close":
        this.closeTab(tabId);
        break;
      case "pin":
        this.pinTab(tabId);
        break;
      case "duplicate":
        this.duplicateTab(tabId);
        break;
      case "move-to-group":
        this.showMoveToGroupMenu(tabId);
        break;
      case "copy-url":
        this.copyTabUrl(tabId);
        break;
      case "close-others":
        this.closeOtherTabs(tabId);
        break;
      case "close-right":
        this.closeTabsToRight(tabId);
        break;
    }
  }

  // Tab operations
  async switchToTab(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      await chrome.tabs.update(tabId, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
    } catch (error) {
      console.error("Error switching to tab:", error);
    }
  }

  async closeTab(tabId) {
    try {
      await chrome.tabs.remove(tabId);
      this.debouncedRefresh();
    } catch (error) {
      console.error("Error closing tab:", error);
    }
  }

  async pinTab(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      await chrome.tabs.update(tabId, { pinned: !tab.pinned });
      this.debouncedRefresh();
    } catch (error) {
      console.error("Error pinning tab:", error);
    }
  }

  async unpinTab(tabId) {
    try {
      await chrome.tabs.update(tabId, { pinned: false });
      this.debouncedRefresh();
    } catch (error) {
      console.error("Error unpinning tab:", error);
    }
  }

  async duplicateTab(tabId) {
    try {
      await chrome.tabs.duplicate(tabId);
      this.debouncedRefresh();
    } catch (error) {
      console.error("Error duplicating tab:", error);
    }
  }

  async openTabInNewWindow(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      await chrome.windows.create({
        url: tab.url,
        type: "popup",
        width: 1200,
        height: 800,
      });
      this.debouncedRefresh();
    } catch (error) {
      console.error("Error opening tab in new window:", error);
    }
  }

  async closeOtherTabs(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      const tabs = await chrome.tabs.query({ windowId: tab.windowId });
      const tabsToClose = tabs
        .filter((t) => t.id !== tabId && !t.pinned)
        .map((t) => t.id);
      await chrome.tabs.remove(tabsToClose);
      this.debouncedRefresh();
    } catch (error) {
      console.error("Error closing other tabs:", error);
    }
  }

  async closeTabsToLeft(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      const tabs = await chrome.tabs.query({ windowId: tab.windowId });
      const tabsToClose = tabs
        .filter((t) => t.index < tab.index && !t.pinned)
        .map((t) => t.id);
      await chrome.tabs.remove(tabsToClose);
      this.debouncedRefresh();
    } catch (error) {
      console.error("Error closing tabs to left:", error);
    }
  }

  async closeTabsToRight(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      const tabs = await chrome.tabs.query({ windowId: tab.windowId });
      const tabsToClose = tabs
        .filter((t) => t.index > tab.index && !t.pinned)
        .map((t) => t.id);
      await chrome.tabs.remove(tabsToClose);
      this.debouncedRefresh();
    } catch (error) {
      console.error("Error closing tabs to right:", error);
    }
  }

  async copyTabUrl(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      await navigator.clipboard.writeText(tab.url);
    } catch (error) {
      console.error("Error copying tab URL:", error);
    }
  }

  async restoreTab(sessionId) {
    try {
      await chrome.sessions.restore(sessionId);
      this.debouncedRefresh();
    } catch (error) {
      console.error("Error restoring tab:", error);
    }
  }

  // Group operations
  toggleGroupCollapse(groupId) {
    if (this.collapsedGroups.has(groupId)) {
      this.collapsedGroups.delete(groupId);
    } else {
      this.collapsedGroups.add(groupId);
    }

    const groupTabs = document.getElementById(`group-tabs-${groupId}`);
    const collapseIcon = document.querySelector(
      `.tab-group[data-group-id="${groupId}"] .collapse-icon`
    );

    if (groupTabs && collapseIcon) {
      if (this.collapsedGroups.has(groupId)) {
        groupTabs.style.display = "none";
        collapseIcon.classList.add("collapsed");
      } else {
        groupTabs.style.display = "block";
        collapseIcon.classList.remove("collapsed");
      }
    }
  }

  toggleWindowCollapse(windowId) {
    if (this.collapsedWindows.has(windowId)) {
      this.collapsedWindows.delete(windowId);
    } else {
      this.collapsedWindows.add(windowId);
    }

    const windowGroups = document.querySelector(
      `.window-section[data-window-id="${windowId}"] .window-groups`
    );
    const collapseIcon = document.querySelector(
      `.window-section[data-window-id="${windowId}"] .collapse-icon`
    );

    if (windowGroups && collapseIcon) {
      if (this.collapsedWindows.has(windowId)) {
        windowGroups.style.display = "none";
        collapseIcon.classList.add("collapsed");
      } else {
        windowGroups.style.display = "block";
        collapseIcon.classList.remove("collapsed");
      }
    }
  }

  async closeGroup(groupId) {
    try {
      const tabs = this.tabs.filter((tab) => tab.groupId === groupId);
      const tabIds = tabs.map((tab) => tab.id);
      await chrome.tabs.remove(tabIds);
      this.debouncedRefresh();
    } catch (error) {
      console.error("Error closing group:", error);
    }
  }

  async createNewGroup() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      // HARD RULE: Never touch pinned tabs
      if (tab.pinned) {
        alert(
          "Cannot create a group from a pinned tab. Please unpin the tab first."
        );
        return;
      }

      const groupId = await chrome.tabs.group({ tabIds: [tab.id] });
      await chrome.tabGroups.update(groupId, {
        title: "New Group",
        color: "blue",
      });
      this.debouncedRefresh();
    } catch (error) {
      console.error("Error creating new group:", error);
    }
  }

  async groupTabsByDomain() {
    try {
      const currentWindow = await chrome.windows.getCurrent();
      const tabs = await chrome.tabs.query({ windowId: currentWindow.id });

      // Group tabs by domain - EXCLUDE PINNED TABS
      const domainGroups = new Map();
      tabs.forEach((tab) => {
        // HARD RULE: Never touch pinned tabs
        if (tab.pinned) return;
        if (!tab.url || tab.url.startsWith("chrome://")) return;
        const domain = new URL(tab.url).hostname;
        if (!domainGroups.has(domain)) {
          domainGroups.set(domain, []);
        }
        domainGroups.get(domain).push(tab);
      });

      // Create groups for each domain with 2+ tabs
      for (const [domain, domainTabs] of domainGroups) {
        if (domainTabs.length >= 2) {
          const tabIds = domainTabs.map((t) => t.id);
          const groupId = await chrome.tabs.group({ tabIds });
          await chrome.tabGroups.update(groupId, {
            title: domain,
            collapsed: false,
          });
        }
      }

      this.debouncedRefresh();
    } catch (error) {
      console.error("Error grouping tabs by domain:", error);
    }
  }

  async suspendInactiveTabs() {
    try {
      const currentWindow = await chrome.windows.getCurrent();
      const [activeTab] = await chrome.tabs.query({
        active: true,
        windowId: currentWindow.id,
      });

      // Only get tabs from the current window (excluding active tab)
      const tabs = await chrome.tabs.query({
        windowId: currentWindow.id,
      });

      let suspendedCount = 0;
      for (const tab of tabs) {
        if (
          tab.id !== activeTab.id &&
          !tab.pinned &&
          !tab.audible &&
          !tab.discarded &&
          !tab.url.startsWith("chrome://") &&
          !tab.url.startsWith("chrome-extension://")
        ) {
          await chrome.tabs.discard(tab.id);
          suspendedCount++;
        }
      }

      console.log(`Suspended ${suspendedCount} tabs in current window`);
      this.debouncedRefresh();
    } catch (error) {
      console.error("Error suspending inactive tabs:", error);
    }
  }

  // Bookmarks
  async loadBookmarks() {
    try {
      const bookmarks = await chrome.bookmarks.getTree();
      this.bookmarks = this.flattenBookmarks(bookmarks);
    } catch (error) {
      console.error("Error loading bookmarks:", error);
    }
  }

  flattenBookmarks(bookmarks, result = [], path = []) {
    for (const bookmark of bookmarks) {
      if (bookmark.url) {
        result.push({
          ...bookmark,
          path: [...path],
        });
      }
      if (bookmark.children) {
        const newPath = bookmark.title ? [...path, bookmark.title] : path;
        this.flattenBookmarks(bookmark.children, result, newPath);
      }
    }
    return result;
  }

  async openBookmark(url, newTab = false) {
    try {
      if (newTab) {
        await chrome.tabs.create({ url });
      } else {
        const [activeTab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        await chrome.tabs.update(activeTab.id, { url });
      }
    } catch (error) {
      console.error("Error opening bookmark:", error);
    }
  }

  async openInPopupWindow(url) {
    try {
      await chrome.windows.create({
        url: url,
        type: "popup",
        width: 1200,
        height: 800,
      });
    } catch (error) {
      console.error("Error opening in popup window:", error);
    }
  }

  // Saved Groups functionality
  async loadSavedGroups() {
    try {
      // Use the saved groups manager to load groups
      if (window.savedGroupsManager) {
        this.savedGroups = await window.savedGroupsManager.loadGroups();
        console.log("Loaded saved groups:", this.savedGroups.length);
      } else {
        // Fallback if manager not loaded yet
        const result = await chrome.storage.local.get("savedGroups");
        this.savedGroups = result.savedGroups || [];
      }
    } catch (error) {
      console.error("Error loading saved groups:", error);
      this.savedGroups = [];
    }
  }

  async saveCurrentGroupWithTags(groupId) {
    try {
      const group = this.groups.find((g) => g.id === groupId);
      const tabs = this.tabs.filter((tab) => tab.groupId === groupId);

      if (!group || tabs.length === 0) {
        console.error("Group not found or empty");
        return;
      }

      const name = prompt(
        "Enter a name for this saved group:",
        group.title || "Unnamed Group"
      );
      if (!name) return;

      // Create the saved group data
      const savedGroup = {
        id: Date.now().toString(),
        name: name,
        color: group.color,
        tabs: tabs.map((tab) => ({
          title: tab.title,
          url: tab.url,
          favIconUrl: tab.favIconUrl,
          pinned: tab.pinned || false,
        })),
        savedAt: new Date().toISOString(),
        tabCount: tabs.length,
      };

      // Save directly to chrome storage
      const result = await chrome.storage.local.get("savedGroups");
      const savedGroups = result.savedGroups || [];
      savedGroups.unshift(savedGroup);
      await chrome.storage.local.set({ savedGroups: savedGroups });

      console.log(`Saved group "${name}" with ${tabs.length} tabs`);

      // If currently in search mode, clear search to show saved groups tab
      if (this.searchQuery) {
        document.getElementById("search-input").value = "";
        this.searchQuery = "";
        document.getElementById("clear-search").style.display = "none";
        this.clearSearch();
      }

      // Switch to saved groups tab to show the newly saved group
      this.switchTabSection("saved-groups");

      // Reload and render saved groups
      await this.loadSavedGroups();
      this.renderSavedGroups();
    } catch (error) {
      console.error("Error saving group:", error);
      alert("Error saving group: " + error.message);
    }
  }

  renderSavedGroups() {
    const container = document.getElementById("saved-groups-content");

    if (!this.savedGroups || this.savedGroups.length === 0) {
      container.innerHTML =
        '<div class="empty-state">No saved groups yet. Save a tab group to see it here!</div>';
      return;
    }

    // Filter saved groups based on search query
    let filteredGroups = this.savedGroups;
    if (this.savedGroupsSearchQuery) {
      filteredGroups = this.savedGroups.filter((group) => {
        // Search in group name
        if (group.name.toLowerCase().includes(this.savedGroupsSearchQuery)) {
          return true;
        }
        // Search in tab titles and URLs
        return group.tabs.some(
          (tab) =>
            tab.title.toLowerCase().includes(this.savedGroupsSearchQuery) ||
            tab.url.toLowerCase().includes(this.savedGroupsSearchQuery)
        );
      });
    }

    if (filteredGroups.length === 0) {
      container.innerHTML =
        '<div class="empty-state">No saved groups match your search.</div>';
      return;
    }

    container.innerHTML = filteredGroups
      .map(
        (group) => `
      <div class="saved-group" data-saved-group-id="${group.id}">
        <div class="saved-group-header">
          <div class="saved-group-title">
            <div class="group-color" style="background-color: ${
              group.color || "blue"
            }"></div>
            <span class="saved-group-name">${this.escapeHtml(group.name)}</span>
            <span class="group-count">${
              group.tabCount || group.tabs.length
            }</span>
            <svg class="collapse-icon ${
              this.collapsedSavedGroups.has(group.id) ? "collapsed" : ""
            }" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
            </svg>
          </div>
          <div class="saved-group-actions">
            <button class="tab-action-btn" title="Add to Project">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2zM15 16h-2v-2H9v-2h4V10h2v2h4v2h-4v2z"/>
              </svg>
            </button>
            <button class="tab-action-btn" title="Edit Group Name">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
            </button>
            <button class="tab-action-btn" title="Restore in Current Window">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
              </svg>
            </button>
            <button class="tab-action-btn" title="Restore in New Window">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
              </svg>
            </button>
            <button class="tab-action-btn close" title="Delete Saved Group">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="saved-group-tabs" style="display: ${
          this.collapsedSavedGroups.has(group.id) ? "none" : "block"
        }">
          ${group.tabs
            .map(
              (tab) => `
            <div class="saved-tab-item" data-tab-url="${tab.url}">
              <img class="tab-favicon" src="${this.getSafeFaviconUrl(tab.url)}" 
                   alt="">
              <span class="saved-tab-title">${this.escapeHtml(tab.title)}</span>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `
      )
      .join("");
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  getSafeFaviconUrl(url, favIconUrl = null) {
    // If we have a favIconUrl from the tab data, use it
    if (favIconUrl) {
      return favIconUrl;
    }

    // Try to generate a favicon URL from the domain
    try {
      const urlObj = new URL(url);
      // Use Google's favicon service which works reliably
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=16`;
    } catch (e) {
      // Return default icon for invalid URLs
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%23999" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>';
    }
  }

  toggleSavedGroupCollapse(groupId) {
    if (this.collapsedSavedGroups.has(groupId)) {
      this.collapsedSavedGroups.delete(groupId);
    } else {
      this.collapsedSavedGroups.add(groupId);
    }
    this.renderSavedGroups();
  }

  async editSavedGroupName(savedGroupId) {
    const savedGroup = this.savedGroups.find((g) => g.id === savedGroupId);
    if (!savedGroup) return;

    const newName = prompt("Enter a new name for this group:", savedGroup.name);
    if (!newName || newName === savedGroup.name) return;

    savedGroup.name = newName;
    await chrome.storage.local.set({ savedGroups: this.savedGroups });
    this.renderSavedGroups();
  }

  async restoreSavedGroup(savedGroupId, inNewWindow = false) {
    try {
      const savedGroup = this.savedGroups.find((g) => g.id === savedGroupId);
      if (!savedGroup) return;

      let windowId;
      if (inNewWindow) {
        const newWindow = await chrome.windows.create();
        windowId = newWindow.id;
        // Remove the default tab
        const tabs = await chrome.tabs.query({ windowId });
        if (tabs.length > 0) {
          await chrome.tabs.remove(tabs[0].id);
        }
      } else {
        const currentWindow = await chrome.windows.getCurrent();
        windowId = currentWindow.id;
      }

      // Create tabs
      const tabIds = [];
      for (const tabData of savedGroup.tabs) {
        const tab = await chrome.tabs.create({
          url: tabData.url,
          windowId,
          active: false,
        });
        tabIds.push(tab.id);
      }

      // Group them
      if (tabIds.length > 0) {
        const groupId = await chrome.tabs.group({ tabIds });
        await chrome.tabGroups.update(groupId, {
          title: savedGroup.name,
          color: savedGroup.color || "blue",
        });
      }

      this.debouncedRefresh();
    } catch (error) {
      console.error("Error restoring saved group:", error);
    }
  }

  async deleteSavedGroup(savedGroupId) {
    if (confirm("Are you sure you want to delete this saved group?")) {
      if (window.savedGroupsManager) {
        await window.savedGroupsManager.deleteGroup(savedGroupId);
        await this.loadSavedGroups();
      } else {
        this.savedGroups = this.savedGroups.filter(
          (g) => g.id !== savedGroupId
        );
        await chrome.storage.local.set({ savedGroups: this.savedGroups });
      }
      this.renderSavedGroups();
    }
  }

  async openSavedTabInCurrentWindow(url) {
    try {
      await chrome.tabs.create({ url });
    } catch (error) {
      console.error("Error opening saved tab:", error);
    }
  }

  async exportAllData() {
    try {
      const dataToExport = {
        projects: this.projects,
        savedGroups: this.savedGroups,
      };
      const dataStr = JSON.stringify(dataToExport, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `power-project-backup-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting data:", error);
    }
  }

  async importAllData(file) {
    try {
      const text = await file.text();
      const importedData = JSON.parse(text);

      if (importedData.projects && Array.isArray(importedData.projects)) {
        importedData.projects.forEach((project) => {
          if (!this.projects.find((p) => p.id === project.id)) {
            this.projects.push(project);
          }
        });
        await this.saveProjects();
        this.renderProjects();
        this.renderProjectsModal();
      }

      if (importedData.savedGroups && Array.isArray(importedData.savedGroups)) {
        importedData.savedGroups.forEach((group) => {
          if (!this.savedGroups.find((g) => g.id === group.id)) {
            this.savedGroups.push(group);
          }
        });
        await chrome.storage.local.set({ savedGroups: this.savedGroups });
        await this.loadSavedGroups();
        this.renderSavedGroups();
      }

      alert(
        `Successfully imported ${
          importedData.projects?.length || 0
        } projects and ${importedData.savedGroups?.length || 0} saved groups.`
      );
    } catch (error) {
      console.error("Error importing data:", error);
      alert("Error importing data. Please check the file format.");
    }
  }

  // Search functionality
  performSearch(query) {
    this.searchResults = {
      tabs: [],
      bookmarks: [],
      groups: [],
      projects: [],
    };

    // Search tabs
    this.searchResults.tabs = this.tabs.filter(
      (tab) =>
        tab.title.toLowerCase().includes(query) ||
        tab.url.toLowerCase().includes(query)
    );

    // Search bookmarks
    this.searchResults.bookmarks = this.bookmarks.filter(
      (bookmark) =>
        bookmark.title.toLowerCase().includes(query) ||
        bookmark.url.toLowerCase().includes(query)
    );

    // Search tab groups
    this.searchResults.groups = this.groups.filter((group) => {
      const hasMatchingTitle = group.title?.toLowerCase().includes(query);
      const groupTabs = this.tabs.filter((tab) => tab.groupId === group.id);
      const hasMatchingTab = groupTabs.some(
        (tab) =>
          tab.title.toLowerCase().includes(query) ||
          tab.url.toLowerCase().includes(query)
      );
      return hasMatchingTitle || hasMatchingTab;
    });

    // Search projects
    this.searchResults.projects = this.projects.filter((project) => {
      // Search in project name
      if (project.name.toLowerCase().includes(query)) {
        return true;
      }
      // Search in project tabs
      return project.window.tabs.some(
        (tab) =>
          tab.title.toLowerCase().includes(query) ||
          tab.url.toLowerCase().includes(query)
      );
    });

    this.renderSearchResults();
  }

  renderSearchResults() {
    const container = document.getElementById("search-results");
    let html = "";

    // Add filter controls
    html += `
      <div class="search-filters" style="
        padding: 12px 20px;
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      ">
        <span style="font-size: 12px; color: #6b7280; font-weight: 600;">FILTERS:</span>
        <label class="filter-checkbox" style="
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #374151;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: background 0.2s;
        " onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background=''">
          <input type="checkbox" id="filter-tabs" ${
            this.searchFilters.tabs ? "checked" : ""
          } style="cursor: pointer;">
          <span>Tabs</span>
        </label>
        <label class="filter-checkbox" style="
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #374151;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: background 0.2s;
        " onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background=''">
          <input type="checkbox" id="filter-bookmarks" ${
            this.searchFilters.bookmarks ? "checked" : ""
          } style="cursor: pointer;">
          <span>Bookmarks</span>
        </label>
        <label class="filter-checkbox" style="
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #374151;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: background 0.2s;
        " onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background=''">
          <input type="checkbox" id="filter-groups" ${
            this.searchFilters.groups ? "checked" : ""
          } style="cursor: pointer;">
          <span>Grouped Tabs</span>
        </label>
        <label class="filter-checkbox" style="
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #374151;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: background 0.2s;
        " onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background=''">
          <input type="checkbox" id="filter-projects" ${
            this.searchFilters.projects ? "checked" : ""
          } style="cursor: pointer;">
          <span>Projects</span>
        </label>
      </div>
    `;

    // Add "Search on Google" option at the top
    if (this.searchQuery) {
      html += `
        <div class="google-search-option" data-search-query="${this.escapeHtml(
          this.searchQuery
        )}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          Search "<strong>${this.escapeHtml(
            this.searchQuery
          )}</strong>" on Google
        </div>
      `;
    }

    // Render tab results
    if (this.searchFilters.tabs && this.searchResults.tabs.length > 0) {
      html += `
        <h4 style="padding: 12px 20px; margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">
          Tabs (${this.searchResults.tabs.length})
        </h4>
        ${this.searchResults.tabs
          .map((tab) => this.createTabHTML(tab))
          .join("")}
      `;
    }

    // Render group results
    if (this.searchFilters.groups && this.searchResults.groups.length > 0) {
      html += `
        <h4 style="padding: 12px 20px; margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">
          Tab Groups (${this.searchResults.groups.length})
        </h4>
      `;

      this.searchResults.groups.forEach((group) => {
        const groupTabs = this.tabs.filter((tab) => tab.groupId === group.id);
        html += `
          <div class="tab-group" data-group-id="${group.id}">
            <div class="group-header">
              <div class="group-title">
                <div class="group-color" style="background-color: ${
                  group.color
                }"></div>
                ${group.title || "Unnamed Group"}
                <span class="group-count">${groupTabs.length}</span>
              </div>
              <div class="group-actions">
                <button class="tab-action-btn" data-group-id="${
                  group.id
                }" title="Add to Project">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2zM15 16h-2v-2H9v-2h4V10h2v2h4v2h-4v2z"/>
                  </svg>
                </button>
                <button class="tab-action-btn" data-group-id="${
                  group.id
                }" title="Save Group">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="group-tabs">
              ${groupTabs.map((tab) => this.createTabHTML(tab)).join("")}
            </div>
          </div>
        `;
      });
    }

    // Render bookmark results
    if (
      this.searchFilters.bookmarks &&
      this.searchResults.bookmarks.length > 0
    ) {
      html += `
        <h4 style="padding: 12px 20px; margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">
          Bookmarks (${this.searchResults.bookmarks.length})
        </h4>
        ${this.searchResults.bookmarks
          .map((bookmark) => {
            // Get favicon URL for the bookmark
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${
              new URL(bookmark.url).hostname
            }&sz=16`;

            // Format bookmark path
            const bookmarkPath =
              bookmark.path && bookmark.path.length > 0
                ? bookmark.path.join(" › ")
                : "Bookmarks Bar";

            return `
          <div class="bookmark-item" data-bookmark-url="${bookmark.url}">
            <img class="tab-favicon" 
                 src="${this.getSafeFaviconUrl(bookmark.url)}" 
                 alt="">
            <div class="tab-info">
              <div class="tab-title">${bookmark.title}</div>
              <div class="tab-url">${bookmark.url}</div>
              <div class="bookmark-path">${bookmarkPath}</div>
            </div>
            <div class="tab-actions">
              <button class="tab-action-btn" title="Open in Current Tab">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
              </button>
              <button class="tab-action-btn" title="Open in Popup Window">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                </svg>
              </button>
            </div>
          </div>
        `;
          })
          .join("")}
      `;
    }

    // Render project results
    if (this.searchFilters.projects && this.searchResults.projects.length > 0) {
      html += `
        <h4 style="padding: 12px 20px; margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">
          Projects (${this.searchResults.projects.length})
        </h4>
      `;

      this.searchResults.projects.forEach((project) => {
        const priorityColors = {
          "very-high": "#ef4444",
          high: "#f97316",
          medium: "#eab308",
          low: "#9ca3af",
        };
        const priorityColor = priorityColors[project.priority || "medium"];

        html += `
          <details class="project-search-result-container" style="margin: 8px 0;">
            <summary style="
              padding: 12px 20px;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 12px;
              transition: background 0.2s;
              list-style: none;
              user-select: none;
            " onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background=''">
              <svg class="collapse-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="transition: transform 0.2s;">
                <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
              </svg>
              <span class="project-priority-dot" style="
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background-color: ${priorityColor};
                flex-shrink: 0;
              "></span>
              <span class="project-emoji" style="font-size: 20px;">${
                project.emoji || "📁"
              }</span>
              <div style="flex: 1;">
                <div style="font-weight: 600; color: #111827;">${this.escapeHtml(
                  project.name
                )}</div>
                <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">
                  ${project.window.tabs.length} tabs • ${
          project.window.groups.length
        } groups
                </div>
              </div>
              <button class="tab-action-btn" onclick="event.stopPropagation(); sidebar.openProjectFromSearch('${
                project.id
              }')" title="Open Project">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                </svg>
              </button>
            </summary>
            <div class="project-tabs-list" style="
              background: #f9fafb;
              border-top: 1px solid #e5e7eb;
              max-height: 300px;
              overflow-y: auto;
            ">
              ${this.renderProjectTabs(project)}
            </div>
          </details>
        `;
      });
    }

    if (html === "") {
      html =
        '<div style="padding: 20px; text-align: center; color: #94a3b8;">No results found</div>';
    }

    container.innerHTML = html;

    // Add click handlers for project search results
    container.querySelectorAll(".project-search-result").forEach((element) => {
      element.addEventListener("click", (e) => {
        if (!e.target.closest("button")) {
          const projectId = element.dataset.projectId;
          this.switchToProject(projectId);
        }
      });
    });
  }

  // Helper method to open project from search
  openProjectFromSearch(projectId) {
    this.switchToProject(projectId);
  }

  // Helper method to render project tabs in search results
  renderProjectTabs(project) {
    let html = "";

    // Group tabs by their groupId
    const groupedTabs = new Map();
    const ungroupedTabs = [];

    project.window.tabs.forEach((tab) => {
      if (
        tab.groupId &&
        tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE &&
        tab.groupId !== -1
      ) {
        if (!groupedTabs.has(tab.groupId)) {
          groupedTabs.set(tab.groupId, []);
        }
        groupedTabs.get(tab.groupId).push(tab);
      } else {
        ungroupedTabs.push(tab);
      }
    });

    // Render grouped tabs
    project.window.groups.forEach((group) => {
      const tabs = groupedTabs.get(group.id) || [];
      if (tabs.length > 0) {
        html += `
          <div style="padding: 8px 20px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span class="group-color" style="background-color: ${
                group.color
              }; width: 12px; height: 12px; border-radius: 50%;"></span>
              <span style="font-weight: 600; color: #374151;">${
                group.title || "Unnamed Group"
              }</span>
              <span style="color: #6b7280; font-size: 12px;">(${
                tabs.length
              })</span>
            </div>
            <div style="margin-left: 20px;">
              ${tabs
                .map(
                  (tab) => `
                <div class="project-tab-item" data-tab-url="${tab.url}" style="
                  padding: 6px 12px;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  transition: background 0.2s;
                  border-radius: 4px;
                " onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background=''">
                  <img src="${
                    tab.favIconUrl ||
                    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%23999" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>'
                  }" 
                       style="width: 16px; height: 16px;" alt="">
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 13px; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(
                      tab.title
                    )}</div>
                    <div style="font-size: 11px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.cleanUrl(
                      tab.url
                    )}</div>
                  </div>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        `;
      }
    });

    // Render ungrouped tabs
    if (ungroupedTabs.length > 0) {
      html += `
        <div style="padding: 8px 20px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="font-weight: 600; color: #374151;">Ungrouped Tabs</span>
            <span style="color: #6b7280; font-size: 12px;">(${
              ungroupedTabs.length
            })</span>
          </div>
          <div style="margin-left: 20px;">
            ${ungroupedTabs
              .map(
                (tab) => `
              <div class="project-tab-item" data-tab-url="${tab.url}" style="
                padding: 6px 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: background 0.2s;
                border-radius: 4px;
              " onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background=''">
                <img src="${
                  tab.favIconUrl ||
                  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%23999" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>'
                }" 
                     style="width: 16px; height: 16px;" alt="">
                <div style="flex: 1; min-width: 0;">
                  <div style="font-size: 13px; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(
                    tab.title
                  )}</div>
                  <div style="font-size: 11px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.cleanUrl(
                    tab.url
                  )}</div>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    return html;
  }

  // Helper method to clean URLs for display
  cleanUrl(url) {
    try {
      const urlObj = new URL(url);
      // Remove protocol and www
      let cleanedUrl = urlObj.hostname.replace(/^www\./, "");
      // Add path if it's not just "/"
      if (urlObj.pathname !== "/") {
        cleanedUrl += urlObj.pathname;
      }
      // Truncate if too long
      if (cleanedUrl.length > 50) {
        cleanedUrl = cleanedUrl.substring(0, 47) + "...";
      }
      return cleanedUrl;
    } catch (e) {
      // Fallback for invalid URLs
      return url.substring(0, 50) + (url.length > 50 ? "..." : "");
    }
  }

  // Projects functionality
  async loadProjects() {
    try {
      const result = await chrome.storage.local.get("projects");
      this.projects = result.projects || [];
      console.log("Loaded projects:", this.projects.length);
    } catch (error) {
      console.error("Error loading projects:", error);
      this.projects = [];
    }
  }

  async saveProjects() {
    try {
      await chrome.storage.local.set({ projects: this.projects });
      console.log("Saved projects:", this.projects.length);
    } catch (error) {
      console.error("Error saving projects:", error);
    }
  }

  renderProjects() {
    const container = document.getElementById("projects-list");
    if (this.projects.length === 0) {
      container.innerHTML = "";
      return;
    }

    // Filter projects based on search query
    let filteredProjects = this.projects;
    if (this.projectsSearchQuery) {
      filteredProjects = this.projects.filter((project) =>
        project.name.toLowerCase().includes(this.projectsSearchQuery)
      );
    }

    if (filteredProjects.length === 0) {
      container.innerHTML =
        '<div style="padding: 8px; color: #94a3b8; font-size: 11px; text-align: center;">No matching projects</div>';
      return;
    }

    // Sort projects by priority
    const priorityOrder = {
      "very-high": 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    filteredProjects.sort((a, b) => {
      const priorityA = priorityOrder[a.priority || "medium"];
      const priorityB = priorityOrder[b.priority || "medium"];
      return priorityA - priorityB;
    });

    container.innerHTML = filteredProjects
      .map((project) => {
        const priorityColors = {
          "very-high": "#ef4444",
          high: "#f97316",
          medium: "#eab308",
          low: "#9ca3af",
        };
        const priorityColor = priorityColors[project.priority || "medium"];

        return `
      <div class="project-item ${
        project.id === this.activeProjectId ? "active" : ""
      }" data-project-id="${project.id}">
        <span class="project-priority-dot" style="background-color: ${priorityColor};"></span>
        <span class="project-emoji">${project.emoji || "📁"}</span>
        <span class="project-name">${project.name}</span>
      </div>
    `;
      })
      .join("");
  }

  async getCurrentWindow() {
    try {
      const currentWindow = await chrome.windows.getCurrent();
      this.currentWindowId = currentWindow.id;
    } catch (error) {
      console.error("Error getting current window:", error);
    }
  }

  async saveCurrentWindowAsProject() {
    const projectName = prompt("Enter a name for this project:");
    if (!projectName) return;

    try {
      const currentWindow = await chrome.windows.getCurrent({ populate: true });
      const groups = await chrome.tabGroups.query({
        windowId: currentWindow.id,
      });

      const project = {
        id: Date.now().toString(),
        name: projectName,
        emoji: "📁",
        priority: "medium", // Default priority
        window: {
          tabs: currentWindow.tabs.map((tab) => ({
            url: tab.url,
            title: tab.title,
            groupId: tab.groupId,
            pinned: tab.pinned,
            index: tab.index,
          })),
          groups: groups.map((group) => ({
            id: group.id,
            title: group.title,
            color: group.color,
            collapsed: group.collapsed,
          })),
        },
        createdAt: new Date().toISOString(),
      };

      this.projects.push(project);
      await this.saveProjects();
      this.renderProjects();
    } catch (error) {
      console.error("Error saving project:", error);
    }
  }

  async switchToProject(projectId) {
    const project = this.projects.find((p) => p.id === projectId);
    if (!project) return;

    // Show confirmation dialog
    const userConfirmed = confirm(
      `Do you want to open the project "${project.name}" in this window?\n\nThis will add ${project.window.tabs.length} tabs to your current window.`
    );

    if (!userConfirmed) return;

    try {
      // Get the current window
      const currentWindow = await chrome.windows.getCurrent();

      // Create all project tabs
      const newTabs = [];
      for (const tabData of project.window.tabs) {
        const tab = await chrome.tabs.create({
          url: tabData.url,
          windowId: currentWindow.id,
          active: false,
        });
        newTabs.push(tab);
      }

      // Create group mappings
      const groupMap = new Map();

      // Recreate groups and assign tabs
      for (const groupData of project.window.groups) {
        const tabsInGroup = project.window.tabs
          .map((tab, index) => ({
            ...tab,
            newId: newTabs[index]?.id,
          }))
          .filter((tab) => tab.groupId === groupData.id && tab.newId);

        if (tabsInGroup.length > 0) {
          const tabIds = tabsInGroup.map((tab) => tab.newId);
          const groupId = await chrome.tabs.group({ tabIds });

          await chrome.tabGroups.update(groupId, {
            title: groupData.title,
            color: groupData.color,
            collapsed: groupData.collapsed,
          });

          groupMap.set(groupData.id, groupId);
        }
      }

      // Set pinned state for tabs
      for (let i = 0; i < project.window.tabs.length; i++) {
        const tab = project.window.tabs[i];
        const newTab = newTabs[i];
        if (newTab && tab.pinned) {
          await chrome.tabs.update(newTab.id, { pinned: true });
        }
      }

      // Activate the first tab
      if (newTabs.length > 0) {
        await chrome.tabs.update(newTabs[0].id, { active: true });
      }

      this.activeProjectId = projectId;
      this.renderProjects();

      // Refresh the sidebar to show new tabs
      this.debouncedRefresh();
    } catch (error) {
      console.error("Error switching to project:", error);
    }
  }

  openProjectsManager() {
    document.getElementById("projects-modal").style.display = "flex";
    this.renderProjectsModal();
  }

  closeModals() {
    document.querySelectorAll(".modal-overlay").forEach((modal) => {
      modal.style.display = "none";
    });
  }

  renderProjectsModal() {
    const container = document.getElementById("projects-list-modal");

    if (this.projects.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #94a3b8;">
          <p style="margin-bottom: 20px;">No projects yet</p>
          <button id="new-project-modal-btn" class="primary-button">Create First Project</button>
        </div>
      `;
      return;
    }

    // Filter projects based on search query
    let filteredProjects = this.projects;
    if (this.projectsModalSearchQuery) {
      filteredProjects = this.projects.filter((project) =>
        project.name.toLowerCase().includes(this.projectsModalSearchQuery)
      );
    }

    if (filteredProjects.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #94a3b8;">
          <p style="margin-bottom: 20px;">No projects match your search</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filteredProjects
      .map(
        (project) => `
      <div class="project-card" data-project-id="${project.id}">
        <div class="project-card-header">
          <div>
            <span class="project-emoji" style="font-size: 24px; margin-right: 12px;">${
              project.emoji || "📁"
            }</span>
            <span class="project-name" style="font-size: 18px; font-weight: 600;">${
              project.name
            }</span>
          </div>
          <div class="project-card-actions">
            <button class="icon-button" title="Edit Project">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
            </button>
            <button class="icon-button" title="Open Project">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
              </svg>
            </button>
            <button class="icon-button" title="Delete Project">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="project-card-details">
          <div style="font-size: 12px; color: #94a3b8; margin-bottom: 12px;">
            Created: ${new Date(project.createdAt).toLocaleDateString()}
          </div>
          <div class="project-preview">
            ${this.renderProjectDetails(project)}
          </div>
        </div>
      </div>
    `
      )
      .join("");
  }

  renderProjectDetails(project) {
    // Group tabs by their groupId
    const groupedTabs = new Map();
    const ungroupedTabs = [];

    project.window.tabs.forEach((tab) => {
      if (
        tab.groupId &&
        tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE &&
        tab.groupId !== -1
      ) {
        if (!groupedTabs.has(tab.groupId)) {
          groupedTabs.set(tab.groupId, []);
        }
        groupedTabs.get(tab.groupId).push(tab);
      } else {
        ungroupedTabs.push(tab);
      }
    });

    let html = "";

    // Render groups
    project.window.groups.forEach((group) => {
      const tabs = groupedTabs.get(group.id) || [];
      if (tabs.length > 0) {
        html += `
          <div class="project-group">
            <div class="group-header" style="cursor: pointer;">
              <div class="group-title">
              <div class="group-color" style="background-color: ${
                group.color
              }"></div>
              <strong>${group.title || "Unnamed Group"}</strong>
              <span class="group-count">${tabs.length}</span>
            </div>
            <div style="margin-left: 24px;">
              ${tabs
                .map(
                  (tab) => `
                <div style="font-size: 12px; padding: 4px 0; color: #6b7280;">
                  ${tab.title}
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        `;
      }
    });

    // Render ungrouped tabs
    if (ungroupedTabs.length > 0) {
      html += `
        <div class="project-group">
          <div style="margin-bottom: 8px;">
            <strong>Ungrouped Tabs</strong>
            <span class="group-count">${ungroupedTabs.length}</span>
          </div>
          <div style="margin-left: 24px;">
            ${ungroupedTabs
              .map(
                (tab) => `
              <div style="font-size: 12px; padding: 4px 0; color: #6b7280;">
                ${tab.title}
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    return html;
  }

  async editProject(projectId) {
    const project = this.projects.find((p) => p.id === projectId);
    if (!project) return;

    // Close the current modal and open the edit project modal
    this.closeModals();
    document.getElementById("new-project-modal").style.display = "flex";

    // Pre-fill the project name
    document.getElementById("new-project-name").value = project.name;

    // Pre-fill the priority
    const prioritySelect = document.getElementById("project-priority");
    prioritySelect.value = project.priority || "medium";

    // Change the button text and action
    const createBtn = document.getElementById("create-project-btn");
    createBtn.textContent = "Update Project";

    // Store the project ID for updating
    this.editingProjectId = projectId;

    // Add a "Clear All Tabs" button if it doesn't exist
    let clearTabsBtn = document.getElementById("clear-project-tabs-btn");
    if (!clearTabsBtn) {
      clearTabsBtn = document.createElement("button");
      clearTabsBtn.id = "clear-project-tabs-btn";
      clearTabsBtn.className = "secondary-button";
      clearTabsBtn.textContent = "Clear All Tabs";
      clearTabsBtn.style.marginLeft = "10px";
      clearTabsBtn.onclick = () => this.clearProjectTabs(projectId);

      // Insert after the Update Project button
      createBtn.parentNode.insertBefore(clearTabsBtn, createBtn.nextSibling);
    } else {
      clearTabsBtn.style.display = "inline-block";
      clearTabsBtn.onclick = () => this.clearProjectTabs(projectId);
    }

    // Add a "Delete This Project" button if it doesn't exist
    let deleteProjectBtn = document.getElementById("delete-project-btn");
    if (!deleteProjectBtn) {
      deleteProjectBtn = document.createElement("button");
      deleteProjectBtn.id = "delete-project-btn";
      deleteProjectBtn.className = "secondary-button";
      deleteProjectBtn.textContent = "Delete This Project";
      deleteProjectBtn.style.marginLeft = "10px";
      deleteProjectBtn.style.backgroundColor = "#ef4444";
      deleteProjectBtn.style.color = "white";
      deleteProjectBtn.onclick = () => this.deleteProjectFromEdit(projectId);

      // Insert after the Clear All Tabs button
      clearTabsBtn.parentNode.insertBefore(
        deleteProjectBtn,
        clearTabsBtn.nextSibling
      );
    } else {
      deleteProjectBtn.style.display = "inline-block";
      deleteProjectBtn.onclick = () => this.deleteProjectFromEdit(projectId);
    }

    // Render tabs with pre-selected ones from the project
    await this.renderTabSelectionForEdit(project);

    // Update button click handler
    createBtn.onclick = () => this.updateProjectFromSelection();
  }

  async renderTabSelectionForEdit(project) {
    const container = document.getElementById("tab-selection-container");

    // Group project tabs by their groupId
    const groupedTabs = new Map();
    const ungroupedTabs = [];

    project.window.tabs.forEach((tab, index) => {
      // Store the original index for later use
      tab.originalIndex = index;

      if (
        tab.groupId &&
        tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE &&
        tab.groupId !== -1
      ) {
        if (!groupedTabs.has(tab.groupId)) {
          groupedTabs.set(tab.groupId, []);
        }
        groupedTabs.get(tab.groupId).push(tab);
      } else {
        ungroupedTabs.push(tab);
      }
    });

    let html = `
      <div style="
        font-size: 13px; 
        color: #6b7280; 
        margin-bottom: 16px;
        padding: 12px;
        background: #f9fafb;
        border-radius: 6px;
        border: 1px solid #e5e7eb;
      ">
        <div style="font-weight: 600; margin-bottom: 4px;">Select tabs to keep in this project</div>
        <div style="font-size: 12px;">Unchecked tabs will be removed. You can move ungrouped tabs to groups.</div>
      </div>
    `;

    // Render groups with their tabs
    project.window.groups.forEach((group) => {
      const tabs = groupedTabs.get(group.id) || [];
      if (tabs.length > 0) {
        html += `
          <div class="selection-group" style="
            margin-bottom: 16px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
            background: white;
          ">
            <div class="selection-group-header" style="
              background: #f9fafb;
              padding: 12px 16px;
              border-bottom: 1px solid #e5e7eb;
              display: flex;
              align-items: center;
              gap: 12px;
            ">
              <input type="checkbox" id="group-${
                group.id
              }" class="group-checkbox" data-group-id="${group.id}" checked>
              <label for="group-${
                group.id
              }" class="selection-group-title" style="
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 1;
                cursor: pointer;
                font-weight: 600;
                color: #111827;
              ">
                <span class="group-color" style="
                  background-color: ${group.color};
                  width: 14px;
                  height: 14px;
                  border-radius: 50%;
                  flex-shrink: 0;
                "></span>
                <span>${group.title || "Unnamed Group"}</span>
                <span style="
                  font-weight: 400;
                  color: #6b7280;
                  font-size: 13px;
                ">(${tabs.length} tabs)</span>
              </label>
            </div>
            <div class="selection-tabs" style="padding: 8px;">
              ${tabs
                .map(
                  (tab) => `
                <div class="selection-tab" style="
                  display: flex;
                  align-items: center;
                  padding: 8px 12px;
                  border-radius: 6px;
                  transition: background 0.2s;
                  cursor: pointer;
                " onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background=''">
                  <input type="checkbox" id="project-tab-${
                    tab.originalIndex
                  }" class="tab-checkbox" data-tab-index="${
                    tab.originalIndex
                  }" data-group-id="${
                    group.id
                  }" checked style="margin-right: 12px;">
                  <label for="project-tab-${tab.originalIndex}" style="
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex: 1;
                    cursor: pointer;
                    min-width: 0;
                  ">
                    <img class="tab-favicon" src="${this.getSafeFaviconUrl(
                      tab.url,
                      tab.favIconUrl
                    )}">
                    <div class="tab-info" style="flex: 1; min-width: 0;">
                      <div class="tab-title">${this.escapeHtml(tab.title)}</div>
                      <div class="tab-url">${this.cleanUrl(tab.url)}</div>
                    </div>
                  </label>
                  <button class="tab-action-btn remove-from-project" title="Remove from project" data-tab-index="${
                    tab.originalIndex
                  }" style="opacity: 0.6; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  </button>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        `;
      }
    });

    // Render ungrouped tabs
    if (ungroupedTabs.length > 0) {
      html += `
        <div class="selection-group" style="
          margin-bottom: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
          background: white;
        ">
          <div class="selection-group-header" style="
            background: #f9fafb;
            padding: 12px 16px;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            align-items: center;
            gap: 12px;
          ">
            <input type="checkbox" id="ungrouped" class="group-checkbox" data-group-id="ungrouped" checked>
            <label for="ungrouped" class="selection-group-title" style="
              display: flex;
              align-items: center;
              gap: 8px;
              flex: 1;
              cursor: pointer;
              font-weight: 600;
              color: #111827;
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="opacity: 0.5;">
                <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
              </svg>
              <span>Ungrouped Tabs</span>
              <span style="
                font-weight: 400;
                color: #6b7280;
                font-size: 13px;
              ">(${ungroupedTabs.length})</span>
            </label>
            ${
              project.window.groups.length > 0
                ? `
              <div style="
                font-size: 12px;
                color: #6b7280;
                padding: 4px 8px;
                background: #e0e7ff;
                border-radius: 4px;
                display: flex;
                align-items: center;
                gap: 4px;
              ">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11 9h2V6h3V4h-3V1h-2v3H8v2h3v3zm-4 9c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2zm-9.83-3.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.86-7.01L19.42 4h-.01l-1.1 2-2.76 5H8.53l-.13-.27L6.16 6l-.95-2-.94-2H1v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.13 0-.25-.11-.25-.25z"/>
                </svg>
                Drag tabs here or use move button
              </div>
            `
                : ""
            }
          </div>
          <div class="selection-tabs" style="padding: 8px; ${
            ungroupedTabs.length === 0
              ? "min-height: 100px; display: flex; align-items: center; justify-content: center;"
              : ""
          }">
            ${
              ungroupedTabs.length === 0
                ? `
              <div style="
                color: #9ca3af;
                font-size: 13px;
                text-align: center;
              ">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" style="opacity: 0.3; margin-bottom: 8px;">
                  <path d="M10 16V8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2zm10 0V8a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2z"/>
                </svg>
                <div>No ungrouped tabs</div>
              </div>
            `
                : ungroupedTabs
                    .map(
                      (tab) => `
              <div class="selection-tab" style="
                display: flex;
                align-items: center;
                padding: 8px 12px;
                border-radius: 6px;
                transition: background 0.2s;
                cursor: pointer;
              " onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background=''">
                <input type="checkbox" id="project-tab-${
                  tab.originalIndex
                }" class="tab-checkbox" data-tab-index="${
                        tab.originalIndex
                      }" checked style="margin-right: 12px;">
                <label for="project-tab-${tab.originalIndex}" style="
                  display: flex;
                  align-items: center;
                  gap: 10px;
                  flex: 1;
                  cursor: pointer;
                  min-width: 0;
                ">
                  <img class="tab-favicon" src="${this.getSafeFaviconUrl(
                    tab.url,
                    tab.favIconUrl
                  )}">
                  <div class="tab-info" style="flex: 1; min-width: 0;">
                    <div class="tab-title">${this.escapeHtml(tab.title)}</div>
                    <div class="tab-url">${this.cleanUrl(tab.url)}</div>
                  </div>
                </label>
                ${
                  project.window.groups.length > 0
                    ? `
                  <button class="tab-action-btn move-to-group" title="Move to group" data-tab-index="${tab.originalIndex}" style="opacity: 0.6; transition: opacity 0.2s; margin-right: 4px;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M10 16V8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2zm10 0V8a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2z"/>
                    </svg>
                  </button>
                `
                    : ""
                }
                <button class="tab-action-btn remove-from-project" title="Remove from project" data-tab-index="${
                  tab.originalIndex
                }" style="opacity: 0.6; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>
            `
                    )
                    .join("")
            }
          </div>
        </div>
      `;
    }

    container.innerHTML = html;

    // Add event listeners for group checkboxes
    container.querySelectorAll(".group-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", (e) => {
        const groupId = e.target.dataset.groupId;
        const isChecked = e.target.checked;
        container
          .querySelectorAll(
            groupId === "ungrouped"
              ? `.tab-checkbox:not([data-group-id])`
              : `.tab-checkbox[data-group-id="${groupId}"]`
          )
          .forEach((tabCheckbox) => {
            tabCheckbox.checked = isChecked;
          });
      });
    });

    // Add event listeners for remove buttons
    container.querySelectorAll(".remove-from-project").forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tabIndex = button.dataset.tabIndex;
        const checkbox = document.getElementById(`project-tab-${tabIndex}`);
        if (checkbox) {
          checkbox.checked = false;
        }
      });
    });

    // Add event listeners for move to group buttons
    container.querySelectorAll(".move-to-group").forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tabIndex = button.dataset.tabIndex;
        this.showMoveToProjectGroupMenu(tabIndex, project);
      });
    });
  }

  showMoveToProjectGroupMenu(tabIndex, project) {
    const tab = project.window.tabs[tabIndex];
    if (!tab || !project.window.groups || project.window.groups.length === 0)
      return;

    // Create a dropdown menu
    const menu = document.createElement("div");
    menu.className = "context-menu";
    menu.style.position = "absolute";
    menu.style.display = "block";

    // Position it near the button
    const button = event.target;
    const rect = button.getBoundingClientRect();
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom}px`;

    // Add groups to menu
    let menuHTML = "";
    project.window.groups.forEach((group) => {
      menuHTML += `
        <div class="context-item" data-group-id="${
          group.id
        }" data-tab-index="${tabIndex}">
          <span class="group-color" style="background-color: ${
            group.color
          }; width: 12px; height: 12px; border-radius: 50%; display: inline-block; margin-right: 8px;"></span>
          ${group.title || "Unnamed Group"}
        </div>
      `;
    });

    menu.innerHTML = menuHTML;
    menu.id = "project-move-to-group-menu";
    document.body.appendChild(menu);

    // Add click handlers
    menu.querySelectorAll(".context-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const groupId = parseInt(item.dataset.groupId);
        const tabIdx = parseInt(item.dataset.tabIndex);

        // Update the tab's groupId
        project.window.tabs[tabIdx].groupId = groupId;

        // Re-render the selection UI
        this.renderTabSelectionForEdit(project);

        // Remove the menu
        menu.remove();
      });
    });

    // Close menu when clicking elsewhere
    setTimeout(() => {
      document.addEventListener("click", function closeMenu(e) {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener("click", closeMenu);
        }
      });
    }, 0);
  }

  async clearProjectTabs(projectId) {
    const project = this.projects.find((p) => p.id === projectId);
    if (!project) return;

    const confirmMessage = `Are you sure you want to clear all tabs from the project "${project.name}"?\n\nThis will remove all ${project.window.tabs.length} tabs from the project.`;

    if (!confirm(confirmMessage)) return;

    // Clear all tabs and groups from the project
    project.window.tabs = [];
    project.window.groups = [];

    await this.saveProjects();

    // Update the UI to show no tabs selected
    document.querySelectorAll(".tab-checkbox").forEach((checkbox) => {
      checkbox.checked = false;
    });
    document.querySelectorAll(".group-checkbox").forEach((checkbox) => {
      checkbox.checked = false;
    });

    alert(`All tabs have been cleared from the project "${project.name}".`);
  }

  async updateProjectFromSelection() {
    const projectName = document.getElementById("new-project-name").value;
    if (!projectName) {
      alert("Please enter a project name");
      return;
    }

    // Get selected tab indices from the project's tabs
    const selectedTabIndices = [];
    document.querySelectorAll(".tab-checkbox:checked").forEach((checkbox) => {
      selectedTabIndices.push(parseInt(checkbox.dataset.tabIndex));
    });

    if (selectedTabIndices.length === 0) {
      alert("Please select at least one tab");
      return;
    }

    // Find and update the project
    const project = this.projects.find((p) => p.id === this.editingProjectId);
    if (!project) return;

    // Filter tabs based on selected indices
    const newTabs = project.window.tabs.filter((tab, index) =>
      selectedTabIndices.includes(index)
    );

    // Get unique group IDs from remaining tabs
    const remainingGroupIds = new Set(
      newTabs
        .filter(
          (tab) =>
            tab.groupId &&
            tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE &&
            tab.groupId !== -1
        )
        .map((tab) => tab.groupId)
    );

    // Filter groups to only include those with remaining tabs
    const newGroups = project.window.groups.filter((group) =>
      remainingGroupIds.has(group.id)
    );

    // Update the project
    project.name = projectName;
    project.priority = document.getElementById("project-priority").value;
    project.window.tabs = newTabs;
    project.window.groups = newGroups;

    await this.saveProjects();
    this.renderProjects();
    this.closeModals();

    // Reset the button and hide clear tabs button
    const createBtn = document.getElementById("create-project-btn");
    createBtn.textContent = "Create Project";
    createBtn.onclick = () => this.createProjectFromSelection();
    this.editingProjectId = null;

    // Hide the clear tabs button
    const clearTabsBtn = document.getElementById("clear-project-tabs-btn");
    if (clearTabsBtn) {
      clearTabsBtn.style.display = "none";
    }
  }

  async openProjectFromModal(projectId) {
    this.closeModals();
    await this.switchToProject(projectId);
  }

  async confirmDeleteProject(projectId) {
    if (confirm("Are you sure you want to delete this project?")) {
      this.projects = this.projects.filter((p) => p.id !== projectId);
      await this.saveProjects();
      this.renderProjectsModal();
      this.renderProjects();
    }
  }

  async deleteProjectFromEdit(projectId) {
    const project = this.projects.find((p) => p.id === projectId);
    if (!project) return;

    if (
      confirm(`Are you sure you want to delete the project "${project.name}"?`)
    ) {
      this.projects = this.projects.filter((p) => p.id !== projectId);
      await this.saveProjects();
      this.renderProjects();
      this.closeModals();

      // Clean up the edit modal state
      const createBtn = document.getElementById("create-project-btn");
      createBtn.textContent = "Create Project";
      createBtn.onclick = () => this.createProjectFromSelection();
      this.editingProjectId = null;

      // Hide the buttons
      const clearTabsBtn = document.getElementById("clear-project-tabs-btn");
      if (clearTabsBtn) {
        clearTabsBtn.style.display = "none";
      }
      const deleteProjectBtn = document.getElementById("delete-project-btn");
      if (deleteProjectBtn) {
        deleteProjectBtn.style.display = "none";
      }
    }
  }

  openNewProjectModal() {
    this.closeModals();
    document.getElementById("new-project-modal").style.display = "flex";

    // Hide the clear tabs button if it exists (from previous edit mode)
    const clearTabsBtn = document.getElementById("clear-project-tabs-btn");
    if (clearTabsBtn) {
      clearTabsBtn.style.display = "none";
    }

    // Hide the delete project button if it exists (from previous edit mode)
    const deleteProjectBtn = document.getElementById("delete-project-btn");
    if (deleteProjectBtn) {
      deleteProjectBtn.style.display = "none";
    }

    // Reset the create button
    const createBtn = document.getElementById("create-project-btn");
    createBtn.textContent = "Create Project";
    createBtn.onclick = () => this.createProjectFromSelection();

    // Clear the project name field
    document.getElementById("new-project-name").value = "";

    // Clear the editing project ID
    this.editingProjectId = null;

    this.renderTabSelection();
  }

  async renderTabSelection() {
    const container = document.getElementById("tab-selection-container");
    const currentWindow = await chrome.windows.getCurrent({ populate: true });
    const groups = await chrome.tabGroups.query({ windowId: currentWindow.id });

    let html = "";

    // Render groups with their tabs
    groups.forEach((group) => {
      const groupTabs = currentWindow.tabs.filter(
        (tab) => tab.groupId === group.id
      );
      if (groupTabs.length > 0) {
        html += `
          <div class="selection-group">
            <div class="selection-group-header">
              <input type="checkbox" id="group-${
                group.id
              }" class="group-checkbox" data-group-id="${group.id}">
              <label for="group-${group.id}" class="selection-group-title">
                <span class="group-color" style="background-color: ${
                  group.color
                }; width: 12px; height: 12px; border-radius: 50%; display: inline-block; margin-right: 8px;"></span>
                ${group.title || "Unnamed Group"} (${groupTabs.length})
              </label>
            </div>
            <div class="selection-tabs">
              ${groupTabs
                .map(
                  (tab) => `
                <div class="selection-tab">
                  <input type="checkbox" id="tab-${
                    tab.id
                  }" class="tab-checkbox" data-tab-id="${
                    tab.id
                  }" data-group-id="${group.id}">
                  <label for="tab-${tab.id}">
                    <img src="${
                      tab.favIconUrl ||
                      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%23999" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>'
                    }" alt="">
                    <span class="selection-tab-title">${tab.title}</span>
                  </label>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        `;
      }
    });

    // Render ungrouped tabs
    const ungroupedTabs = currentWindow.tabs.filter(
      (tab) => tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE
    );
    if (ungroupedTabs.length > 0) {
      html += `
        <div class="selection-group">
          <div class="selection-group-header">
            <input type="checkbox" id="ungrouped" class="group-checkbox" data-group-id="ungrouped">
            <label for="ungrouped" class="selection-group-title">
              Ungrouped Tabs (${ungroupedTabs.length})
            </label>
          </div>
          <div class="selection-tabs">
            ${ungroupedTabs
              .map(
                (tab) => `
              <div class="selection-tab">
                <input type="checkbox" id="tab-${
                  tab.id
                }" class="tab-checkbox" data-tab-id="${tab.id}">
                <label for="tab-${tab.id}">
                  <img src="${
                    tab.favIconUrl ||
                    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%23999" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>'
                  }" alt="">
                  <span class="selection-tab-title">${tab.title}</span>
                </label>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    container.innerHTML = html;

    // Add event listeners for group checkboxes
    container.querySelectorAll(".group-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", (e) => {
        const groupId = e.target.dataset.groupId;
        const isChecked = e.target.checked;
        container
          .querySelectorAll(
            groupId === "ungrouped"
              ? ".tab-checkbox:not([data-group-id])"
              : `.tab-checkbox[data-group-id="${groupId}"]`
          )
          .forEach((tabCheckbox) => {
            tabCheckbox.checked = isChecked;
          });
      });
    });
  }

  async createProjectFromSelection() {
    const projectName = document.getElementById("new-project-name").value;
    if (!projectName) {
      alert("Please enter a project name");
      return;
    }

    const selectedTabs = [];
    document.querySelectorAll(".tab-checkbox:checked").forEach((checkbox) => {
      selectedTabs.push(parseInt(checkbox.dataset.tabId));
    });

    if (selectedTabs.length === 0) {
      alert("Please select at least one tab");
      return;
    }

    const priority = document.getElementById("project-priority").value;
    const currentWindow = await chrome.windows.getCurrent({ populate: true });
    const groups = await chrome.tabGroups.query({ windowId: currentWindow.id });

    const project = {
      id: Date.now().toString(),
      name: projectName,
      emoji: "📁",
      priority: priority,
      window: {
        tabs: currentWindow.tabs
          .filter((tab) => selectedTabs.includes(tab.id))
          .map((tab) => ({
            url: tab.url,
            title: tab.title,
            groupId: tab.groupId,
            pinned: tab.pinned,
            index: tab.index,
          })),
        groups: groups
          .filter((group) =>
            currentWindow.tabs.some(
              (tab) => selectedTabs.includes(tab.id) && tab.groupId === group.id
            )
          )
          .map((group) => ({
            id: group.id,
            title: group.title,
            color: group.color,
            collapsed: group.collapsed,
          })),
      },
      createdAt: new Date().toISOString(),
    };

    this.projects.push(project);
    await this.saveProjects();
    this.renderProjects();
    this.closeModals();
  }

  // Search on Google
  searchOnGoogle(query) {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
      query
    )}`;
    chrome.tabs.create({ url: searchUrl });
  }

  // Settings Dropdown Methods
  toggleSettingsDropdown() {
    const dropdown = document.getElementById("settings-dropdown");
    if (dropdown.style.display === "none" || !dropdown.style.display) {
      dropdown.style.display = "block";
    } else {
      dropdown.style.display = "none";
    }
  }

  hideSettingsDropdown() {
    const dropdown = document.getElementById("settings-dropdown");
    dropdown.style.display = "none";
  }

  // Toggle Project Search
  toggleProjectSearch() {
    const searchContainer = document.getElementById(
      "projects-search-container"
    );
    const searchInput = document.getElementById("projects-search");

    this.projectsSearchVisible = !this.projectsSearchVisible;

    if (this.projectsSearchVisible) {
      searchContainer.style.display = "flex";
      searchInput.focus();
    } else {
      searchContainer.style.display = "none";
      searchInput.value = "";
      this.projectsSearchQuery = "";
      this.renderProjects();
    }
  }

  // Add to Project Methods
  pendingAddToProject = null;

  addTabToProject(tabId) {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    this.pendingAddToProject = {
      type: "tab",
      data: {
        url: tab.url,
        title: tab.title,
        groupId: chrome.tabGroups.TAB_GROUP_ID_NONE,
        pinned: tab.pinned,
        index: tab.index,
      },
    };

    this.openAddToProjectModal();
  }

  addTabGroupToProject(groupId) {
    const group = this.groups.find((g) => g.id === groupId);
    const tabs = this.tabs.filter((tab) => tab.groupId === groupId);

    if (!group || tabs.length === 0) return;

    this.pendingAddToProject = {
      type: "group",
      data: {
        group: {
          id: groupId,
          title: group.title,
          color: group.color,
          collapsed: group.collapsed,
        },
        tabs: tabs.map((tab) => ({
          url: tab.url,
          title: tab.title,
          groupId: tab.groupId,
          pinned: tab.pinned,
          index: tab.index,
        })),
      },
    };

    this.openAddToProjectModal();
  }

  addSavedGroupToProject(savedGroupId) {
    const savedGroup = this.savedGroups.find((g) => g.id === savedGroupId);
    if (!savedGroup) return;

    this.pendingAddToProject = {
      type: "savedGroup",
      data: {
        group: {
          id: Date.now(),
          title: savedGroup.name,
          color: savedGroup.color,
          collapsed: false,
        },
        tabs: savedGroup.tabs.map((tab, index) => ({
          url: tab.url,
          title: tab.title,
          groupId: Date.now(),
          pinned: false,
          index: index,
        })),
      },
    };

    this.openAddToProjectModal();
  }

  openAddToProjectModal() {
    document.getElementById("add-to-project-modal").style.display = "flex";
    this.resetAddToProjectModal();

    // Store selected project
    this.selectedProjectForAdd = null;

    // Render all projects initially
    this.renderProjectsForSelection();

    // Set up search functionality
    const searchInput = document.getElementById("project-search-add");
    searchInput.value = "";
    searchInput.addEventListener("input", (e) => {
      this.renderProjectsForSelection(e.target.value.toLowerCase());
    });
  }

  renderProjectsForSelection(searchQuery = "") {
    const container = document.getElementById("project-select-container");

    // Filter projects based on search
    let filteredProjects = this.projects;
    if (searchQuery) {
      filteredProjects = this.projects.filter((project) =>
        project.name.toLowerCase().includes(searchQuery)
      );
    }

    if (filteredProjects.length === 0) {
      container.innerHTML = `
        <div style="padding: 12px; text-align: center; color: #6b7280; font-size: 13px;">
          No projects found
        </div>
      `;
      return;
    }

    container.innerHTML = filteredProjects
      .map(
        (project) => `
      <div class="project-select-item" data-project-id="${project.id}" style="
        padding: 10px 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: background 0.2s;
        ${
          this.selectedProjectForAdd === project.id
            ? "background: #e0e7ff;"
            : ""
        }
      ">
        <span style="font-size: 16px;">${project.emoji || "📁"}</span>
        <span style="flex: 1; font-size: 14px; color: #374151;">${
          project.name
        }</span>
        ${
          this.selectedProjectForAdd === project.id
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="#4f46e5"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
            : ""
        }
      </div>
    `
      )
      .join("");

    // Add click handlers
    container.querySelectorAll(".project-select-item").forEach((item) => {
      item.addEventListener("click", () => {
        this.selectedProjectForAdd = item.dataset.projectId;
        this.renderProjectsForSelection(searchQuery);
      });

      item.addEventListener("mouseenter", () => {
        if (this.selectedProjectForAdd !== item.dataset.projectId) {
          item.style.background = "#f3f4f6";
        }
      });

      item.addEventListener("mouseleave", () => {
        if (this.selectedProjectForAdd !== item.dataset.projectId) {
          item.style.background = "";
        }
      });
    });
  }

  closeAddToProjectModal() {
    document.getElementById("add-to-project-modal").style.display = "none";
    this.pendingAddToProject = null;
  }

  resetAddToProjectModal() {
    document.getElementById("existing-project-selection").style.display =
      "none";
    document.getElementById("new-project-creation").style.display = "none";
    document.getElementById("new-project-name-add").value = "";
  }

  showExistingProjectSelection() {
    this.resetAddToProjectModal();
    document.getElementById("existing-project-selection").style.display =
      "block";
  }

  showNewProjectCreation() {
    this.resetAddToProjectModal();
    document.getElementById("new-project-creation").style.display = "block";
  }

  async confirmAddToProject() {
    if (!this.selectedProjectForAdd) {
      alert("Please select a project");
      return;
    }

    const project = this.projects.find(
      (p) => p.id === this.selectedProjectForAdd
    );

    if (!project || !this.pendingAddToProject) return;

    if (this.pendingAddToProject.type === "tab") {
      project.window.tabs.push(this.pendingAddToProject.data);
    } else if (
      this.pendingAddToProject.type === "group" ||
      this.pendingAddToProject.type === "savedGroup"
    ) {
      // Add group
      project.window.groups.push(this.pendingAddToProject.data.group);
      // Add tabs
      project.window.tabs.push(...this.pendingAddToProject.data.tabs);
    }

    await this.saveProjects();
    this.closeAddToProjectModal();
    alert("Added to project successfully!");
  }

  async confirmCreateAndAddToProject() {
    const projectName = document.getElementById("new-project-name-add").value;
    if (!projectName || !this.pendingAddToProject) return;

    const project = {
      id: Date.now().toString(),
      name: projectName,
      emoji: "📁",
      window: {
        tabs: [],
        groups: [],
      },
      createdAt: new Date().toISOString(),
    };

    if (this.pendingAddToProject.type === "tab") {
      project.window.tabs.push(this.pendingAddToProject.data);
    } else if (
      this.pendingAddToProject.type === "group" ||
      this.pendingAddToProject.type === "savedGroup"
    ) {
      project.window.groups.push(this.pendingAddToProject.data.group);
      project.window.tabs.push(...this.pendingAddToProject.data.tabs);
    }

    this.projects.push(project);
    await this.saveProjects();
    this.renderProjects();
    this.closeAddToProjectModal();
    alert("Project created successfully!");
  }

  // Update in Project functionality
  showUpdateProjectModal(groupId) {
    const group = this.groups.find((g) => g.id === groupId);
    const tabs = this.tabs.filter((tab) => tab.groupId === groupId);

    if (!group || tabs.length === 0) {
      alert("Group not found or empty");
      return;
    }

    if (this.projects.length === 0) {
      alert("No projects found. Please create a project first.");
      return;
    }

    // Store the group data for updating
    this.pendingUpdateGroup = {
      groupId: groupId,
      groupName: group.title || "Unnamed Group",
      tabs: tabs.map((tab) => ({
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        pinned: tab.pinned,
        index: tab.index,
      })),
    };

    // Create and show the update project modal
    this.createUpdateProjectModal();
  }

  createUpdateProjectModal() {
    // Remove existing modal if it exists
    const existingModal = document.getElementById("update-project-modal");
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal HTML
    const modalHTML = `
      <div class="modal-overlay" id="update-project-modal" style="display: flex;">
        <div class="modal-content" style="width: 500px; max-height: 600px;">
          <div class="modal-header">
            <h3>Update Tab Group in Project</h3>
            <button id="close-update-project-modal" class="close-btn">×</button>
          </div>
          <div class="modal-body">
            <div style="margin-bottom: 16px; padding: 12px; background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px;">
              <div style="font-weight: 600; color: #0369a1; margin-bottom: 4px;">Group to Update:</div>
              <div style="color: #075985; font-size: 14px;">${
                this.pendingUpdateGroup.groupName
              } (${this.pendingUpdateGroup.tabs.length} tabs)</div>
            </div>
            
            <div style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
                Select Project to Update:
              </label>
              <input 
                type="text" 
                id="update-project-search" 
                placeholder="Search projects..." 
                style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; margin-bottom: 12px;"
              >
              <div id="update-project-list" style="
                max-height: 300px;
                overflow-y: auto;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                background: white;
              ">
                ${this.renderProjectsForUpdate()}
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button id="cancel-update-project" class="secondary-button">Cancel</button>
            <button id="confirm-update-project" class="primary-button" disabled>Update Project</button>
          </div>
        </div>
      </div>
    `;

    // Add modal to DOM
    document.body.insertAdjacentHTML("beforeend", modalHTML);

    // Set up event listeners
    this.setupUpdateProjectModalListeners();
  }

  renderProjectsForUpdate(searchQuery = "") {
    let filteredProjects = this.projects;
    if (searchQuery) {
      filteredProjects = this.projects.filter((project) =>
        project.name.toLowerCase().includes(searchQuery)
      );
    }

    if (filteredProjects.length === 0) {
      return `
        <div style="padding: 20px; text-align: center; color: #6b7280; font-size: 13px;">
          No projects found
        </div>
      `;
    }

    return filteredProjects
      .map((project) => {
        const priorityColors = {
          "very-high": "#ef4444",
          high: "#f97316",
          medium: "#eab308",
          low: "#9ca3af",
        };
        const priorityColor = priorityColors[project.priority || "medium"];

        return `
            <div class="update-project-item" data-project-id="${
              project.id
            }" style="
              padding: 12px 16px;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 12px;
              transition: background 0.2s;
              border-bottom: 1px solid #f3f4f6;
            " onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background=''">
              <span class="project-priority-dot" style="
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background-color: ${priorityColor};
                flex-shrink: 0;
              "></span>
              <span style="font-size: 20px;">${project.emoji || "📁"}</span>
              <div style="flex: 1;">
                <div style="font-weight: 600; color: #111827; margin-bottom: 2px;">${this.escapeHtml(
                  project.name
                )}</div>
                <div style="font-size: 12px; color: #6b7280;">
                  ${project.window.tabs.length} tabs • ${
          project.window.groups.length
        } groups
                </div>
              </div>
              <svg class="selected-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" style="display: none;">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="#10b981"/>
              </svg>
            </div>
          `;
      })
      .join("");
  }

  setupUpdateProjectModalListeners() {
    const modal = document.getElementById("update-project-modal");
    const searchInput = document.getElementById("update-project-search");
    const projectList = document.getElementById("update-project-list");
    const cancelBtn = document.getElementById("cancel-update-project");
    const confirmBtn = document.getElementById("confirm-update-project");
    const closeBtn = document.getElementById("close-update-project-modal");

    let selectedProjectId = null;

    // Search functionality
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase();
      projectList.innerHTML = this.renderProjectsForUpdate(query);
      selectedProjectId = null;
      confirmBtn.disabled = true;
      this.setupProjectSelection();
    });

    // Project selection
    const setupProjectSelection = () => {
      projectList.querySelectorAll(".update-project-item").forEach((item) => {
        item.addEventListener("click", () => {
          // Remove previous selection
          projectList.querySelectorAll(".update-project-item").forEach((el) => {
            el.style.background = "";
            el.querySelector(".selected-icon").style.display = "none";
          });

          // Mark as selected
          item.style.background = "#ecfdf5";
          item.querySelector(".selected-icon").style.display = "block";
          selectedProjectId = item.dataset.projectId;
          confirmBtn.disabled = false;
        });
      });
    };

    this.setupProjectSelection = setupProjectSelection;
    setupProjectSelection();

    // Cancel/Close
    cancelBtn.addEventListener("click", () => {
      modal.remove();
      this.pendingUpdateGroup = null;
    });

    closeBtn.addEventListener("click", () => {
      modal.remove();
      this.pendingUpdateGroup = null;
    });

    // Confirm update
    confirmBtn.addEventListener("click", async () => {
      if (selectedProjectId && this.pendingUpdateGroup) {
        await this.updateTabGroupInProject(selectedProjectId);
        modal.remove();
        this.pendingUpdateGroup = null;
      }
    });

    // Close modal when clicking outside
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
        this.pendingUpdateGroup = null;
      }
    });
  }

  async updateTabGroupInProject(projectId) {
    try {
      const project = this.projects.find((p) => p.id === projectId);
      if (!project || !this.pendingUpdateGroup) {
        alert("Project not found or no group data");
        return;
      }

      const groupName = this.pendingUpdateGroup.groupName;
      const newTabs = this.pendingUpdateGroup.tabs;

      // Find existing group with the same name in the project
      const existingGroupIndex = project.window.groups.findIndex(
        (group) => group.title === groupName
      );

      if (existingGroupIndex !== -1) {
        // Update existing group
        const existingGroup = project.window.groups[existingGroupIndex];
        const existingGroupId = existingGroup.id;

        // Remove all tabs that belong to this group
        project.window.tabs = project.window.tabs.filter(
          (tab) => tab.groupId !== existingGroupId
        );

        // Add new tabs with the same group ID
        const updatedTabs = newTabs.map((tab) => ({
          ...tab,
          groupId: existingGroupId,
        }));

        project.window.tabs.push(...updatedTabs);

        alert(
          `Updated "${groupName}" in project "${project.name}" with ${newTabs.length} tabs`
        );
      } else {
        // Create new group in project
        const newGroupId = Date.now();
        const currentGroup = this.groups.find(
          (g) => g.id === this.pendingUpdateGroup.groupId
        );

        const newGroup = {
          id: newGroupId,
          title: groupName,
          color: currentGroup?.color || "blue",
          collapsed: false,
        };

        project.window.groups.push(newGroup);

        // Add tabs with new group ID
        const newTabsWithGroup = newTabs.map((tab) => ({
          ...tab,
          groupId: newGroupId,
        }));

        project.window.tabs.push(...newTabsWithGroup);

        alert(
          `Added new group "${groupName}" to project "${project.name}" with ${newTabs.length} tabs`
        );
      }

      // Save the updated project
      await this.saveProjects();
      this.renderProjects();
    } catch (error) {
      console.error("Error updating tab group in project:", error);
      alert("Error updating project: " + error.message);
    }
  }

  // Selection mode methods (placeholder for now)
  enterSelectionMode() {
    this.selectionMode = true;
    document
      .querySelector(".sidebar-container")
      .classList.add("selection-mode");
    document.getElementById("selection-controls").classList.add("active");
  }

  exitSelectionMode() {
    this.selectionMode = false;
    this.selectedTabs.clear();
    document
      .querySelector(".sidebar-container")
      .classList.remove("selection-mode");
    document.getElementById("selection-controls").classList.remove("active");
    document.querySelectorAll(".tab-item.selected").forEach((item) => {
      item.classList.remove("selected");
    });
  }

  async suspendSelectedTabs() {
    // Placeholder - implement when selection mode is fully implemented
    console.log("Suspend selected tabs");
  }

  async closeSelectedTabs() {
    // Placeholder - implement when selection mode is fully implemented
    console.log("Close selected tabs");
  }

  // Auto-refresh functionality
  startAutoRefresh() {
    // Listen for tab events that require refresh
    chrome.tabs.onCreated.addListener(() => this.debouncedRefresh());
    chrome.tabs.onRemoved.addListener(() => this.debouncedRefresh());
    chrome.tabs.onUpdated.addListener(() => this.debouncedRefresh());
    chrome.tabs.onMoved.addListener(() => this.debouncedRefresh());
    chrome.tabs.onAttached.addListener(() => this.debouncedRefresh());
    chrome.tabs.onDetached.addListener(() => this.debouncedRefresh());
    chrome.tabGroups.onCreated.addListener(() => this.debouncedRefresh());
    chrome.tabGroups.onRemoved.addListener(() => this.debouncedRefresh());
    chrome.tabGroups.onUpdated.addListener(() => this.debouncedRefresh());
    chrome.tabGroups.onMoved.addListener(() => this.debouncedRefresh());
  }
}

// Initialize sidebar
const sidebar = new PowerProjectSidebar();
