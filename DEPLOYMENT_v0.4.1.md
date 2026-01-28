# CraftCorps Launcher v0.4.1 Deployment

## Date: 2026-01-28

### Summary
Successfully built and deployed CraftCorps launcher v0.4.1 with new web integration features including notifications, real Seeds balance, and friends list.

---

## What Was Deployed

### New Features in v0.4.1
1. **Web Notifications System** - Bell icon in title bar with:
   - Real-time notification polling (30s intervals)
   - Sound alerts for new notifications
   - Click to navigate to relevant pages
   - Mark as read functionality

2. **Real Seeds Balance** - Live cryptocurrency balance display in ProfileView

3. **In-Launcher Friends List** - Friends list with:
   - Online status indicators (EU/India servers)
   - Auto-refresh every 30 seconds
   - Minecraft head avatars

4. **Backend API Integration** - New launcher-specific API endpoints:
   - `/api/launcher/notifications/*`
   - `/api/launcher/balance`
   - `/api/launcher/friends`
   - `/api/launcher/stats`

---

## Build Artifacts

### Platforms Built
✅ **macOS (Intel x64)** - 125 MB DMG
  - File: `CraftCorps-0.4.1-mac-x64.dmg`
  - URL: `https://download.craftcorps.net/CraftCorps-0.4.1-mac-x64.dmg`

✅ **Linux (Universal)** - 101 MB AppImage
  - File: `CraftCorps-0.4.1-linux.AppImage`
  - URL: `https://download.craftcorps.net/CraftCorps-0.4.1-linux.AppImage`

❌ **Windows** - Not built (requires Windows machine or Docker)
❌ **macOS (ARM)** - Build failed due to code signing issues

---

## Infrastructure Setup

### Cloudflare R2 Storage
- Bucket: `craftcorpslauncher`
- Custom Domain: `download.craftcorps.net`
- Files uploaded to R2 with 1-year cache

### Cloudflare Worker
Created new worker `craftcorps-downloads` to serve files from R2:
- Route: `download.craftcorps.net/*`
- Binding: R2 bucket `craftcorpslauncher`
- Cache: Public, max-age 1 year

### Web App Updates
- Updated `src/lib/launcher-downloads.ts` to point to R2 URLs
- Deployed to Cloudflare Workers
- Download page shows v0.4.1 correctly

---

## Files Modified

### Backend (craftcorps-web)
```
convex/notifications.ts     - Added UUID-based queries
convex/launcher.ts           - NEW - Launcher API queries
src/pages/api/launcher/      - NEW - API endpoints directory
  ├── balance.ts
  ├── friends.ts
  ├── stats.ts
  └── notifications/
      ├── list.ts
      ├── unread-count.ts
      └── mark-read.ts
src/lib/launcher-downloads.ts - Updated download URLs
```

### Launcher (craftcorps-launcher)
```
electron/handlers/notificationHandler.cjs - NEW - IPC handlers
electron/main.cjs                          - Register handlers
electron/preload.cjs                       - Expose APIs
src/components/common/NotificationBell.jsx - NEW - Bell component
src/components/profile/FriendsList.jsx     - NEW - Friends component
src/components/layout/TitleBar.jsx         - Added NotificationBell
src/views/ProfileView.jsx                  - Added balance + friends
src/App.jsx                                - Navigation handler
```

---

## Deployment Steps Taken

1. ✅ Built launcher with `npm run ci:build:linux` and `npm run ci:build:mac`
2. ✅ Copied builds to `/tmp/craftcorps-builds/`
3. ✅ Uploaded to Cloudflare R2 bucket `craftcorpslauncher`
4. ✅ Created worker `craftcorps-downloads` to serve R2 files
5. ✅ Updated `launcher-downloads.ts` with new URLs
6. ✅ Deployed web app to Cloudflare Workers
7. ✅ Verified downloads work: https://craftcorps.net/launcher/download

---

## Verification

### Download URLs Working
```bash
✅ https://download.craftcorps.net/CraftCorps-0.4.1-mac-x64.dmg (125 MB)
✅ https://download.craftcorps.net/CraftCorps-0.4.1-linux.AppImage (101 MB)
❌ https://download.craftcorps.net/CraftCorps-0.4.1-windows.exe (not built)
```

### Website Updated
✅ https://craftcorps.net/launcher/download shows v0.4.1
✅ Download buttons point to R2 CDN

---

## Technical Details

### Build Process
- npm install with `--cache /tmp/npm-cache` to bypass cache issues
- Used `CSC_IDENTITY_AUTO_DISCOVERY=false` for macOS builds
- Cross-compilation for Windows failed (requires native build)

### Authentication Flow
1. Launcher → Backend: Bearer token in Authorization header
2. Backend → Auth Service: Validate token with `auth.craftcorps.net/auth/me`
3. Backend → Convex: Query with Minecraft UUID from linked accounts
4. Response → Launcher: Return data (notifications, balance, friends, stats)

### Auto-Polling
- Notifications: Every 30 seconds
- Friends list: Every 30 seconds
- Balance: On profile load

---

## Known Issues

1. **Windows Build Not Available** - Requires Windows machine for native build
2. **macOS ARM Build Failed** - Code signing issues, only x64 available
3. **Canary Builds** - URLs point to R2 but no canary builds uploaded yet

---

## Next Steps (Optional)

- [ ] Build Windows version (requires Windows machine)
- [ ] Build macOS ARM version (requires code signing cert)
- [ ] Upload canary builds to R2
- [ ] Generate `latest.yml` files for auto-updater
- [ ] Test auto-updater functionality
- [ ] Add market CDN integration

---

## Documentation

Full integration details documented in:
- `/Users/nico/Desktop/craftcorps-launcher/LAUNCHER_INTEGRATION_FEATURES.md`

---

## Contact

For issues or questions:
- Check console logs: `%APPDATA%/CraftCorps/logs/` (Windows) or `~/Library/Application Support/CraftCorps/logs/` (macOS)
- Check network tab for API calls
- Verify authentication status
