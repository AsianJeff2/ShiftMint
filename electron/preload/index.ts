import { contextBridge, ipcRenderer } from 'electron';
import type { OpenDialogOptions, SaveDialogOptions } from 'electron';

// Privileged operations use fixed channels validated by the main process.
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getBootstrapToken: () => ipcRenderer.invoke('auth:bootstrap-token'),
  getApiToken: () => ipcRenderer.invoke('auth:api-token'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  showOpenDialog: (options: OpenDialogOptions) => ipcRenderer.invoke('dialog:open', options),
  showSaveDialog: (options: SaveDialogOptions) => ipcRenderer.invoke('dialog:save', options),
  showNotification: (title: string, body: string) => ipcRenderer.invoke('notification:show', { title, body }),
  database: {
    selectBackupFile: () => ipcRenderer.invoke('database:selectBackupFile'),
    selectBackupLocation: () => ipcRenderer.invoke('database:selectBackupLocation'),
  },
});
