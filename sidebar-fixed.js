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
    const minimizeBtn = document.getElementById("minimize-projects");
    if (minimizeBtn) {
      minimizeBtn.addEventListener("click", () => {
        this.toggleProjectsBar();
      });
    }

    // Search functionality
    const searchInput = document.getElementById("search-input");
    const clearSearch = document.getElementById("clear-search");

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        if (clearSearch) {
          clearSearch.style.display = this.searchQuery ? "block" : "none";
        }

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
    }

    if (clearSearch) {
      clearSearch.addEventListener("click", () => {
        if (searchInput) {
          searchInput.value = "";
          this.searchQuery = "";
          clearSearch.style.display = "none";
          this.clearSearch();
        }
      });
    }

    // Sort functionality
    const sortSelect = document.getElementById("sort-tabs");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        this.sortType = e.target.value;
        this.filterAndRender();
      });
    }

    // Quick actions - now in header
    const suspendBtn = document.getElementById("suspend-inactive");
    if (suspendBtn) {
      suspendBtn.addEventListener("click", () => {
        this.suspendInactiveTabs();
      });
    }

    const groupByDomainBtn = document.getElementById("group-by-domain");
    if (groupByDomainBtn) {
      groupByDomainBtn.addEventListener("click", () => {
        this.groupTabsByDomain();
      });
    }

    const newGroupBtn = document.getElementById("new-group-btn");
    if (newGroupBtn) {
      newGroupBtn.addEventListener("click", () => {
        this.createNewGroup();
      });
    }

    // Settings functionality
    const settingsBtn = document.getElementById("settings-btn");
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        this.openSettingsModal();
      });
    }

    const closeSettingsBtn = document.getElementById("close-settings-modal");
    if (closeSettingsBtn) {
      closeSettingsBtn.addEventListener("click", () => {
        this.closeSettingsModal();
      });
    }

    // Settings export/import
    const settingsExportBtn = document.getElementById("settings-export-backup");
    if (settingsExportBtn) {
      settingsExportBtn.addEventListener("click", () => {
        this.exportAllData();
      });
    }

    const settingsImportBtn = document.getElementById("settings-import-backup");
    if (settingsImportBtn) {
      settingsImportBtn.addEventListener("click", () => {
        const fileInput = document.getElementById("settings-import-file");
        if (fileInput) {
          fileInput.click();
        }
      });
    }

    const settingsImportFile = document.getElementById("settings-import-file");
    if (settingsImportFile) {
      settingsImportFile.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          this.importAllData(file);
          e.target.value = ""; // Reset file input
        }
      });
    }

    // Backup functionality in projects modal
    const exportBackupBtn = document.getElementById("export-backup-btn");
    if (exportBackupBtn) {
      exportBackupBtn.addEventListener("click", () => {
        this.exportAllData();
      });
    }

    const importBackupBtn = document.getElementById("import-backup-btn");
    if (importBackupBtn) {
      importBackupBtn.addEventListener("click", () => {
        const fileInput = document.getElementById("import-backup-file");
        if (fileInput) {
          fileInput.click();
        }
      });
    }

    const importBackupFile = document.getElementById("import-backup-file");
    if (importBackupFile) {
      importBackupFile.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          this.importAllData(file);
          e.target.value = ""; // Reset file input
        }
      });
    }

    // Selection controls
    const suspendSelectedBtn = document.getElementById("suspend-selected");
    if (suspendSelectedBtn) {
      suspendSelectedBtn.addEventListener("click", () => {
        this.suspendSelectedTabs();
      });
    }

    const closeSelectedBtn = document.getElementById("close-selected");
    if (closeSelectedBtn) {
      closeSelectedBtn.addEventListener("click", () => {
        this.closeSelectedTabs();
      });
    }

    const cancelSelectionBtn = document.getElementById("cancel-selection");
    if (cancelSelectionBtn) {
      cancelSelectionBtn.addEventListener("click", () => {
        this.exitSelectionMode();
      });
    }

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

    // Projects functionality
    const searchProjectsBtn = document.getElementById("search-projects-btn");
    if (searchProjectsBtn) {
      searchProjectsBtn.addEventListener("click", () => {
        this.toggleProjectSearch();
      });
    }

    // Projects search input
    const projectsSearch = document.getElementById("projects-search");
    if (projectsSearch) {
      projectsSearch.addEventListener("input", (e) => {
        this.projectsSearchQuery = e.target.value.toLowerCase();
        this.renderProjects();
      });
    }

    // Saved groups search input
    const savedGroupsSearch = document.getElementById("saved-groups-search");
    if (savedGroupsSearch) {
      savedGroupsSearch.addEventListener("input", (e) => {
        this.savedGroupsSearchQuery = e.target.value.toLowerCase();
        this.renderSavedGroups();
      });
    }

    const saveProjectBtn = document.getElementById("save-project-btn");
    if (saveProjectBtn) {
      saveProjectBtn.addEventListener("click", () => {
        this.saveCurrentWindowAsProject();
      });
    }

    const manageProjectsBtn = document.getElementById("manage-projects-btn");
    if (manageProjectsBtn) {
      manageProjectsBtn.addEventListener("click", () => {
        this.openProjectsManager();
      });
    }

    // Event delegation for project items
    const projectsList = document.getElementById("projects-list");
    if (projectsList) {
      projectsList.addEventListener("click", (e) => {
        const projectItem = e.target.closest(".project-item");
        if (projectItem) {
          const projectId = projectItem.dataset.projectId;
          this.switchToProject(projectId);
        }
      });

      // Right-click context menu for projects
      projectsList.addEventListener("contextmenu", (e) => {
        const projectItem = e.target.closest(".project-item");
        if (projectItem) {
          e.preventDefault();
          const projectId = projectItem.dataset.projectId;
          this.editProject(projectId);
        }
      });
    }

    // Projects modal search
    const projectsModalSearch = document.getElementById("projects-modal-search");
    if (projectsModalSearch) {
      projectsModalSearch.addEventListener("input", (e) => {
        this.projectsModalSearchQuery = e.target.value.toLowerCase();
        this.renderProjectsModal();
      });
    }

    // Modal event listeners
    const closeProjectsModal = document.getElementById("close-projects-modal");
    if (closeProjectsModal) {
      closeProjectsModal.addEventListener("click", () => {
        this.closeModals();
      });
    }

    const closeNewProjectModal = document.getElementById("close-new-project-modal");
    if (closeNewProjectModal) {
      closeNewProjectModal.addEventListener("click", () => {
        this.closeModals();
      });
    }

    const newProjectModalBtn = document.getElementById("new-project-modal-btn");
    if (newProjectModalBtn) {
      newProjectModalBtn.addEventListener("click", () => {
        this.openNewProjectModal();
      });
    }

    const cancelNewProject = document.getElementById("cancel-new-project");
    if (cancelNewProject) {
      cancelNewProject.addEventListener("click", () => {
        this.closeModals();
      });
    }

    const createProjectBtn = document.getElementById("create-project-btn");
    if (createProjectBtn) {
      createProjectBtn.addEventListener("click", () => {
        this.createProjectFromSelection();
      });
    }

    // Add to Project Modal event listeners
    const closeAddToProjectModal = document.getElementById("close-add-to-project-modal");
    if (closeAddToProjectModal) {
      closeAddToProjectModal.addEventListener("click", () => {
        this.closeAddToProjectModal();
      });
    }

    const addToExistingProject = document.getElementById("add-to-existing-project");
    if (addToExistingProject) {
      addToExistingProject.addEventListener("click", () => {
        this.showExistingProjectSelection();
      });
    }

    const createNewProjectForAdd = document.getElementById("create-new-project-for-add");
    if (createNewProjectForAdd) {
      createNewProjectForAdd.addEventListener("click", () => {
        this.showNewProjectCreation();
      });
    }

    const cancelAddToProject = document.getElementById("cancel-add-to-project");
    if (cancelAddToProject) {
      cancelAddToProject.addEventListener("click", () => {
        this.closeAddToProjectModal();
      });
    }

    const confirmAddToProject = document.getElementById("confirm-add-to-project");
    if (confirmAddToProject) {
      confirmAddToProject.addEventListener("click", () => {
        this.confirmAddToProject();
      });
    }

    const cancelCreateProjectAdd = document.getElementById("cancel-create-project-add");
    if (cancelCreateProjectAdd) {
      cancelCreateProjectAdd.addEventListener("click", () => {
        this.closeAddToProjectModal();
      });
    }

    const confirmCreateProjectAdd = document.getElementById("confirm-create-project-add");
    if (confirmCreateProjectAdd) {
      confirmCreateProjectAdd.addEventListener("click", () => {
        this.confirmCreateAndAddToProject();
      });
    }

    // Close modals when clicking outside
    document.querySelectorAll(".modal-overlay").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          this.closeModals();
        }
      });
    });

    // Event delegation for project modal buttons
    const projectsListModal = document.getElementById("projects-list-modal");
    if (projectsListModal) {
      projectsListModal.addEventListener("click", (e) => {
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
    if (badge) {
      badge.textContent = this.tabs.length;
    }
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
    if (!container) return;

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
