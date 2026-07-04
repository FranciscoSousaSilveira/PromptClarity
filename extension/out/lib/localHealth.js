"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OLLAMA_HEALTH_TIMEOUT_MS = void 0;
exports.checkLocalApiHealth = checkLocalApiHealth;
const product_1 = require("../config/product");
const localRewriteService_1 = require("./localRewriteService");
exports.OLLAMA_HEALTH_TIMEOUT_MS = 1500;
function elapsedSince(startedAt) {
    return Math.max(0, Date.now() - startedAt);
}
/** Lightweight local-only check. It never loads the model or performs a rewrite. */
async function checkLocalApiHealth(options = {}) {
    // External environment values are intentionally reduced to a safe loopback URL.
    const url = (0, localRewriteService_1.resolveLocalOllamaUrl)(options.ollamaUrl);
    const mode = options.mode || 'fast';
    const intervention = options.intervention || product_1.DEFAULT_REWRITE_INTERVENTION;
    const model = (0, localRewriteService_1.getSelectedLocalModel)(mode);
    const fetchImpl = options.fetchImpl || fetch;
    const timeoutMs = options.timeoutMs ?? exports.OLLAMA_HEALTH_TIMEOUT_MS;
    const startedAt = Date.now();
    const controller = new AbortController();
    let timeout;
    try {
        // Promise.race prevents a faulty local service from holding diagnostics open.
        const timeoutPromise = new Promise((_resolve, reject) => {
            timeout = setTimeout(() => {
                controller.abort();
                const error = new Error('Ollama health check timed out');
                error.name = 'AbortError';
                reject(error);
            }, timeoutMs);
        });
        const response = await Promise.race([
            fetchImpl(`${url}/api/tags`, { cache: 'no-store', signal: controller.signal }),
            timeoutPromise
        ]);
        const latencyMs = elapsedSince(startedAt);
        if (!response.ok) {
            const message = `Ollama returned HTTP ${response.status}`;
            return {
                status: 'error',
                api: 'ok',
                ollama: { status: 'error', url, model, reachable: true, latencyMs, error: message },
                config: {
                    mode,
                    intervention,
                    keepAlive: options.keepAlive ?? null,
                    prewarmEnabled: options.prewarmEnabled ?? null
                },
                lastError: message
            };
        }
        return {
            status: 'ok',
            api: 'ok',
            ollama: { status: 'ok', url, model, reachable: true, latencyMs },
            config: {
                mode,
                intervention,
                keepAlive: options.keepAlive ?? null,
                prewarmEnabled: options.prewarmEnabled ?? null
            },
            lastError: null
        };
    }
    catch (error) {
        const timedOut = error instanceof Error && error.name === 'AbortError';
        const message = timedOut ? 'Ollama health check timed out' : 'Ollama is unreachable';
        return {
            status: 'degraded',
            api: 'ok',
            ollama: {
                status: 'unreachable',
                url,
                model,
                reachable: false,
                latencyMs: elapsedSince(startedAt),
                error: message
            },
            config: {
                mode,
                intervention,
                keepAlive: options.keepAlive ?? null,
                prewarmEnabled: options.prewarmEnabled ?? null
            },
            lastError: message
        };
    }
    finally {
        if (timeout)
            clearTimeout(timeout);
    }
}
//# sourceMappingURL=localHealth.js.map