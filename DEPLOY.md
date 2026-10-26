# PromptClarity — Deployment Guide

## Overview

This guide covers the complete deployment pipeline for PromptClarity, from code signing to GitHub Releases automation.

---

## Prerequisites for Maintainers

### Required Accounts & Tools

| Tool | Purpose |
|------|---------|
| **GitHub** | Source control + Releases |
| **Code Signing Certificate** (EV) | Remove SmartScreen warning |
| **GitHub Actions** | CI/CD automation |
| **Windows 10/11 build machine** | NSIS packaging |

### Code Signing Certificate

**Required** to avoid Windows SmartScreen warning:

```
Windows protected your PC
Microsoft Defender SmartScreen prevented an unrecognized app from starting.
```

**Options:**
| Provider | Cost/yr | Type |
|----------|---------|------|
| Sectigo | ~$200 | EV Code Signing |
| DigiCert | ~$400 | EV Code Signing |
| GlobalSign | ~$300 | EV Code Signing |

**EV Certificate Required** — standard certificates still show warnings until reputation builds.

### Certificate Setup

```powershell
# Export certificate as .pfx
# Set as GitHub secret: CODE_SIGN_CERT (base64)
# Set password as secret: CODE_SIGN_PASSWORD
```

---

## Build Pipeline

### Local Build Verification

```powershell
# Full verification pipeline
npm run lint
npm test
npm run desktop:typecheck
npm run desktop:build
npm --prefix apps/desktop-app run package
```

### Release Process

```powershell
# 1. Update version in package.json files
# Root package.json + apps/desktop-app/package.json

# 2. Create git tag
git tag v0.3.0
git push origin v0.3.0

# 3. GitHub Actions builds and publishes automatically
```

---

## GitHub Actions Workflow

### `.github/workflows/release.yml`

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write
  packages: write

jobs:
  build:
    runs-on: windows-latest
    timeout-minutes: 60
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Type check
        run: npm run desktop:typecheck
      
      - name: Lint
        run: npm run lint
      
      - name: Build desktop app
        run: npm run desktop:build
      
      - name: Package installer
        run: npm --prefix apps/desktop-app run package
        env:
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        if: startsWith(github.ref, 'refs/tags/')
        with:
          files: |
            apps/desktop-app/release/desktop/PromptClarity Setup *.exe
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `CSC_LINK` | Base64-encoded .pfx certificate |
| `CSC_KEY_PASSWORD` | Certificate password |
| `GITHUB_TOKEN` | Auto-provided by GitHub |

---

## Code Signing Details

### Local Signing (for testing)

```powershell
# Sign the installer
signtool sign /fd sha256 /tr http://timestamp.sectigo.com /td sha256 \
  /f cert.pfx /p "password" \
  "release/desktop/PromptClarity Setup 0.2.0.exe"

# Verify signature
signtool verify /pa "release/desktop/PromptClarity Setup 0.2.0.exe"
```

### Electron Builder Config (package.json)

```json
{
  "build": {
    "appId": "com.promptclarity.desktop",
    "productName": "PromptClarity",
    "asar": true,
    "files": [
      "dist/**/*",
      "resources/**/*",
      "package.json"
    ],
    "asarUnpack": [
      "resources/**/*"
    ],
    "directories": {
      "output": "../../release/desktop"
    },
    "win": {
      "icon": "assets/icon.png",
      "target": ["nsis"],
      "sign": "signtool sign /fd sha256 /tr http://timestamp.sectigo.com /td sha256 /f $CSC_LINK /p $CSC_KEY_PASSWORD"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "installerIcon": "assets/icon.ico",
      "uninstallerIcon": "assets/icon.ico",
      "installerHeaderIcon": "assets/icon.ico"
    },
    "publish": {
      "provider": "github",
      "owner": "yourusername",
      "repo": "PromptClarity"
    }
  }
}
```

---

## Release Checklist

### Pre-release

- [ ] Update version in `package.json` (root + `apps/desktop-app/package.json`)
- [ ] Update `CHANGELOG.md` with release notes
- [ ] Run full test suite: `npm test`
- [ ] Run typecheck: `npm run desktop:typecheck`
- [ ] Run lint: `npm run lint`
- [ ] Test installer on clean VM

### Release

- [ ] Create and push tag: `git tag v0.3.0 && git push origin v0.3.0`
- [ ] Verify GitHub Actions build passes
- [ ] Verify installer downloads and runs on clean VM
- [ ] Verify code signature: `signtool verify /pa PromptClarity Setup 0.2.0.exe`
- [ ] Verify auto-updater works (install v0.2.0, check for v0.3.0)

### Post-release

- [ ] Update `CHANGELOG.md`
- [ ] Announce on GitHub Discussions / Twitter / Discord
- [ ] Update documentation if needed

---

## Auto-Updater Configuration

### Client-side (already in main.ts)

```typescript
import { autoUpdater } from 'electron-updater';

app.whenReady().then(async () => {
  autoUpdater.checkForUpdatesAndNotify().catch(err => console.error('Update check failed:', err));
});
```

### Server-side (GitHub Releases)

The `publish` config in `package.json` points to GitHub Releases. The `autoUpdater` checks `https://api.github.com/repos/owner/repo/releases/latest`.

### Testing Updates Locally

```powershell
# Create a test release on GitHub (draft)
# Set UPDATE_URL environment variable to test
$env:UPDATE_URL = "https://api.github.com/repos/owner/repo/releases/latest"
npm run desktop:dev
```

---

## Code Signing Certificate Management

### Renewal Process

1. **60 days before expiry**: Order new certificate
2. **30 days before**: Install new cert, test signing
- [ ] Update `CSC_LINK` and `CSC_KEY_PASSWORD` GitHub secrets
- [ ] Test build on GitHub Actions
- [ ] Verify signature on installer

### Certificate Backup

```powershell
# Backup certificate securely
openssl pkcs12 -in cert.pfx -out cert-backup.pem -nodes
# Store in secure password manager (1Password, Bitwarden, etc.)
```

---

## Troubleshooting Deployment

| Issue | Solution |
|-------|----------|
| **Signtool fails** | Verify cert not expired, password correct, cert has private key |
| **GitHub Actions timeout** | Increase `timeout-minutes` in workflow; check network |
| **NSIS build fails** | Check `asarUnpack` includes `resources/**/*` |
| **Auto-updater fails** | Check GitHub Release is published (not draft); check `publish` config |
| **SmartScreen still warns** | Verify EV cert; check `signtool verify /pa installer.exe` |

---

## Security Checklist

- [ ] EV Code Signing Certificate valid
- [ ] Certificate password in GitHub Secrets (not repo)
- [ ] GitHub Actions workflow has minimal permissions
- [ ] Dependencies audited: `npm audit`
- [ ] No hardcoded secrets in code
- [ ] Auto-updater uses HTTPS + signature verification
- [ ] Crash reports don't contain PII

---

## Rollback Procedure

If a bad release ships:

1. **GitHub Releases**: Delete the bad release + assets
2. **Tag**: `git tag -d v0.3.0 && git push origin :refs/tags/v0.3.0`
3. **Re-tag**: `git tag v0.2.1 && git push origin v0.2.1`
3. **Auto-updater**: Users on bad version won't see update (no newer version)

---

## Monitoring

- **GitHub Actions**: Build status badge in README
- **GitHub Releases**: Track download counts
- **Sentry/Telemetry**: Crash rates (if telemetry enabled)
- **GitHub Issues**: User-reported problems