# Historical source

This directory retains superseded source and claims for reference. Archived files are excluded from supported TypeScript builds, automated test discovery and Docker images. They are not maintained modules, supported entry points or recovery tooling.

| Directory | Retired material |
| --- | --- |
| `legacy-apps/` | Duplicate portable/working applications and website snapshots |
| `legacy-launchers/` | Ad hoc launchers, shortcuts and debug startup flows |
| `scripts/` | Source-rewriting, reset, packaging and demonstration scripts |
| `legacy-source/` | Alternative domain calculators/repositories and their tests, sample-data hooks, mock or simulated UI, destructive database alternatives, superseded documentation and old asset notes |
| `components/` | Superseded components retained separately |
| `history/` | Previous implementation reports, operating guides and completion claims |

Historical payroll, tax filing, analytics transfer, permissive import and production-readiness claims are unverified and superseded. Their original dates and claims remain reference material; they do not establish shipped behavior, compliance or test coverage. Tests retained here are excluded from the active verification count.

The active product treats payroll figures as estimates and does not finalize payments or file taxes. Current CSV import rejects invalid records instead of inventing employees or times. Outbound analytics transfer is unavailable. Use the root package scripts and maintained audit, deployment, database, desktop and POS guides for current behavior.

Do not execute archived scripts or import archived repositories into active code. Several reset data, bypass period locks and sensitive-field protections, alter schemas without migration history, or overwrite source files. Offline legacy recovery requires a reviewed migration on a disposable copy, as described in `docs/DATABASE_MIGRATION.md`; restoring a historical script is not that procedure.
