# Active Context

## Current Focus: Project Management Features - COMPLETED

### Issues Resolved

1. Modified the project opening functionality to preserve existing tabs when opening a project
2. Added a confirmation dialog when opening projects
3. Added "Clear All Tabs" button to the project edit modal
4. Implemented searchable dropdown for "Add to Project" modal

### Recent Changes

1. **Modified `switchToProject` function in sidebar.js**:

   - Removed the code that was deleting existing tabs when opening a project
   - Removed the `existingTabs` query and the `chrome.tabs.remove()` call
   - Now when opening a project, it adds the project's tabs to the current window alongside existing tabs
   - Added a confirmation dialog that warns users before opening a project
   - The dialog shows the project name and number of tabs that will be added

2. **Enhanced `editProject` function in sidebar.js**:

   - Added a "Clear All Tabs" button that appears when editing a project
   - The button is positioned next to the "Update Project" button
   - Button is hidden when creating a new project (only shows in edit mode)

3. **Added `clearProjectTabs` function in sidebar.js**:

   - Shows a confirmation dialog before clearing tabs
   - Clears all tabs and groups from the project
   - Updates the UI to show no tabs selected
   - Shows an alert confirming the action was completed

4. **Updated CSS in sidebar.css**:

   - Added `.secondary-button` class for the "Clear All Tabs" button styling
   - Matches the design system with gray background and hover effects

5. **Implemented Searchable Dropdown for "Add to Project" Modal**:

   - Replaced static `<select>` dropdown with a searchable interface
   - Added search input field to filter projects in real-time
   - Projects are displayed as clickable items with visual selection feedback
   - Selected project shows with blue background and checkmark icon
   - Empty state message when no projects match the search
   - Modified `openAddToProjectModal`, `renderProjectsForSelection`, and `confirmAddToProject` functions

6. **Fixed Project Edit Modal to Show Project's Tabs**:
   - Modified `renderTabSelectionForEdit` to display tabs that belong to the project (not current window tabs)
   - Added individual delete buttons (X) next to each tab for easy removal
   - Shows helpful text explaining that unchecked tabs will be removed from the project
   - Updated `updateProjectFromSelection` to work with project tab indices instead of window tab IDs
   - Groups are automatically removed if all their tabs are unchecked

### Key Implementation Details

The change was simple but important:

- **Before**: The function would query all existing tabs in the current window and delete them before creating the project tabs
- **After**: The function now only creates the new project tabs, leaving existing tabs untouched

This aligns with the "Non-Destructive" user experience goal outlined in the product context.

### Technical Implementation

Removed this code block from `switchToProject`:

```javascript
// Get existing tabs
const existingTabs = await chrome.tabs.query({
  windowId: currentWindow.id,
});

// Now close the old tabs (after new tabs are created to prevent window closure)
if (existingTabs.length > 0) {
  await chrome.tabs.remove(existingTabs.map((tab) => tab.id));
}
```

### Next Steps

1. Test the implementation to ensure projects open correctly alongside existing tabs
2. Consider if users might want an option to choose between:
   - Opening project alongside existing tabs (current behavior)
   - Opening project in a new window
   - Replacing current tabs (old behavior)

## Current Focus: Delete Project Feature - COMPLETED

### Issue Resolved

Added a "Delete Project" option to the right-click context menu for saved groups/projects.

### Recent Changes

1. **Added Saved Group Context Menu in sidebar.html**:

   - Created a new context menu specifically for saved groups
   - Added "Delete Project" option with a separator above it
   - Includes all relevant actions: Restore in Current/New Window, Add to Project, Edit Name

2. **Updated Event Listeners in sidebar.js**:
   - Modified the contextmenu event listener to detect right-clicks on saved groups
   - Added `showSavedGroupContextMenu()` method to display the context menu at mouse position
   - Added `handleSavedGroupContextMenuAction()` method to handle all context menu actions
   - Added `confirmDeleteSavedGroup()` method that shows a confirmation dialog before deletion
   - Updated `hideContextMenu()` to hide both tab and saved group context menus

### Key Implementation Details

The implementation follows the existing pattern for tab context menus:

- Uses event delegation to detect right-clicks on elements with `.saved-group` class
- Shows context menu at the exact mouse position
- Properly hides menu when clicking elsewhere
- Includes confirmation dialog to prevent accidental deletions

### Technical Implementation

Added this to the contextmenu event listener:

```javascript
else if (e.target.closest(".saved-group")) {
  e.preventDefault();
  this.showSavedGroupContextMenu(e, e.target.closest(".saved-group"));
}
```

The confirmation dialog shows the project name:

```javascript
if (
  confirm(`Are you sure you want to delete the project "${savedGroup.name}"?`)
) {
  await this.deleteSavedGroup(savedGroupId);
}
```
