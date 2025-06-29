# Power Project Chrome Extension - Project Brief

## Overview

Power Project is a Chrome extension that provides enhanced tab management capabilities. The extension operates through a sidebar interface that allows users to organize, save, and manage their browser tabs and tab groups.

## Core Purpose

To provide users with a powerful and intuitive interface for managing browser tabs, including:

- Organizing tabs into groups
- Saving and restoring tab groups
- Managing recently closed tabs
- Searching through tabs and bookmarks
- Bulk operations on tabs

## Key Features

1. **Tab Groups Management**: View and manage browser tab groups
2. **All Tabs View**: See all ungrouped tabs
3. **Recently Closed**: Access and restore recently closed tabs
4. **Saved Groups**: Save tab groups for later restoration
5. **Search Functionality**: Search through tabs and bookmarks
6. **Quick Actions**: Suspend inactive tabs, group by domain
7. **Import/Export**: Save and load tab group configurations

## Technical Stack

- Chrome Extension Manifest V3
- Vanilla JavaScript
- HTML/CSS for UI
- Chrome Extension APIs (tabs, tabGroups, storage, sessions, bookmarks)

## Current Issues

1. Saved Groups expand/collapse functionality not working
2. Restore in new window not functioning
3. Delete saved group not working
4. Need explicit "Restore in Current Window" option
5. UI inconsistency between different sections
