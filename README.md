# ShiftMint

ShiftMint tracks restaurant employees, shifts, tips and payroll estimates. The supported application uses React, TypeScript, Express, Prisma and SQLite, with an Electron desktop shell and a same-origin hosted web runtime. It currently provisions one business per workspace. It does not send payments or file taxes.

## Structure

| Path | Purpose |
| --- | --- |
| main.tsx, App.tsx | Browser entry and routes |
| pages/, components/, contexts/, hooks/ | Application UI and state |
| electron/backend/ | Authentication, scoped API routes and SQLite lifecycle |
| electron/main/, electron/preload/ | Desktop lifecycle and privileged IPC |
| lib/pos/ | Square and Toast read-only adapters |
| lib/security/, lib/transformers/, lib/export/ | Shared contracts and focused helpers |
| prisma/ | Canonical schema and migration history |
| tests/ | Browser, database and desktop regressions |
| docs/ | Audit, deployment, database recovery, desktop runtime and POS guides |
| archive/ | Excluded historical app forks, scripts and reports |

## Installation and verification

Use Node.js 24 and npm 11 or newer. From the repository root:

```sh
npm ci --include=dev --ignore-scripts
npm run prisma:generate
npm run verify
```

Install the Electron binary only when working on the desktop shell:

```sh
node node_modules/electron/install.js
npm run dev
```

The desktop shell generates and persists its workspace secrets before starting the backend. Back up both the database and the secret file. See [desktop runtime](docs/DESKTOP_RUNTIME.md).

The final repaired source passed **564 tests in 54 files**, all three typechecks, and clean renderer/API/Electron builds on Node 24.21.0/npm 11.19 on 2026-10-05. Production-configured local HTTP acceptance passed **37 checks**. Current compiled browser acceptance covered failed, stale and capped read states, bounded tip dates and retry recovery, with the exact export/clock/restore regression scope recorded separately. Fresh Windows unpacked packaging excluded database canaries; its packaged native database migration, backup, restore and restart smoke passed. Earlier broader browser checks remain dated evidence for their source snapshots. Fresh audit recorded zero runtime advisories and 15 development advisories (five high, ten moderate). Native desktop window/installer launch, Docker execution, hosting and live POS credentials remain unverified. Independent review and transfer status belongs in the immutable release delivery record.

The first independent review rejected an earlier candidate. Round2 found a Linux test assertion and period-export date contract; round3 found failed reads presented as empty or zero financial data. Repairs preserve historical updates, require the desktop capability, validate CSV contracts, bound tip history, show incomplete reads as unavailable, block unsafe writes/analysis, reconcile rounded wages and retain disconnected middleware work under the approved queue. The user authorized private transfer after verification and renewed independent review; the release record identifies the reviewed artifact and resulting commit.

For local web development, copy .env.example to .env, supply independent secrets and an absolute isolated data directory, then run npm run dev:backend and npm run dev:vite in separate terminals. Enter BOOTSTRAP_TOKEN as the first account's workspace setup code. The frontend sends /api requests through Vite's local proxy.

## Deployment and integrations

The Render blueprint defines one Node service with a persistent SQLite disk. Migrations run during process initialization after that disk mounts. Review [deployment](docs/DEPLOYMENT.md) before starting a service.

Square merchant tokens and Toast Standard credentials enable validated read-only sales, labor and menu previews. Tokens stay encrypted on the server. POS previews do not modify shifts or payroll; employee/location mapping and durable import processing remain future work. See [POS setup and boundaries](docs/POS_INTEGRATIONS.md). Verona POS is identified. Its connector needs an approved API or export contract from the vendor before implementation.

The payroll engine produces wage and withholding estimates. `grossPay` contains wages only; default estimated withholding is `22% × (wages + all recorded tips)`. `netPay` is wages plus those tips minus estimated withholding, including cash or tips already received; it is not the remaining amount payable. Provider tax calculations, jurisdiction-specific rules, deductions, payments and filings remain outside this release. Payment finalization is blocked. Review [audit](docs/AUDIT.md) for verified changes and remaining limits.

The shipped 2.0 desktop created raw SQL tables without canonical migration history. Its existing workspaces require a reviewed offline upgrade on a copy. Do not reset, automatically baseline or run archived database scripts against them. Follow [database migration](docs/DATABASE_MIGRATION.md).
