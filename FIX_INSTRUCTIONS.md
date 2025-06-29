# Immediate Fix for Export/Import Error

## The Problem

The sidebar.js file has references to HTML elements that were removed when the UI was updated. This causes JavaScript errors when the extension loads.

## Quick Solution

### Find and Remove These Lines (around line 160-177 in sidebar.js):

```javascript
// Saved groups functionality
document.getElementById("export-groups").addEventListener("click", () => {
  this.exportSavedGroups();
});

document.getElementById("import-groups-btn").addEventListener("click", () => {
  document.getElementById("import-groups").click();
});

document.getElementById("import-groups").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    this.importSavedGroups(file);
  }
});
```

### These Lines Should Be Removed Because:

1. The "export-groups" element doesn't exist in the HTML
2. The "import-groups-btn" element doesn't exist in the HTML
3. The "import-groups" element doesn't exist in the HTML
4. These were from an old UI design that has been replaced

### The Export/Import Functionality Still Works!

The export/import feature is still available through:

1. **Settings Modal** - Click the ⚙️ icon in the header
2. **Projects Manager** - Click "Manage Projects" button

Both use the same `exportAllData()` and `importAllData()` methods that are already in the code.

## How to Fix:

1. Open `sidebar.js`
2. Find the lines mentioned above (search for "export-groups")
3. Delete those lines completely
4. Save the file
5. Reload the extension

## Testing After Fix:

1. Click the extension icon to open sidebar
2. Click the ⚙️ settings icon
3. Try "Export Backup" - should download a JSON file
4. Try "Import Backup" - should let you select the JSON file
5. Check that projects and saved groups are imported correctly

The extension should now work without errors!
