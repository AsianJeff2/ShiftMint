# Deployment

The prepared hosting target is one Render Node web service serving the Vite application and Express API from the same origin, with a persistent SQLite disk. This preserves the desktop application and its database format. Hosted startup supports **one business per instance** and refuses databases containing multiple businesses. This release does not provide a shared, multi-business SaaS deployment.

Deployment remains pending access to the hosting account, confirmation of its billing settings, and final review and publication of an immutable release. No Render service has been provisioned or deployed during this audit. Neither a native Docker build/run nor execution in Render's environment has been observed.

## Configuration in the repository

`render.yaml` defines the following configuration. It uses Render's native Node runtime; the separate `Dockerfile` is an alternative packaging path.

| Setting | Configured value |
| --- | --- |
| Service | `shiftmint`, type `web`, runtime `node` |
| Compute plan | `0.5c-512mb` |
| Region and instances | `oregon`, one instance |
| Automatic deployments | `autoDeployTrigger: off` |
| Build | `npm ci --include=dev --ignore-scripts && npm run build:web` |
| Start | `npm start` |
| Health check | `/api/health` |
| Shutdown allowance | 30 seconds |
| Persistent disk | `shiftmint-data`, 1 GB mounted at `/var/data` |
| Node version | `NODE_VERSION=24.21.0` |

Render currently lists `0.5c-512mb` as 0.5 CPU with 512 MB RAM and supports `autoDeployTrigger: off`. The account owner must verify the current compute and disk charges in the dashboard before creating the service. This guide does not quote a verified dollar price. [Render Blueprint reference](https://render.com/docs/blueprint-spec).

The disk requires a paid service. It is available only to the running service instance, not during build or pre-deploy commands. Disk-backed services cannot scale to multiple instances and have downtime during deployments. These constraints determine the current architecture. [Render persistent disks](https://render.com/docs/disks).

The build installs development dependencies explicitly because TypeScript and Vite are build tools. Dependency lifecycle scripts are disabled. `build:web` explicitly generates the Prisma client, builds the renderer into `dist`, and compiles the API into `dist-server`. It does not package Electron. `npm start` starts the compiled backend, which also serves `dist` and handles SPA routes.

Database initialization runs **at process startup after the disk mounts**, before the HTTP listener opens. It applies the checked-in migration history, snapshots an existing database before pending upgrades, and verifies database integrity. Do not move SQLite migrations into Render's build or pre-deploy command. A historical database that fails guarded migration checks needs the offline procedure in [database upgrades and recovery](DATABASE_MIGRATION.md).

## Environment and recovery keys

Keep secrets in the hosting account's environment controls and a private recovery store. Do not put them in the repository, frontend build variables, screenshots, or exported diagnostic bundles.

| Variable | Required value or purpose |
| --- | --- |
| `NODE_ENV` | `production` |
| `SHIFTMINT_RUNTIME` | `web` |
| `HOST` | `0.0.0.0` |
| `PORT` | Use Render's supplied port; the server reads it automatically. |
| `SHIFTMINT_DATA_DIR` | `/var/data`; logs and backups also use this directory. |
| `DATABASE_URL` | `file:/var/data/shiftmint.db` |
| `TRUST_PROXY` | `1`, for this Render proxy topology. |
| `JWT_SECRET` | Independent random secret, at least 32 characters. The blueprint generates it. |
| `BOOTSTRAP_TOKEN` | Independent random setup secret, at least 32 characters. The blueprint generates it. |
| `ENCRYPTION_KEY` | 32 random bytes encoded as exactly 64 hexadecimal characters; supply it at Blueprint creation. |
| `CORS_ORIGINS` | Leave unset for the same-origin deployment. A separate frontend needs explicitly allowed full origins. |
| `TOAST_API_BASE_URL` | Required only for Toast. Use the API Access URL granted in Toast Web, as an HTTPS `*.toasttab.com` hostname with no path, credentials, or port. |
| `PAYROLL_ESTIMATED_TAX_RATE` | Optional instance-wide withholding estimate fraction; default `0.22`, range zero to one. |
| `PAYROLL_WEEKLY_OVERTIME_HOURS` | Optional positive weekly overtime threshold; default `40`. |
| `PAYROLL_DAILY_OVERTIME_HOURS` | Optional positive daily threshold; unset disables this additional threshold. |
| `FRONTEND_DIST` | Optional absolute path to a built renderer; defaults to this release's `dist/`. |
| `ENABLE_ANALYTICS_SCHEDULER` | Default false. Enables local collection only for desktop; hosted scheduling stays disabled. |

Render terminates HTTPS at its proxy and forwards HTTP to the service. The application binds to `0.0.0.0` and the supplied `PORT`. [Render web services](https://render.com/docs/web-services). `TRUST_PROXY=1` is parsed as a numeric hop count; reassess it if another proxy is added, because Express uses the trusted proxy topology to determine the client address and protocol. [Express proxy configuration](https://expressjs.com/en/guide/behind-proxies/).

The alternative Docker runtime does not set `TRUST_PROXY` automatically. Configure the actual proxy hop count and accepted frontend origins before exposing it behind HTTPS; a request origin and the effective service origin must match. Direct local access uses `TRUST_PROXY` unset. Do not copy Render's proxy value into a different topology without checking it.

Payroll environment values change estimates for every business record in the instance and are not protected by the business-configuration lock. Reopen affected calculated periods before changing these values, then restart, recalculate and review. Historical paid periods require a separate reviewed policy migration; do not silently apply a new policy to them.

The blueprint prompts for `ENCRYPTION_KEY` through `sync: false`; changes to an existing service's manually supplied secrets must be made in its environment settings. Render-generated `JWT_SECRET` and `BOOTSTRAP_TOKEN` values must also be recorded privately for recovery. [Render secret environment variables](https://render.com/docs/blueprint-spec#prompting-for-secret-values).

An existing encrypted workspace requires its **original encryption key**. Creating another key does not recover its data. The key encrypts sensitive fields and POS credentials; it does not encrypt every SQLite column. A database backup alone cannot recover those encrypted records. Do not rotate `ENCRYPTION_KEY` without a reviewed re-encryption and backup recovery procedure. Rotating `JWT_SECRET` invalidates existing sessions.

## First deployment and owner setup

1. Finish release verification and independent review. Publish only the reviewed immutable release through the repository's authorized integration process. Workers do not commit; the operator authorized coordinator integration of this reviewed private transfer. No merge is authorized.
2. Obtain access to the intended Render account and grant its GitHub integration access to the published ShiftMint repository. Confirm the selected repository, release branch/commit, region, compute plan, and 1 GB disk in the creation screen. Confirm the current charges there.
3. Create the service from `render.yaml`, supplying a new `ENCRYPTION_KEY` for an empty workspace or the original key for a reviewed migrated workspace. Retain all three recovery secrets privately. Confirm automatic deployment remains off.
4. Allow the first build and startup to complete. Read migration and startup logs. A migration refusal must be investigated on a copy of the database; do not reset or automatically baseline it.
5. Open the service's HTTPS URL. Confirm `/api/health` returns `status: ok`. This endpoint establishes that the process is responding; it is not a continuing deep database or POS readiness check.
6. For an empty workspace, complete the first-account setup form. Enter the dashboard's `BOOTSTRAP_TOKEN` in **Workspace setup code**. The API uses it to authorize creation of the first owner and business; public signup does not create another business after setup.
7. Review business configuration, timezone, employee permissions, tip rules, and payroll estimate settings. Verify login, logout, representative employee/shift/tip reads, exports, and a backup using disposable acceptance records before entering operational data.
8. If POS access is needed, use **Settings → POS connections** and follow [POS setup](POS_INTEGRATIONS.md). Validate the granted locations and scopes with merchant-approved credentials. No live provider connection has been verified by this audit.

For local web verification, use Node 24 and npm 11 or newer. Install with `npm ci --include=dev --ignore-scripts`, then run `npm run verify`. Copy `.env.example` to a private `.env`, supply independent secrets and an absolute disposable `SHIFTMINT_DATA_DIR`, then run `npm start` after the build. Use the locally served application and its setup code. Keep the desktop workspace's data and secrets separate from this test directory. Desktop launch and key handling are documented in [desktop runtime](DESKTOP_RUNTIME.md).

## Backups, restores, and releases

The owner can create a consistent SQLite snapshot through **Settings → Database**. Application snapshots are placed in `/var/data/backups` using SQLite `VACUUM INTO`. These files share the service's disk with the live database. **There is no automatic external backup transfer, retention policy, or browser backup download/upload in this release.** Ordinary data exports are not complete database recovery files.

The operator must manually transfer completed backup files to private storage outside the service and retain the original encryption key separately. Render documents SSH/SCP and shell transfer options for disk-backed services. Use application database snapshots for database recovery rather than assuming a disk snapshot is a consistent database backup. [Render disk transfers and recovery](https://render.com/docs/disks).

Set an operational backup schedule and monitor disk usage. The 1 GB disk holds the database, its sidecars, logs, and every retained snapshot. Remove old on-disk backups only after confirming the external copy and recovery materials. Backup files contain employee and business data even though selected fields are encrypted.

Production Winston logs emit structured JSON to the hosting console and write rotated files in `/var/data/logs` when `SHIFTMINT_DATA_DIR=/var/data`. If only an absolute SQLite `DATABASE_URL` is configured, file logs use that database's parent directory plus `logs`. A relative `SHIFTMINT_DATA_DIR` is rejected. The error and combined file transports each retain up to five 5 MB files; dashboard retention and alerting still require operator configuration. Treat logs as private operational data.

Hosted restore accepts a validated snapshot already in the service's backup directory. Local file selection/import is desktop-only. For recovery from an external copy, an authorized operator must transfer it to the backup directory before selecting it for restore. Restore validates schema, migration checksums, relations, and encrypted fields with the current key before replacing the database. It drains API work and creates a recovery snapshot. Follow [database recovery](DATABASE_MIGRATION.md), and test recovery on a disposable instance before relying on it for operational data.

A whole-database restore also restores password and logout-revocation state from the snapshot. After recovery, rotate `JWT_SECRET` in the hosting environment and restart the service to invalidate earlier sessions. Keep `ENCRYPTION_KEY` unchanged so restored ciphertext remains readable. Review user access and reconnect provider credentials if the snapshot contains an obsolete connection.

Before a manual release, stop starting POS previews, let existing work finish, create and transfer a snapshot, and record the deployed code revision. The blueprint gives the process 30 seconds to shut down, shorter than a full POS preview. Schedule a maintenance window for disk-backed deployments. Verify login, protected routes, exports, and representative stored values after startup. A code rollback does not undo a database migration; assess database compatibility and recovery snapshots before rolling back.

## POS and sensitive-data boundaries

Square and Toast connections provide validated **read-only previews** of payments/tips and optional labor/menu data. Credentials remain encrypted on the server. Previews download JSON for review and do not create employees, shifts, tips, payroll entries, or payouts. Automatic import, scheduled synchronization, webhooks, and hosted Square OAuth onboarding are not implemented. The user approved keeping Verona POS pending for this release until an approved API/export contract becomes available. See [provider contracts and limits](POS_INTEGRATIONS.md).

The accepted request coordinator serializes every API mutation globally, including the POST used for a read-only POS preview. A preview can therefore pause other writes for roughly 90 seconds. The operation budget is checked before each provider request, and a final in-flight request can consume its separate 10-second timeout. Other writes wait up to 10 seconds and then return **503** with a retry message before their handler runs. Wait for the preview to finish and retry those rejected writes; use shorter preview intervals during business hours. GET requests remain available outside database maintenance. This limitation also affects login/setup operations, which use POST.

Routine business and employee responses and exports omit EIN and bank account/routing fields. Omitted fields preserve their stored values on ordinary edits. Backups can still contain encrypted sensitive values. Payroll and withholding remain estimates requiring review; payment finalization is blocked. Deployment does not authorize sending payments or filing taxes.

The payroll formula reports `grossPay` as wages only. At the default rate, estimated withholding is `22% × (wages + all recorded tips)`, and `netPay` is `wages + all recorded tips − estimated withholding`. Recorded tips include cash and tips the employee has already received. `netPay` therefore does not represent the remaining amount owed to the employee; settle already-received tips separately with a reviewed payroll provider.

Partial-week payroll estimates consume earlier workweek hours for overtime context. Closed and paid periods now protect overlapping source shifts from the configured start of that workweek through the period's end, including open-ended shifts. Tip locks cover the period's own venue-date range. Reopen the affected period before correcting those source records, then recalculate and review the estimate before closing it again. The final independent release review must cover this repair.

Effective timezone or workweek-start changes are refused while any closed or paid period exists, because those settings define protected source boundaries. Unchanged effective values and unrelated configuration edits remain allowed. Paid records remain immutable; future policy changes for historical paid workspaces need a reviewed migration or policy-snapshot design.

## Verification still required

The final repaired source passed **564 tests in 54 files**, all three typechecks, and clean renderer/API/Electron builds on Node 24.21.0/npm 11.19 on 2026-10-05. Production-configured local HTTP acceptance passed **37 checks**. Current compiled browser acceptance covered failed, stale and capped read states, bounded tip dates and retry recovery, with the exact export/clock/restore regression scope recorded separately. Fresh Windows unpacked packaging excluded database canaries; its packaged native database migration, backup, restore and restart smoke passed. Earlier broader browser checks remain dated evidence for their source snapshots. Fresh audit recorded zero runtime advisories and 15 development advisories (five high, ten moderate). Native desktop window/installer launch, Docker execution, hosting and live POS credentials remain unverified. Independent review and transfer status belongs in the immutable release delivery record. See [AUDIT.md](AUDIT.md) for dated evidence and remaining limits.

Backend startup requires `SHIFTMINT_RUNTIME` to be exactly `web` or `desktop`; missing or misspelled values are refused before listening. The desktop entry sets its mode and per-launch API capability. Migration subprocesses receive only the SQLite URL and required platform/native-engine paths, with `CHECKPOINT_DISABLE=1`; they do not inherit application authentication, encryption, bootstrap or POS secrets. Prisma can still fetch a missing native engine. Include the target platform's engines in the build and verify startup in that deployment environment; dependency installation and client generation also require their own network review.

Round 1 independent review rejected an earlier candidate. The repaired source passed the local checks above. The final release record must carry exact candidate/review/commit identities and transfer status before provisioning. Native installer launch/signing and actual operator migration remain unverified. The user authorized private code transfer after checks and review.

Before calling the service deployed, observe its native Render build, mounted-disk startup, migration logs, HTTPS and proxy behavior, first-owner bootstrap, authentication, tenant/role restrictions, restart persistence, external backup transfer and restore on a disposable instance, and a live provider acceptance check with granted merchant scopes. The alternative Docker image requires its own native build/run and persistent-volume verification. Hosting account access, provisioning, billing acceptance, live POS credentials, native Docker execution, and Render execution remain unverified or pending.

Official hosting references were checked on 2026-10-05. Recheck the dashboard's available plans and secret configuration at provisioning time.
