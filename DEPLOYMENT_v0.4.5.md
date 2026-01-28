# Deployment v0.4.5 - 2026-01-28

## Summary
Fixed persistent auto-updater download issues by disabling differential downloads and multi-range requests. This version ensures users can successfully download updates from v0.4.4+, though users on v0.4.1-0.4.3 must manually update once.

## Changes

### Auto-Updater Fixes (electron/handlers/updateHandler.cjs)
- Disabled differential downloads: `autoUpdater.disableDifferentialDownload = true`
- Disabled multi-range requests: `useMultipleRangeRequest: false`
- Added Cache-Control header: `'Cache-Control': 'no-cache'`
- Enhanced error logging with stack traces and error details

### Root Cause
The auto-updater was failing to download updates due to:
1. Differential download mechanism not working with Cloudflare R2 CDN configuration
2. Multi-range HTTP requests causing download failures
3. Solution: Force full downloads instead of delta updates

## Deployment Process

### Phase 1: Build Launcher (GitHub Actions)
```bash
gh workflow run "Build and Publish Release" \
  --repo nicopalomin/craftcorps-launcher \
  -f channel=Stable

# Workflow ID: 21439802912
```

**Build Results:**
- ✅ Linux: 1m 47s
- ✅ macOS x64: 2m 36s
- ✅ Windows: 3m 18s

**Artifacts Uploaded to R2:**
- `CraftCorps-0.4.5-windows.exe` (117 MB)
- `CraftCorps-0.4.5-mac-x64.dmg`
- `CraftCorps-0.4.5-linux.AppImage`
- `latest.yml` (version metadata)

### Phase 2: Update Web App
```bash
cd /Users/nico/Desktop/craftcorps-web

# Updated files:
# - src/lib/launcher-downloads.ts (version: '0.4.5')
# - src/pages/launcher/download.astro (update notice to v0.4.5)

npm run build
npx wrangler deploy
```

**Deploy Time:** 14.59 seconds
**Version ID:** a9783dc0-1f17-4e31-8f02-d139e5f4741b

### Phase 3: Verification
```bash
# Download URLs verified (all return HTTP 200):
curl -I https://download.craftcorps.net/CraftCorps-0.4.5-windows.exe
curl -I https://download.craftcorps.net/CraftCorps-0.4.5-mac-x64.dmg
curl -I https://download.craftcorps.net/CraftCorps-0.4.5-linux.AppImage

# Metadata verified:
curl https://download.craftcorps.net/latest.yml
# Shows: version: 0.4.5

# Website verified:
# https://craftcorps.net/launcher/download
# Shows v0.4.5 badge and update notice
```

## User Impact

### Users on v0.4.4
- ✅ Auto-update should work seamlessly to v0.4.5
- Download uses full installer (not differential)

### Users on v0.4.1-0.4.3
- ❌ Auto-updater remains broken (client-side code issue)
- ✅ Manual download works from website
- ℹ️ After ONE manual update to v0.4.5, auto-update works forever
- ℹ️ Prominent website notice in 4 languages (EN, PL, UK, HI) guides users

### Why v0.4.1 Can't Auto-Update
Client-side auto-updater code in v0.4.1 has bugs that prevent successful downloads. Since the updater code runs on the user's machine, it cannot be fixed remotely via server-side changes. Users must manually download v0.4.5 once to get the fixed updater code.

## Technical Details

### Auto-Updater Configuration
```javascript
autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'https://download.craftcorps.net/',
    channel: 'latest',
    useMultipleRangeRequest: false // Disabled for R2 compatibility
});

autoUpdater.requestHeaders = {
    'User-Agent': 'CraftCorps-Launcher',
    'Cache-Control': 'no-cache'
};

// Force full downloads instead of delta updates
autoUpdater.disableDifferentialDownload = true;
autoUpdater.autoDownload = false; // User must click "Download"
```

### Website Update Notice
Added multi-language notice on `/launcher/download` page:
- Blue gradient banner with lightning emoji
- Explains auto-updater fixes
- Recommends manual download for v0.4.1-0.4.4 users
- Highlights: "Fixed update downloads" and "Better error logging"

## Files Modified

### Launcher (craftcorps-launcher)
- `package.json` - version: "0.4.5"
- `electron/handlers/updateHandler.cjs` - auto-updater fixes

### Web App (craftcorps-web)
- `src/lib/launcher-downloads.ts` - LAUNCHER_VERSION: '0.4.5'
- `src/pages/launcher/download.astro` - update notice text to v0.4.5

## Next Steps

1. **Monitor User Reports**
   - Confirm v0.4.4 users can auto-update successfully
   - Track how many users manually download v0.4.5 from v0.4.1

2. **Future Improvements**
   - Consider in-app notification system for critical updates
   - Add telemetry to track update success rates
   - Implement update channel system (stable/canary)

## Deployment Timeline
- 2026-01-28 13:22 UTC - GitHub Actions build completed
- 2026-01-28 14:25 UTC - Web app built
- 2026-01-28 14:26 UTC - Web app deployed
- 2026-01-28 14:26 UTC - Verification completed

## Status
✅ **Deployment Complete and Verified**

All download links working, website updated, and ready for users.
