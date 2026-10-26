# Privacy Policy

## Summary

**PromptClarity processes all prompts locally on your machine. No prompt data ever leaves your computer.**

---

## Data Processing

| Data                   | Where It Goes                                              | Retention                            |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------ |
| **Prompts**            | Local API (`127.0.0.1:3000`) → Ollama (`127.0.0.1:11434`)  | Memory only; never written to disk   |
| **Clipboard**          | Temporarily read/restored during capture/insert            | Restored immediately after operation |
| **History** (optional) | `%LOCALAPPDATA%\PromptClarity Desktop\prompt-clarity.json` | Until manually cleared or disabled   |
| **Settings**           | `%LOCALAPPDATA%\PromptClarity Desktop\prompt-clarity.json` | Persisted across sessions            |
| **Ollama models**      | `%LOCALAPPDATA%\Ollama\models\`                            | Managed by Ollama                    |
| **Telemetry** (opt-in) | `https://telemetry.promptclarity.app/v1/`                  | 30 days max                          |

---

## What We Don't Collect

- ❌ **Prompt text** — Never sent anywhere
- ❌ **Clipboard content** — Never logged or transmitted
- ❌ **File paths, filenames, or file contents**
- ❌ **Personal identifiers** (name, email, IP beyond connection)
- ❌ **Model outputs** — Not logged or cached beyond 30s memory cache

---

## Telemetry (Opt-in Only)

**Disabled by default.** Enable in Settings → Privacy → "Send anonymous crash reports & usage stats".

### Collected (if enabled)

| Event                                      | Data                                            |
| ------------------------------------------ | ----------------------------------------------- |
| `app_start`                                | Platform, arch, app version                     |
| `capture_success`                          | `selectionState`, `copiedLength`, duration (ms) |
| `capture_timeout`                          | Duration, timeout reason                        |
| `capture_error`                            | Error type, message (no prompt text)            |
| `model_download_start`                     | Model name                                      |
| `telemetry_enabled` / `telemetry_disabled` | Toggle state                                    |

### Crash Reports

- Triggered by `uncaughtException` / `unhandledRejection`
- Sent via `navigator.sendBeacon` for reliability
- Contains: error message, stack trace, app version, platform
- **Context only**: `captureInProgress`, `analysisInProgress`, `selectedModel`
- **Never includes**: Prompt text, clipboard, file paths, user data

### Data Handling

| Aspect             | Detail                                           |
| ------------------ | ------------------------------------------------ |
| **Endpoint**       | `https://telemetry.promptclarity.app/v1/events`  |
| **Crash Endpoint** | `https://telemetry.promptclarity.app/v1/crashes` |
| **Transport**      | HTTPS + `keepalive` / `sendBeacon`               |
| **Retention**      | 30 days max                                      |
| **Access**         | PromptClarity maintainers only                   |
| **Sharing**        | Never sold, shared, or sold                      |

---

## Local Data Storage

| Location                                                   | Content                               |
| ---------------------------------------------------------- | ------------------------------------- |
| `%LOCALAPPDATA%\PromptClarity Desktop\prompt-clarity.json` | Settings, optional history            |
| `%LOCALAPPDATA%\Ollama\models\`                            | Downloaded models (managed by Ollama) |
| `%TEMP%`                                                   | Temporary files (auto-cleaned)        |

**You control your data:**

- Disable history in Settings → History
- Clear history anytime from tray menu
- Delete `%LOCALAPPDATA%\PromptClarity Desktop` to wipe all local data

---

## Network Connections

| Destination                                        | Purpose                              | Required          |
| -------------------------------------------------- | ------------------------------------ | ----------------- |
| `127.0.0.1:3000`                                   | Local rewrite API                    | Yes               |
| `127.0.0.1:11434`                                  | Ollama inference                     | Yes               |
| `https://api.github.com`                           | Check Ollama releases (auto-install) | Auto-install only |
| `https://github.com/.../releases/download/...`     | Download Ollama installer            | Auto-install only |
| `https://telemetry.promptclarity.app`              | Opt-in telemetry                     | Opt-in only       |
| `https://api.github.com/repos/.../releases/latest` | Auto-updater check                   | Yes               |

**No other network connections are made.**

---

## Your Rights

- **Access** — View all local data in `%LOCALAPPDATA%\PromptClarity Desktop\`
- **Delete** — Clear history in Settings; uninstall removes app data
- **Opt-out** — Telemetry disabled by default; toggle anytime in Settings
- **Portability** — Export settings/history via Diagnostics panel

---

## Children's Privacy

PromptClarity is not directed at children under 13. We do not knowingly collect personal information from children.

---

## Changes to This Policy

Updates posted to this file and GitHub Releases. Continued use constitutes acceptance.

---

## Contact

Questions: [GitHub Issues](https://github.com/yourusername/PromptClarity/issues) or security@promptclarity.app
