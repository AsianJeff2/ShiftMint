# Desktop runtime

The desktop app uses the same renderer and API as the web app. Electron runs a private API on the local workstation and loads the packaged renderer from `dist/index.html`. Development uses the local Vite server supplied by `npm run dev`; the Electron launcher does not start a second Vite process.

The canonical Electron entrypoint is `electron/main/index.ts`, compiled to `dist-electron/electron/main/index.js`. `index-production.ts` is a compatibility entrypoint that imports the same implementation. Build tools must not copy that compatibility file over the canonical source.

## Local data and configuration

Desktop startup initializes workspace configuration before importing the database, logger, or API modules. The default data directory preserves the historical location:

| System | Directory |
| --- | --- |
| Windows | `%USERPROFILE%\AppData\Roaming\ShiftMint` |
| macOS | `~/Library/Application Support/ShiftMint` |
| Linux | `~/.shiftmint` |

`SHIFTMINT_DATA_DIR` selects another data directory. Use an absolute path. An explicit SQLite `DATABASE_URL` is preserved; when no data directory is provided, its parent directory holds the runtime configuration. Desktop rejects a database URL with a non-file scheme.

The shell forces `SHIFTMINT_RUNTIME=desktop`, `HOST=127.0.0.1` and `PORT=3001`, regardless of inherited hosting settings. A packaged shell also sets `NODE_ENV=production`. It does not expose the service on the LAN or use an inherited web runtime. A conflicting local service on port 3001 is a startup error, not a reason to bind the app publicly.

The first launch generates random authentication and encryption keys in `runtime-secrets.json`. Later launches reuse those keys. Supplied `JWT_SECRET` and `ENCRYPTION_KEY` values must match an existing workspace secret file. The encryption key must contain 64 hexadecimal characters. The secret file is created with owner-only permissions on systems that support POSIX file modes; Windows uses the data directory's inherited access permissions.

Keep `runtime-secrets.json` private and retain it with the workspace's recovery materials. A database backup alone cannot recover encrypted records without their original encryption key. Do not commit, publish, or paste the secret file into diagnostics.

## Existing databases and recovery

Startup preserves an existing secret file and does not rewrite database records. When a database has no stored or supplied encryption key, startup scans the database and its SQLite write-ahead file for the current and legacy ciphertext markers. If a marker exists, startup stops before generating a replacement key. This scan is conservative: SQLite pages can retain deleted ciphertext. Such a workspace still requires recovery review.

To recover an encrypted workspace, restore its original secret file or provide its original encryption key. Do not create a new key as a substitute. An invalid secret file or a mismatch with supplied secrets also stops startup. A legacy plaintext workspace can receive new runtime secrets; that does not migrate its schema.

Every existing workspace created by the shipped 2.0 raw-SQL initializer requires the offline upgrade in [DATABASE_MIGRATION.md](DATABASE_MIGRATION.md). The app preserves the database and refuses unknown migration history. Earlier-release and automatic pre-upgrade snapshots retain older history and require offline recovery; the current Database tab cannot restore them unchanged.

Startup failures display the actual error and recovery guidance before quitting. Configuration can fail before the persistent logger is initialized, so do not assume a log file exists for an early key-recovery refusal. Preserve the database, sidecars, backups and original key before diagnosing it.

## Renderer boundary and lifecycle

Packaged builds ignore inherited development URLs and load only the app's own index file. Development permits a configured loopback HTTP origin. Privileged IPC accepts only the current window's top frame at that renderer URL. Dialog and notification payloads are validated. The preload exposes fixed operations, with sandboxing and context isolation enabled.

Each shell launch generates a private API capability in memory. The trusted renderer receives it through validated `auth:api-token` IPC exposed as `getApiToken`; the API client presents it as `X-Desktop-Token`. The desktop service rejects a missing or mismatched capability. It is separate from the persisted JWT signing key, a logged-in user's bearer token, and the one-time first-owner bootstrap capability. Do not persist or print it. Browser origin checks alone are not the desktop authorization boundary; another local web page cannot obtain this capability through the preload. Private API routes still require user authentication and permissions.

The app rejects renderer navigation to other origins and webviews. External links open through the operating system only for HTTP or HTTPS URLs without embedded credentials. IPC handlers register once, so closing and reopening the macOS window does not register duplicate handlers. Quit stops the API before closing the database.

## Verification

Run `npm run test:run -- tests/desktop` for the focused renderer, IPC, startup, shutdown, and key-recovery checks. These tests mock Electron and backend lifecycle calls and use disposable fixtures under the checkout's `.tmp-tests/`. They do not open the operator's real database.

Unit checks do not verify native Electron launch, installer signing, native database engine packaging, or backup compatibility with an existing operator workspace. Validate those separately with a disposable data directory before shipping an installer.

`npm run build` produces `dist/`, `dist-server/` and `dist-electron/`. `npm run dist:win` builds Windows x64 NSIS and portable artifacts in `release/`. The manifest bundles explicit Prisma schema/migration files and physical runtime dependencies; it does not include development SQLite files. Current Windows configuration uses a per-user installer, `asInvoker` and no elevation. Signing is not configured. A packaged engine/database smoke check does not prove a native window, installer interaction, signed release or an operator-data upgrade; record those checks separately.
