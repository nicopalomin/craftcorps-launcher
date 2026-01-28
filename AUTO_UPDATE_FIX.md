# Auto-Update Issue - Diagnosis & Solution

## Problem Summary

Auto-updates are **completely broken on macOS** due to electron-updater requiring ZIP files, but the launcher only builds DMG files.

**Error from logs:**
```
Error: ZIP file not provided: [
  {
    "url": "https://download.craftcorps.net/CraftCorps-0.4.5-mac-arm64.dmg",
    ...
  }
]
```

## Root Cause Analysis

### Issue #1: electron-updater macOS Limitation
- **electron-updater's `MacUpdater` class ONLY supports ZIP files for auto-updates**
- DMG files **cannot** be used for auto-updates on macOS
- This is a hard limitation in electron-updater, not a configuration issue

### Issue #2: Current Build Configuration
**Current `package.json` (Lines 49-59):**
```json
"mac": {
  "target": {
    "target": "dmg",   // ❌ ONLY DMG, no ZIP
    "arch": ["x64", "arm64"]
  },
  ...
}
```

**Current `latest-mac.yml` on R2:**
```yaml
version: 0.4.5
files:
  - url: CraftCorps-0.4.5-mac-x64.dmg      # ❌ DMG files
  - url: CraftCorps-0.4.5-mac-arm64.dmg    # ❌ DMG files
```

### Issue #3: How macOS Auto-Updates Should Work

1. **ZIP file** (.zip) - Used by electron-updater for auto-updates
   - Contains the `.app` bundle
   - Can be downloaded and extracted programmatically
   - Required for in-app auto-updates

2. **DMG file** (.dmg) - Used for manual downloads
   - Better user experience for initial install
   - Drag-and-drop installer
   - NOT supported by electron-updater

## The Solution

### Step 1: Update package.json Build Configuration

Change the macOS target to produce BOTH `zip` and `dmg`:

```json
"mac": {
  "target": [
    {
      "target": "zip",    // ✅ For auto-updates
      "arch": ["x64", "arm64"]
    },
    {
      "target": "dmg",    // ✅ For manual downloads
      "arch": ["x64", "arm64"]
    }
  ],
  "category": "public.app-category.games",
  "icon": "public/icon.png",
  "artifactName": "CraftCorps-${version}-mac-${arch}.${ext}"
}
```

### Step 2: Verify electron-builder Will Generate Both

After the change, electron-builder will produce:
- `CraftCorps-0.4.5-mac-x64.zip` (118 MB) - **Auto-update**
- `CraftCorps-0.4.5-mac-arm64.zip` (115 MB) - **Auto-update**
- `CraftCorps-0.4.5-mac-x64.dmg` (127 MB) - **Manual download**
- `CraftCorps-0.4.5-mac-arm64.dmg` (123 MB) - **Manual download**
- `latest-mac.yml` - **Will now include ZIP files**

### Step 3: Expected latest-mac.yml After Fix

```yaml
version: 0.4.5
files:
  - url: CraftCorps-0.4.5-mac-x64.zip       # ✅ ZIP for auto-update
    sha512: <hash>
    size: <size>
  - url: CraftCorps-0.4.5-mac-arm64.zip     # ✅ ZIP for auto-update
    sha512: <hash>
    size: <size>
  - url: CraftCorps-0.4.5-mac-x64.dmg       # For manual download
    sha512: <hash>
    size: <size>
  - url: CraftCorps-0.4.5-mac-arm64.dmg     # For manual download
    sha512: <hash>
    size: <size>
path: CraftCorps-0.4.5-mac-x64.zip          # ✅ Primary is now ZIP
sha512: <hash>
releaseDate: '2026-01-28T...'
```

### Step 4: Update upload-r2.cjs (Optional Improvement)

The current `upload-r2.cjs` already handles ZIP files in the glob pattern (line 65):
```javascript
const pattern = '**/*.{yml,exe,exe.blockmap,zip,dmg,dmg.blockmap,AppImage,AppImage.blockmap}';
```

No changes needed here. ✅

### Step 5: Update Website Download Links

Update the website (`craftcorps-web`) to offer:
- **Primary macOS download**: DMG files (better UX for first install)
- **Secondary option**: ZIP files (if needed)

The auto-updater will automatically use the ZIP files from latest-mac.yml.

## Windows & Linux Status

### Windows ✅ WORKING
- Uses NSIS installer (.exe)
- Auto-updates work correctly
- No changes needed

### Linux ❓ NEEDS VERIFICATION
- Currently uses AppImage
- AppImage auto-updates work differently (need to verify)
- May need similar ZIP configuration

## Implementation Steps

1. **Update package.json** (1 minute)
   - Change `mac.target` to array with both `zip` and `dmg`

2. **Test Local Build** (10 minutes)
   ```bash
   npm run ci:build:mac
   ```
   - Verify ZIP files are generated
   - Check that `release/latest-mac.yml` lists ZIP files first

3. **Deploy New Version** (15 minutes)
   ```bash
   # Bump version
   npm version patch  # or minor/major

   # Trigger GitHub Actions
   gh workflow run "Build and Publish Release" \
     --repo nicopalomin/craftcorps-launcher \
     -f channel=Stable

   # Verify R2 upload includes ZIP files
   curl https://download.craftcorps.net/latest-mac.yml
   ```

4. **Update Website** (5 minutes)
   - Update `craftcorps-web/src/lib/launcher-downloads.ts`
   - Offer DMG as primary download (better UX)
   - Deploy: `npm run build && npx wrangler deploy`

5. **Test Auto-Update** (5 minutes)
   - Install version N on macOS
   - Deploy version N+1
   - Launch app, verify update notification appears
   - Verify update downloads and installs correctly

## Expected Behavior After Fix

### First-Time Users
- Download DMG from website
- Drag CraftCorps.app to Applications
- Launch normally

### Existing Users (Auto-Update)
- App checks `https://download.craftcorps.net/latest-mac.yml`
- Sees new ZIP file available
- Downloads ZIP file in background
- Extracts and replaces .app bundle
- Prompts user to restart
- Auto-update works! ✅

## Rollback Plan

If auto-updates fail after the fix:
1. Revert package.json change
2. Rebuild with DMG only
3. Re-upload to R2
4. Investigate electron-updater logs for new error

## Risk Assessment

**Risk Level:** Low
- Windows builds unchanged (still working)
- macOS manual downloads still work (DMG available)
- Only adds ZIP files, doesn't remove anything
- Standard electron-builder configuration

## References

- [electron-updater macOS docs](https://www.electron.build/auto-update#macos)
- [electron-builder targets](https://www.electron.build/configuration/mac)
- [MacUpdater source code](https://github.com/electron-userland/electron-builder/blob/master/packages/electron-updater/src/MacUpdater.ts)

## Testing Checklist

- [ ] Local build produces both ZIP and DMG
- [ ] latest-mac.yml lists ZIP files first
- [ ] GitHub Actions uploads all files to R2
- [ ] Website shows DMG as primary download
- [ ] Auto-update works from version N to N+1
- [ ] Manual DMG install still works
- [ ] ZIP extraction works on both Intel and ARM Macs
