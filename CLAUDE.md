# CLAUDE.md - Instructions for AI Assistant

## Deployment Protocol

**CRITICAL: Always ask the user if they want to deploy after completing these types of tasks:**

### Tasks That Require Deployment Confirmation

1. **Version Bumps** - When `package.json` version is updated
2. **Feature Additions** - New features added to the launcher
3. **Bug Fixes** - Critical bugs fixed that users should receive
4. **UI Changes** - Visual updates or improvements
5. **Performance Improvements** - Optimizations that improve user experience
6. **Security Fixes** - Any security-related updates

### Deployment Question Format

After completing a task that falls into the above categories, ask:

```
Would you like to deploy version X.Y.Z? (Y/N)

This will:
1. Build launcher for Windows, macOS, and Linux via GitHub Actions
2. Upload builds to Cloudflare R2
3. Update the web app to show the new version
4. Make the new version available at craftcorps.net/launcher/download
```

### If User Says YES

Follow the complete deployment process documented in `GITHUB_ACTIONS_DEPLOYMENT.md`:

**Phase 1: Trigger GitHub Actions**
```bash
gh workflow run "Build and Publish Release" \
  --repo nicopalomin/craftcorps-launcher \
  -f channel=Stable

# Watch the build
gh run watch --repo nicopalomin/craftcorps-launcher
```

**Phase 2: Update Web App**
```bash
cd /Users/nico/Desktop/craftcorps-web

# Update version in src/lib/launcher-downloads.ts
# Build and deploy
npm run build
npx wrangler deploy
```

**Phase 3: Verify**
```bash
# Check R2 uploads
curl -I https://download.craftcorps.net/CraftCorps-X.Y.Z-windows.exe
curl -I https://download.craftcorps.net/CraftCorps-X.Y.Z-mac-x64.dmg
curl -I https://download.craftcorps.net/CraftCorps-X.Y.Z-linux.AppImage

# Visit website
# https://craftcorps.net/launcher/download
```

### If User Says NO

- Do not trigger deployment
- Remind user they can deploy later using the guide in `GITHUB_ACTIONS_DEPLOYMENT.md`

---

## Deployment Checklist Reference

See complete checklist in: `GITHUB_ACTIONS_DEPLOYMENT.md`

Key points:
- GitHub Actions builds launcher (automated)
- Web app update is MANUAL (requires separate deploy)
- Always verify downloads work after deployment
- Create deployment documentation in `DEPLOYMENT_vX.Y.Z.md`

---

## Related Documentation

- **Full Deployment Guide:** `GITHUB_ACTIONS_DEPLOYMENT.md`
- **Latest Deployment:** `DEPLOYMENT_v0.4.3.md`
- **R2 Credentials:** `/Users/nico/Desktop/R2_API_CREDENTIALS.md`
