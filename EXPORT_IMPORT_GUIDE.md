# Export/Import & Chrome Sync Guide for Power Project Extension

## Where to Find Export/Import Buttons

The extension provides **TWO locations** for export/import functionality:

### Location 1: Settings Modal (Header)

1. Click the **Settings icon (⚙️)** in the header of the sidebar
2. In the Settings modal, you'll see:
   - **Export Backup** button - exports both projects and saved groups
   - **Import Backup** button - imports both projects and saved groups

### Location 2: Project Manager Modal

1. Click the **Manage Projects icon (⚙️)** in the Projects bar at the bottom
2. In the Project Manager modal header, you'll see:
   - **Export Backup** button (📄 icon)
   - **Import Backup** button (📥 icon)

## How Export/Import Works

### Export:

- Click either Export button
- A file named `power-project-backup-YYYY-MM-DD.json` will download
- This file contains BOTH:
  - All your projects
  - All your saved groups

### Import:

- Click either Import button
- Select your backup JSON file
- The extension will merge the data, avoiding duplicates
- You'll see a confirmation of how many items were imported

## Chrome Sync Setup

Chrome Sync is already implemented in the code, but requires:

1. **Sign into Chrome**

   - Click your profile icon in Chrome
   - Sign in with your Google account

2. **Enable Chrome Sync**

   - Go to Chrome Settings → You and Google
   - Turn on "Sync and Google services"
   - Make sure "Extensions" is enabled in sync settings

3. **Load Extension on Other Devices**
   - Sign into Chrome with the same Google account
   - Install the extension
   - Your data should appear automatically

## Troubleshooting Sync Issues

If sync isn't working:

1. **Check Chrome Sign-in Status**

   - Open chrome://settings/
   - Verify you're signed in at the top

2. **Check Sync Settings**

   - Go to chrome://settings/syncSetup
   - Ensure "Extensions" is checked

3. **For Unpublished Extensions**

   - Chrome sync works best with published extensions
   - For development/local extensions, sync may be limited
   - Use the Export/Import feature as a reliable backup

4. **Storage Limits**
   - Chrome sync has a 100KB total limit
   - If you have lots of data, you may hit this limit
   - Export/Import has no such limitations

## Quick Test

To verify the buttons are working:

1. Open the extension sidebar
2. Click the Settings icon (⚙️) in the header
3. You should see the Export/Import buttons in the modal
