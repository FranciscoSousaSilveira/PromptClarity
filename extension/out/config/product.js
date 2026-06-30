"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODEL_PROFILES = exports.SUPPORTED_CHAT_ORIGINS = exports.PRODUCT = void 0;
exports.isPerformanceMode = isPerformanceMode;
exports.PRODUCT = {
    name: 'Prompt Grammarly',
    desktopName: 'Prompt Grammarly Desktop',
    version: '0.2.0',
    apiUrl: 'http://127.0.0.1:3000/api/rewrite',
    defaultShortcut: 'CommandOrControl+Alt+P'
};
exports.SUPPORTED_CHAT_ORIGINS = [
    'https://chatgpt.com',
    'https://chat.openai.com',
    'https://claude.ai',
    'https://gemini.google.com',
    'https://copilot.microsoft.com',
    'https://www.perplexity.ai',
    'https://chat.deepseek.com',
    'https://grok.com',
    'https://chat.mistral.ai',
    'https://poe.com',
    'https://www.meta.ai'
];
exports.MODEL_PROFILES = {
    fast: {
        mode: 'fast',
        label: 'Fast',
        model: 'qwen2.5:0.5b',
        maxInputCharacters: 1500,
        maxOutputTokens: 64,
        contextTokens: 1024,
        temperature: 0.05,
        useInstantRulesForShortPrompts: true
    },
    balanced: {
        mode: 'balanced',
        label: 'Balanced',
        model: 'gemma3:1b',
        maxInputCharacters: 6000,
        maxOutputTokens: 180,
        contextTokens: 2048,
        temperature: 0.1,
        useInstantRulesForShortPrompts: false
    },
    quality: {
        mode: 'quality',
        label: 'Quality',
        model: 'qwen2.5:3b',
        maxInputCharacters: 12000,
        maxOutputTokens: 320,
        contextTokens: 4096,
        temperature: 0.15,
        useInstantRulesForShortPrompts: false
    }
};
function isPerformanceMode(value) {
    return value === 'fast' || value === 'balanced' || value === 'quality';
}
//# sourceMappingURL=product.js.map