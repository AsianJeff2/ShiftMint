// Test script for ShiftMint Analytics Webhook
const axios = require('axios');

const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwehWvm70jVZA2m5cN2-1TegMSa_NrK34BZQepBtZ8gasXr6S6xoMjnCzAtbKKfoYpxcg/exec';

async function testWebhook() {
  console.log('🧪 Testing ShiftMint Analytics Webhook...\n');
  console.log(`📍 Webhook URL: ${WEBHOOK_URL}\n`);

  const testData = {
    source: 'shiftmint-desktop',
    version: '2.0.0',
    data: [{
      timestamp: new Date().toISOString(),
      device_id: 'test-device-001',
      app_version: '2.0.0',
      customersServed: 150,
      shiftsLogged: 45,
      payrollReportsCreated: 2,
      totalCashflowManaged: 35000.50,
      businessType: 'restaurant',
      posSystem: 'square',
      platform: 'test-platform',
      daysActive: 15,
      recentlyActive: true,
      totalEmployees: 12,
      activeEmployees: 10
    }]
  };

  try {
    console.log('📤 Sending test data...');
    console.log('Data being sent:', JSON.stringify(testData.data[0], null, 2));
    
    const response = await axios.post(WEBHOOK_URL, testData, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ShiftMint/2.0.0-test'
      },
      timeout: 30000
    });

    console.log('\n✅ SUCCESS! Webhook responded with:');
    console.log(response.data);
    console.log('\n🎉 Your webhook is working correctly!');
    console.log('📊 Check your Google Sheet - you should see the test data.');
    
  } catch (error) {
    console.error('\n❌ ERROR: Webhook test failed');
    if (error.response) {
      console.error('Response error:', error.response.data);
      console.error('Status code:', error.response.status);
    } else if (error.request) {
      console.error('No response received. Check your internet connection.');
    } else {
      console.error('Error:', error.message);
    }
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Ensure the Google Apps Script is deployed as a Web App');
    console.log('2. Check that "Anyone" has access to the web app');
    console.log('3. Verify the webhook URL is correct');
    console.log('4. Check the Google Apps Script logs for errors');
  }
}

// Run the test
testWebhook();