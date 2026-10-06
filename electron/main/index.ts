import { app, BrowserWindow, shell, ipcMain, dialog, Notification } from 'electron';
import type { IpcMainInvokeEvent, OpenDialogOptions, SaveDialogOptions } from 'electron';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { createRendererPolicy, isAllowedExternalUrl } from './renderer-policy';
import { initializeDesktopEnvironment } from './runtime-environment';

// The desktop process owns a local service, even if its parent has web settings.
process.env.SHIFTMINT_RUNTIME = 'desktop';
process.env.HOST = '127.0.0.1';
process.env.PORT = '3001';
process.env.SHIFTMINT_DESKTOP_TOKEN = randomBytes(32).toString('hex');
if (app.isPackaged) process.env.NODE_ENV = 'production';

const rendererPolicy = createRendererPolicy({
  packaged: app.isPackaged,
  appPath: app.getAppPath(),
  devUrl: process.env.VITE_DEV_SERVER_URL,
});

let mainWindow: BrowserWindow | null = null;
let stopBackendServer: (() => Promise<void>) | undefined;
let closeDatabase: (() => Promise<void>) | undefined;
let shuttingDown = false;
let ready = false;

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  if (!mainWindow || event.sender !== mainWindow.webContents ||
      event.senderFrame !== mainWindow.webContents.mainFrame ||
      !rendererPolicy.isTrustedRendererUrl(event.senderFrame?.url || '')) {
    throw new Error('IPC request rejected');
  }
}

function dialogOptions(value: unknown, mode: 'open' | 'save'): OpenDialogOptions | SaveDialogOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid dialog options');
  }
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const key of ['title', 'defaultPath', 'buttonLabel', 'message', 'nameFieldLabel']) {
    const text = input[key];
    if (text !== undefined) {
      if (typeof text !== 'string' || text.length > 4096 || text.includes('\0')) {
        throw new Error('Invalid dialog text');
      }
      output[key] = text;
    }
  }
  if (input.filters !== undefined) {
    if (!Array.isArray(input.filters) || input.filters.length > 20) {
      throw new Error('Invalid dialog filters');
    }
    output.filters = input.filters.map((filter: unknown) => {
      if (!filter || typeof filter !== 'object') throw new Error('Invalid dialog filter');
      const entry = filter as Record<string, unknown>;
      if (typeof entry.name !== 'string' || entry.name.length > 100 ||
          !Array.isArray(entry.extensions) || entry.extensions.length > 20 ||
          !entry.extensions.every((extension: unknown) =>
            typeof extension === 'string' && /^[a-zA-Z0-9*]+$/.test(extension))) {
        throw new Error('Invalid dialog filter');
      }
      return { name: entry.name, extensions: entry.extensions };
    });
  }
  if (input.properties !== undefined) {
    const allowed = mode === 'open'
      ? ['openFile', 'openDirectory', 'multiSelections', 'showHiddenFiles', 'createDirectory',
         'promptToCreate', 'noResolveAliases', 'treatPackageAsDirectory', 'dontAddToRecent']
      : ['showHiddenFiles', 'createDirectory', 'treatPackageAsDirectory',
         'showOverwriteConfirmation', 'dontAddToRecent'];
    if (!Array.isArray(input.properties) ||
        !input.properties.every((property: unknown) => typeof property === 'string' && allowed.includes(property))) {
      throw new Error('Invalid dialog properties');
    }
    output.properties = input.properties;
  }
  return output as OpenDialogOptions | SaveDialogOptions;
}

function registerIpcHandlers(): void {
  const handle = (channel: string, handler: (...args: unknown[]) => unknown) => {
    ipcMain.handle(channel, (event, ...args) => {
      assertTrustedSender(event);
      return handler(...args);
    });
  };
  handle('app:version', () => app.getVersion());
  handle('auth:bootstrap-token', () => process.env.BOOTSTRAP_TOKEN);
  handle('auth:api-token', () => process.env.SHIFTMINT_DESKTOP_TOKEN);
  handle('window:minimize', () => mainWindow?.minimize());
  handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  handle('window:close', () => mainWindow?.close());
  handle('dialog:open', options =>
    dialog.showOpenDialog(mainWindow!, dialogOptions(options, 'open') as OpenDialogOptions));
  handle('dialog:save', options =>
    dialog.showSaveDialog(mainWindow!, dialogOptions(options, 'save') as SaveDialogOptions));
  handle('notification:show', value => {
    if (!value || typeof value !== 'object') throw new Error('Invalid notification');
    const { title, body } = value as Record<string, unknown>;
    if (typeof title !== 'string' || title.length > 250 ||
        typeof body !== 'string' || body.length > 4000) throw new Error('Invalid notification');
    if (Notification.isSupported()) new Notification({ title, body }).show();
  });
  handle('database:selectBackupFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Select Database Backup File',
      filters: [{ name: 'Database Files', extensions: ['db', 'sqlite', 'sqlite3'] }],
      properties: ['openFile'],
    });
    return result.canceled ? null : result.filePaths[0];
  });
  handle('database:selectBackupLocation', async () => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Save Database Backup',
      defaultPath: `shiftmint-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'Database Files', extensions: ['db'] }],
    });
    return result.canceled ? null : result.filePath;
  });
}

function openExternal(url: string): void {
  if (isAllowedExternalUrl(url)) {
    void shell.openExternal(url).catch(() => console.error('Could not open the external link.'));
  }
}

async function createWindow(): Promise<void> {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  const iconPath = join(app.getAppPath(), 'assets', 'icon.png.png');
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'ShiftMint',
    show: false,
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: rendererPolicy.usesDevServer,
    },
  });
  mainWindow = window;
  if (app.isPackaged) window.removeMenu();

  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!rendererPolicy.isTrustedRendererUrl(url)) {
      event.preventDefault();
      openExternal(url);
    }
  });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => { if (mainWindow === window) mainWindow = null; });

  await window.loadURL(rendererPolicy.rendererUrl);
  if (rendererPolicy.usesDevServer) window.webContents.openDevTools({ mode: 'detach' });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (ready) void createWindow().catch(() => console.error('Could not reopen the app window.'));
  });
  app.whenReady().then(async () => {
    initializeDesktopEnvironment();
    registerIpcHandlers();
    const database = await import('../backend/database');
    closeDatabase = database.closeDatabase;
    await database.initializeDatabase();
    const backend = await import('../backend/server');
    stopBackendServer = backend.stopBackendServer;
    await backend.startBackendServer();
    ready = true;
    await createWindow();
  }).catch(error => {
    const message = error instanceof Error ? error.message : 'The local database or service could not start.';
    console.error('Desktop startup failed:', message);
    dialog.showErrorBox('ShiftMint could not start',
      message + '\n\nPreserve the database and its original encryption key. Follow the database recovery guide before retrying.');
    app.quit();
  });

  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('activate', () => {
    if (ready && BrowserWindow.getAllWindows().length === 0) {
      void createWindow().catch(() => console.error('Could not reopen the app window.'));
    }
  });
  app.on('before-quit', event => {
    if (shuttingDown) return;
    event.preventDefault();
    shuttingDown = true;
    ready = false;
    void (async () => {
      try { await stopBackendServer?.(); }
      catch { console.error('The local service did not stop cleanly.'); }
      try { await closeDatabase?.(); }
      catch { console.error('The database did not close cleanly.'); }
      app.quit();
    })();
  });
}
