export declare const PRODUCT: {
    readonly name: "Prompt Grammarly";
    readonly desktopName: "Prompt Grammarly Desktop";
    readonly version: "0.2.0";
    readonly apiUrl: "http://127.0.0.1:3000/api/rewrite";
    readonly defaultShortcut: "CommandOrControl+Alt+P";
};
export declare const SUPPORTED_CHAT_ORIGINS: readonly ["https://chatgpt.com", "https://chat.openai.com", "https://claude.ai", "https://gemini.google.com", "https://copilot.microsoft.com", "https://www.perplexity.ai", "https://chat.deepseek.com", "https://grok.com", "https://chat.mistral.ai", "https://poe.com", "https://www.meta.ai"];
export type PerformanceMode = 'fast' | 'balanced' | 'quality';
export interface ModelProfile {
    mode: PerformanceMode;
    label: string;
    model: string;
    maxInputCharacters: number;
    maxOutputTokens: number;
    contextTokens: number;
    temperature: number;
    useInstantRulesForShortPrompts: boolean;
}
export declare const MODEL_PROFILES: Record<PerformanceMode, ModelProfile>;
export declare function isPerformanceMode(value: unknown): value is PerformanceMode;
//# sourceMappingURL=product.d.ts.map