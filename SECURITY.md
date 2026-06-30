# Security

The local API binds to `127.0.0.1` and accepts browser requests only from supported chat origins and Chrome extensions. An optional `PROMPT_GRAMMARLY_TOKEN` environment variable enables an additional request token through `X-Prompt-Grammarly-Token`.

Run these checks before release:

```powershell
npm audit
npm --prefix extension audit
npm --prefix apps/desktop-app audit
npm run lint
npm run test:coverage
```

Do not expose port 3000 or the Ollama port to a public network. Report security issues privately to the repository owner rather than opening a public issue.
