// Test CSV Export in Browser Console
// Copy and paste this into the browser console to test CSV generation

console.log('=== TESTING CSV EXPORT ===');

// Create test payroll data
const testPayrollData = [{
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-01-14'),
    periodStatus: 'closed',
    employeeId: 'emp123',
    employeeName: 'John Doe',
    employeeNumber: 'EMP001',
    employeeEmail: 'john@example.com',
    employeePhone: '555-1234',
    employeeDepartment: 'Kitchen',
    employeeRole: 'Cook',
    employeeStatus: 'active',
    hourlyRate: 20.00,
    overtimeRate: 30.00,
    payType: 'hourly',
    regularHours: 40,
    overtimeHours: 5,
    totalHours: 45,
    regularPay: 800.00,
    overtimePay: 150.00,
    grossPay: 950.00,
    totalTips: 100.00,
    totalTaxes: 209.00,
    taxRate: '22.00%',
    netPay: 841.00,
    tipEligible: 'Yes',
    taxExemptions: 2,
    startDate: new Date('2023-06-01'),
    notes: 'Test employee',
    effectiveHourlyRate: 21.11,
    totalCompensation: 841.00
}];

console.log('Test data created with', Object.keys(testPayrollData[0]).length, 'fields');
console.log('Field names:', Object.keys(testPayrollData[0]));

// Define the payroll fields (same as in the app)
const payrollFields = [
    { key: 'periodStart', display: 'Period Start Date' },
    { key: 'periodEnd', display: 'Period End Date' },
    { key: 'periodStatus', display: 'Period Status' },
    { key: 'employeeId', display: 'Employee ID' },
    { key: 'employeeName', display: 'Employee Name' },
    { key: 'employeeNumber', display: 'Employee Number' },
    { key: 'employeeEmail', display: 'Email' },
    { key: 'employeePhone', display: 'Phone' },
    { key: 'employeeDepartment', display: 'Department' },
    { key: 'employeeRole', display: 'Role' },
    { key: 'employeeStatus', display: 'Employment Status' },
    { key: 'hourlyRate', display: 'Hourly Rate' },
    { key: 'overtimeRate', display: 'Overtime Rate' },
    { key: 'payType', display: 'Pay Type' },
    { key: 'regularHours', display: 'Regular Hours' },
    { key: 'overtimeHours', display: 'Overtime Hours' },
    { key: 'totalHours', display: 'Total Hours' },
    { key: 'regularPay', display: 'Regular Pay' },
    { key: 'overtimePay', display: 'Overtime Pay' },
    { key: 'grossPay', display: 'Gross Pay' },
    { key: 'totalTips', display: 'Total Tips' },
    { key: 'totalTaxes', display: 'Total Taxes' },
    { key: 'taxRate', display: 'Tax Rate' },
    { key: 'netPay', display: 'Net Pay' },
    { key: 'tipEligible', display: 'Tip Eligible' },
    { key: 'taxExemptions', display: 'Tax Exemptions' },
    { key: 'startDate', display: 'Start Date' },
    { key: 'notes', display: 'Notes' },
    { key: 'effectiveHourlyRate', display: 'Effective Hourly Rate' },
    { key: 'totalCompensation', display: 'Total Compensation' }
];

console.log('Expected fields:', payrollFields.length);

// Generate CSV headers
const csvHeaders = payrollFields.map(field => field.display).join(',');
console.log('CSV Headers:', csvHeaders);

// Generate CSV row
const csvRow = payrollFields.map(field => {
    let value = testPayrollData[0][field.key];
    
    if (value === null || value === undefined || value === '') {
        if (['notes', 'employeeName', 'employeeNumber', 'employeeEmail', 'employeePhone', 
             'employeeDepartment', 'employeeRole', 'employeeStatus', 'payType', 
             'tipEligible', 'periodStatus', 'taxRate'].includes(field.key)) {
            return '';
        }
        return '0';
    }
    
    // Format dates
    if (field.key.includes('Date') || field.key === 'periodStart' || field.key === 'periodEnd' || field.key === 'startDate') {
        if (value instanceof Date) {
            value = value.toISOString().split('T')[0];
        } else if (typeof value === 'string' && value.includes('T')) {
            value = value.split('T')[0];
        }
    }
    // Format currency values
    else if (field.key.includes('Pay') || field.key.includes('Rate') || 
             field.key.includes('Tips') || field.key.includes('Taxes') || 
             field.key.includes('Compensation') || field.key === 'effectiveHourlyRate') {
        if (typeof value === 'number') {
            value = value.toFixed(2);
        }
    }
    // Format hours
    else if (field.key.includes('Hours')) {
        if (typeof value === 'number') {
            value = value.toFixed(2);
        }
    }
    
    // Escape if needed
    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    
    return value;
}).join(',');

console.log('CSV Row:', csvRow);

// Create full CSV
const fullCSV = csvHeaders + '\n' + csvRow;
const columnCount = csvHeaders.split(',').length;
const rowColumnCount = csvRow.split(',').length;

console.log('=== RESULTS ===');
console.log('Header columns:', columnCount);
console.log('Row columns:', rowColumnCount);
console.log('Expected: 30 columns');

if (columnCount === 30 && rowColumnCount === 30) {
    console.log('✅ SUCCESS: CSV has correct number of columns!');
} else {
    console.error('❌ FAILED: Column count mismatch!');
}

// Test download
function downloadTestCSV() {
    const blob = new Blob([fullCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'test-payroll-30-columns.csv';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('✅ Test CSV downloaded as test-payroll-30-columns.csv');
}

console.log('Run downloadTestCSV() to download a test file with 30 columns');

// Make function available globally
window.downloadTestCSV = downloadTestCSV;