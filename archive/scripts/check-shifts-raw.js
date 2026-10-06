// Simple SQLite query to check shifts
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'prisma', 'data', 'shiftmint.db');
console.log('Opening database:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    return;
  }
  console.log('Connected to database');
});

// Query shifts table
db.all("SELECT id, businessId, employeeId, shiftDate, status FROM shifts LIMIT 10", (err, rows) => {
  if (err) {
    console.error('Error querying shifts:', err);
    return;
  }
  
  console.log('\n=== Shifts in Database ===');
  console.log('Total rows returned:', rows.length);
  
  rows.forEach((row, index) => {
    console.log(`\n${index + 1}. Shift:`);
    console.log(`   ID: ${row.id}`);
    console.log(`   Business ID: ${row.businessId}`);
    console.log(`   Employee ID: ${row.employeeId || 'NULL'}`);
    console.log(`   Date: ${row.shiftDate}`);
    console.log(`   Status: ${row.status}`);
  });
});

// Count total shifts
db.get("SELECT COUNT(*) as count FROM shifts", (err, row) => {
  if (err) {
    console.error('Error counting shifts:', err);
    return;
  }
  console.log(`\nTotal shifts in database: ${row.count}`);
});

// Check for businesses
db.all("SELECT id, name FROM businesses", (err, rows) => {
  if (err) {
    console.error('Error querying businesses:', err);
    return;
  }
  
  console.log('\n=== Businesses ===');
  rows.forEach(row => {
    console.log(`Business: ${row.name} (ID: ${row.id})`);
  });
});

// Close database
setTimeout(() => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('\nDatabase connection closed');
    }
  });
}, 1000);