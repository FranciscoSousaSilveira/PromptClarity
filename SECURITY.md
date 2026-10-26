# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.2.x   | ✅ Yes    |
| < 0.2.0 | ❌ No     |

---

## Reporting a Vulnerability

**Do not open a public issue.** Please report security vulnerabilities privately:

**Email:** security@promptclarity.app

**PGP Key:** Available at https://promptclarity.app/.well-known/pgp-key.asc

**Response Time:** We aim to acknowledge within 48 hours and provide a fix timeline within 7 days.

---

## Security Architecture

### Zero-Cloud Design

| Component            | Network                                       |
| -------------------- | --------------------------------------------- |
| Prompt Processing    | `127.0.0.1:3000` (local API)                  |
| LLM Inference        | `127.0.0.1:11434` (Ollama)                    |
| External Connections | GitHub Releases (updates), Telemetry (opt-in) |

**No cloud APIs, no account system, no prompt storage.**

---

## Threat Model

| Threat              | Mitigation                                                  |
| ------------------- | ----------------------------------------------------------- |
| Prompt exfiltration | Zero cloud — all processing local                           |
| Clipboard theft     | Read/restore within same process; no logging                |
| Model poisoning     | Local models only; validation rejects non-copy-edit output  |
| Supply chain        | Signed releases; pinned dependencies; `npm audit` in CI     |
| Auto-update hijack  | Signed releases + `electron-updater` signature verification |
| Telemetry abuse     | Opt-in only; no PII; crash reports via `sendBeacon`         |

---

## Code Signing

### Production Releases

| Artifact                    | Signed                      |
| --------------------------- | --------------------------- |
| `PromptClarity Setup *.exe` | ✅ EV Code Signing          |
| `PromptClarity.exe`         | ✅ EV Code Signing          |
| `ollama.exe`                | ✅ Signed by Ollama team    |
| `api/server.exe`            | ✅ Signed by build pipeline |

**Certificate:** EV Code Signing (Sectigo/DigiCert/GlobalSign)
**Timestamp:** RFC 3161 (Sectigo/DigiCert timestamp server)

### Verification

```powershell
# Verify installer
signtool verify /pa "PromptClarity Setup 0.2.0.exe"

# Verify executable
signtool verify /pa "PromptClarity.exe"
```

---

## Dependency Security

### CI Pipeline

```yaml
# .github/workflows/security.yml
- name: Audit dependencies
  run: npm audit --audit-level=high

- name: Check for vulnerable packages
  run: npm audit --audit-level=moderate --json > audit.json || true

- name: Check license compliance
  run: npx license-checker --onlyAllow 'MIT;Apache-2.0;BSD-3-Clause;ISC;CC0-1.0;Unlicense'
```

### Dependency Policy

| Policy          | Rule                                           |
| --------------- | ---------------------------------------------- |
| Direct deps     | Pinned to exact versions (`package-lock.json`) |
| Transitive      | Locked via `package-lock.json`                 |
| Vulnerabilities | `npm audit` in CI; high/critical block release |
| Licenses        | MIT/Apache-2.0/BSD/ISC only                    |
| Updates         | Monthly `npm update` + manual review           |

---

## Auto-Updater Security

### Update Flow

```
1. App starts → autoUpdater.checkForUpdatesAndNotify()
2. GET https://api.github.com/repos/owner/repo/releases/latest
3. Verify release signature (electron-updater internal)
4. Download .exe to temp
4. Verify signature (electron-updater internal)
5. Prompt user → install on next restart
```

### Security Controls

| Control                | Implementation                                                             |
| ---------------------- | -------------------------------------------------------------------------- |
| Transport              | HTTPS only                                                                 |
| Signature verification | `electron-updater` internal (Ed25519)                                      |
| Downgrade protection   | Version comparison (semver)                                                |
| Rollback               | Previous version retained in `%LOCALAPPDATA%\PromptClarity Desktop\backup` |
| User consent           | Explicit prompt before install                                             |

### Update Server

| Provider  | GitHub Releases                |
| --------- | ------------------------------ |
| Auth      | None (public releases)         |
| Signature | Ed25519 via `electron-updater` |
| Channel   | `latest` (stable)              |

---

## Code Signing

### Certificate Requirements

| Requirement | Specification                   |
| ----------- | ------------------------------- |
| Type        | EV Code Signing                 |
| Provider    | Sectigo / DigiCert / GlobalSign |
| Key Size    | RSA 3072+ / ECDSA P-384         |
| Hash        | SHA-256                         |
| Timestamp   | RFC 3161                        |

### Signing Process

```powershell
# Sign installer
signtool sign /fd sha256 /tr http://timestamp.sectigo.com /td sha256 ^
  /f cert.pfx /p "%CSC_KEY_PASSWORD%" ^
  "release/desktop/PromptClarity Setup 0.2.0.exe"

# Verify
signtool verify /pa "release/desktop/PromptClarity Setup 0.2.0.exe"
```

### CI/CD Signing (GitHub Actions)

```yaml
- name: Sign installer
  uses: azure/sign-tool@v2
  with:
    certificate: ${{ secrets.CSC_LINK }}
    certificate-password: ${{ secrets.CSC_KEY_PASSWORD }}
    file: release/desktop/PromptClarity Setup *.exe
    timestamp-rfc3161: true
```

---

## Secure Development Practices

### Code Review Requirements

- [ ] All changes via PR
- [ ] 1+ approval required
- [ ] CI passes (tests, typecheck, lint)
- [ ] No secrets in code (GitHub secret scanning enabled)

### Dependency Management

```bash
# Monthly
npm audit
npm update

# Pre-release
npm audit --audit-level=high
```

### Secrets Management

| Secret             | Storage                                         |
| ------------------ | ----------------------------------------------- |
| Code signing cert  | GitHub Secrets (`CSC_LINK`, `CSC_KEY_PASSWORD`) |
| Telemetry endpoint | Hardcoded HTTPS URL (no secrets)                |
| No API keys        | No cloud APIs used                              |

---

## Incident Response

### Vulnerability Disclosure

1. **Report** → security@promptclarity.app
2. **Acknowledge** → Within 48 hours
3. **Triage** → Severity assessment (CVSS)
4. **Fix** → Target: 7 days (critical), 30 days (high)
5. **Release** → Signed patch release
6. **Disclose** → GitHub Security Advisory + Release notes

### Incident Classification

| Severity | Examples                         | SLA     |
| -------- | -------------------------------- | ------- |
| Critical | RCE, prompt exfiltration         | 24h     |
| High     | Local privilege escalation       | 72h     |
| Medium   | Information disclosure (non-PII) | 7 days  |
| Low      | Minor info leak                  | 30 days |

---

## Secure Deployment Checklist

### Pre-Release

- [ ] `npm audit` — no high/critical
- [ ] `npm run lint` — clean
- [ ] `npm run desktop:typecheck` — clean
- [ ] `npm test` — 100% pass
- [ ] Installer signed + verified
- [ ] Installer tested on clean VM
- [ ] Auto-updater tested (staging release)

### Post-Release

- [ ] GitHub Release published
- [ ] Release notes published
- [ ] Auto-updater verified (staging)
- [ ] Monitoring: crash reports, GitHub Issues

---

## Responsible Disclosure

We appreciate security researchers who:

1. Report via security@promptclarity.app (not public issues)
2. Provide reproduction steps
3. Allow reasonable time for fix before disclosure

We offer acknowledgment in release notes (with permission) and our gratitude.

---

## Security Contacts

- **Email:** security@promptclarity.app
- **PGP:** https://promptclarity.app/.well-known/pgp-key.asc
- **Response:** 48h acknowledgment, 7-day fix target
