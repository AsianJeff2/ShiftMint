# ShiftMint Analytics Webhook Setup Guide

## Overview
This guide will help you set up a Google Sheets webhook to receive analytics data from ShiftMint users who opt-in to data collection.

## Step 1: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet named "ShiftMint Analytics"
3. In the first row, add these column headers:
   - A1: `timestamp`
   - B1: `device_id`
   - C1: `app_version`
   - D1: `customers_served`
   - E1: `shifts_logged`
   - F1: `payroll_reports_created`
   - G1: `total_cashflow_managed`
   - H1: `business_type`
   - I1: `pos_system`
   - J1: `platform`
   - K1: `days_active`
   - L1: `recently_active`
   - M1: `total_employees`
   - N1: `active_employees`

## Step 2: Create Google Apps Script

1. In your Google Sheet, go to **Extensions → Apps Script**
2. Delete any existing code and paste the following:

```javascript
// ShiftMint Analytics Webhook
// This script receives analytics data from ShiftMint desktop applications

function doPost(e) {
  try {
    // Parse the incoming data
    const data = JSON.parse(e.postData.contents);
    
    // Get the active spreadsheet
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Process each analytics entry
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach(entry => {
        // Create a row with the analytics data
        const row = [
          new Date().toISOString(), // timestamp
          entry.device_id || 'unknown',
          entry.app_version || 'unknown',
          entry.customersServed || 0,
          entry.shiftsLogged || 0,
          entry.payrollReportsCreated || 0,
          entry.totalCashflowManaged || 0,
          entry.businessType || 'not_specified',
          entry.posSystem || 'not_specified',
          entry.platform || 'unknown',
          entry.daysActive || 0,
          entry.recentlyActive || false,
          entry.totalEmployees || 0,
          entry.activeEmployees || 0
        ];
        
        // Append the row to the sheet
        sheet.appendRow(row);
      });
    }
    
    // Log the event
    console.log(`Received ${data.data ? data.data.length : 0} analytics entries`);
    
    // Return success response
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: 'Analytics data received',
        entriesProcessed: data.data ? data.data.length : 0
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // Log error
    console.error('Error processing analytics data:', error);
    
    // Return error response
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Test function to verify the script is working
function testWebhook() {
  const testData = {
    data: [{
      device_id: 'test-device',
      app_version: '2.0.0',
      customersServed: 100,
      shiftsLogged: 50,
      payrollReportsCreated: 4,
      totalCashflowManaged: 25000,
      businessType: 'restaurant',
      platform: 'win32',
      daysActive: 30,
      recentlyActive: true,
      totalEmployees: 10,
      activeEmployees: 8
    }]
  };
  
  // Simulate a POST request
  const e = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  const result = doPost(e);
  console.log(result.getContent());
}
```

3. Save the script (Ctrl+S or Cmd+S)
4. Name it "ShiftMint Analytics Webhook"

## Step 3: Deploy as Web App

1. Click **Deploy → New Deployment**
2. Configure the deployment:
   - **Type**: Web app
   - **Description**: ShiftMint Analytics Webhook
   - **Execute as**: Me
   - **Who has access**: Anyone
3. Click **Deploy**
4. **Copy the Web app URL** - it will look like:
   ```
   https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
   ```

## Step 4: Configure ShiftMint

1. Set the webhook URL as an environment variable when running ShiftMint:
   ```bash
   ANALYTICS_WEBHOOK_URL="https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec" npm run dev
   ```

2. Or add it to your `.env` file:
   ```
   ANALYTICS_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
   ```

## Step 5: Test the Integration

1. In the Google Apps Script editor, run the `testWebhook()` function
2. Check your Google Sheet - you should see a test entry
3. In ShiftMint, enable analytics and click "Transmit Data" to test the live integration

## Data Analysis Tips

### Creating Charts
1. Select your data range
2. Insert → Chart
3. Recommended charts:
   - Line chart for trends over time
   - Pie chart for business types
   - Bar chart for platform distribution

### Useful Formulas
- Average customers per user: `=AVERAGE(D:D)`
- Total cashflow across all users: `=SUM(G:G)`
- Active user percentage: `=COUNTIF(L:L,TRUE)/COUNTA(L:L)*100`

### Creating a Dashboard
1. Create a new sheet named "Dashboard"
2. Use `QUERY()` function to aggregate data:
   ```
   =QUERY(Sheet1!A:N, "SELECT AVG(D), AVG(E), SUM(G) WHERE A IS NOT NULL")
   ```

## Privacy & Security Notes

- The webhook accepts data from anyone who has the URL
- No personal or financial data is transmitted
- All data is anonymous and aggregated
- Consider restricting access if needed for additional security

## Troubleshooting

### No data appearing in sheet
1. Check Apps Script executions log
2. Verify webhook URL is correct in ShiftMint
3. Ensure analytics is enabled in ShiftMint

### Permission errors
1. Re-deploy the web app
2. Ensure "Anyone" has access
3. Check Google account permissions

## Support

For issues with the analytics system, please check:
1. ShiftMint logs for transmission errors
2. Google Apps Script logs for webhook errors
3. Local analytics export files if transmission fails