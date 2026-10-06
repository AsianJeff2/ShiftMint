// Test script to verify shift deletion issue
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { promisify } = require('util');

const dbPath = path.join(__dirname, '..', 'prisma', 'data', 'shiftmint.db');
console.log('Database path:', dbPath);

async function testDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      console.log('✓ Connected to database\n');
      
      // Promisify database methods
      const dbAll = promisify(db.all.bind(db));
      const dbGet = promisify(db.get.bind(db));
      
      (async () => {
        try {
          // 1. Count total shifts
          const countResult = await dbGet("SELECT COUNT(*) as count FROM shifts");
          console.log(`Total shifts in database: ${countResult.count}\n`);
          
          if (countResult.count === 0) {
            console.log('⚠️  No shifts found in database');
            console.log('Please import some shifts first using the CSV import feature.\n');
            db.close();
            resolve();
            return;
          }
          
          // 2. Get sample shifts
          const shifts = await dbAll(`
            SELECT id, businessId, employeeId, shiftDate, status 
            FROM shifts 
            ORDER BY createdAt DESC 
            LIMIT 5
          `);
          
          console.log('=== Recent Shifts (Last 5) ===');
          shifts.forEach((shift, index) => {
            console.log(`${index + 1}. Shift ID: "${shift.id}"`);
            console.log(`   Business ID: "${shift.businessId}"`);
            console.log(`   Employee ID: ${shift.employeeId ? `"${shift.employeeId}"` : 'NULL'}`);
            console.log(`   Date: ${shift.shiftDate}`);
            console.log(`   Status: ${shift.status}`);
            console.log('');
          });
          
          // 3. Check business IDs
          const businessGroups = await dbAll(`
            SELECT businessId, COUNT(*) as count 
            FROM shifts 
            GROUP BY businessId
          `);
          
          console.log('=== Shifts by Business ID ===');
          businessGroups.forEach(group => {
            console.log(`Business ID "${group.businessId}": ${group.count} shifts`);
          });
          console.log('');
          
          // 4. Check for NULL or empty business IDs
          const problematicShifts = await dbAll(`
            SELECT id, businessId, employeeId 
            FROM shifts 
            WHERE businessId IS NULL OR businessId = ''
            LIMIT 5
          `);
          
          if (problematicShifts.length > 0) {
            console.log('⚠️  WARNING: Found shifts with NULL or empty businessId:');
            problematicShifts.forEach(shift => {
              console.log(`   - Shift ${shift.id}: businessId = "${shift.businessId}"`);
            });
            console.log('');
          }
          
          // 5. Get all businesses
          const businesses = await dbAll("SELECT id, name FROM businesses");
          console.log('=== Registered Businesses ===');
          if (businesses.length === 0) {
            console.log('⚠️  No businesses found in database');
            console.log('This could be the issue - shifts may have incorrect business IDs\n');
          } else {
            businesses.forEach(business => {
              console.log(`Business: "${business.name}"`);
              console.log(`ID: "${business.id}"`);
              console.log('');
            });
            
            // Check for orphaned shifts
            const businessIds = businesses.map(b => `'${b.id}'`).join(',');
            const orphaned = await dbAll(`
              SELECT id, businessId 
              FROM shifts 
              WHERE businessId NOT IN (${businessIds})
              LIMIT 5
            `);
            
            if (orphaned.length > 0) {
              console.log('⚠️  WARNING: Found shifts with non-existent business IDs:');
              orphaned.forEach(shift => {
                console.log(`   - Shift ${shift.id} has businessId: "${shift.businessId}"`);
              });
              console.log('   These shifts cannot be deleted through the normal UI!\n');
            }
          }
          
          // 6. Test a specific shift ID format
          if (shifts.length > 0) {
            const testShift = shifts[0];
            console.log('=== Testing Shift ID Format ===');
            console.log(`Sample shift ID: "${testShift.id}"`);
            console.log(`ID length: ${testShift.id.length} characters`);
            console.log(`ID type: ${typeof testShift.id}`);
            
            // Check if it's a valid CUID format
            const cuidPattern = /^c[a-z0-9]{24}$/;
            if (cuidPattern.test(testShift.id)) {
              console.log('✓ ID appears to be a valid CUID\n');
            } else {
              console.log('⚠️  ID does not match expected CUID format\n');
            }
          }
          
          console.log('=== Diagnosis Complete ===\n');
          console.log('Possible issues:');
          console.log('1. Shifts may have incorrect or NULL businessId');
          console.log('2. The logged-in user\'s businessId may not match the shifts');
          console.log('3. There may be a mismatch between the auth token and database state\n');
          
          db.close();
          resolve();
        } catch (error) {
          console.error('Error running queries:', error);
          db.close();
          reject(error);
        }
      })();
    });
  });
}

testDatabase().catch(console.error);