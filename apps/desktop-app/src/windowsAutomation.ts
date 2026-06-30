import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';
import { join } from 'node:path';

export interface WindowsCaptureResult {
  windowHandle: string;
  selectionState: 'HAS_SELECTION' | 'AUTO_SELECTED' | 'EMPTY' | 'UNKNOWN';
  processName: string;
  caretAtEnd: boolean | null;
  isTextControl: boolean;
}

interface HelperResponse {
  id: number;
  ok: boolean;
  error?: string;
  result?: WindowsCaptureResult;
}

interface PendingRequest {
  resolve: (response: HelperResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class WindowsAutomation {
  private child: ChildProcessWithoutNullStreams | null = null;
  private lines: Interface | null = null;
  private sequence = 0;
  private pending = new Map<number, PendingRequest>();

  start() {
    this.ensureStarted();
  }

  async capture(): Promise<WindowsCaptureResult> {
    const response = await this.request('capture');
    if (!response.result) throw new Error('Windows helper returned no capture result.');
    return response.result;
  }

  async paste(windowHandle: string, selectAll = false): Promise<void> {
    await this.request('paste', { windowHandle, selectAll });
  }

  stop() {
    this.lines?.close();
    this.child?.kill();
    this.lines = null;
    this.child = null;
    for (const item of this.pending.values()) {
      clearTimeout(item.timeout);
      item.reject(new Error('Windows helper stopped.'));
    }
    this.pending.clear();
  }

  private ensureStarted() {
    if (this.child && !this.child.killed) return;
    const helperPath = join(__dirname, 'windows-helper.ps1');
    this.child = spawn(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', helperPath],
      { windowsHide: true }
    );
    this.lines = createInterface({ input: this.child.stdout });
    this.lines.on('line', (line) => this.handleLine(line));
    this.child.on('exit', () => this.stop());
    this.child.stderr.on('data', (chunk) =>
      console.warn(`[desktop] Windows helper: ${String(chunk).trim()}`)
    );
  }

  private request(command: string, extra: Record<string, unknown> = {}): Promise<HelperResponse> {
    this.ensureStarted();
    const id = ++this.sequence;
    return new Promise<HelperResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Windows helper timed out during ${command}.`));
      }, 8_000);
      this.pending.set(id, { resolve, reject, timeout });
      this.child!.stdin.write(`${JSON.stringify({ id, command, ...extra })}\n`);
    }).then((response) => {
      if (!response.ok) throw new Error(response.error || `Windows helper failed during ${command}.`);
      return response;
    });
  }

  private handleLine(line: string) {
    let response: HelperResponse;
    try {
      response = JSON.parse(line) as HelperResponse;
    } catch {
      return;
    }
    const pending = this.pending.get(response.id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(response.id);
    pending.resolve(response);
  }
}
