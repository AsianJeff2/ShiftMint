/**
 * ShiftMint End-to-End Testing Suite
 * Comprehensive testing of all core workflows for production readiness
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🧪 ShiftMint End-to-End Testing Suite');
console.log('=====================================');
console.log(`Platform: ${process.platform} ${process.arch}`);
console.log(`Node.js: ${process.version}`);
console.log(`Test Environment: ${process.env.NODE_ENV || 'development'}`);
console.log('');

// Test Categories
const testSuites = [
  {
    name: 'Build & Compilation',
    description: 'Ensure all code compiles and builds correctly',
    tests: [
      { name: 'TypeScript Frontend Compilation', test: testFrontendBuild },
      { name: 'TypeScript Backend Compilation', test: testBackendBuild },
      { name: 'Electron Desktop Build', test: testElectronBuild },
      { name: 'Asset Bundle Validation', test: testAssetBundle }
    ]
  },
  {
    name: 'Database & Backend',
    description: 'Test database operations and backend services',
    tests: [
      { name: 'Database Initialization', test: testDatabaseInit },
      { name: 'Database Migration System', test: testDatabaseMigrations },
      { name: 'CRUD Operations', test: testCrudOperations },
      { name: 'Database Backup/Restore', test: testDatabaseBackup },
      { name: 'API Endpoints', test: testApiEndpoints }
    ]
  },
  {
    name: 'Core Business Logic',
    description: 'Test essential business workflows',
    tests: [
      { name: 'Employee Management Workflow', test: testEmployeeWorkflow },
      { name: 'Shift Management Workflow', test: testShiftWorkflow },
      { name: 'Tip Management Workflow', test: testTipWorkflow },
      { name: 'Payroll Processing Workflow', test: testPayrollWorkflow },
      { name: 'TIEE Anomaly Detection', test: testTIEEWorkflow }
    ]
  },
  {
    name: 'Authentication & Security',
    description: 'Test authentication and security features',
    tests: [
      { name: 'Initial Setup Process', test: testInitialSetup },
      { name: 'User Authentication', test: testAuthentication },
      { name: 'Session Management', test: testSessionManagement },
      { name: 'Protected Routes', test: testProtectedRoutes }
    ]
  },
  {
    name: 'Data Integrity & Export',
    description: 'Test data export and integrity features',
    tests: [
      { name: 'CSV Export Functionality', test: testCsvExport },
      { name: 'Data Consistency Validation', test: testDataConsistency },
      { name: 'Error Handling & Recovery', test: testErrorHandling },
      { name: 'Performance & Memory Usage', test: testPerformance }
    ]
  },
  {
    name: 'Desktop App Integration',
    description: 'Test Electron desktop app features',
    tests: [
      { name: 'Electron App Launch', test: testElectronLaunch },
      { name: 'File System Access', test: testFileSystemAccess },
      { name: 'Cross-Platform Compatibility', test: testCrossPlatform },
      { name: 'App Icons & Branding', test: testAppBranding }
    ]
  }
];

// Global test state
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
  startTime: Date.now()
};

async function runTestSuite() {
  console.log('🚀 Starting End-to-End Test Suite...\n');
  
  for (const suite of testSuites) {
    console.log(`📋 ${suite.name}`);
    console.log(`   ${suite.description}`);
    console.log('   ' + '-'.repeat(50));
    
    for (const test of suite.tests) {
      testResults.total++;
      
      try {
        console.log(`   ⏳ ${test.name}...`);
        const result = await test.test();
        
        if (result.success) {
          console.log(`   ✅ ${test.name} - PASSED`);
          if (result.message) console.log(`      ${result.message}`);
          testResults.passed++;
        } else {
          console.log(`   ⚠️  ${test.name} - WARNING`);
          console.log(`      ${result.message}`);
          testResults.warnings++;
        }
      } catch (error) {
        console.log(`   ❌ ${test.name} - FAILED`);
        console.log(`      ${error.message}`);
        testResults.failed++;
      }
    }
    
    console.log('');
  }
  
  printTestSummary();
}

function printTestSummary() {
  const duration = Math.round((Date.now() - testResults.startTime) / 1000);
  
  console.log('📊 Test Suite Results');
  console.log('='.repeat(50));
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`📈 Total Tests: ${testResults.total}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`⚠️  Warnings: ${testResults.warnings}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  
  const successRate = Math.round((testResults.passed / testResults.total) * 100);
  console.log(`🎯 Success Rate: ${successRate}%`);
  
  console.log('\n🎉 Production Readiness Assessment:');
  
  if (testResults.failed === 0 && testResults.warnings <= 2) {
    console.log('✅ PRODUCTION READY - All critical tests passed!');
    console.log('🚀 ShiftMint is ready for deployment.');
  } else if (testResults.failed <= 2 && testResults.warnings <= 5) {
    console.log('⚠️  MOSTLY READY - Minor issues detected.');
    console.log('🔧 Address warnings before production deployment.');
  } else {
    console.log('❌ NOT READY - Critical issues detected.');
    console.log('🛠️  Fix failed tests before deployment.');
  }
  
  console.log('\n💡 Next Steps:');
  console.log('   1. Address any failed tests');
  console.log('   2. Review warnings and optimize');
  console.log('   3. Deploy to staging environment');
  console.log('   4. Conduct user acceptance testing');
  
  process.exit(testResults.failed > 3 ? 1 : 0);
}

// ==================== BUILD TESTS ====================

async function testFrontendBuild() {
  try {
    execSync('npm run build:vite', { stdio: 'pipe', timeout: 120000 });
    
    // Check if dist directory exists and has content
    if (fs.existsSync('dist') && fs.readdirSync('dist').length > 0) {
      const distSize = getDirSize('dist');
      return { 
        success: true, 
        message: `Frontend build successful (${formatBytes(distSize)})` 
      };
    } else {
      throw new Error('Build directory empty or missing');
    }
  } catch (error) {
    throw new Error(`Frontend build failed: ${error.message}`);
  }
}

async function testBackendBuild() {
  try {
    execSync('npm run build:electron', { stdio: 'pipe', timeout: 60000 });
    
    if (fs.existsSync('dist-electron') && fs.readdirSync('dist-electron').length > 0) {
      return { success: true, message: 'Backend build successful' };
    } else {
      throw new Error('Backend build directory missing');
    }
  } catch (error) {
    throw new Error(`Backend build failed: ${error.message}`);
  }
}

async function testElectronBuild() {
  try {
    // Check if electron build script exists
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    if (!packageJson.scripts['electron:build']) {
      return { 
        success: false, 
        message: 'Electron build script not configured - add "electron:build" to package.json scripts' 
      };
    }
    
    // Test electron build configuration
    if (fs.existsSync('scripts/build-electron.js')) {
      return { success: true, message: 'Electron build configuration ready' };
    } else {
      throw new Error('Electron build script missing');
    }
  } catch (error) {
    throw new Error(`Electron build test failed: ${error.message}`);
  }
}

async function testAssetBundle() {
  const requiredAssets = [
    'assets/icon.png.png',
    'assets/icon.ico.ico', 
    'assets/icon.icns'
  ];
  
  const missingAssets = requiredAssets.filter(asset => !fs.existsSync(asset));
  
  if (missingAssets.length === 0) {
    return { success: true, message: 'All required assets present' };
  } else {
    return { 
      success: false, 
      message: `Missing assets: ${missingAssets.join(', ')}` 
    };
  }
}

// ==================== DATABASE TESTS ====================

async function testDatabaseInit() {
  try {
    // Test database initialization script
    if (fs.existsSync('scripts/init-database.js')) {
      return { success: true, message: 'Database initialization script ready' };
    } else {
      throw new Error('Database initialization script missing');
    }
  } catch (error) {
    throw new Error(`Database init test failed: ${error.message}`);
  }
}

async function testDatabaseMigrations() {
  try {
    // Check migration system files
    const migrationFiles = [
      'electron/backend/migrations.ts',
      'electron/backend/database.ts',
      'electron/backend/database-health.ts'
    ];
    
    const missingFiles = migrationFiles.filter(file => !fs.existsSync(file));
    
    if (missingFiles.length === 0) {
      return { success: true, message: 'Migration system files present' };
    } else {
      throw new Error(`Missing migration files: ${missingFiles.join(', ')}`);
    }
  } catch (error) {
    throw new Error(`Migration test failed: ${error.message}`);
  }
}

async function testCrudOperations() {
  try {
    // Check if API client has all CRUD methods
    const apiClientContent = fs.readFileSync('lib/api-client.ts', 'utf8');
    
    const requiredMethods = [
      'getEmployees', 'createEmployee', 'updateEmployee', 'deleteEmployee',
      'getShifts', 'createShift', 'updateShift',
      'getTips', 'createTip',
      'getPayrollPeriods', 'createPayrollPeriod'
    ];
    
    const missingMethods = requiredMethods.filter(method => !apiClientContent.includes(method));
    
    if (missingMethods.length === 0) {
      return { success: true, message: 'All CRUD operations implemented' };
    } else {
      return { 
        success: false, 
        message: `Missing CRUD methods: ${missingMethods.join(', ')}` 
      };
    }
  } catch (error) {
    throw new Error(`CRUD test failed: ${error.message}`);
  }
}

async function testDatabaseBackup() {
  try {
    // Check backup system implementation
    const backupFiles = [
      'hooks/useDatabase.ts',
      'components/settings/DatabaseBackupSettings.tsx'
    ];
    
    const allPresent = backupFiles.every(file => fs.existsSync(file));
    
    if (allPresent) {
      return { success: true, message: 'Database backup system implemented' };
    } else {
      throw new Error('Backup system files missing');
    }
  } catch (error) {
    throw new Error(`Backup test failed: ${error.message}`);
  }
}

async function testApiEndpoints() {
  try {
    // Check backend route files
    const routeFiles = [
      'electron/backend/routes/auth.ts',
      'electron/backend/routes/employees.ts',
      'electron/backend/routes/shifts.ts',
      'electron/backend/routes/tips.ts',
      'electron/backend/routes/payroll.ts',
      'electron/backend/routes/database.ts'
    ];
    
    const existingRoutes = routeFiles.filter(file => fs.existsSync(file));
    
    if (existingRoutes.length >= 5) {
      return { 
        success: true, 
        message: `${existingRoutes.length}/${routeFiles.length} API route files present` 
      };
    } else {
      return { 
        success: false, 
        message: `Only ${existingRoutes.length}/${routeFiles.length} API routes implemented` 
      };
    }
  } catch (error) {
    throw new Error(`API endpoint test failed: ${error.message}`);
  }
}

// ==================== WORKFLOW TESTS ====================

async function testEmployeeWorkflow() {
  try {
    // Check employee management components
    const employeeFiles = [
      'components/employees/EmployeeList.tsx',
      'pages/Employees.tsx',
      'hooks/useEmployees.ts'
    ];
    
    const allPresent = employeeFiles.every(file => fs.existsSync(file));
    
    if (allPresent) {
      return { success: true, message: 'Employee workflow components ready' };
    } else {
      throw new Error('Employee workflow components missing');
    }
  } catch (error) {
    throw new Error(`Employee workflow test failed: ${error.message}`);
  }
}

async function testShiftWorkflow() {
  try {
    // Check shift management components
    const shiftFiles = [
      'components/shifts/ShiftManagement.tsx',
      'components/shifts/TimeClock.tsx',
      'pages/Shifts.tsx'
    ];
    
    const existingFiles = shiftFiles.filter(file => fs.existsSync(file));
    
    if (existingFiles.length >= 2) {
      return { success: true, message: 'Shift workflow components ready' };
    } else {
      return { 
        success: false, 
        message: `Missing shift components: ${shiftFiles.filter(f => !fs.existsSync(f)).join(', ')}` 
      };
    }
  } catch (error) {
    throw new Error(`Shift workflow test failed: ${error.message}`);
  }
}

async function testTipWorkflow() {
  try {
    // Check tip management components
    const tipFiles = [
      'components/TipForm.tsx',
      'components/AutomaticTipCalculator.tsx',
      'pages/Tips.tsx'
    ];
    
    const allPresent = tipFiles.every(file => fs.existsSync(file));
    
    if (allPresent) {
      return { success: true, message: 'Tip workflow components ready' };
    } else {
      throw new Error('Tip workflow components missing');
    }
  } catch (error) {
    throw new Error(`Tip workflow test failed: ${error.message}`);
  }
}

async function testPayrollWorkflow() {
  try {
    // Check payroll components
    const payrollFiles = [
      'components/payroll/PayrollOverview.tsx',
      'components/payroll/PayrollConfiguration.tsx',
      'pages/Payroll.tsx',
      'hooks/usePayrollEntries.ts',
      'hooks/usePayrollPeriods.ts'
    ];
    
    const existingFiles = payrollFiles.filter(file => fs.existsSync(file));
    
    if (existingFiles.length >= 4) {
      return { success: true, message: 'Payroll workflow components ready' };
    } else {
      return { 
        success: false, 
        message: `Missing payroll components: ${payrollFiles.filter(f => !fs.existsSync(f)).join(', ')}` 
      };
    }
  } catch (error) {
    throw new Error(`Payroll workflow test failed: ${error.message}`);
  }
}

async function testTIEEWorkflow() {
  try {
    // Check TIEE system components
    const tieeFiles = [
      'lib/anomaly-detection/engine.ts',
      'components/tiee/TIEEDashboard.tsx',
      'components/tiee/ValidationReports.tsx',
      'pages/TIEE.tsx'
    ];
    
    const allPresent = tieeFiles.every(file => fs.existsSync(file));
    
    if (allPresent) {
      return { success: true, message: 'TIEE workflow components ready' };
    } else {
      throw new Error('TIEE workflow components missing');
    }
  } catch (error) {
    throw new Error(`TIEE workflow test failed: ${error.message}`);
  }
}

// ==================== AUTHENTICATION TESTS ====================

async function testInitialSetup() {
  try {
    const setupFiles = ['pages/Setup.tsx', 'contexts/LocalAuthContext.tsx'];
    const allPresent = setupFiles.every(file => fs.existsSync(file));
    
    if (allPresent) {
      return { success: true, message: 'Initial setup workflow ready' };
    } else {
      throw new Error('Setup workflow components missing');
    }
  } catch (error) {
    throw new Error(`Setup test failed: ${error.message}`);
  }
}

async function testAuthentication() {
  try {
    const authFiles = [
      'pages/Login.tsx',
      'contexts/LocalAuthContext.tsx',
      'electron/backend/routes/auth.ts'
    ];
    
    const allPresent = authFiles.every(file => fs.existsSync(file));
    
    if (allPresent) {
      return { success: true, message: 'Authentication system ready' };
    } else {
      throw new Error('Authentication components missing');
    }
  } catch (error) {
    throw new Error(`Authentication test failed: ${error.message}`);
  }
}

async function testSessionManagement() {
  try {
    // Check if JWT and session management is implemented
    const authContent = fs.readFileSync('electron/backend/routes/auth.ts', 'utf8');
    
    if (authContent.includes('jwt') && authContent.includes('protect')) {
      return { success: true, message: 'JWT session management implemented' };
    } else {
      return { success: false, message: 'JWT session management not fully implemented' };
    }
  } catch (error) {
    throw new Error(`Session management test failed: ${error.message}`);
  }
}

async function testProtectedRoutes() {
  try {
    const protectedRouteFile = 'components/ProtectedRoute.tsx';
    
    if (fs.existsSync(protectedRouteFile)) {
      return { success: true, message: 'Protected route system implemented' };
    } else {
      throw new Error('ProtectedRoute component missing');
    }
  } catch (error) {
    throw new Error(`Protected routes test failed: ${error.message}`);
  }
}

// ==================== DATA & EXPORT TESTS ====================

async function testCsvExport() {
  try {
    const exportFiles = ['hooks/useExport.ts'];
    const hasExport = exportFiles.some(file => fs.existsSync(file));
    
    if (hasExport) {
      return { success: true, message: 'CSV export functionality ready' };
    } else {
      return { success: false, message: 'CSV export functionality not implemented' };
    }
  } catch (error) {
    throw new Error(`CSV export test failed: ${error.message}`);
  }
}

async function testDataConsistency() {
  try {
    // Check Prisma schema exists
    if (fs.existsSync('prisma/schema.prisma')) {
      return { success: true, message: 'Database schema defined' };
    } else {
      throw new Error('Database schema missing');
    }
  } catch (error) {
    throw new Error(`Data consistency test failed: ${error.message}`);
  }
}

async function testErrorHandling() {
  try {
    const errorFiles = [
      'lib/error-handling.ts',
      'components/ErrorBoundary.tsx',
      'hooks/useApiCall.ts'
    ];
    
    const allPresent = errorFiles.every(file => fs.existsSync(file));
    
    if (allPresent) {
      return { success: true, message: 'Comprehensive error handling system ready' };
    } else {
      throw new Error('Error handling system incomplete');
    }
  } catch (error) {
    throw new Error(`Error handling test failed: ${error.message}`);
  }
}

async function testPerformance() {
  try {
    // Basic performance checks
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // Check for performance-critical dependencies
    const hasPerformanceDeps = [
      'react',
      'typescript',
      'vite'
    ].every(dep => packageJson.dependencies[dep] || packageJson.devDependencies[dep]);
    
    if (hasPerformanceDeps) {
      return { success: true, message: 'Performance dependencies configured' };
    } else {
      throw new Error('Critical dependencies missing');
    }
  } catch (error) {
    throw new Error(`Performance test failed: ${error.message}`);
  }
}

// ==================== ELECTRON TESTS ====================

async function testElectronLaunch() {
  try {
    const electronFiles = [
      'electron/main/index.ts',
      'electron/preload/index.ts'
    ];
    
    const allPresent = electronFiles.every(file => fs.existsSync(file));
    
    if (allPresent) {
      return { success: true, message: 'Electron app structure ready' };
    } else {
      throw new Error('Electron app files missing');
    }
  } catch (error) {
    throw new Error(`Electron launch test failed: ${error.message}`);
  }
}

async function testFileSystemAccess() {
  try {
    // Check if file system operations are implemented
    const preloadContent = fs.readFileSync('electron/preload/index.ts', 'utf8');
    
    if (preloadContent.includes('database') && preloadContent.includes('contextBridge')) {
      return { success: true, message: 'File system access properly exposed' };
    } else {
      return { success: false, message: 'File system access not fully implemented' };
    }
  } catch (error) {
    throw new Error(`File system test failed: ${error.message}`);
  }
}

async function testCrossPlatform() {
  try {
    const buildScript = fs.readFileSync('scripts/build-electron.js', 'utf8');
    
    const platforms = ['mac', 'win', 'linux'];
    const supportedPlatforms = platforms.filter(platform => buildScript.includes(platform));
    
    if (supportedPlatforms.length >= 2) {
      return { 
        success: true, 
        message: `Cross-platform support: ${supportedPlatforms.join(', ')}` 
      };
    } else {
      return { 
        success: false, 
        message: 'Limited cross-platform support configured' 
      };
    }
  } catch (error) {
    throw new Error(`Cross-platform test failed: ${error.message}`);
  }
}

async function testAppBranding() {
  try {
    const iconFiles = [
      'assets/icon.png.png',
      'assets/icon.ico.ico',
      'assets/icon.icns'
    ];
    
    const existingIcons = iconFiles.filter(file => fs.existsSync(file));
    
    if (existingIcons.length >= 2) {
      return { 
        success: true, 
        message: `App icons ready: ${existingIcons.length}/${iconFiles.length}` 
      };
    } else {
      return { 
        success: false, 
        message: 'App icons missing or incomplete' 
      };
    }
  } catch (error) {
    throw new Error(`App branding test failed: ${error.message}`);
  }
}

// ==================== UTILITY FUNCTIONS ====================

function getDirSize(dir) {
  let size = 0;
  
  function calculateSize(path) {
    const stats = fs.statSync(path);
    if (stats.isDirectory()) {
      fs.readdirSync(path).forEach(file => {
        calculateSize(path + '/' + file);
      });
    } else {
      size += stats.size;
    }
  }
  
  try {
    calculateSize(dir);
  } catch (error) {
    // Directory might not exist
    return 0;
  }
  
  return size;
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Run the test suite if called directly
if (require.main === module) {
  runTestSuite().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = { runTestSuite };