# Quick Fix: Export/Import Buttons Not Working

## The Problem

The Settings button and Manage Projects button aren't responding because the extension needs to be reloaded after the code updates.

## Solution Steps

### 1. Reload the Extension (REQUIRED)

1. Open Edge/Chrome and go to: `edge://extensions/` (for Edge) or `chrome://extensions/` (for Chrome)
2. Find "Power-Project" extension
3. Click the **Refresh/Reload** button (circular arrow icon) on the extension card
4. Close and reopen the extension sidebar

### 2. Where to Find the Buttons

#### Settings Button (⚙️)

- Location: **Top-right corner of the sidebar header**
- It's the rightmost icon in the header
- When clicked, opens a modal with Export/Import buttons

#### Manage Projects Button (⚙️)

- Location: **Bottom of the sidebar in the "Projects" bar**
- Look for the Projects section at the very bottom
- The gear icon is on the right side of the Projects header
- Opens the Project Manager with export/import icons

### 3. If Projects Bar is Minimized

If you don't see the Projects bar at the bottom:

- It might be minimized
- Look for a small bar at the bottom with an up arrow (^)
- Click it to expand the Projects section

## Edge Browser Compatibility

✅ The extension is fully compatible with Microsoft Edge

- Edge uses the same Chromium engine as Chrome
- All Chrome extension APIs work in Edge
- Data syncs through your Microsoft account (if Edge sync is enabled)

## Testing the Buttons

After reloading:

1. Click the Settings icon (⚙️) in the top-right
2. You should see "Export Backup" and "Import Backup" buttons
3. Click the Projects gear icon at the bottom
4. You should see export (📄) and import (📥) icons in the modal header

## Still Not Working?

If buttons still don't respond after reloading:

1. Check the browser console (F12) for any errors
2. Try disabling and re-enabling the extension
3. Make sure you're using the latest version of Edge/Chrome
