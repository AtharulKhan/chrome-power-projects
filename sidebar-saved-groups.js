// Saved Groups Manager - Clean Implementation
class SavedGroupsManager {
  constructor() {
    this.savedGroups = [];
    this.init();
  }

  async init() {
    await this.loadGroups();
  }

  async loadGroups() {
    try {
      const result = await chrome.storage.sync.get("savedGroups");
      this.savedGroups = result.savedGroups || [];
      console.log("Loaded saved groups:", this.savedGroups.length);
      return this.savedGroups;
    } catch (error) {
      console.error("Error loading saved groups:", error);
      this.savedGroups = [];
      return [];
    }
  }

  async saveGroup(groupData) {
    try {
      const savedGroup = {
        id: Date.now().toString(),
        name: groupData.name,
        color: groupData.color || "blue",
        tabs: groupData.tabs.map((tab) => ({
          title: tab.title,
          url: tab.url,
          favIconUrl: tab.favIconUrl,
          pinned: tab.pinned || false,
        })),
        savedAt: new Date().toISOString(),
        tabCount: groupData.tabs.length,
      };

      // Load current groups to ensure we have the latest
      await this.loadGroups();

      // Add new group at the beginning
      this.savedGroups.unshift(savedGroup);

      // Save to storage
      await chrome.storage.sync.set({ savedGroups: this.savedGroups });

      console.log("Group saved successfully:", savedGroup.name);
      return savedGroup;
    } catch (error) {
      console.error("Error saving group:", error);
      throw error;
    }
  }

  async deleteGroup(groupId) {
    try {
      this.savedGroups = this.savedGroups.filter((g) => g.id !== groupId);
      await chrome.storage.sync.set({ savedGroups: this.savedGroups });
      console.log("Group deleted:", groupId);
      return true;
    } catch (error) {
      console.error("Error deleting group:", error);
      return false;
    }
  }

  async restoreGroup(groupId, inNewWindow = false) {
    try {
      const savedGroup = this.savedGroups.find((g) => g.id === groupId);
      if (!savedGroup) {
        throw new Error("Saved group not found");
      }

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

      // Group the tabs
      if (tabIds.length > 0) {
        const groupId = await chrome.tabs.group({ tabIds });
        await chrome.tabGroups.update(groupId, {
          title: savedGroup.name,
          color: savedGroup.color || "blue",
        });
      }

      console.log("Group restored:", savedGroup.name);
      return true;
    } catch (error) {
      console.error("Error restoring group:", error);
      return false;
    }
  }

  renderSavedGroups(container) {
    if (!this.savedGroups || this.savedGroups.length === 0) {
      container.innerHTML =
        '<div class="empty-state">No saved groups yet. Save a tab group to see it here!</div>';
      return;
    }

    container.innerHTML = this.savedGroups
      .map(
        (group) => `
      <div class="saved-group" data-saved-group-id="${group.id}">
        <div class="saved-group-header">
          <div class="saved-group-info">
            <div class="group-color" style="background-color: ${
              group.color || "blue"
            }"></div>
            <span class="saved-group-name">${this.escapeHtml(group.name)}</span>
            <span class="group-count">${group.tabCount}</span>
          </div>
          <div class="saved-group-actions">
            <button class="action-btn" onclick="savedGroupsManager.restoreGroup('${
              group.id
            }', false)" title="Restore in Current Window">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
              </svg>
            </button>
            <button class="action-btn" onclick="savedGroupsManager.restoreGroup('${
              group.id
            }', true)" title="Restore in New Window">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
              </svg>
            </button>
            <button class="action-btn close" onclick="savedGroupsManager.deleteGroupWithConfirm('${
              group.id
            }')" title="Delete Saved Group">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="saved-group-preview">
          ${group.tabs
            .slice(0, 3)
            .map(
              (tab) => `
            <div class="saved-tab-preview">
              <img src="${
                tab.favIconUrl ||
                'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%23999" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>'
              }" alt="">
              <span>${this.escapeHtml(tab.title)}</span>
            </div>
          `
            )
            .join("")}
          ${
            group.tabs.length > 3
              ? `<div class="saved-tab-preview more">+${
                  group.tabs.length - 3
                } more</div>`
              : ""
          }
        </div>
      </div>
    `
      )
      .join("");
  }

  async deleteGroupWithConfirm(groupId) {
    if (confirm("Are you sure you want to delete this saved group?")) {
      await this.deleteGroup(groupId);
      // Re-render the saved groups
      const container = document.getElementById("saved-groups-content");
      if (container) {
        this.renderSavedGroups(container);
      }
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// Create global instance
window.savedGroupsManager = new SavedGroupsManager();
