/**
 * Test script for production database initialization
 * This script validates that the database system works in production-like conditions
 */

const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Import our production database functions
const { initializeDatabase, getDatabasePath, getDataDirectory, closeDatabase } = require('../dist-electron/backend/database.js');

async function testProductionDatabase() {
  console.log('🧪 Starting Production Database Test');
  console.log('=====================================');
  
  try {
    // Step 1: Clean up any existing test database
    console.log('1. Cleaning up test environment...');
    const testDataDir = path.join(os.tmpdir(), 'shiftmint-test');
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
    
    // Override the data directory for testing
    process.env.SHIFTMINT_DATA_DIR = testDataDir;
    
    // Step 2: Test fresh installation
    console.log('2. Testing fresh installation...');
    await initializeDatabase();
    console.log('✅ Fresh installation completed');
    
    // Step 3: Verify database structure
    console.log('3. Verifying database structure...');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${path.join(testDataDir, 'shiftmint.db')}`
        }
      }
    });
    
    await prisma.$connect();
    
    // Test that all tables exist and are accessible
    const tables = [
      'appSetting',
      'business', 
      'user',
      'employee',
      'businessConfiguration',
      'shift',
      'tipEntry',
      'payrollPeriod',
      'payrollEntry',
      'punchEvent',
      'auditLog',
      'analyticsEntry'
    ];
    
    for (const table of tables) {
      try {
        await prisma[table].count();
        console.log(`  ✅ Table '${table}' is accessible`);
      } catch (error) {
        console.error(`  ❌ Table '${table}' failed: ${error.message}`);
        throw error;
      }
    }
    
    // Step 4: Test default settings
    console.log('4. Verifying default settings...');
    const settings = await prisma.appSetting.findMany();
    const requiredSettings = ['app_version', 'schema_version', 'first_launch', 'install_date'];
    
    for (const setting of requiredSettings) {
      const found = settings.find(s => s.key === setting);
      if (found) {
        console.log(`  ✅ Setting '${setting}' = '${found.value}'`);
      } else {
        console.error(`  ❌ Required setting '${setting}' not found`);
        throw new Error(`Missing required setting: ${setting}`);
      }
    }
    
    // Step 5: Test existing installation (should not recreate tables)
    console.log('5. Testing existing installation handling...');
    await prisma.$disconnect();
    
    // Reinitialize - should detect existing database
    await initializeDatabase();
    console.log('✅ Existing installation handled correctly');
    
    // Step 6: Test basic CRUD operations
    console.log('6. Testing basic database operations...');
    await prisma.$connect();
    
    // Create a test business
    const business = await prisma.business.create({
      data: {
        name: 'Test Restaurant',
        type: 'restaurant',
        phone: '555-0123',
        ein: '12-3456789'
      }
    });
    console.log(`  ✅ Created business: ${business.name}`);
    
    // Create a test user
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        passwordHash: 'hashedpassword',
        businessId: business.id
      }
    });
    console.log(`  ✅ Created user: ${user.email}`);
    
    // Test indexes are working
    const usersByEmail = await prisma.user.findMany({
      where: { email: 'test@example.com' }
    });
    console.log(`  ✅ Index query returned ${usersByEmail.length} user(s)`);
    
    await prisma.$disconnect();
    
    // Step 7: Clean up
    console.log('7. Cleaning up test environment...');
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
    
    console.log('\n🎉 All tests passed! Production database system is ready.');
    console.log('=====================================');
    
    return {
      success: true,
      message: 'Production database initialization test completed successfully'
    };
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    console.log('=====================================');
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Environment check
function checkEnvironment() {
  console.log('Environment Check:');
  console.log(`- Node.js: ${process.version}`);
  console.log(`- Platform: ${process.platform}`);
  console.log(`- Architecture: ${process.arch}`);
  console.log(`- Temp directory: ${os.tmpdir()}`);
  console.log('');
}

// Run test if called directly
if (require.main === module) {
  checkEnvironment();
  testProductionDatabase()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { testProductionDatabase };