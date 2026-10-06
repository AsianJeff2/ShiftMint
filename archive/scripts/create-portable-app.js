/**
 * Create Portable ShiftMint App
 * Creates a working desktop app without the packaging issues
 */

const fs = require('fs-extra');
const path = require('path');

console.log('📦 Creating Portable ShiftMint Desktop App...\n');

async function createPortableApp() {
  try {
    // Create portable app directory
    const portableDir = path.join(__dirname, '..', 'ShiftMint-Portable');
    
    console.log('🗂️  Creating portable app directory...');
    await fs.ensureDir(portableDir);
    
    // Copy essential files
    const filesToCopy = [
      { src: 'dist', dest: 'dist' },
      { src: 'dist-electron', dest: 'dist-electron' },
      { src: 'node_modules/@prisma', dest: 'node_modules/@prisma' },
      { src: 'node_modules/.prisma', dest: 'node_modules/.prisma' },
      { src: 'prisma', dest: 'prisma' },
      { src: 'package.json', dest: 'package.json' }
    ];
    
    console.log('📋 Copying application files...');
    for (const file of filesToCopy) {
      const srcPath = path.join(__dirname, '..', file.src);
      const destPath = path.join(portableDir, file.dest);
      
      if (await fs.pathExists(srcPath)) {
        await fs.copy(srcPath, destPath);
        console.log(`   ✅ Copied: ${file.src}`);
      } else {
        console.log(`   ⚠️  Skipped: ${file.src} (not found)`);
      }
    }
    
    // Create a startup script
    const startupScript = `@echo off
echo 🚀 Starting ShiftMint Desktop Application...
echo.
echo 📍 Application Directory: %~dp0
echo 🗄️  Database will be created in: %APPDATA%\\ShiftMint\\
echo.

cd /d "%~dp0"
node dist-electron/main/index.js

pause`;
    
    await fs.writeFile(path.join(portableDir, 'Start-ShiftMint.bat'), startupScript);
    console.log('   ✅ Created: Start-ShiftMint.bat');
    
    // Create README
    const readme = `# 🍽️ ShiftMint Desktop - Portable Version

## 🚀 How to Run ShiftMint

**Double-click: Start-ShiftMint.bat**

This will:
- ✅ Launch the ShiftMint desktop application
- ✅ Create database automatically in %APPDATA%\\ShiftMint\\
- ✅ Work completely offline (no internet required)
- ✅ Store all data locally on your computer

## 📊 What You Get

- 👥 **Employee Management** (add, edit, manage staff)
- ⏰ **Shift Tracking** (clock in/out, hours tracking)
- 💰 **Tip Recording** (cash, credit, automatic calculations)
- 📊 **Payroll Processing** (complete payroll calculations)
- 🛡️ **TIEE Anomaly Detection** (12 validation rules)
- 🔄 **Database Backup/Restore** (protect your data)
- 📤 **Data Export** (CSV/Excel for taxes/compliance)

## 🔒 Privacy Features

- **100% Local Data** (nothing sent to cloud)
- **Offline Operation** (works without internet)
- **Your Data Stays Yours** (complete privacy)

## 🆘 Troubleshooting

- **Won't Start**: Make sure Node.js is installed
- **Database Issues**: Delete %APPDATA%\\ShiftMint\\ to start fresh
- **Need Help**: Check the console output for error messages

---
**🎊 Welcome to ShiftMint - The Future of Restaurant Payroll! 🎊**`;
    
    await fs.writeFile(path.join(portableDir, 'README.md'), readme);
    console.log('   ✅ Created: README.md');
    
    console.log('\n🎊 PORTABLE APP CREATED SUCCESSFULLY!');
    console.log(`📁 Location: ${portableDir}`);
    console.log('\n📋 To run ShiftMint:');
    console.log('   1. Navigate to: ShiftMint-Portable\\');
    console.log('   2. Double-click: Start-ShiftMint.bat');
    console.log('   3. Enjoy your local-first payroll system!');
    
    return portableDir;
    
  } catch (error) {
    console.error('❌ Error creating portable app:', error);
    throw error;
  }
}

createPortableApp().then((appDir) => {
  console.log(`\n✅ ShiftMint Portable App ready at: ${appDir}`);
  process.exit(0);
}).catch((error) => {
  console.error('💥 Failed to create portable app:', error);
  process.exit(1);
});