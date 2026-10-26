import { spawn, ChildProcessWithoutNullStreams, ChildProcessByStdio } from 'node:child_process';
import { join } from 'node:path';
import { app } from 'electron';
import process from 'node:process';

const nodeProcess = process;

interface ServiceConfig {
  name: string;
  command: string;
  args: string[];
  healthUrl: string;
  readyTimeoutMs: number;
  env?: Record<string, string>;
}

interface ServiceInstance {
  process: any | null;
  config: ServiceConfig;
  isReady: boolean;
  startTime: number;
}

export class ServiceManager {
  private services = new Map<string, ServiceInstance>();
  private isShuttingDown = false;

  private getResourcePath(relativePath: string): string {
    // In development: resources are in the project
    // In production: resources are in the app.asar.unpacked or alongside the executable
    const base = app.isPackaged
      ? join(nodeProcess.resourcesPath)
      : join(__dirname, '..', '..', 'resources');
    return join(base, relativePath);
  }

  async startService(config: ServiceConfig): Promise<void> {
    if (this.services.has(config.name)) {
      console.log(`[ServiceManager] ${config.name} already running`);
      return;
    }

    console.log(`[ServiceManager] Starting ${config.name}...`);

    const execPath = this.getResourcePath(config.command);
    const childProcess = spawn(execPath, config.args, {
      env: { ...nodeProcess.env, ...config.env },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const instance: ServiceInstance = {
      process: childProcess,
      config,
      isReady: false,
      startTime: Date.now()
    };

    this.services.set(config.name, instance);

    // Handle process output
    childProcess.stdout?.on('data', (data: Buffer) => {
      console.log(`[${config.name}] ${data.toString().trim()}`);
    });
    childProcess.stderr?.on('data', (data: Buffer) => {
      console.warn(`[${config.name}] ${data.toString().trim()}`);
    });

    childProcess.on('exit', (code: number, signal: NodeJS.Signals | null) => {
      console.log(`[ServiceManager] ${config.name} exited with code ${code}, signal ${signal}`);
      instance.isReady = false;
      if (!this.isShuttingDown) {
        console.warn(`[ServiceManager] ${config.name} died unexpectedly, not restarting automatically`);
      }
    });

    // Wait for health check
    await this.waitForHealth(config.name);
  }

  private async waitForHealth(serviceName: string): Promise<void> {
    const instance = this.services.get(serviceName);
    if (!instance) throw new Error(`Service ${serviceName} not found`);

    const { healthUrl, readyTimeoutMs } = instance.config;
    const startTime = Date.now();

    while (Date.now() - startTime < readyTimeoutMs) {
      if (this.isShuttingDown) throw new Error('Shutting down');

      try {
        const response = await fetch(healthUrl, { method: 'GET', signal: AbortSignal.timeout(2000) });
        if (response.ok) {
          instance.isReady = true;
          console.log(`[ServiceManager] ${serviceName} is ready`);
          return;
        }
      } catch {
        // Not ready yet
      }
      await new Promise(r => setTimeout(r, 500));
    }

    throw new Error(`${serviceName} failed to become ready within ${readyTimeoutMs}ms`);
  }

  async stopService(name: string): Promise<void> {
    const instance = this.services.get(name);
    if (!instance || !instance.process) return;

    console.log(`[ServiceManager] Stopping ${name}...`);
    instance.process.kill('SIGTERM');

    // Wait for graceful shutdown
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.warn(`[ServiceManager] ${name} did not exit gracefully, forcing kill`);
        instance.process?.kill('SIGKILL');
        resolve();
      }, 5000);

      instance.process?.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    this.services.delete(name);
    console.log(`[ServiceManager] ${name} stopped`);
  }

  async stopAll(): Promise<void> {
    this.isShuttingDown = true;
    const names = Array.from(this.services.keys());
    await Promise.all(names.map(name => this.stopService(name)));
  }

  isServiceReady(name: string): boolean {
    return this.services.get(name)?.isReady ?? false;
  }

  getServiceUrl(name: string): string | null {
    const instance = this.services.get(name);
    return instance ? instance.config.healthUrl.replace('/health', '') : null;
  }
}

// Factory function to create the default services for Prompt Grammarly
export function createDefaultServices(): ServiceManager {
  const manager = new ServiceManager();

  // Ollama service
  const ollamaExe = process.platform === 'win32' ? 'ollama/ollama.exe' : 'ollama/ollama';
  const ollamaConfig: ServiceConfig = {
    name: 'ollama',
    command: ollamaExe,
    args: ['serve'],
    healthUrl: 'http://127.0.0.1:11434/api/version',
    readyTimeoutMs: 30000,
    env: {
      OLLAMA_HOST: '127.0.0.1:11434',
      OLLAMA_MODELS: join(process.env.APPDATA || '', 'Ollama', 'models')
    }
  };

  // API service - the port will be dynamically assigned
  const apiConfig: ServiceConfig = {
    name: 'api',
    command: process.platform === 'win32' ? 'api/server.exe' : 'api/server',
    args: [],
    healthUrl: 'http://127.0.0.1:3000/api/health',
    readyTimeoutMs: 15000,
    env: {
      PORT: '3000',
      OLLAMA_URL: 'http://127.0.0.1:11434',
      NODE_ENV: 'production'
    }
  };

  return manager;
}

export function getServiceManager(): ServiceManager {
  // Singleton pattern
  const globalWithServiceManager = global as typeof globalThis & {
    serviceManager?: ServiceManager;
  };
  if (!globalWithServiceManager.serviceManager) {
    globalWithServiceManager.serviceManager = createDefaultServices();
  }
  return globalWithServiceManager.serviceManager;
}