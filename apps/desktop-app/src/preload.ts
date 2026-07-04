import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridge, DesktopPopupState } from './shared';

const bridge: DesktopBridge = {
  onState(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, state: DesktopPopupState) => listener(state);
    ipcRenderer.on('desktop-state', wrapped);
    return () => ipcRenderer.removeListener('desktop-state', wrapped);
  },
  copy: (text) => ipcRenderer.invoke('copy-improved-prompt', text),
  insert: (text) => ipcRenderer.invoke('insert-improved-prompt', text),
  undo: () => ipcRenderer.invoke('undo-last-insertion'),
  tooMuch: () => ipcRenderer.invoke('too-much-feedback'),
  retry: () => ipcRenderer.invoke('retry-analysis'),
  close: () => ipcRenderer.invoke('close-popup'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  clearHistory: () => ipcRenderer.invoke('clear-history')
};

contextBridge.exposeInMainWorld('promptDesktop', bridge);
