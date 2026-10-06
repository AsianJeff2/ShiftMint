/**
 * ShiftMint Production Build Script
 * Matrix-optimized: Comprehensive + Integrative
 * Creates a console-free, professional desktop application
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m'
};

async function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function buildProduction() {
  try {
    log('\n🚀 Starting ShiftMint Production Build\n', 'bright');
    log('This will create a console-free desktop application\n', 'blue');
    
    // Step 1: Clean previous builds
    log('📧 Cleaning previous builds...', 'yellow');
    const dirsToClean = ['dist', 'dist-electron', 'dist-installer'];
    for (const dir of dirsToClean) {
      try {
        await fs.rmdir(dir, { recursive: true });
      } catch (e) {
        // Directory might not exist
      }
    }
    
    // Step 2: Install dependencies
    log('📦 Installing dependencies...', 'yellow');
    await execAsync('npm install');
    
    // Step 3: Generate Prisma client
    log('🗄️ Generating Prisma client...', 'yellow');
    await execAsync('npm run prisma:generate');
    
    // Step 4: Build frontend (production mode)
    log('🎨 Building frontend...', 'yellow');
    process.env.NODE_ENV = 'production';
    await execAsync('npm run build:vite:prod');
    
    // Step 5: Build Electron (production mode)
    log('⚡ Building Electron...', 'yellow');
    
    // Copy production index.ts if it exists
    const prodIndexPath = path.join(__dirname, '..', 'electron', 'main', 'index-production.ts');
    const mainIndexPath = path.join(__dirname, '..', 'electron', 'main', 'index.ts');
    const backupPath = path.join(__dirname, '..', 'electron', 'main', 'index-dev.ts');
    
    if (await fs.access(prodIndexPath).then(() => true).catch(() => false)) {
      // Backup current index.ts
      await fs.copyFile(mainIndexPath, backupPath);
      // Use production version
      await fs.copyFile(prodIndexPath, mainIndexPath);
    }
    
    await execAsync('npm run build:electron:prod');
    
    // Step 6: Create installer
    log('📦 Creating Windows installer...', 'yellow');
    await execAsync('npm run dist:win');
    
    // Restore original index.ts if we backed it up
    if (await fs.access(backupPath).then(() => true).catch(() => false)) {
      await fs.copyFile(backupPath, mainIndexPath);
      await fs.unlink(backupPath);
    }
    
    // Step 7: Create portable version
    log('💼 Creating portable version...', 'yellow');
    await execAsync('npm run dist:win-portable');
    
    log('\n✅ Production build complete!', 'green');
    log('\n📁 Output files:', 'bright');
    
    // List output files
    const installerDir = path.join(__dirname, '..', 'dist-installer');
    const files = await fs.readdir(installerDir);
    
    for (const file of files) {
      if (file.endsWith('.exe')) {
        const stats = await fs.stat(path.join(installerDir, file));
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        log(`   • ${file} (${sizeMB} MB)`, 'blue');
      }
    }
    
    log('\n📋 Next steps:', 'bright');
    log('   1. Test the installer on a clean Windows machine', 'reset');
    log('   2. Verify no console windows appear', 'reset');
    log('   3. Check all features work correctly', 'reset');
    log('   4. Distribute the .exe file to users', 'reset');
    
  } catch (error) {
    log(`\n❌ Build failed: ${error.message}`, 'red');
    log('\n💡 Troubleshooting tips:', 'yellow');
    log('   • Ensure all dependencies are installed: npm install', 'reset');
    log('   • Check for TypeScript errors: npm run build:vite', 'reset');
    log('   • Verify Prisma schema: npm run prisma:generate', 'reset');
    process.exit(1);
  }
}

// Run the build
buildProduction();