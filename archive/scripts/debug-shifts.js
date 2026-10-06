// Debug script to check shift database state
const { PrismaClient } = require('@prisma/client');
const path = require('path');

// Set up Prisma with the correct database path
const dbPath = path.join(__dirname, '..', 'prisma', 'data', 'shiftmint.db');
process.env.DATABASE_URL = `file:${dbPath}`;

console.log('Database path:', dbPath);
console.log('DATABASE_URL:', process.env.DATABASE_URL);

const prisma = new PrismaClient({
  log: ['error', 'warn']
});

async function debugShifts() {
  try {
    console.log('\n=== ShiftMint Database Debug ===\n');
    
    // 1. Count total shifts
    const shiftCount = await prisma.shift.count();
    console.log(`Total shifts in database: ${shiftCount}`);
    
    // 2. Get all unique business IDs
    const shifts = await prisma.shift.findMany({
      select: {
        id: true,
        businessId: true,
        employeeId: true,
        shiftDate: true,
        status: true,
        createdAt: true
      },
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('\n--- Recent Shifts (last 10) ---');
    shifts.forEach((shift, index) => {
      console.log(`${index + 1}. Shift ID: ${shift.id}`);
      console.log(`   Business ID: ${shift.businessId}`);
      console.log(`   Employee ID: ${shift.employeeId || 'UNASSIGNED'}`);
      console.log(`   Date: ${shift.shiftDate}`);
      console.log(`   Status: ${shift.status}`);
      console.log(`   Created: ${shift.createdAt}`);
      console.log('');
    });
    
    // 3. Check for unique business IDs
    const uniqueBusinessIds = await prisma.shift.groupBy({
      by: ['businessId'],
      _count: {
        id: true
      }
    });
    
    console.log('--- Business ID Summary ---');
    uniqueBusinessIds.forEach(business => {
      console.log(`Business ID "${business.businessId}": ${business._count.id} shifts`);
    });
    
    // 4. Check for any shifts without businessId
    const noBusinessId = await prisma.shift.count({
      where: {
        OR: [
          { businessId: null },
          { businessId: '' }
        ]
      }
    });
    
    if (noBusinessId > 0) {
      console.log(`\n⚠️  WARNING: ${noBusinessId} shifts have no business ID!`);
    }
    
    // 5. Get all businesses
    const businesses = await prisma.business.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true
      }
    });
    
    console.log('\n--- Registered Businesses ---');
    businesses.forEach(business => {
      console.log(`Business: ${business.name}`);
      console.log(`ID: ${business.id}`);
      console.log(`Created: ${business.createdAt}`);
      console.log('');
    });
    
    // 6. Check for shifts with non-existent business IDs
    const businessIds = businesses.map(b => b.id);
    const orphanedShifts = await prisma.shift.count({
      where: {
        NOT: {
          businessId: {
            in: businessIds
          }
        }
      }
    });
    
    if (orphanedShifts > 0) {
      console.log(`\n⚠️  WARNING: ${orphanedShifts} shifts belong to non-existent businesses!`);
      
      // Show some examples
      const examples = await prisma.shift.findMany({
        where: {
          NOT: {
            businessId: {
              in: businessIds
            }
          }
        },
        take: 5,
        select: {
          id: true,
          businessId: true,
          shiftDate: true
        }
      });
      
      console.log('Examples of orphaned shifts:');
      examples.forEach(shift => {
        console.log(`  - Shift ${shift.id} with businessId: "${shift.businessId}"`);
      });
    }
    
    console.log('\n=== Debug Complete ===\n');
    
  } catch (error) {
    console.error('Error debugging shifts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugShifts();