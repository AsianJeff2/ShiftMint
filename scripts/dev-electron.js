const { spawn } = require('node:child_process');
const electron = require('electron');

const rendererUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';
const parsedUrl = new URL(rendererUrl);
if (parsedUrl.protocol !== 'http:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(parsedUrl.hostname) ||
    parsedUrl.username || parsedUrl.password) {
  throw new Error('VITE_DEV_SERVER_URL must point to a local HTTP server');
}

const child = spawn(electron, ['.'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  windowsHide: true,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    VITE_DEV_SERVER_URL: rendererUrl,
    SHIFTMINT_RUNTIME: 'desktop',
  },
});
child.on('error', () => { console.error('Could not launch Electron.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { if (!child.killed) child.kill(signal); });
}
