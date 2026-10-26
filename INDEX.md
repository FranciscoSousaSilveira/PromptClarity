# PromptClarity Documentation

Welcome to the PromptClarity documentation. PromptClarity is a standalone Windows desktop application that improves prompts locally using a bundled Ollama instance and a local Next.js API server.

---

## 📚 Documentation Index

### 🚀 Getting Started

| Document                       | Description                                              |
| ------------------------------ | -------------------------------------------------------- |
| [README.md](README.md)         | Project overview, quick start, architecture, development |
| [INSTALL.md](INSTALL.md)       | End-user installation guide (standalone installer)       |
| [QUICKSTART.md](QUICKSTART.md) | Legacy VS Code MVP guide (historical)                    |

### 👤 User Guides

| Document                     | Description                                                |
| ---------------------------- | ---------------------------------------------------------- |
| [APP_GUIDE.md](APP_GUIDE.md) | Complete application guide (desktop, Chrome, VS Code, API) |
| [INSTALL.md](INSTALL.md)     | End-user installation guide                                |
| [PRIVACY.md](PRIVACY.md)     | Privacy policy, telemetry, data handling                   |

### 🛠️ Developer & Maintainer Guides

| Document                               | Description                                      |
| -------------------------------------- | ------------------------------------------------ |
| [IMPLEMENTATION.md](IMPLEMENTATION.md) | Complete architecture, data flow, components     |
| [DEPLOY.md](DEPLOY.md)                 | Deployment guide (code signing, CI/CD, releases) |
| [SECURITY.md](SECURITY.md)             | Security policy, threat model, code signing      |
| [PRIVACY.md](PRIVACY.md)               | Privacy policy, telemetry, data handling         |
| [SECURITY.md](SECURITY.md)             | Security policy, threat model, code signing      |

### 📦 Release & Packaging

| Document                 | Description                                       |
| ------------------------ | ------------------------------------------------- |
| [RELEASE.md](RELEASE.md) | Release process, versioning, changelog            |
| [DEPLOY.md](DEPLOY.md)   | Deployment pipeline, code signing, GitHub Actions |

### 🔒 Security & Compliance

| Document                   | Description                                            |
| -------------------------- | ------------------------------------------------------ |
| [SECURITY.md](SECURITY.md) | Security policy, vulnerability reporting, threat model |
| [PRIVACY.md](PRIVACY.md)   | Privacy policy, telemetry opt-in, data handling        |
| [SECURITY.md](SECURITY.md) | Code signing, threat model, incident response          |

---

## 🚀 Quick Links

| Task                     | Command                     |
| ------------------------ | --------------------------- |
| **Install dependencies** | `npm install`               |
| **Build desktop app**    | `npm run desktop:build`     |
| **Run tests**            | `npm test`                  |
| **Type check**           | `npm run desktop:typecheck` |
| **Lint**                 | `npm run lint`              |
| **Package installer**    | `npm run package:desktop`   |
| **Run dev mode**         | `npm run desktop:dev`       |
| **Run diagnostics**      | `npm run diagnostics`       |

---

## 🏗️ Project Structure

```
PromptClarity/
├── apps/desktop-app/          # Electron desktop app
│   ├── src/
│   │   ├── main.ts            # Electron main, tray, services
│   │   ├── renderer.ts        # React popup UI
│   │   ├── services.ts        # Service manager (Ollama + API)
│   │   ├── telemetry.ts       # Opt-in telemetry
│   │   ├── windows-helper.ps1 # Windows automation
│   │   └── renderer/          # React popup UI
│   ├── resources/
│   │   ├── ollama/ollama.exe      # Bundled Ollama
│   │   └── api/api/               # Bundled API server
│   └── scripts/
│       ├── build.mjs
│       ├── download-ollama.mjs
│       └── build-api.mjs
├── app/                       # Next.js API server
├── config/product.ts          # Model profiles, shortcuts
├── types/                     # TypeScript types
├── lib/                       # Shared logic (analyzer, rewriter, etc.)
├── tests/                     # Vitest tests
└── package.json               # Root workspace
```

---

## 🔑 Key Commands

```powershell
# Development
npm run desktop:dev          # Run with hot reload
npm run desktop:build        # Build for production
npm run package:desktop      # Create NSIS installer

# Quality
npm test                     # 324 tests
npm run desktop:typecheck    # TypeScript check
npm run lint                 # ESLint

# Production
npm run package:desktop      # Creates PromptClarity Setup 0.2.0.exe
```

---

## 📋 Quick Reference

| Feature                 | Implementation                                  |
| ----------------------- | ----------------------------------------------- |
| **Hotkey**              | `Ctrl+Alt+P` (configurable)                     |
| **Auto model select**   | RAM detection on first run                      |
| **Ollama auto-install** | Silent install if missing (opt-out in Settings) |
| **Model selector**      | Settings → Model dropdown + Re-detect button    |
| **Telemetry**           | Opt-in only (Settings → Privacy)                |
| **Auto-updater**        | GitHub Releases + electron-updater              |
| **Code signing**        | EV certificate required for release             |

---

## 🔗 External Links

- [GitHub Repository](https://github.com/yourusername/PromptClarity)
- [GitHub Releases](https://github.com/yourusername/PromptClarity/releases)
- [Issue Tracker](https://github.com/yourusername/PromptClarity/issues)
- [Security Reporting](mailto:security@promptclarity.app)
