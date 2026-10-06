# ShiftMint Desktop Shortcut Setup Guide

## ✅ Automatic Shortcut Creation

ShiftMint automatically creates desktop shortcuts in the following scenarios:

### 1. During Installation (Windows Installer)
- Desktop shortcut is created automatically
- Start Menu shortcuts are created
- Option to launch ShiftMint after installation

### 2. Manual Creation
Run the provided PowerShell script:
```powershell
powershell -ExecutionPolicy Bypass -File Create-ShiftMint-Shortcut.ps1
```

## 🚀 Shortcut Features

The ShiftMint shortcut is intelligent and works in multiple modes:

### Production Mode
- Launches the installed ShiftMint.exe directly
- Fastest startup time
- No console window

### Development Mode
- Runs `npm run dev` automatically
- Shows console output for debugging
- Hot reload enabled

## 📍 Shortcut Locations

1. **Desktop**: `%USERPROFILE%\Desktop\ShiftMint.lnk`
2. **Start Menu**: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\ShiftMint\`
3. **Quick Launch**: `%APPDATA%\Microsoft\Internet Explorer\Quick Launch\`

## 🔧 Troubleshooting

### Shortcut Not Working?
1. Ensure Node.js is installed: `node --version`
2. Run `npm install` in the ShiftMint directory
3. Try the batch file directly: `Start-ShiftMint.bat`

### Multiple Monitors Issue
- Check all monitors and taskbar
- Use Alt+Tab to find the window
- Window may start minimized

### Permission Issues
- Right-click shortcut → Properties → Advanced
- Check "Run as administrator" if needed

## 🎯 Matrix Optimization Summary

This shortcut system is optimized across all 4 criteria:

1. **Least Invasive**: Uses Windows standard shortcut mechanism
2. **Most Simple**: One-click launch for users
3. **Most Comprehensive**: Works in all scenarios (dev/prod)
4. **Most Integrative**: Integrates with Windows installer and manual setup

## 📝 For Developers

To update the shortcut behavior, modify:
- `Start-ShiftMint.bat` - Launch logic
- `package.json` → `build.nsis` - Installer settings
- `build/installer-hooks.nsh` - Custom installer actions