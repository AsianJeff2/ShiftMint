import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const environmentKeys = ['SHIFTMINT_RUNTIME', 'HOST', 'PORT', 'NODE_ENV', 'SHIFTMINT_DESKTOP_TOKEN', 'BOOTSTRAP_TOKEN'] as const;
const originalEnvironment = Object.fromEntries(environmentKeys.map(key => [key, process.env[key]]));
afterEach(() => {
  for (const key of environmentKeys) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
});

const state = vi.hoisted(() => ({
  appEvents: new Map<string, (...args: any[]) => any>(),
  ipcHandlers: new Map<string, (...args: any[]) => any>(),
  windows: [] as any[],
  calls: [] as string[],
  quit: vi.fn(),
  stopServer: vi.fn(async () => undefined),
  closeDatabase: vi.fn(async () => undefined),
  openExternal: vi.fn(async () => undefined),
  ipcHandle: vi.fn(),
}));

vi.mock('electron', () => {
  class MockWindow {
    static getAllWindows() { return state.windows.filter(window => !window.destroyed); }
    events = new Map<string, (...args: any[]) => any>();
    destroyed = false;
    options: any;
    webContents = {
      mainFrame: { url: '' },
      session: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() },
      setWindowOpenHandler: vi.fn(),
      on: vi.fn(),
      openDevTools: vi.fn(),
    };
    constructor(options: any) { this.options = options; state.windows.push(this); }
    isDestroyed() { return this.destroyed; }
    isMinimized() { return false; }
    isMaximized() { return false; }
    maximize() {}
    unmaximize() {}
    minimize() {}
    restore() {}
    show() {}
    focus() {}
    removeMenu() {}
    on(event: string, callback: (...args: any[]) => any) { this.events.set(event, callback); }
    once(event: string, callback: (...args: any[]) => any) { this.events.set(event, callback); }
    async loadURL(url: string) { this.webContents.mainFrame.url = url; }
    close() { this.destroyed = true; this.events.get('closed')?.(); }
  }
  return {
    app: {
      isPackaged: true,
      getAppPath: () => process.cwd(),
      getVersion: () => '2.0.0',
      requestSingleInstanceLock: () => true,
      whenReady: async () => undefined,
      on: (event: string, callback: (...args: any[]) => any) => state.appEvents.set(event, callback),
      quit: state.quit,
    },
    BrowserWindow: MockWindow,
    shell: { openExternal: state.openExternal },
    ipcMain: { handle: (channel: string, callback: (...args: any[]) => any) => {
      if (state.ipcHandlers.has(channel)) throw new Error('Duplicate handler');
      state.ipcHandle(channel);
      state.ipcHandlers.set(channel, callback);
    } },
    dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn(), showErrorBox: vi.fn() },
    Notification: class { static isSupported() { return true; } show() {} },
  };
});
vi.mock('../../electron/main/runtime-environment', () => ({
  initializeDesktopEnvironment: () => state.calls.push('environment'),
}));
vi.mock('../../electron/backend/database', () => ({
  initializeDatabase: async () => { state.calls.push('database'); },
  closeDatabase: state.closeDatabase,
}));
vi.mock('../../electron/backend/server', () => ({
  startBackendServer: async () => { state.calls.push('server'); },
  stopBackendServer: state.stopServer,
}));

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  state.appEvents.clear();
  state.ipcHandlers.clear();
  state.windows.splice(0);
  state.calls.splice(0);
  await import('../../electron/main/index');
  await vi.waitFor(() => expect(state.windows).toHaveLength(1));
});

describe('desktop shell lifecycle', () => {
  it('forces a private production service and a fresh renderer capability at each launch', async () => {
    expect(process.env).toMatchObject({ HOST: '127.0.0.1', PORT: '3001', NODE_ENV: 'production', SHIFTMINT_RUNTIME: 'desktop' });
    const token = process.env.SHIFTMINT_DESKTOP_TOKEN;
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const sender = state.windows[0].webContents;
    const handler = state.ipcHandlers.get('auth:api-token')!;
    expect(handler({ sender, senderFrame: sender.mainFrame })).toBe(token);
    expect(() => handler({ sender: {}, senderFrame: sender.mainFrame })).toThrow('IPC request rejected');
    expect(() => handler({ sender, senderFrame: { url: sender.mainFrame.url } })).toThrow('IPC request rejected');
    vi.resetModules();
    state.ipcHandlers.clear();
    await import('../../electron/main/index');
    await vi.waitFor(() => expect(state.windows).toHaveLength(2));
    expect(process.env.SHIFTMINT_DESKTOP_TOKEN).not.toBe(token);
  });
  it('provides setup capability only to the trusted main renderer frame', () => {
    const window = state.windows[0];
    const handler = state.ipcHandlers.get('auth:bootstrap-token')!;
    process.env.BOOTSTRAP_TOKEN = 'test-desktop-capability';
    expect(handler({ sender: window.webContents, senderFrame: window.webContents.mainFrame })).toBe('test-desktop-capability');
    expect(() => handler({ sender: window.webContents, senderFrame: { url: 'https://hostile.example' } })).toThrow('IPC request rejected');
    delete process.env.BOOTSTRAP_TOKEN;
  });
  it('initializes workspace secrets before the database and local service', () => {
    expect(state.calls).toEqual(['environment', 'database', 'server']);
    expect(state.windows[0].options.webPreferences).toMatchObject({
      nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, devTools: false,
    });
    expect(state.windows[0].webContents.mainFrame.url).toContain('/dist/index.html');
  });

  it('recreates a closed window without registering duplicate IPC handlers', async () => {
    const count = state.ipcHandle.mock.calls.length;
    state.windows[0].close();
    state.appEvents.get('activate')?.();
    await vi.waitFor(() => expect(state.windows).toHaveLength(2));
    expect(state.ipcHandle).toHaveBeenCalledTimes(count);
  });

  it('accepts the current top frame and rejects another sender, frame, or origin', () => {
    const sender = state.windows[0].webContents;
    const handler = state.ipcHandlers.get('app:version')!;
    expect(handler({ sender, senderFrame: sender.mainFrame })).toBe('2.0.0');
    expect(() => handler({ sender: {}, senderFrame: sender.mainFrame })).toThrow('IPC request rejected');
    expect(() => handler({ sender, senderFrame: { url: sender.mainFrame.url } })).toThrow('IPC request rejected');
    sender.mainFrame.url = 'https://untrusted.example';
    expect(() => handler({ sender, senderFrame: sender.mainFrame })).toThrow('IPC request rejected');
  });

  it('rejects malformed privileged dialog and notification arguments', () => {
    const sender = state.windows[0].webContents;
    const event = { sender, senderFrame: sender.mainFrame };
    expect(() => state.ipcHandlers.get('dialog:open')!(event, null)).toThrow('Invalid dialog');
    expect(() => state.ipcHandlers.get('dialog:open')!(event, { properties: ['unsafe'] })).toThrow('Invalid dialog');
    expect(() => state.ipcHandlers.get('notification:show')!(event, { title: {}, body: 'text' }))
      .toThrow('Invalid notification');
  });

  it('stops the local service and closes the database before completing quit', async () => {
    const preventDefault = vi.fn();
    state.appEvents.get('before-quit')?.({ preventDefault });
    await vi.waitFor(() => expect(state.quit).toHaveBeenCalledTimes(1));
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(state.stopServer).toHaveBeenCalledTimes(1);
    expect(state.closeDatabase).toHaveBeenCalledTimes(1);
    expect(state.stopServer.mock.invocationCallOrder[0]).toBeLessThan(state.closeDatabase.mock.invocationCallOrder[0]);
  });
});
