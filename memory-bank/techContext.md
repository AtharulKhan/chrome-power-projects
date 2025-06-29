# Technical Context - Power Project Chrome Extension

## Technologies Used

### Core Technologies

- **Chrome Extension Manifest V3**: Latest extension platform
- **Vanilla JavaScript ES6+**: No framework dependencies
- **HTML5/CSS3**: Modern web standards
- **Chrome Extension APIs**:
  - `chrome.tabs`: Tab management
  - `chrome.tabGroups`: Group operations
  - `chrome.storage`: Persistent data
  - `chrome.sessions`: Recently closed tabs
  - `chrome.bookmarks`: Bookmark access
  - `chrome.windows`: Window management

### Development Setup

1. Load unpacked extension in Chrome
2. Open sidebar from extension icon
3. Developer tools for debugging
4. No build process required (vanilla JS)

### Key Technical Constraints

- **Manifest V3 Limitations**:
  - Service worker instead of background page
  - Restricted host permissions
  - Declarative content scripts
- **Performance**:
  - Large number of tabs can slow operations
  - DOM manipulation costs with many elements
- **Storage Limits**:
  - chrome.storage.local: 5MB limit
  - Need to manage saved groups size

### API Usage Patterns

#### Tab Operations

```javascript
// Get all tabs
chrome.tabs.query({}, (tabs) => {});

// Create tab
chrome.tabs.create({ url, windowId, active });

// Update tab
chrome.tabs.update(tabId, { active, pinned });

// Remove tabs
chrome.tabs.remove([tabIds]);
```

#### Group Operations

```javascript
// Create group
chrome.tabs.group({ tabIds });

// Update group
chrome.tabGroups.update(groupId, { title, color });

// Query groups
chrome.tabGroups.query({});
```

#### Storage Operations

```javascript
// Save data
chrome.storage.local.set({ key: value });

// Retrieve data
chrome.storage.local.get(["key"], (result) => {});
```

### Error Handling Patterns

- Try-catch blocks around Chrome API calls
- Graceful degradation for missing permissions
- Console warnings for non-critical failures
- User feedback for critical operations

### Browser Compatibility

- Chrome/Edge (Chromium-based browsers)
- Not compatible with Firefox (different API)
- Requires Chrome 88+ for full tabGroups API
