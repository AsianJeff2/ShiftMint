# Database upgrades and recovery

ShiftMint 2.1 uses the checked-in Prisma migration history for fresh installations and supported upgrades. `npm run db:migrate` runs the same guarded initialization as the application from a development checkout. A compiled Node/web deployment uses `npm run db:migrate:production`; it does not require development-only `tsx`. Both commands read an optional `.env` and run from their matching checkout/server deployment, not an arbitrary desktop installation folder. The desktop package runs guarded initialization internally. Set `SHIFTMINT_DATA_DIR` to an absolute workspace directory and set `DATABASE_URL` when the database file lives elsewhere. An unset database URL selects `shiftmint.db` in the data directory. Use the workspace's original encryption key and the required runtime configuration; these migration commands do not recover or rotate missing keys.

An existing database with pending canonical migrations receives a `shiftmint-before-upgrade-*.db` snapshot in the workspace backup directory before migrations run. A restart with no pending migrations does not create another upgrade snapshot. Retain the workspace's original `runtime-secrets.json` or original encryption key separately and privately. Database snapshots contain encrypted records but do not contain recovery keys.

The pre-upgrade snapshot retains the old schema and old migration history. It is an **offline recovery artifact**, not a backup the upgraded app can restore through its Database tab. The same restriction applies to a backup from any earlier release whose migration history differs from the current release. Keep those files; a restore refusal does not mean they are corrupt.

## Legacy 2025 databases

Every existing workspace created by the shipped 2.0 desktop app's raw-SQL initializer requires an offline legacy upgrade before 2.1 can open it. That initializer never recorded Prisma migration history. This is the expected migration path for those installations, not an exceptional edge case. A developer database created with canonical Prisma migrations is a different case and may qualify for the guarded upgrade.

The former runtime also altered tables outside migration history. A table named `_prisma_migrations` does not prove the actual schema matches its recorded migrations. In particular, the old runtime added shift position, employee type, station, hourly rate, and wage fields separately.

The supported upgrade stops before applying migrations when a database contains application tables but has no Prisma history, or has those unrecorded shift columns. Even a table containing zero rows is an existing schema. The refusal preserves recorded values; the app does not reset wages or mark an unknown schema as migrated. The alignment migration adds shift columns without rebuilding or dropping the shift table. Use the guarded command rather than invoking raw Prisma deploy against a workspace.

Upgrade a refused workspace offline:

1. Close ShiftMint and stop every service that opens this database. Retain the original database, any SQLite sidecars, existing backups, and the original encryption key or secret file. Make a consistent SQLite snapshot. Do not copy an actively written database without a SQLite-aware snapshot.
2. Work on a disposable copy. Inspect its full schema, migration history, row counts, foreign keys, and stored shift and payroll values. Compare them with all checked-in migrations and `prisma/schema.prisma`.
3. Prepare an explicit migration for that copy. Preserve existing wage and position fields, encrypted records, identifiers, relations, and payroll totals. Record migration history only after proving that the corresponding schema and data changes are present. Do not use automatic baselining or `prisma db push --accept-data-loss` as a substitute.
4. Verify every model, foreign keys, SQLite integrity, encrypted-field decryption, row counts and representative financial records on the copy. Compare exports with the retained original. Payroll estimates require a separate business-policy review; structural validation does not establish correct withholding or an amount payable. Keep the original available for recovery. Replace the active workspace only after those checks pass.

An automatic converter for every historical schema variant is not included. An operator workspace that triggers the refusal needs a reviewed migration based on its actual schema.

For a `shiftmint-before-upgrade-*` snapshot or older-release backup, follow the same offline procedure on a copy of that snapshot. Preserve its original history and key, determine its schema version, then prepare and verify its migration to the current schema before installing the result in a stopped workspace. Do not edit migration-history rows merely to satisfy in-app validation. Archived reset scripts are not recovery tools.

## Backup restore

In-app restore accepts a `.db` file in the workspace backup directory with the current schema, migration history and original encryption key. The desktop file selection route first copies a selected SQLite file into that directory. Hosted mode does not accept a path to the operator's local file: an operator must transfer and validate recovery materials through the host's supported administrative process. Backup-directory links or junctions and linked backup files are refused.

The API pauses new requests and waits for active requests to drain before maintenance. Restore stages the candidate alongside the active database and validates SQLite integrity, foreign keys, every current model's columns and required fields, the complete current migration history and checksums, and encrypted values with the current workspace key. Hosted restore also rejects a backup containing multiple businesses. An older-schema backup needs an offline upgrade; an encrypted backup from another workspace needs its original key. Both are rejected before the active database is replaced.

After successful validation, restore creates a recovery snapshot and replaces the active file. It reconnects and validates again. A replacement or reconnect failure restores the recovery snapshot automatically. If automatic recovery also fails, the error identifies the retained snapshot for offline recovery. Do not discard that snapshot or the original key.

`npm run test:run -- tests/database` exercises fresh/repeated initialization, recorded-history upgrades, legacy drift refusal, snapshots, malformed and incompatible backups, key mismatches, and reconnect rollback using disposable test directories. These checks do not provide an automatic upgrade for shipped 2.0 raw-SQL workspaces or verify an operator's database. Validate each legacy workspace separately; native installer behavior is a separate acceptance check.
