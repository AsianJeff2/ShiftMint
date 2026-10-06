# ShiftMint Technical Stack Documentation

## Overview
ShiftMint is a standalone desktop application for Windows that provides comprehensive shift management, payroll processing, and tip distribution for small to medium-sized businesses. Each installation is completely independent and stores all data locally on the user's machine.

## Technical Architecture

### Core Technologies

#### Frontend Framework
- **React 18.3.1** - Modern UI library for building interactive interfaces
- **TypeScript 5.5.3** - Type-safe JavaScript for better code quality
- **Vite 5.3.4** - Lightning-fast build tool and dev server
- **TailwindCSS 3.4.7** - Utility-first CSS framework
- **Shadcn/UI** - Pre-built, accessible React components

#### Desktop Framework
- **Electron 31.3.1** - Cross-platform desktop app framework
- **Electron Builder 24.13.3** - Packaging and distribution tool
- **Electron Vite 2.3.0** - Vite integration for Electron

#### Backend Technologies
- **Express.js 4.21.2** - Local API server
- **SQLite3 5.1.7** - Embedded database (no server required)
- **Prisma 5.24.0** - Type-safe database ORM
- **Bcryptjs 2.4.3** - Password hashing
- **Machine-id 1.1.12** - Device identification

#### Data Processing
- **CSV-parse/stringify** - Import/export functionality
- **Xlsx 0.18.5** - Excel file support
- **Date-fns 3.6.0** - Date manipulation
- **UUID 10.0.0** - Unique identifier generation

## Application Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    User's Windows Computer                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              ShiftMint.exe (Electron)                │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │                                                     │  │
│  │  ┌──────────────────┐    ┌────────────────────┐  │  │
│  │  │   Main Process    │    │  Renderer Process  │  │  │
│  │  │                  │    │                   │  │  │
│  │  │ • Window Mgmt    │    │ • React UI        │  │  │
│  │  │ • File System    │◄───┤ • State Mgmt      │  │  │
│  │  │ • IPC Handler    │    │ • User Interface  │  │  │
│  │  │ • Menu System    │    │                   │  │  │
│  │  └──────────────────┘    └────────────────────┘  │  │
│  │           │                         │              │  │
│  │           └─────────┬───────────────┘              │  │
│  │                     ▼                              │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │         Express API Server (localhost:3001)  │  │  │
│  │  ├─────────────────────────────────────────────┤  │  │
│  │  │ • Authentication  • Shift Management        │  │  │
│  │  │ • Employee CRUD   • Tip Distribution        │  │  │
│  │  │ • Payroll Calc    • Error Detection         │  │  │
│  │  │ • CSV Import/Exp  • Analytics Collection    │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │                     │                              │  │
│  │                     ▼                              │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │          SQLite Database (Prisma ORM)       │  │  │
│  │  ├─────────────────────────────────────────────┤  │  │
│  │  │ Location: %APPDATA%\ShiftMint\shiftmint.db │  │  │
│  │  │                                             │  │  │
│  │  │ Tables:                                     │  │  │
│  │  │ • Employees      • PayrollPeriods          │  │  │
│  │  │ • Shifts         • PayrollEntries          │  │  │
│  │  │ • Tips           • AppSettings             │  │  │
│  │  │ • Users          • AuditLogs               │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │                                                     │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              File System Storage                     │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │ %APPDATA%\ShiftMint\                               │  │
│  │ ├── shiftmint.db         (Main database)           │  │
│  │ ├── backups\             (Database backups)        │  │
│  │ ├── logs\                (Application logs)        │  │
│  │ ├── analytics-exports\   (Analytics data)          │  │
│  │ └── .device-id           (Unique device ID)        │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘

                              │
                              ▼
                 ┌────────────────────────┐
                 │   Optional: Analytics  │
                 │   Webhook (External)   │
                 └────────────────────────┘
```

## Installation & Distribution Process

### 1. Website Download Setup
```html
<!-- Example download page -->
<div class="download-section">
  <h2>Download ShiftMint for Windows</h2>
  <button onclick="downloadShiftMint()">
    Download ShiftMint Setup (85MB)
  </button>
  <p>Version 1.0.0 • Windows 10/11 • 64-bit</p>
  <p>✓ Digitally signed • ✓ No internet required</p>
</div>
```

### 2. Installation Process
1. User downloads `ShiftMint-Setup.exe`
2. Windows SmartScreen verification
3. Installation wizard:
   - Choose install location
   - Create desktop shortcut
   - Add to Start Menu
4. First launch initialization:
   - Create local database
   - Setup admin account
   - Configure business settings

### 3. Data Storage Locations
- **Windows**: `C:\Users\[Username]\AppData\Roaming\ShiftMint\`
- **Database**: `shiftmint.db` (SQLite file)
- **Backups**: `backups\` subdirectory
- **Logs**: `logs\` subdirectory

## Key Features & Implementation

### 1. Local-First Architecture
- All data stored locally in SQLite
- No cloud dependencies
- Works completely offline
- Optional analytics webhook

### 2. Security Features
- Bcrypt password hashing
- Local authentication
- Encrypted local storage
- No data transmission without consent

### 3. Data Import/Export
- CSV import for employees, shifts, tips
- Excel export for payroll reports
- Database backup/restore functionality
- Comprehensive data export tools

### 4. Error Detection System
- 12 built-in validation rules
- Real-time shift validation
- Anomaly detection
- Compliance checking

### 5. Payroll Processing
- Automatic tip distribution
- Overtime calculations
- Multiple pay rate support
- Detailed payroll reports

## Deployment Checklist

### Pre-Distribution
- [x] Remove all hardcoded paths
- [x] Use OS-specific app directories
- [x] Test on clean Windows installation
- [x] Digital code signing (recommended)
- [x] Create installer with Electron Builder

### Distribution Requirements
- Windows 10/11 (64-bit)
- 4GB RAM minimum
- 500MB disk space
- No internet connection required

### Building for Distribution
```bash
# Production build
npm run build:prod

# Create Windows installer
npm run dist:win

# Output: dist-installer/ShiftMint-Setup.exe
```

## Support & Maintenance

### Automatic Updates (Optional)
- Electron's autoUpdater module
- Check for updates on startup
- User consent before updating

### Error Reporting
- Local error logs only
- No automatic error reporting
- User can export logs for support

### Data Privacy
- All data stays on user's computer
- No telemetry without consent
- Optional analytics webhook
- Full data ownership by user

## Conclusion
ShiftMint is designed as a completely standalone desktop application that respects user privacy and data ownership. Each installation is independent, with all data stored locally on the user's machine. The application requires no internet connection and can run entirely offline, making it perfect for businesses that prioritize data security and control.