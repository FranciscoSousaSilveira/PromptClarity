import { app } from 'electron';
import { DesktopStore } from './desktopStore';
import { join } from 'node:path';
const desktopStore = new DesktopStore(
  join(app.getPath('appData'), 'PromptClarity Desktop', 'prompt-clarity.json')
);

interface TelemetryEvent {
  event: string;
  timestamp: number;
  version: string;
  platform: string;
  data?: Record<string, unknown>;
}

interface CrashReport {
  timestamp: number;
  version: string;
  platform: string;
  error: {
    message: string;
    stack?: string;
    name: string;
  };
  context?: {
    captureInProgress: boolean;
    analysisInProgress: boolean;
    selectedModel?: string;
  };
}

const ENDPOINT = 'https://telemetry.promptclarity.app/v1/events';
const CRASH_ENDPOINT = 'https://telemetry.promptclarity.app/v1/crashes';

let telemetryEnabled = false;

export function initTelemetry() {
  const settings = desktopStore.settings;
  telemetryEnabled = settings.telemetryEnabled === true;

  if (telemetryEnabled) {
    setupCrashHandler();
    track('app_start', {
      platform: process.platform,
      arch: process.arch,
      version: app.getVersion()
    });
  }

  // Listen for setting changes
  desktopStore.onDidChange('telemetryEnabled', (enabled: boolean) => {
    telemetryEnabled = enabled;
    if (enabled) track('telemetry_enabled');
    else track('telemetry_disabled');
  });
}

function track(event: string, data?: Record<string, unknown>) {
  if (!telemetryEnabled) return;

  const eventData: TelemetryEvent = {
    event,
    timestamp: Date.now(),
    version: app.getVersion(),
    platform: process.platform,
    data
  };

  fetch('https://telemetry.promptclarity.app/v1/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventData),
    keepalive: true
  }).catch(() => {}); // Silent fail
}

function setupCrashHandler() {
  process.on('uncaughtException', (error) => {
    if (!telemetryEnabled) return;

    const report: CrashReport = {
      timestamp: Date.now(),
      version: app.getVersion(),
      platform: process.platform,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context: {
        captureInProgress: false,
        analysisInProgress: false
      }
    };

    // Use sendBeacon for reliability during crash
    navigator.sendBeacon?.('https://telemetry.promptclarity.app/v1/crashes', JSON.stringify(report));
  });

  process.on('unhandledRejection', (reason) => {
    if (!telemetryEnabled) return;
    const error = reason instanceof Error ? reason : new Error(String(reason));
    // Same as above
  });
}

export function trackEvent(event: string, data?: Record<string, unknown>) {
  if (!telemetryEnabled) return;
  track(event, data);
}

export function isTelemetryEnabled(): boolean {
  return telemetryEnabled;
}

export function setTelemetryEnabled(enabled: boolean) {
  telemetryEnabled = enabled;
}
