#!/usr/bin/env node
/**
 * Debug script to test CSV import directly
 */

const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

// Minimal test data that should definitely import
const testData = [
  {
    employeeName: 'Test Employee 1',
    startTime: '2024-01-15T09:00:00',
    endTime: '2024-01-15T17:00:00',
  },
  {
    // Missing employee name - should still import
    startTime: '2024-01-15T10:00:00',
    endTime: '2024-01-15T18:00:00',
  },
  {
    // Completely minimal
    employeeName: 'Test Employee 2'
  },
  {
    // Empty object - ultimate test
  }
];

async function testImport() {
  console.log('🔍 Testing CSV Import with minimal data...\n');
  
  try {
    const response = await axios.post(
      `${API_URL}/shifts/import-csv`,
      { csvData: testData },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('\n✅ Import successful!');
      console.log(`   Imported: ${response.data.imported} shifts`);
      console.log(`   Errors: ${response.data.errors?.length || 0}`);
      console.log(`   Warnings: ${response.data.warnings?.length || 0}`);
      
      if (response.data.errors && response.data.errors.length > 0) {
        console.log('\n❌ ERRORS (these should not happen with permissive import):');
        response.data.errors.forEach(err => console.log(`   - ${err}`));
      }
      
      if (response.data.warnings && response.data.warnings.length > 0) {
        console.log('\n⚠️  Warnings (expected for incomplete data):');
        response.data.warnings.forEach(warn => console.log(`   - ${warn}`));
      }
    }
    
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('⚠️  Authentication required. Testing without auth...');
      // Try without auth header
      try {
        const response = await axios.post(
          `${API_URL}/shifts/import-csv`,
          { csvData: testData }
        );
        console.log('Response:', JSON.stringify(response.data, null, 2));
      } catch (err2) {
        console.error('❌ Error:', err2.response?.data || err2.message);
      }
    } else {
      console.error('❌ Error:', error.response?.data || error.message);
    }
  }
}

// Check if backend is running
async function checkBackend() {
  try {
    await axios.get(`${API_URL}/health`);
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('====================================');
  console.log('   CSV Import Debug Test');
  console.log('====================================\n');
  
  const backendRunning = await checkBackend();
  if (!backendRunning) {
    console.log('⚠️  Backend not running at', API_URL);
    console.log('   The backend might be running but the health check failed.');
    console.log('   Attempting import anyway...\n');
  }
  
  await testImport();
}

main().catch(console.error);