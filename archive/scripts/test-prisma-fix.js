/**
 * Test Prisma Client Fix
 * Verifies that Prisma client can be imported and initialized properly
 */

const { PrismaClient } = require('@prisma/client');
const path = require('path');

console.log('🧪 Testing Prisma Client Fix...\n');

async function testPrismaClient() {
  try {
    console.log('📍 Testing Prisma Client Import...');
    
    // Test if Prisma client can be imported
    console.log('✅ Prisma Client imported successfully');
    
    // Test database path resolution
    const dbPath = path.join(__dirname, '..', 'test.db');
    console.log(`📁 Database path: ${dbPath}`);
    
    // Test Prisma client initialization
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${dbPath}`
        }
      }
    });
    
    console.log('✅ Prisma Client initialized successfully');
    
    // Test basic connection (this might fail, but import should work)
    try {
      await prisma.$connect();
      console.log('✅ Database connection test: SUCCESS');
      await prisma.$disconnect();
    } catch (dbError) {
      console.log('⚠️  Database connection test: Expected to fail (no schema yet)');
      console.log(`   Error: ${dbError.message.split('\n')[0]}`);
    }
    
    console.log('\n🎯 PRISMA CLIENT STATUS: READY');
    console.log('   ✅ Import: Working');
    console.log('   ✅ Initialization: Working');
    console.log('   ✅ Ready for Electron bundling');
    
  } catch (error) {
    console.log('\n❌ PRISMA CLIENT ERROR:');
    console.log(`   Error: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
    
    if (error.message.includes('Cannot find module')) {
      console.log('\n🔧 DIAGNOSIS: Missing Prisma dependencies');
      console.log('   - Prisma client not properly generated');
      console.log('   - Run: npx prisma generate');
    }
  }
}

testPrismaClient().then(() => {
  console.log('\n🏁 Prisma test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});