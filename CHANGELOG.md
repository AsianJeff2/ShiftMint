# ShiftMint Changelog

This file records the current ShiftMint candidate and retained historical release claims. An unreleased entry does not confirm deployment, installer distribution or production provider acceptance.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - Unreleased

### Changed

- Modernized the maintained Node 24, Electron 44, React 19, Vite 8 and Prisma 6 build paths and added separate compiled web and desktop entry points.
- Consolidated the active renderer/API/database implementation and moved duplicate applications, obsolete repositories/domain calculators, simulated UI and completion reports into `archive/`.
- Added private hosted deployment configuration and maintained database, desktop and POS operation guides. Hosted deployments keep business data on their configured server; POS previews make outbound provider requests.
- Made payroll calculations and exports explicitly estimates. Gross wages exclude tips; estimated net compensation includes all recorded tips, including amounts already received, and is not the remaining amount payable. Payment finalization and tax filing remain unavailable.

### Fixed

- Replaced simulated time clock success with acknowledged employee clock actions and saved shift records.
- Preserved historical shift rates/wages and tip timestamps/types/source/pooling during ordinary edits; aligned shared DTO contracts and calendar-date handling.
- Replaced invented CSV dates and employee-heading shifts with strict timestamp validation, explicit offsets, visible row errors and blocked partial imports.
- Added guarded canonical migration initialization, pre-upgrade snapshots and staged current-schema backup validation with rollback. Existing shipped 2.0 raw-SQL workspaces require an offline legacy upgrade; older snapshots remain offline recovery artifacts.
- Normalized backup labels, retained controls after errors, and disabled local-file import in hosted mode.

### Security

- Added desktop loopback runtime enforcement and a per-launch API capability delivered through trusted IPC, with sandboxing, context isolation and sender validation.
- Added persisted workspace secrets, sensitive-field encryption/redaction, token revocation, role checks and coordinated database maintenance.
- Narrowed desktop packaging to explicit schema/migration resources and retained runtime engine dependencies. Windows x64 builds use `asInvoker`, a per-user installer and no elevation. Signing is not configured; native installation and signed distribution require separate acceptance.

### Integration limits

- Square and Toast connections provide credential validation and read-only preview support. Preview does not import payroll inputs or demonstrate live merchant acceptance.
- Verona support remains pending provider identification and an approved integration contract. No Verona adapter or production connection is claimed.

## Historical entries

The following dates and feature lists are retained historical, unverified claims from the earlier codebase. They do not describe 2.1 or establish that those releases, installer features, signing, elevation or public hosting ever shipped. Current scripts, data paths, runtime behavior and release limits are defined by the maintained source and guides.

## [2.0.0] - 2024-01-15 (historical, unverified)

### Added
- Windows NSIS installer with proper installation directory structure
- App data storage in %APPDATA%\ShiftMint\data for SQLite database
- Digital signature placeholder for future code signing
- UAC elevation for secure installation
- Download tracking API endpoint
- Version metadata API endpoint
- Public hosting directory structure for installer distribution

### Changed
- Enhanced Electron Builder configuration for production-ready Windows deployment
- Updated build output directory to /dist
- Improved installer user experience with custom welcome message

### Security
- Added proper execution level requirements for Windows installer
- Implemented secure app data directory creation
- Prepared infrastructure for code signing certificates

## [1.0.0] - 2023-12-01 (historical, unverified)

### Added
- Initial release of ShiftMint Desktop
- Local-first tip tracking system
- Employee management functionality
- Payroll calculation and management
- SQLite database for offline operation
- Express backend API
- React frontend with Electron wrapper

---

## Version History Format

### [Unreleased]
- Features and fixes currently in development

### [X.Y.Z] - YYYY-MM-DD
#### Added
- New features

#### Changed
- Changes in existing functionality

#### Deprecated
- Soon-to-be removed features

#### Removed
- Removed features

#### Fixed
- Bug fixes

#### Security
- Security vulnerability fixes
