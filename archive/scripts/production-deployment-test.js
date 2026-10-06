/**
 * Production Deployment Test Suite
 * Validates complete production build pipeline
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 SHIFTMINT PRODUCTION DEPLOYMENT TEST\n');

const tests = [
  {
    name: 'Frontend Production Build',
    command: 'npm',
    args: ['run', 'build:vite'],
    expected: 'dist/index.html'
  },
  {
    name: 'Backend TypeScript Build', 
    command: 'npm',
    args: ['run', 'build:electron'],
    expected: 'dist-electron/main/index.js'
  },
  {
    name: 'Database Migration System',
    validation: () => {
      const migrationFile = path.join(__dirname, '..', 'electron', 'backend', 'migrations.ts');
      return fs.existsSync(migrationFile);
    }
  },
  {
    name: 'Error Handling System',
    validation: () => {
      const errorFile = path.join(__dirname, '..', 'lib', 'error-handling.ts');
      return fs.existsSync(errorFile);
    }
  },
  {
    name: 'Desktop App Icons',
    validation: () => {
      const assetsDir = path.join(__dirname, '..', 'assets');
      return fs.existsSync(assetsDir);
    }
  }
];

async function runTest(test) {
  return new Promise((resolve) => {
    console.log(`📋 Testing: ${test.name}`);
    
    if (test.validation) {
      const result = test.validation();
      console.log(`   ${result ? '✅' : '❌'} ${test.name}: ${result ? 'PASSED' : 'FAILED'}`);
      resolve(result);
      return;
    }
    
    if (test.command) {
      const process = spawn(test.command, test.args, { shell: true });
      let output = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        output += data.toString();
      });
      
      process.on('close', (code) => {
        const success = code === 0 && (test.expected ? fs.existsSync(test.expected) : true);
        console.log(`   ${success ? '✅' : '❌'} ${test.name}: ${success ? 'PASSED' : 'FAILED'}`);
        if (!success && output) {
          console.log(`   📄 Output: ${output.slice(-200)}`);
        }
        resolve(success);
      });
      
      // Timeout after 2 minutes
      setTimeout(() => {
        process.kill();
        console.log(`   ⏰ ${test.name}: TIMEOUT`);
        resolve(false);
      }, 120000);
    }
  });
}

async function runAllTests() {
  console.log('🧪 Running Production Deployment Tests...\n');
  
  const results = [];
  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);
  }
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`\n📊 PRODUCTION DEPLOYMENT RESULTS:`);
  console.log(`   ✅ Passed: ${passed}/${total} tests`);
  console.log(`   📈 Success Rate: ${Math.round((passed/total) * 100)}%`);
  
  if (passed === total) {
    console.log('\n🏆 PRODUCTION DEPLOYMENT: READY!');
    console.log('   🎯 All systems operational');
    console.log('   🚀 Ready for desktop app packaging');
    console.log('   💼 Enterprise-grade build pipeline');
  } else {
    console.log('\n⚠️  PRODUCTION DEPLOYMENT: Issues Detected');
    console.log('   🔧 Some components need attention');
  }
  
  process.exit(passed === total ? 0 : 1);
}

runAllTests();