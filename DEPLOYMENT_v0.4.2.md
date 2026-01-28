# CraftCorps Launcher v0.4.2 Deployment

## Date: 2026-01-28

### Summary
Successfully deployed CraftCorps launcher v0.4.2 with official 6-7 SMP servers integration.

---

## What's New in v0.4.2

### Official Servers Feature
- **6-7 SMP EU** (`play.6-7.uk`) - European server
- **6-7 SMP ASIA** (`in.6-7.uk`) - Asian server

**Features:**
- Always appear first on discover page
- Green "OFFICIAL SERVER" badge with shield icon
- Automatically filtered by category (Survival)
- Available even if API fails (fallback)
- Full Smart Join compatibility

---

## Build Artifacts

### Platforms Built
✅ **macOS (Intel x64)** - 125 MB DMG
  - File: `CraftCorps-0.4.2-mac-x64.dmg`
  - URL: `https://download.craftcorps.net/CraftCorps-0.4.2-mac-x64.dmg`
  - Works on Apple Silicon via Rosetta

✅ **Linux (ARM64)** - 101 MB AppImage
  - File: `CraftCorps-0.4.2-linux.AppImage`
  - URL: `https://download.craftcorps.net/CraftCorps-0.4.2-linux.AppImage`
  - Universal compatibility

❌ **Windows** - Not built (requires Windows machine or Docker)

---

## Deployment Status

### Launcher Build
✅ Built successfully for macOS and Linux
✅ Version bumped from 0.4.1 → 0.4.2
✅ Frontend compiled without errors

### CDN Upload
✅ Uploaded to Cloudflare R2 bucket `craftcorpslauncher`
✅ Available at `download.craftcorps.net`
✅ 1-year cache configured

### Web App Update
✅ Download URLs updated to v0.4.2
✅ Built successfully
✅ Deployed to Cloudflare Workers
✅ Live at https://craftcorps.net/launcher/download

---

## Files Modified

### Launcher
```
package.json                                    - Version 0.4.1 → 0.4.2
electron/handlers/discoveryHandler.cjs          - Added OFFICIAL_SERVERS array
src/components/discover/ServerBadge.jsx         - Added official badge styling
```

### Web App
```
src/lib/launcher-downloads.ts                   - LAUNCHER_VERSION = '0.4.2'
```

---

## Official Servers Configuration

### Server Data Structure
```javascript
{
    id: '6-7-smp-eu',
    name: '6-7 SMP EU',
    ip: 'play.6-7.uk',
    port: 25565,
    category: 'survival',
    badge: 'OFFICIAL SERVER',
    description: 'Official 6-7 SMP European Server - Premium survival experience',
    version: '1.21.11',
    verified: true,
    official: true,
    website: 'https://6-7.uk',
    discord: 'https://discord.gg/YXG2BZhe29'
}
```

### Badge Styling
- **Color**: Emerald/teal gradient (`from-emerald-500 to-teal-600`)
- **Icon**: Shield (Lucide React)
- **Label**: "OFFICIAL SERVER"
- **Glow**: Green shadow effect
- **Priority**: Highest (above Featured, Verified, etc.)

---

## Verification

### Download URLs Working
```bash
✅ https://download.craftcorps.net/CraftCorps-0.4.2-mac-x64.dmg (125 MB)
✅ https://download.craftcorps.net/CraftCorps-0.4.2-linux.AppImage (101 MB)
❌ https://download.craftcorps.net/CraftCorps-0.4.2-windows.exe (not built)
```

### Website Updated
✅ https://craftcorps.net/launcher/download shows v0.4.2
✅ Download buttons point to R2 CDN
✅ macOS warning displayed for Mac users

### Launcher Functionality
✅ Official servers appear first on discover page
✅ Badge displays correctly (emerald/green)
✅ Smart Join compatible
✅ Category filtering works
✅ Search functionality works

---

## Build Process

### Commands Used
```bash
# Update version
# Edit package.json: "version": "0.4.2"

# Build Linux
npm run build
npx electron-builder --linux

# Build macOS
CSC_IDENTITY_AUTO_DISCOVERY=false npm run ci:build:mac

# Copy builds
cp "release/CraftCorps Setup 0.4.2.AppImage" /tmp/craftcorps-builds/CraftCorps-0.4.2-linux.AppImage
cp "release/CraftCorps Setup 0.4.2 x64.dmg" /tmp/craftcorps-builds/CraftCorps-0.4.2-mac-x64.dmg

# Upload to R2
npx wrangler r2 object put craftcorpslauncher/CraftCorps-0.4.2-linux.AppImage --file=/tmp/craftcorps-builds/CraftCorps-0.4.2-linux.AppImage --remote
npx wrangler r2 object put craftcorpslauncher/CraftCorps-0.4.2-mac-x64.dmg --file=/tmp/craftcorps-builds/CraftCorps-0.4.2-mac-x64.dmg --remote

# Update and deploy web app
# Edit src/lib/launcher-downloads.ts: LAUNCHER_VERSION = '0.4.2'
npm run build
npx wrangler deploy
```

---

## Known Issues

1. **macOS ARM Build Failed**
   - ARM64 build fails with code signing errors
   - x64 build works on Apple Silicon via Rosetta
   - Not a blocker for deployment

2. **Windows Build Unavailable**
   - Cross-compilation from macOS not supported
   - Requires native Windows build machine
   - Users must use v0.4.1 Windows build for now

3. **Code Signing**
   - Apps are unsigned (no Apple Developer certificate)
   - macOS users must run: `sudo xattr -cr /Applications/CraftCorps.app`
   - Warning displayed on download page

---

## Rollback Instructions

If critical issues are discovered:

```bash
# Revert launcher code
cd /Users/nico/Desktop/craftcorps-launcher
git checkout HEAD~1 electron/handlers/discoveryHandler.cjs
git checkout HEAD~1 src/components/discover/ServerBadge.jsx
git checkout HEAD~1 package.json
npm run build

# Revert web app
cd /Users/nico/Desktop/craftcorps-web
# Edit src/lib/launcher-downloads.ts: LAUNCHER_VERSION = '0.4.1'
npm run build
npx wrangler deploy
```

---

## User Impact

### Positive Changes
- Official 6-7 SMP servers easily accessible
- Clear visual distinction with green badge
- Always available (fallback if API fails)
- Smart Join works seamlessly

### No Breaking Changes
- Existing discover page functionality preserved
- Community servers still visible
- Search and filters work as before
- Backward compatible with v0.4.1

---

## Monitoring

### Metrics to Watch
- Download counts for v0.4.2
- Join success rate for official servers
- User feedback in Discord
- Error reports in launcher logs

### Support Channels
- Discord: https://discord.gg/YXG2BZhe29
- GitHub Issues: https://github.com/orbit246/craftcorps/issues
- Logs: `%APPDATA%/CraftCorps/logs/` (Windows) or `~/Library/Application Support/CraftCorps/logs/` (macOS)

---

## Next Steps (Optional)

1. **Windows Build**
   - Set up Windows build machine or Docker
   - Build and upload v0.4.2 for Windows

2. **Auto-Updater**
   - Generate `latest.yml` files
   - Configure electron-updater

3. **Server Status**
   - Add real-time player count for official servers
   - Ping servers in background

4. **Analytics**
   - Track official server join rate
   - Monitor conversion from discover → join

---

## Related Documentation

- Full feature details: `/Users/nico/Desktop/craftcorps-launcher/OFFICIAL_SERVERS_UPDATE.md`
- Previous deployment: `/Users/nico/Desktop/craftcorps-launcher/DEPLOYMENT_v0.4.1.md`
- Integration docs: `/Users/nico/Desktop/craftcorps-launcher/LAUNCHER_INTEGRATION_FEATURES.md`

---

## Deployment Checklist

- [x] Version bumped to 0.4.2
- [x] Official servers code added
- [x] Badge styling implemented
- [x] Linux build created
- [x] macOS build created
- [x] Builds uploaded to R2
- [x] Download URLs updated
- [x] Web app built
- [x] Web app deployed
- [x] Download URLs verified
- [x] Version displayed correctly on website
- [x] Documentation updated

---

## Timeline

- **03:00 AM** - Started deployment
- **03:01 AM** - Built Linux AppImage (101 MB)
- **03:04 AM** - Built macOS DMG (125 MB)
- **03:07 AM** - Uploaded to R2
- **03:09 AM** - Deployed web app
- **03:10 AM** - Verified downloads working
- **03:10 AM** - Deployment complete

**Total Time:** ~10 minutes

---

## Success Criteria Met

✅ Launcher builds successfully
✅ Official servers appear in discover page
✅ Downloads accessible from website
✅ Version number correct (v0.4.2)
✅ No breaking changes
✅ Documentation complete

---

## Conclusion

CraftCorps Launcher v0.4.2 has been successfully deployed with official 6-7 SMP server integration. Both EU and ASIA servers now appear prominently on the discover page with distinctive green "OFFICIAL SERVER" badges. Downloads are available for macOS and Linux platforms, with Windows build pending.
