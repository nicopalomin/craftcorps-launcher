# GitHub Actions Deployment Guide

Complete guide for deploying CraftCorps Launcher using GitHub Actions automated builds.

---

## Overview

GitHub Actions automatically builds Windows, macOS, and Linux versions of the launcher on native runners and uploads them to Cloudflare R2 storage.

**Repository:** https://github.com/nicopalomin/craftcorps-launcher

---

## Prerequisites

### 1. GitHub Secrets (Already Configured ✅)

The following secrets are configured in your repository:

| Secret Name | Value | Purpose |
|-------------|-------|---------|
| `R2_ACCOUNT_ID` | `34c57ed70616c1325dd0a91b99a5cc35` | Cloudflare account ID |
| `R2_BUCKET_NAME` | `craftcorpslauncher` | R2 bucket name |
| `R2_ACCESS_KEY_ID` | `6640980be2c7ab0b991d6b50ef0c2088` | R2 API access key |
| `R2_SECRET_ACCESS_KEY` | `6dde397a9235e47de3494ca039b173a8b1bdaafdb5405f9e41666e9b2b20632b` | R2 API secret key |
| `REVALIDATION_TOKEN` | _(optional)_ | Website cache revalidation token |

**⚠️ Credentials stored securely at:** `/Users/nico/Desktop/R2_API_CREDENTIALS.md`

---

## Deployment Workflow

### Option 1: GitHub Web Interface (Recommended)

**Best for:** Quick deployments without command line

1. **Visit the workflow page:**
   ```
   https://github.com/nicopalomin/craftcorps-launcher/actions/workflows/deploy.yml
   ```

2. **Click "Run workflow"** (green button, top right)

3. **Configure the build:**
   - **Branch:** Select `main` (or your target branch)
   - **Version:** Leave empty to use `package.json` version, or enter specific version (e.g., `0.4.4`)
   - **Channel:** Select `Stable` or `Canary`

4. **Click "Run workflow"** to start the build

5. **Monitor progress:**
   - Watch the workflow run in real-time
   - Three parallel jobs will run: Windows, macOS, Linux
   - Typical completion time: 3-5 minutes

6. **Verify uploads:**
   ```
   https://download.craftcorps.net/CraftCorps-{version}-windows.exe
   https://download.craftcorps.net/CraftCorps-{version}-mac-x64.dmg
   https://download.craftcorps.net/CraftCorps-{version}-linux.AppImage
   ```

---

### Option 2: GitHub CLI (Terminal)

**Best for:** Command-line workflow integration

```bash
# From the launcher directory
cd /Users/nico/Desktop/craftcorps-launcher

# Trigger deployment (uses version from package.json)
gh workflow run "Build and Publish Release" \
  --repo nicopalomin/craftcorps-launcher \
  -f channel=Stable

# Watch the build progress
gh run watch --repo nicopalomin/craftcorps-launcher

# List recent workflow runs
gh run list --repo nicopalomin/craftcorps-launcher --limit 5

# View specific run details
gh run view <run-id> --repo nicopalomin/craftcorps-launcher
```

**Build with custom version:**
```bash
gh workflow run "Build and Publish Release" \
  --repo nicopalomin/craftcorps-launcher \
  -f channel=Stable \
  -f version=0.4.4
```

---

## Build Process

### What Happens During Build

1. **Checkout Code** - Clones your repository
2. **Setup Node.js** - Installs Node.js 20 with npm caching
3. **Install Dependencies** - Runs `npm ci` for consistent installs
4. **Set Version** (optional) - Bumps version if specified
5. **Build Application** - Compiles frontend and packages with electron-builder
6. **Publish to R2** - Uploads build artifacts to Cloudflare R2
7. **Cleanup** - Saves npm cache for faster future builds

### Build Output

Each platform produces:

**Windows:**
- `CraftCorps-{version}-windows.exe` (NSIS installer)
- `CraftCorps-{version}-windows.exe.blockmap` (delta updates)
- `latest.yml` (auto-updater metadata)

**macOS:**
- `CraftCorps-{version}-mac-x64.dmg` (Intel DMG)
- `CraftCorps-{version}-mac-x64.dmg.blockmap` (delta updates)
- ARM64 build may fail (use x64 via Rosetta)

**Linux:**
- `CraftCorps-{version}-linux.AppImage` (universal AppImage)
- `CraftCorps-{version}-linux.AppImage.blockmap` (delta updates)

---

## Artifact Naming Convention

The launcher uses consistent naming across all platforms:

```
CraftCorps-{version}-{platform}.{ext}
```

**Examples:**
- Windows: `CraftCorps-0.4.3-windows.exe`
- macOS: `CraftCorps-0.4.3-mac-x64.dmg`
- Linux: `CraftCorps-0.4.3-linux.AppImage`

This is configured in `package.json`:

```json
{
  "build": {
    "win": {
      "artifactName": "CraftCorps-${version}-windows.exe"
    },
    "mac": {
      "artifactName": "CraftCorps-${version}-mac-${arch}.${ext}"
    },
    "linux": {
      "artifactName": "CraftCorps-${version}-linux.${ext}"
    }
  }
}
```

---

## Deployment Checklist

Use this checklist when deploying a new version:

- [ ] **Update version** in `package.json` (e.g., `0.4.3` → `0.4.4`)
- [ ] **Commit and push** changes to GitHub
- [ ] **Trigger workflow** via web interface or CLI
- [ ] **Monitor build** - ensure all 3 platforms complete successfully
- [ ] **Verify uploads** - check all download URLs return 200 OK
- [ ] **Update web app** - change `LAUNCHER_VERSION` in `craftcorps-web/src/lib/launcher-downloads.ts`
- [ ] **Deploy web app** - run `npm run build && npx wrangler deploy`
- [ ] **Test downloads** - verify files download and install correctly
- [ ] **Create deployment doc** - document changes in `DEPLOYMENT_v{version}.md`

---

## Troubleshooting

### Build Failures

**Problem:** Build fails on one platform
- **Check logs:** Click on the failed job to view detailed error messages
- **Common causes:**
  - Node module installation issues
  - electron-builder packaging errors
  - Code signing problems (macOS ARM)
- **Solution:** Fix the error, commit changes, and re-run workflow

**Problem:** All builds fail immediately
- **Check:** GitHub secrets are configured correctly
- **Verify:** Repository has access to R2 bucket
- **Test:** R2 credentials manually with wrangler CLI

### Upload Failures

**Problem:** Build succeeds but upload fails
- **Check:** R2 credentials are valid and not expired
- **Verify:** Bucket name is correct (`craftcorpslauncher`)
- **Test:** Upload manually using wrangler CLI:
  ```bash
  npx wrangler r2 object put craftcorpslauncher/test.txt \
    --file=<local-file> --remote
  ```

**Problem:** File uploaded but not accessible
- **Check:** R2 public domain is configured (`download.craftcorps.net`)
- **Verify:** CORS settings allow public access
- **Test:** Visit URL directly in browser

### Version Conflicts

**Problem:** Wrong version number in build
- **Cause:** `package.json` not updated before build
- **Solution:** Update `package.json`, commit, and rebuild

**Problem:** Build uploads but website shows old version
- **Cause:** Web app not deployed with updated version
- **Solution:** Update `src/lib/launcher-downloads.ts` and deploy:
  ```bash
  cd /Users/nico/Desktop/craftcorps-web
  # Edit src/lib/launcher-downloads.ts
  npm run build
  npx wrangler deploy
  ```

---

## Platform-Specific Notes

### Windows
- Builds on `windows-latest` (Windows Server 2022)
- Uses NSIS installer (one-click install)
- No code signing (users see SmartScreen warning)
- Typical build time: 4-5 minutes

### macOS
- Builds on `macos-latest` (macOS 14 Sonoma)
- x64 build works on Apple Silicon via Rosetta
- ARM64 build may fail due to code signing issues (not critical)
- Users must run: `sudo xattr -cr /Applications/CraftCorps.app`
- Typical build time: 2-3 minutes

### Linux
- Builds on `ubuntu-latest` (Ubuntu 22.04)
- Creates universal AppImage (works on all distros)
- ARM64 build for Raspberry Pi and ARM servers
- Typical build time: 1-2 minutes

---

## Advanced Usage

### Building Canary Releases

Canary builds are unstable development versions:

```bash
gh workflow run "Build and Publish Release" \
  --repo nicopalomin/craftcorps-launcher \
  -f channel=Canary
```

Canary artifacts are uploaded to:
- `CraftCorps-canary-windows.exe`
- `CraftCorps-canary-mac.dmg`
- `CraftCorps-canary-linux.AppImage`

### Manual Build Locally

If GitHub Actions is unavailable, build locally:

```bash
# macOS
npm run build
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac

# Linux (requires Linux machine)
npm run build
npx electron-builder --linux

# Windows (requires Windows machine or GitHub Actions)
npm run build
npx electron-builder --win
```

Then upload manually:
```bash
cd /Users/nico/Desktop/craftcorps-web
npx wrangler r2 object put craftcorpslauncher/CraftCorps-0.4.3-windows.exe \
  --file=/path/to/build.exe --remote
```

---

## GitHub Actions Workflows

### Available Workflows

1. **Build and Publish Release** (`deploy.yml`)
   - Full multi-platform build and deploy
   - Uploads to R2 automatically
   - Supports both Stable and Canary channels

2. **Build Windows** (`build_windows.yml`)
   - Windows-only build
   - Manual artifact download (not uploaded to R2)
   - Useful for testing

3. **Build macOS** (`build_macos.yml`)
   - macOS-only build
   - Manual artifact download (not uploaded to R2)
   - Useful for testing

4. **Build Linux** (`build_linux.yml`)
   - Linux-only build
   - Manual artifact download (not uploaded to R2)
   - Useful for testing

### Workflow Files Location

```
.github/workflows/
├── deploy.yml                  # Main deployment workflow
├── build_windows.yml           # Windows-only build
├── build_macos.yml            # macOS-only build
└── build_linux.yml            # Linux-only build
```

---

## Security Notes

### GitHub Secrets Best Practices

- ✅ Secrets are encrypted and only exposed during workflow execution
- ✅ Secrets are never logged or visible in workflow output
- ✅ Access is limited to repository collaborators
- ⚠️ Rotate secrets if compromised
- ⚠️ Never commit secrets to git

### R2 API Token Permissions

Current token has **Object Read & Write** permissions on bucket `craftcorpslauncher`.

**To revoke/regenerate:**
1. Visit: https://dash.cloudflare.com/34c57ed70616c1325dd0a91b99a5cc35/r2/api-tokens
2. Find token: "CraftCorps Launcher Builds"
3. Click "Revoke" to disable
4. Create new token with same permissions
5. Update GitHub secrets with new credentials

---

## Cost Estimates

### GitHub Actions Usage

- **Free tier:** 2,000 minutes/month for free accounts
- **macOS builds:** Use 10x multiplier (5 min build = 50 min usage)
- **Windows/Linux builds:** Use 1x multiplier (5 min build = 5 min usage)
- **Estimated cost per deployment:** ~60 minutes (5 min Windows + 5 min Linux + 5 min macOS × 10)
- **Free tier allows:** ~33 deployments/month

### Cloudflare R2 Storage

- **Storage:** $0.015/GB/month
- **Typical usage:** ~350 MB per version (3 builds)
- **Estimated cost:** ~$0.005/month per version
- **Free tier:** 10 GB storage (enough for ~28 versions)

---

## Quick Reference

### Essential Commands

```bash
# Deploy new version
gh workflow run "Build and Publish Release" \
  --repo nicopalomin/craftcorps-launcher \
  -f channel=Stable

# Watch build progress
gh run watch --repo nicopalomin/craftcorps-launcher

# List recent runs
gh run list --repo nicopalomin/craftcorps-launcher --limit 5

# View run details
gh run view <run-id> --repo nicopalomin/craftcorps-launcher --log

# Test download URLs
curl -I https://download.craftcorps.net/CraftCorps-0.4.3-windows.exe
curl -I https://download.craftcorps.net/CraftCorps-0.4.3-mac-x64.dmg
curl -I https://download.craftcorps.net/CraftCorps-0.4.3-linux.AppImage
```

### Important URLs

- **Repository:** https://github.com/nicopalomin/craftcorps-launcher
- **Workflows:** https://github.com/nicopalomin/craftcorps-launcher/actions
- **Deploy Workflow:** https://github.com/nicopalomin/craftcorps-launcher/actions/workflows/deploy.yml
- **R2 Dashboard:** https://dash.cloudflare.com/34c57ed70616c1325dd0a91b99a5cc35/r2/overview/buckets/craftcorpslauncher
- **Download CDN:** https://download.craftcorps.net/

---

## Related Documentation

- **R2 Credentials:** `/Users/nico/Desktop/R2_API_CREDENTIALS.md`
- **Latest Deployment:** `/Users/nico/Desktop/craftcorps-launcher/DEPLOYMENT_v0.4.3.md`
- **Official Servers:** `/Users/nico/Desktop/craftcorps-launcher/OFFICIAL_SERVERS_UPDATE.md`
- **macOS Warning:** `/Users/nico/Desktop/craftcorps-launcher/MACOS_WARNING_UPDATE.md`

---

## Support

For issues or questions:
- **GitHub Issues:** https://github.com/nicopalomin/craftcorps-launcher/issues
- **Discord:** https://discord.gg/YXG2BZhe29
- **Email:** nicolas.r.palomino@proton.me

---

**Last Updated:** 2026-01-28
**Author:** Nicolas Palomino
**Co-Authored By:** Claude Opus 4.5
