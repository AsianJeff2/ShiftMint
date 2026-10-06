const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 ShiftMint Optimized Launcher');
console.log('=====================================');

// Check if running in development or production
const isDev = !fs.existsSync(path.join(__dirname, '..', 'dist'));

async function launchShiftMint() {
  try {
    // Step 1: Check if backend is already running
    const http = require('http');
    const backendRunning = await new Promise(resolve => {
      http.get('http://localhost:3001/api/health', res => {
        resolve(res.statusCode === 200);
      }).on('error', () => resolve(false));
    });

    if (!backendRunning) {
      console.log('📦 Starting backend server...');
      const backend = spawn('node', [
        path.join(__dirname, '..', 'electron', 'backend', 'server.js')
      ], {
        stdio: 'inherit',
        shell: true
      });
      
      // Wait for backend to start
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      console.log('✅ Backend already running');
    }

    // Step 2: Launch Electron with window management
    console.log('🖥️  Launching ShiftMint Desktop...');
    
    const electronPath = require('electron');
    const mainPath = path.join(__dirname, '..', 'dist-electron', 'main', 'index.js');
    
    const electron = spawn(electronPath, [
      mainPath,
      '--enable-logging',
      '--force-device-scale-factor=1',
      '--high-dpi-support=1',
      '--disable-gpu-sandbox'
    ], {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
        ELECTRON_ENABLE_LOGGING: '1'
      }
    });

    electron.on('error', (err) => {
      console.error('❌ Failed to start Electron:', err);
    });

    electron.on('exit', (code) => {
      console.log(`Electron exited with code ${code}`);
      process.exit(code);
    });

    // Alternative: Open in browser if Electron fails
    setTimeout(() => {
      console.log('\n📱 Alternative Access:');
      console.log('   If the desktop window doesn\'t appear, you can access ShiftMint at:');
      console.log('   🌐 http://localhost:3000 (in your browser)');
      console.log('\n💡 Troubleshooting:');
      console.log('   - Check Windows taskbar for minimized window');
      console.log('   - Try Alt+Tab to switch between windows');
      console.log('   - Check all monitors if using multiple displays');
    }, 5000);

  } catch (error) {
    console.error('❌ Launch error:', error);
    
    // Fallback: Try npm run dev
    console.log('\n🔄 Trying fallback method...');
    const fallback = spawn('npm', ['run', 'dev'], {
      stdio: 'inherit',
      shell: true,
      cwd: path.join(__dirname, '..')
    });
  }
}

// Launch with proper error handling
launchShiftMint().catch(console.error);