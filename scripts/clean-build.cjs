const fs = require('node:fs');
const path = require('node:path');

const root = fs.realpathSync(path.resolve(__dirname, '..'));
const outputs = { server: 'dist-server', electron: 'dist-electron' };
const name = outputs[process.argv[2]];
if (!name) throw new Error('Choose server or electron build output');
const target = path.resolve(root, name);
if (!target.startsWith(root + path.sep)) throw new Error('Build output escapes the repository');
if (!fs.existsSync(target)) process.exit(0);
const stats = fs.lstatSync(target);
if (!stats.isDirectory() || stats.isSymbolicLink() || fs.realpathSync(target) !== target) throw new Error('Build output must be a real directory inside the repository');

function inspect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (/\.(?:db|sqlite|sqlite3)(?:-|$)/i.test(entry.name) || entry.name.toLowerCase() === 'runtime-secrets.json') {
      throw new Error('Build output contains workspace data; move it to private recovery storage before rebuilding');
    }
    if (entry.isDirectory()) inspect(path.join(directory, entry.name));
  }
}
inspect(target);
fs.rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
