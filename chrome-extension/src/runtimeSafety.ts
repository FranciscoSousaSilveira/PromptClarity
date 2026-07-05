export interface ChromeLike {
  runtime?: {
    id?: string;
    lastError?: { message?: string } | null;
  };
  storage?: {
    local?: unknown;
  };
}

export function getChromeApi(): ChromeLike | undefined {
  try {
    return (globalThis as typeof globalThis & { chrome?: ChromeLike }).chrome;
  } catch {
    return undefined;
  }
}

export function hasUsableExtensionContext(chromeApi: ChromeLike | undefined = getChromeApi()): boolean {
  try {
    return Boolean(chromeApi?.runtime?.id) && Boolean(chromeApi?.storage?.local);
  } catch {
    return false;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || '');
  }
  return String(error || '');
}

export function isExtensionContextInvalidationError(error: unknown): boolean {
  return /extension context (?:was )?invalidated/i.test(errorMessage(error));
}

export function isChromeRuntimeCommunicationError(error: unknown): boolean {
  return /extension context (?:was )?invalidated|message port closed|port is disconnected|receiving end does not exist|could not establish connection/i.test(
    errorMessage(error)
  );
}

export function readChromeRuntimeLastError(chromeApi: ChromeLike | undefined = getChromeApi()): Error | null {
  try {
    const message = chromeApi?.runtime?.lastError?.message;
    return message ? new Error(message) : null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

/** Tracks the one-way lifecycle of this content-script instance across an extension reload. */
export class ExtensionContextLifecycle {
  private observed = false;
  private invalidated = false;

  observe(chromeApi: ChromeLike | undefined = getChromeApi()): boolean {
    const available = hasUsableExtensionContext(chromeApi);
    if (available) this.observed = true;
    else if (this.observed) this.invalidated = true;
    return available && !this.invalidated;
  }

  noteRuntimeError(error: unknown): boolean {
    if (isExtensionContextInvalidationError(error)) this.invalidated = true;
    return isChromeRuntimeCommunicationError(error);
  }

  shouldIgnoreLateResult(chromeApi: ChromeLike | undefined = getChromeApi()): boolean {
    if (this.invalidated) return true;
    if (hasUsableExtensionContext(chromeApi)) {
      this.observed = true;
      return false;
    }
    if (this.observed) {
      this.invalidated = true;
      return true;
    }
    return false;
  }

  hasObservedExtensionContext(): boolean {
    return this.observed;
  }

  isInvalidated(): boolean {
    return this.invalidated;
  }
}
