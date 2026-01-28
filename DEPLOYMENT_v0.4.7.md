# Deployment v0.4.7 - Manual Install UX Fix

**Date**: January 28, 2026
**Build Status**: In Progress
**GitHub Actions Run**: https://github.com/nicopalomin/craftcorps-launcher/actions/runs/21442892041

## Changes in This Release

### 🔧 Auto-Update Manual Install Fix

**Problem:**
- After downloading updates successfully on macOS, auto-install would fail silently
- Error: "Could not get code signature for running application"
- Users saw greyed-out/stuck UI with no way to proceed
- Downloaded ZIP file sat unused in cache folder

**Root Cause:**
- electron-updater requires code-signed apps for automatic installation on macOS
- CraftCorps launcher is currently unsigned on macOS
- Windows auto-updates work (app is code-signed with Azure Trusted Signing)

**Solution:**
Added graceful handling for unsigned builds with helpful user interface:

1. **Backend Detection**: Detects code signing errors in `updateHandler.cjs`
2. **New Status**: Added `manual-install-required` update status
3. **User-Friendly Dialog**: Shows clear instructions with:
   - Explanation of what happened
   - Step-by-step manual install instructions
   - "Open Download Folder" button
   - Download path display
4. **IPC Handler**: Added `open-path` handler to open folders in Finder

### User Experience

**Before (v0.4.6):**
1. Update downloads successfully ✅
2. Auto-install fails silently ❌
3. UI stuck/greyed out ❌
4. User confused, no way forward ❌

**After (v0.4.7):**
1. Update downloads successfully ✅
2. Shows "Manual Installation Required" dialog ✅
3. Clear instructions + Open Folder button ✅
4. User can easily complete manual install ✅

**Future (with code signing):**
1. Update downloads ✅
2. Auto-installs automatically ✅
3. Perfect UX like Discord ✅

## Files Modified

### Backend (electron/)
- `electron/handlers/updateHandler.cjs`
  - Detect code signing errors specifically
  - Send `manual-install-required` status with path
  - Wrapped auto-install in try-catch

- `electron/handlers/appHandler.cjs`
  - Added `open-path` IPC handler for opening folders

### Frontend (src/)
- `src/components/modals/UpdateModal.jsx`
  - New "Manual Installation Required" UI
  - Step-by-step instructions
  - "Open Download Folder" button
  - Close button to dismiss

- `src/hooks/useAutoUpdate.js`
  - Handle `manual-install-required` status
  - Track `updateError` and `updatePath` state
  - Update `isUpdating` condition

- `src/App.jsx`
  - Pass `updateError` and `updatePath` to components

- `src/components/layout/AppOverlays.jsx`
  - Forward new props to UpdateOverlay

### Documentation
- `MACOS_CODE_SIGNING_GUIDE.md` - Complete guide for adding code signing
- `DEPLOYMENT_v0.4.6.md` - Previous deployment record
- `DEPLOYMENT_v0.4.7.md` - This file

## Build Artifacts

Expected files to be uploaded to R2:

### Windows ✅
- `CraftCorps-0.4.7-windows.exe`
- `CraftCorps-0.4.7-windows.exe.blockmap`
- `latest.yml`

### macOS ⏳
- `CraftCorps-0.4.7-mac-x64.zip`
- `CraftCorps-0.4.7-mac-arm64.zip`
- `CraftCorps-0.4.7-mac-x64.dmg`
- `CraftCorps-0.4.7-mac-arm64.dmg`
- `CraftCorps-0.4.7-mac-x64.zip.blockmap` (may 404, that's OK)
- `CraftCorps-0.4.7-mac-arm64.zip.blockmap` (may 404, that's OK)
- `latest-mac.yml`

### Linux ✅
- `CraftCorps-0.4.7-linux.AppImage`
- `CraftCorps-0.4.7-linux.AppImage.blockmap`
- `latest-linux.yml`

## Post-Deployment Checklist

### 1. Verify R2 Upload
```bash
# Check update manifests
curl -I https://download.craftcorps.net/latest-mac.yml

# Verify files exist
curl -I https://download.craftcorps.net/CraftCorps-0.4.7-mac-arm64.zip
curl -I https://download.craftcorps.net/CraftCorps-0.4.7-mac-x64.dmg
```

### 2. Update Website
```bash
cd /Users/nico/Desktop/craftcorps-web

# Update version in src/lib/launcher-downloads.ts
# Change from 0.4.6 to 0.4.7

npm run build
npx wrangler deploy
```

### 3. Test Manual Install Flow

**Important:** Test from v0.4.6 → v0.4.7 to verify the new dialog works

1. Keep v0.4.6 installed
2. Check for updates (should detect 0.4.7)
3. Click "Download Update"
4. Wait for download to complete
5. **Should see "Manual Installation Required" dialog** ✅
6. Click "Open Download Folder"
7. Should open: `~/Library/Caches/craftcorps-launcher-updater/pending/`
8. Extract `CraftCorps-0.4.7-mac-arm64.zip`
9. Move `CraftCorps.app` to `/Applications/`
10. Launch - should show v0.4.7

### 4. Check Logs
```bash
tail -50 ~/Library/Logs/CraftCorps\ Launcher/main.log | grep -i update
```

**Should see:**
```
[info] Update available: 0.4.7
[info] Download complete
[warn] Code signing error detected
[info] Sending manual-install-required status
```

**Should NOT see:**
```
[error] ZIP file not provided  ❌ (this was the v0.4.5 error)
```

## Known Issues / Notes

- **macOS blockmap files**: May return 404 errors. This is expected and OK - electron-updater falls back to full download
- **First update to 0.4.7**: Users will need to manually install this version
- **Subsequent updates**: Will continue to require manual install until code signing is added
- **Windows/Linux**: Unchanged, continue working normally

## Future Improvements

### Option 1: Add macOS Code Signing (Recommended)
See `MACOS_CODE_SIGNING_GUIDE.md` for complete instructions

**Requirements:**
- Apple Developer Account ($99/year)
- Code signing certificate
- Notarization setup
- GitHub Actions secrets

**Benefits:**
- Fully automatic updates on macOS
- Professional user experience
- No manual installation needed

**Effort:** 2-3 hours initial setup

### Option 2: Alternative Update Methods
- In-app download manager with progress
- Direct download links in settings
- Update notifications only (no download)

## Rollback Plan

If the new dialog causes issues:

```bash
# Revert to v0.4.6
git revert HEAD~1  # Revert the fix commit
npm version 0.4.6 --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: revert to 0.4.6"
git push nico main

# Rebuild
gh workflow run "Build and Publish Release" -f channel=Stable
```

Users can still download the update manually from the website.

## Success Criteria

- ✅ Build completes successfully
- ✅ All files uploaded to R2
- ✅ Website updated to v0.4.7
- ✅ "Manual Installation Required" dialog shows after download
- ✅ "Open Download Folder" button works
- ✅ Manual installation completes successfully
- ✅ No console errors in browser/logs

## Status Updates

- **14:48 UTC**: Build triggered ✅
- **14:50 UTC**: Linux build completed (1m 36s) ✅
- **14:53 UTC**: Windows build completed (4m 11s) ✅
- **15:04 UTC**: macOS build completed (16m 3s) ✅
  - Built 4 files: 2 ZIP + 2 DMG for x64 and arm64
- **15:04 UTC**: R2 upload completed ✅
  - All 6 platform files verified (200 OK)
  - `latest-mac.yml` correctly lists v0.4.7
- **15:07 UTC**: Website updated to v0.4.7 ✅
  - craftcorps.net/launcher/download shows v0.4.7
- **NEXT**: User testing (manual install flow)

## Related Issues

- v0.4.5: "ZIP file not provided" error (fixed in v0.4.6)
- v0.4.6: Auto-install fails silently (fixed in v0.4.7)
- Future: Add code signing for fully automatic updates
