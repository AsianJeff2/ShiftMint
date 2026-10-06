# ShiftMint Installer Deployment Guide

This guide explains how to build and deploy the ShiftMint Windows installer to your website.

## Building the Installer

### Prerequisites
- Node.js 18+ installed
- Windows operating system (for building Windows installer)
- All dependencies installed (`npm install`)

### Build Steps

1. **Clean previous builds**:
   ```bash
   rm -rf dist/
   rm -rf dist-electron/
   ```

2. **Build the application**:
   ```bash
   npm run build
   ```

3. **Create the Windows installer**:
   ```bash
   npm run dist:win
   ```

   This will create `shiftmint-setup.exe` in the `dist/` directory.

4. **Copy installer to website directory**:
   ```bash
   cp dist/shiftmint-setup.exe website/public/
   ```

## Deployment Process

### Local Testing

1. **Start the backend server**:
   ```bash
   npm run dev:backend
   ```

2. **Test the download endpoint**:
   - Visit: `http://localhost:3001/download`
   - Verify the installer downloads correctly

3. **Test the version endpoint**:
   - Visit: `http://localhost:3001/api/version`
   - Verify version information is displayed

### Production Deployment

1. **Update version number** in `package.json`

2. **Update CHANGELOG.md** with release notes

3. **Build the installer** (follow build steps above)

4. **Sign the installer** (optional but recommended):
   - If you have a code signing certificate, update the `certificateFile` and `certificatePassword` fields in `package.json`
   - Rebuild the installer

5. **Deploy to your web server**:
   - Upload `website/public/shiftmint-setup.exe` to your web server
   - Ensure the Express backend is running with proper routes configured
   - Configure your web server to serve the `/download` endpoint

## API Endpoints

### `/api/version`
Returns current version information:
```json
{
  "version": "2.0.0",
  "name": "ShiftMint",
  "description": "ShiftMint - Local-first tip tracking...",
  "fileSize": 85234567,
  "changelog": "...",
  "downloadUrl": "/download",
  "releaseDate": "2024-01-15T..."
}
```

### `/api/log-download` (POST)
Logs download events for analytics:
```json
{
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "timestamp": "2024-01-15T..."
}
```

### `/download`
Serves the installer file with:
- Rate limiting (10 downloads per IP per hour)
- Automatic download logging
- Proper error handling

## Security Considerations

1. **Code Signing**: Always sign your installer for production deployments
2. **HTTPS**: Serve downloads over HTTPS only
3. **Rate Limiting**: Adjust `DOWNLOAD_LIMIT` in server.ts as needed
4. **Access Logs**: Monitor `logs/downloads.json` for unusual activity

## Troubleshooting

### Installer won't build
- Ensure you're on Windows
- Check that all icon files exist in `assets/` directory
- Verify `electron-builder` is installed

### Download endpoint returns 404
- Check that `shiftmint-setup.exe` exists in `website/public/`
- Verify Express server is running
- Check server logs for errors

### Version endpoint fails
- Ensure `package.json` and `CHANGELOG.md` are accessible
- Check file permissions

## Maintenance

### Regular Updates
1. Monitor download logs for usage patterns
2. Update dependencies regularly
3. Test installer on clean Windows systems
4. Keep CHANGELOG.md up to date

### Backup Strategy
- Keep copies of all released installers
- Backup download logs regularly
- Maintain version history

For additional support, consult the main ShiftMint documentation.