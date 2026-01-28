# Auto-Update Fix - Testing Guide

## Changes Made

✅ **Updated `package.json` lines 49-69** to build both ZIP and DMG for macOS:

```json
"mac": {
  "target": [
    {
      "target": "zip",    // ✅ NEW - For auto-updates
      "arch": ["x64", "arm64"]
    },
    {
      "target": "dmg",    // ✅ Existing - For manual downloads
      "arch": ["x64", "arm64"]
    }
  ],
  ...
}
```

## Next Steps

### 1. Local Build Test (Optional but Recommended)

Test the build locally to verify ZIP files are generated:

```bash
cd /Users/nico/Desktop/craftcorps-launcher

# Clean previous builds
rm -rf release/

# Build for macOS
npm run ci:build:mac
```

**Expected output in `release/` folder:**
- ✅ `CraftCorps-0.4.5-mac-x64.zip` (~120 MB)
- ✅ `CraftCorps-0.4.5-mac-arm64.zip` (~115 MB)
- ✅ `CraftCorps-0.4.5-mac-x64.dmg` (~127 MB)
- ✅ `CraftCorps-0.4.5-mac-arm64.dmg` (~123 MB)
- ✅ `latest-mac.yml` (should list ZIP files first)

**Verify `latest-mac.yml` content:**
```bash
cat release/latest-mac.yml
```

Should see:
```yaml
version: 0.4.5
files:
  - url: CraftCorps-0.4.5-mac-x64.zip       # ✅ ZIP first
    sha512: ...
    size: ...
  - url: CraftCorps-0.4.5-mac-arm64.zip     # ✅ ZIP for arm64
    sha512: ...
    size: ...
```

### 2. Deploy New Version

Bump the version and deploy:

```bash
# Option A: Patch version (0.4.5 → 0.4.6)
npm version patch

# Option B: Minor version (0.4.5 → 0.5.0)
npm version minor

# Trigger GitHub Actions build
gh workflow run "Build and Publish Release" \
  --repo nicopalomin/craftcorps-launcher \
  -f channel=Stable

# Watch the build progress
gh run watch --repo nicopalomin/craftcorps-launcher
```

### 3. Verify R2 Upload

After GitHub Actions completes (~10 minutes), verify files were uploaded:

```bash
# Check the update manifest
curl https://download.craftcorps.net/latest-mac.yml

# Verify ZIP files exist
curl -I https://download.craftcorps.net/CraftCorps-0.4.6-mac-x64.zip
curl -I https://download.craftcorps.net/CraftCorps-0.4.6-mac-arm64.zip

# Verify DMG files still exist (for manual downloads)
curl -I https://download.craftcorps.net/CraftCorps-0.4.6-mac-x64.dmg
curl -I https://download.craftcorps.net/CraftCorps-0.4.6-mac-arm64.dmg
```

Expected response: `HTTP/2 200` (file exists)

### 4. Update Website

Update the website to show new download links:

```bash
cd /Users/nico/Desktop/craftcorps-web

# Update src/lib/launcher-downloads.ts
# Change version from 0.4.5 to 0.4.6

# Build and deploy
npm run build
npx wrangler deploy
```

### 5. Test Auto-Update End-to-End

**Method 1: Test with Current Version**
1. Install current version (0.4.5) from the app
2. Deploy new version (0.4.6)
3. Launch the app
4. Wait 5 minutes (auto-update check interval)
5. Verify update notification appears
6. Click "Update Now"
7. Verify download completes
8. Verify app restarts with new version

**Method 2: Force Update Check (Faster)**
1. Install current version (0.4.5)
2. Deploy new version (0.4.6)
3. Open app
4. Go to Settings → Check for Updates
5. Should see: "Update available: 0.4.6"
6. Click "Download Update"
7. Verify download completes (watch logs)
8. Click "Install and Restart"
9. App should restart with 0.4.6

### 6. Check Logs for Errors

```bash
# Check for update-related errors
tail -100 ~/Library/Logs/CraftCorps\ Launcher/main.log | grep -i "update"

# Should see (success case):
# [info] Checking for update...
# [info] Update available: 0.4.6
# [info] Download speed: ... - Downloaded 100%
# [info] Update downloaded. Auto-installing in 3 seconds...
# [info] Auto quit-and-install triggered

# Should NOT see:
# [error] ZIP file not provided  ❌
```

## Troubleshooting

### If ZIP files are not generated
- Check `package.json` syntax (must be valid JSON)
- Ensure `electron-builder` is up to date: `npm update electron-builder`
- Try `npm run electron:build` instead of `ci:build:mac`

### If auto-update still fails
1. Check `latest-mac.yml` on R2 - does it list ZIP files?
2. Check app logs for new error messages
3. Verify ZIP file is downloadable: `curl -I https://download.craftcorps.net/CraftCorps-0.4.6-mac-arm64.zip`
4. Check electron-updater version: Should be 6.6.2+

### If manual DMG download breaks
- DMG files should still be uploaded
- Check website download link points to correct DMG URL
- Verify DMG exists on R2: `curl -I https://download.craftcorps.net/CraftCorps-0.4.6-mac-arm64.dmg`

## Success Criteria

- ✅ Local build produces 4 files: 2 ZIP + 2 DMG
- ✅ `latest-mac.yml` lists ZIP files first
- ✅ GitHub Actions uploads all files to R2
- ✅ `curl` confirms ZIP and DMG files exist on R2
- ✅ Website shows DMG as download option
- ✅ Auto-update downloads ZIP file (not DMG)
- ✅ Auto-update installs successfully
- ✅ App restarts with new version
- ✅ No errors in logs

## Rollback (If Needed)

If something goes wrong:

1. Revert package.json:
```bash
cd /Users/nico/Desktop/craftcorps-launcher
git checkout package.json
```

2. Rebuild and redeploy:
```bash
npm version patch
gh workflow run "Build and Publish Release" -f channel=Stable
```

3. Users on broken version can manually download DMG from website

## Notes

- **First-time users**: Still download DMG from website (better UX)
- **Existing users**: Auto-update uses ZIP files
- **Windows/Linux**: Unchanged, still working
- **File sizes**: ZIP files are slightly smaller than DMG (~8-12 MB difference)
