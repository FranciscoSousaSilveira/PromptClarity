export interface ChatSiteAdapter {
  id: string;
  hosts: string[];
  composerSelectors: string[];
  userMessageSelectors: string[];
  richTextStrategy: 'native-input' | 'contenteditable' | 'paragraphs';
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase();
}

export function matchesChatSiteHost(hostname: string, adapterHost: string): boolean {
  const normalizedHostname = normalizeHostname(hostname);
  const normalizedAdapterHost = normalizeHostname(adapterHost);
  return (
    normalizedHostname === normalizedAdapterHost ||
    normalizedHostname.endsWith(`.${normalizedAdapterHost}`)
  );
}

const COMMON_COMPOSERS = ['textarea', 'input[type="text"]', '[contenteditable="true"]'];
const COMMON_USER_MESSAGES = [
  '[data-message-author-role="user"]',
  '[data-testid="user-message"]',
  '[data-testid="user-query"]',
  '[data-author="user"]',
  '[data-role="user"]',
  '.user-message',
  '.font-user-message'
];

export const CHAT_SITE_ADAPTERS: ChatSiteAdapter[] = [
  {
    id: 'chatgpt',
    hosts: ['chatgpt.com', 'chat.openai.com'],
    composerSelectors: ['#prompt-textarea', ...COMMON_COMPOSERS],
    userMessageSelectors: ['[data-message-author-role="user"]', ...COMMON_USER_MESSAGES],
    richTextStrategy: 'contenteditable'
  },
  {
    id: 'claude',
    hosts: ['claude.ai'],
    composerSelectors: ['[contenteditable="true"]', ...COMMON_COMPOSERS],
    userMessageSelectors: ['[data-testid="user-message"]', ...COMMON_USER_MESSAGES],
    richTextStrategy: 'contenteditable'
  },
  {
    id: 'gemini',
    hosts: ['gemini.google.com'],
    composerSelectors: ['.ql-editor[contenteditable="true"]', ...COMMON_COMPOSERS],
    userMessageSelectors: ['user-query', '.user-query-container', ...COMMON_USER_MESSAGES],
    richTextStrategy: 'paragraphs'
  },
  {
    id: 'copilot',
    hosts: ['copilot.microsoft.com'],
    composerSelectors: COMMON_COMPOSERS,
    userMessageSelectors: COMMON_USER_MESSAGES,
    richTextStrategy: 'contenteditable'
  },
  {
    id: 'perplexity',
    hosts: ['www.perplexity.ai'],
    composerSelectors: COMMON_COMPOSERS,
    userMessageSelectors: ['[data-testid="user-query"]', ...COMMON_USER_MESSAGES],
    richTextStrategy: 'contenteditable'
  },
  {
    id: 'deepseek',
    hosts: ['chat.deepseek.com'],
    composerSelectors: COMMON_COMPOSERS,
    userMessageSelectors: COMMON_USER_MESSAGES,
    richTextStrategy: 'native-input'
  },
  {
    id: 'grok',
    hosts: ['grok.com'],
    composerSelectors: COMMON_COMPOSERS,
    userMessageSelectors: COMMON_USER_MESSAGES,
    richTextStrategy: 'contenteditable'
  },
  {
    id: 'mistral',
    hosts: ['chat.mistral.ai'],
    composerSelectors: COMMON_COMPOSERS,
    userMessageSelectors: COMMON_USER_MESSAGES,
    richTextStrategy: 'contenteditable'
  },
  {
    id: 'poe',
    hosts: ['poe.com'],
    composerSelectors: COMMON_COMPOSERS,
    userMessageSelectors: COMMON_USER_MESSAGES,
    richTextStrategy: 'contenteditable'
  },
  {
    id: 'meta',
    hosts: ['www.meta.ai'],
    composerSelectors: COMMON_COMPOSERS,
    userMessageSelectors: COMMON_USER_MESSAGES,
    richTextStrategy: 'contenteditable'
  }
];

export function getSiteAdapter(hostname = location.hostname): ChatSiteAdapter {
  const normalizedHostname = normalizeHostname(hostname);
  return (
    CHAT_SITE_ADAPTERS.find((adapter) =>
      adapter.hosts.some((adapterHost) => matchesChatSiteHost(normalizedHostname, adapterHost))
    ) || {
      id: 'generic',
      hosts: [normalizedHostname],
      composerSelectors: COMMON_COMPOSERS,
      userMessageSelectors: COMMON_USER_MESSAGES,
      richTextStrategy: 'contenteditable'
    }
  );
}
