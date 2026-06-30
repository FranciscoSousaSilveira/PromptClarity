# Privacy

- Prompts are sent only to the local service at `127.0.0.1:3000` and local Ollama at `127.0.0.1:11434`.
- No telemetry, analytics, cloud API, or external prompt storage is enabled.
- The desktop app temporarily reads and restores the clipboard during capture and insertion.
- Optional local history is stored in the desktop application data directory and can be disabled or cleared.
- The rewrite service keeps a memory-only cache for 30 seconds to avoid duplicate processing.
- Models may remain in RAM when **Keep models in memory** is enabled.
