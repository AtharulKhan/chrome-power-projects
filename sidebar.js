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
          this.switchToTab(tabId);
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
          this.openBookmark(url);
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

    // Context menu
    document.addEventListener("contextmenu", (e) => {
      if (e.target.closest(".tab-item")) {
        e.preventDefault();
        this.showContextMenu(e, e.target.closest(".tab-item"));
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

    document
      .getElementById("create-project-btn")
      .addEventListener("click", () => {
        this.createProjectFromSelection();
      });

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

  filterAndRender() {
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

    this.renderTabs(filteredTabs);
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

  render() {
    this.renderGroups();
    this.filterAndRender();
    this.renderSavedGroups();
  }

  renderGroups() {
    const container = document.getElementById("groups-content");

    // Group tabs by window
    const windowGroups = new Map();
    this.tabs.forEach((tab) => {
      if (!windowGroups.has(tab.windowId)) {
        windowGroups.set(tab.windowId, []);
      }
      windowGroups.get(tab.windowId).push(tab);
    });

    // Render groups organized by window
    let html = "";
    let windowIndex = 0;

    for (const [windowId, windowTabs] of windowGroups) {
      windowIndex++;
      const windowGroupTabs = windowTabs.filter(
        (tab) => tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE
      );
      const groupsInWindow = this.groups.filter((group) =>
        windowGroupTabs.some((tab) => tab.groupId === group.id)
      );

      if (groupsInWindow.length > 0) {
        const isWindowCollapsed = this.collapsedWindows.has(windowId);
        html += `
          <div class="window-section" data-window-id="${windowId}">
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
                const groupTabs = windowTabs.filter(
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

  renderTabs(tabs) {
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

    container.innerHTML = ungroupedTabs
      .map((tab) => this.createTabHTML(tab))
      .join("");
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
  }

  handleContextMenuAction(action, tabId) {
    switch (action) {
      case "pin":
        this.pinTab(tabId);
        break;
      case "duplicate":
        this.duplicateTab(tabId);
        break;
      case "close-other":
        this.closeOtherTabs(tabId);
        break;
      case "close-left":
        this.closeTabsToLeft(tabId);
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
              <img class="tab-favicon" src="chrome://favicon/size/16@1x/${
                tab.url
              }" 
                   onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\'><path fill=\\' %23999\\' d=\\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z\\'/></svg>'"
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

    this.renderSearchResults();
  }

  renderSearchResults() {
    const container = document.getElementById("search-results");
    let html = "";

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
    if (this.searchResults.tabs.length > 0) {
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
    if (this.searchResults.groups.length > 0) {
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
    if (this.searchResults.bookmarks.length > 0) {
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
                 src="${faviconUrl}" 
                 onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\'><path fill=\\' %23999\\' d=\\'M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z\\'/></svg>'"
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

    if (html === "") {
      html =
        '<div style="padding: 20px; text-align: center; color: #94a3b8;">No results found</div>';
    }

    container.innerHTML = html;
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

    container.innerHTML = filteredProjects
      .map(
        (project) => `
      <div class="project-item ${
        project.id === this.activeProjectId ? "active" : ""
      }" data-project-id="${project.id}">
        <span class="project-emoji">${project.emoji || "📁"}</span>
        <span class="project-name">${project.name}</span>
      </div>
    `
      )
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

    // Change the button text and action
    const createBtn = document.getElementById("create-project-btn");
    createBtn.textContent = "Update Project";

    // Store the project ID for updating
    this.editingProjectId = projectId;

    // Render tabs with pre-selected ones from the project
    await this.renderTabSelectionForEdit(project);

    // Update button click handler
    createBtn.onclick = () => this.updateProjectFromSelection();
  }

  async renderTabSelectionForEdit(project) {
    const container = document.getElementById("tab-selection-container");
    const currentWindow = await chrome.windows.getCurrent({ populate: true });
    const groups = await chrome.tabGroups.query({ windowId: currentWindow.id });

    // Create a set of URLs from the project for easy checking
    const projectTabUrls = new Set(project.window.tabs.map((tab) => tab.url));

    let html = "";

    // Render groups with their tabs
    groups.forEach((group) => {
      const groupTabs = currentWindow.tabs.filter(
        (tab) => tab.groupId === group.id
      );
      if (groupTabs.length > 0) {
        const hasSelectedTabs = groupTabs.some((tab) =>
          projectTabUrls.has(tab.url)
        );
        html += `
          <div class="selection-group">
            <div class="selection-group-header">
              <input type="checkbox" id="group-${
                group.id
              }" class="group-checkbox" data-group-id="${group.id}" ${
          hasSelectedTabs ? "checked" : ""
        }>
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
                  }" data-group-id="${group.id}" ${
                    projectTabUrls.has(tab.url) ? "checked" : ""
                  }>
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
      const hasSelectedTabs = ungroupedTabs.some((tab) =>
        projectTabUrls.has(tab.url)
      );
      html += `
        <div class="selection-group">
          <div class="selection-group-header">
            <input type="checkbox" id="ungrouped" class="group-checkbox" data-group-id="ungrouped" ${
              hasSelectedTabs ? "checked" : ""
            }>
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
                }" class="tab-checkbox" data-tab-id="${tab.id}" ${
                  projectTabUrls.has(tab.url) ? "checked" : ""
                }>
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

  async updateProjectFromSelection() {
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

    const currentWindow = await chrome.windows.getCurrent({ populate: true });
    const groups = await chrome.tabGroups.query({ windowId: currentWindow.id });

    // Find and update the project
    const project = this.projects.find((p) => p.id === this.editingProjectId);
    if (!project) return;

    project.name = projectName;
    project.window = {
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
    };

    await this.saveProjects();
    this.renderProjects();
    this.closeModals();

    // Reset the button
    const createBtn = document.getElementById("create-project-btn");
    createBtn.textContent = "Create Project";
    createBtn.onclick = () => this.createProjectFromSelection();
    this.editingProjectId = null;
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

  openNewProjectModal() {
    this.closeModals();
    document.getElementById("new-project-modal").style.display = "flex";
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

    const currentWindow = await chrome.windows.getCurrent({ populate: true });
    const groups = await chrome.tabGroups.query({ windowId: currentWindow.id });

    const project = {
      id: Date.now().toString(),
      name: projectName,
      emoji: "📁",
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

    // Populate project selection
    const select = document.getElementById("project-select");
    select.innerHTML = this.projects
      .map(
        (project) => `
      <option value="${project.id}">${project.emoji} ${project.name}</option>
    `
      )
      .join("");
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
    const projectId = document.getElementById("project-select").value;
    const project = this.projects.find((p) => p.id === projectId);

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
