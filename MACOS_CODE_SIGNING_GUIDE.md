# macOS Code Signing Guide

## Problem

Auto-updates on macOS fail with:
```
Error: Could not get code signature for running application
```

electron-updater **requires code-signed apps** to perform automatic installations on macOS for security reasons.

## Current Status

- ✅ Windows: Code-signed with Azure Trusted Signing
- ❌ macOS: **NOT code-signed** (auto-updates fail)
- ❌ Linux: N/A (AppImage doesn't support auto-updates)

## Solution: Add macOS Code Signing

### Step 1: Get Apple Developer Account

1. Sign up at https://developer.apple.com ($99/year)
2. Enroll in Apple Developer Program
3. Create a **Developer ID Application** certificate

### Step 2: Export Certificate for GitHub Actions

```bash
# Export certificate from Keychain
# 1. Open Keychain Access
# 2. Find "Developer ID Application" certificate
# 3. Right-click → Export "Developer ID Application"
# 4. Save as .p12 file with a password

# Convert to base64 for GitHub Secrets
base64 -i DeveloperIDApplication.p12 -o certificate.txt

# Copy the content of certificate.txt
cat certificate.txt | pbcopy
```

### Step 3: Add GitHub Secrets

Go to https://github.com/nicopalomin/craftcorps-launcher/settings/secrets/actions

Add these secrets:
- `APPLE_CERTIFICATE`: Base64-encoded .p12 certificate
- `APPLE_CERTIFICATE_PASSWORD`: Password for the .p12 file
- `APPLE_ID`: Your Apple ID email
- `APPLE_PASSWORD`: App-specific password (create at appleid.apple.com)
- `APPLE_TEAM_ID`: Your team ID (found in developer.apple.com)

### Step 4: Update package.json

Add code signing configuration:

```json
{
  "build": {
    "mac": {
      "target": [
        { "target": "zip", "arch": ["x64", "arm64"] },
        { "target": "dmg", "arch": ["x64", "arm64"] }
      ],
      "category": "public.app-category.games",
      "icon": "public/icon.png",
      "artifactName": "CraftCorps-${version}-mac-${arch}.${ext}",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist"
    },
    "afterSign": "electron/notarize.js"
  }
}
```

### Step 5: Create Entitlements File

Create `build/entitlements.mac.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
</dict>
</plist>
```

### Step 6: Create Notarization Script

Create `electron/notarize.js`:

```javascript
const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  console.log(`Notarizing ${appName}...`);

  return await notarize({
    appBundleId: 'com.craftcorps.launcher',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
};
```

### Step 7: Install Dependencies

```bash
npm install --save-dev @electron/notarize
```

### Step 8: Update GitHub Actions Workflow

Update `.github/workflows/deploy.yml`:

```yaml
- name: Build Application
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
    CSC_LINK: ${{ secrets.APPLE_CERTIFICATE }}
    CSC_KEY_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
  run: |
    if [ "${{ inputs.channel }}" == "Canary" ]; then
      npm run ci:build:canary:${{ matrix.script_suffix }}
    else
      npm run ci:build:${{ matrix.script_suffix }}
    fi
  shell: bash
```

### Step 9: Test

After adding code signing:

1. Trigger a new build via GitHub Actions
2. Download and install the signed app
3. Test auto-update:
   - Should download ZIP file
   - Should install automatically
   - No "code signature" error

## Verification

Check if app is code-signed:

```bash
codesign -dv --verbose=4 /Applications/CraftCorps.app
```

Should show:
```
Authority=Developer ID Application: Your Name (TEAM_ID)
```

## Cost & Effort

- **Cost**: $99/year (Apple Developer Program)
- **Time**: 2-3 hours (first time setup)
- **Complexity**: Medium

## Alternative: Skip Code Signing (Development Only)

If you don't want to code sign yet, you can:

1. **Manual updates**: Users download DMG and install manually
2. **Show download location**: Add UI to show where update was downloaded
3. **Disable auto-install**: Remove the 3-second auto-install

**Not recommended for production**, but works for development/testing.

## Implementation Priority

- **High**: If you want seamless auto-updates for users
- **Low**: If manual updates are acceptable for now

Current workaround: Users can manually install from:
`~/Library/Caches/craftcorps-launcher-updater/pending/CraftCorps-*.zip`
