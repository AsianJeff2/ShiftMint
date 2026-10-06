#!/usr/bin/env node

// Test script to verify shift creation and CSV import functionality
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const API_BASE = 'http://localhost:3001/api';

async function testShiftAPI() {
  console.log('🧪 Testing ShiftMint Shift API...\n');
  
  try {
    // Step 1: Check if backend is running
    console.log('1️⃣ Checking backend health...');
    const healthResponse = await fetch(`${API_BASE}/health`);
    if (!healthResponse.ok) {
      throw new Error('Backend not running');
    }
    console.log('✅ Backend is running\n');

    // Step 2: Login to get token
    console.log('2️⃣ Logging in...');
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@test.com',
        password: 'test123'
      })
    });
    
    const loginData = await loginResponse.json();
    if (!loginData.success) {
      throw new Error('Login failed: ' + loginData.message);
    }
    
    const token = loginData.token;
    console.log('✅ Login successful\n');

    // Step 3: Test shift creation
    console.log('3️⃣ Testing shift creation...');
    const shiftData = {
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      jobCode: 'server',
      locationId: 'main',
      status: 'completed',
      notes: 'Test shift creation',
      employeeId: null,
      businessId: '',
      shiftDate: new Date().toISOString().split('T')[0],
      durationMin: 480,
      totalSales: 1500.00,
      cashSales: 200.00,
      creditCardSales: 1300.00,
      totalTips: 150.00,
      cashTips: 30.00,
      creditCardTips: 120.00
    };

    const createResponse = await fetch(`${API_BASE}/shifts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(shiftData)
    });

    const createResult = await createResponse.json();
    console.log('Response Status:', createResponse.status);
    console.log('Response Body:', JSON.stringify(createResult, null, 2));

    if (createResult.success) {
      console.log('✅ Shift creation successful!\n');
    } else {
      console.log('❌ Shift creation failed:', createResult.message);
      if (createResult.errors) {
        console.log('Validation errors:', createResult.errors);
      }
    }

    // Step 4: Test CSV import
    console.log('4️⃣ Testing CSV import...');
    const csvData = [
      {
        employeeName: 'Test Employee',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        jobCode: 'bartender',
        locationId: 'bar',
        status: 'completed',
        notes: 'Test CSV import'
      }
    ];

    const importResponse = await fetch(`${API_BASE}/shifts/import-csv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ csvData })
    });

    const importResult = await importResponse.json();
    console.log('CSV Import Response Status:', importResponse.status);
    console.log('CSV Import Response Body:', JSON.stringify(importResult, null, 2));

    if (importResult.success) {
      console.log('✅ CSV import successful!\n');
    } else {
      console.log('❌ CSV import failed:', importResult.message);
    }

    // Step 5: Verify shifts were created by fetching them
    console.log('5️⃣ Fetching shifts to verify...');
    const shiftsResponse = await fetch(`${API_BASE}/shifts`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const shiftsResult = await shiftsResponse.json();
    console.log('Shifts count:', shiftsResult.shifts?.length || 0);

    console.log('\n🎉 API Test Complete!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testShiftAPI();