#!/usr/bin/env node

/**
 * Build Configuration Verification Script
 * Checks that all required files and configurations are in place for building the installer
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying ShiftMint build configuration...\n');

let errors = 0;
let warnings = 0;

// Check package.json
console.log('📦 Checking package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  if (!packageJson.build) {
    console.error('❌ Missing "build" configuration in package.json');
    errors++;
  } else {
    console.log('✅ Build configuration found');
    
    // Check for Windows configuration
    if (!packageJson.build.win) {
      console.error('❌ Missing Windows build configuration');
      errors++;
    } else {
      console.log('✅ Windows configuration found');
    }
    
    // Check for NSIS configuration
    if (!packageJson.build.nsis) {
      console.error('❌ Missing NSIS configuration');
      errors++;
    } else {
      console.log('✅ NSIS configuration found');
    }
  }
  
  // Check version
  if (!packageJson.version) {
    console.error('❌ Missing version in package.json');
    errors++;
  } else {
    console.log(`✅ Version: ${packageJson.version}`);
  }
} catch (e) {
  console.error('❌ Failed to read package.json:', e.message);
  errors++;
}

console.log('\n📁 Checking required files...');

// Check for icon files
const iconFiles = [
  'assets/icon.ico.ico',
  'assets/icon.png.png',
  'assets/icon.icns'
];

iconFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file} exists`);
  } else {
    console.error(`❌ Missing ${file}`);
    errors++;
  }
});

// Check for optional NSIS assets
const optionalFiles = [
  'assets/installer-sidebar.bmp',
  'assets/installer-header.bmp',
  'LICENSE.txt'
];

optionalFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file} exists`);
  } else {
    console.warn(`⚠️  Missing optional file: ${file}`);
    warnings++;
  }
});

// Check for required directories
console.log('\n📁 Checking directories...');
const requiredDirs = [
  'electron',
  'electron/main',
  'electron/backend',
  'components',
  'assets',
  'prisma'
];

requiredDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`✅ ${dir}/ exists`);
  } else {
    console.error(`❌ Missing directory: ${dir}/`);
    errors++;
  }
});

// Check for required source files
console.log('\n📄 Checking source files...');
const requiredFiles = [
  'App.tsx',
  'main.tsx',
  'index.html',
  'vite.config.ts',
  'tsconfig.json'
];

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file} exists`);
  } else {
    console.error(`❌ Missing file: ${file}`);
    errors++;
  }
});

// Check for website directory
if (fs.existsSync('website/public')) {
  console.log('✅ website/public/ exists');
} else {
  console.log('📁 Creating website/public/ directory...');
  fs.mkdirSync('website/public', { recursive: true });
  console.log('✅ website/public/ created');
}

// Check Electron Builder installation
console.log('\n📦 Checking dependencies...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  if (packageJson.devDependencies && packageJson.devDependencies['electron-builder']) {
    console.log('✅ electron-builder is installed');
  } else {
    console.error('❌ electron-builder is not in devDependencies');
    errors++;
  }
  
  if (packageJson.devDependencies && packageJson.devDependencies['electron']) {
    console.log('✅ electron is installed');
  } else {
    console.error('❌ electron is not in devDependencies');
    errors++;
  }
} catch (e) {
  console.error('❌ Failed to check dependencies:', e.message);
}

// Summary
console.log('\n📊 Summary:');
console.log(`   Errors: ${errors}`);
console.log(`   Warnings: ${warnings}`);

if (errors === 0) {
  console.log('\n✅ Build configuration is valid! You can run:');
  console.log('   npm run build');
  console.log('   npm run dist:win');
  console.log('\nThe installer will be created in the dist/ directory.');
  process.exit(0);
} else {
  console.log('\n❌ Please fix the errors above before building.');
  process.exit(1);
}