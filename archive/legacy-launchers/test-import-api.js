const apiClient = require('./lib/api-client-cjs'); // Using a CJS version for simplicity in a script

const testImport = async () => {
  console.log('--- Starting API Test: Employee CSV Import ---');

  const csvData = [
    {
      firstName: 'Test',
      lastName: 'Employee',
      email: `test.${Date.now()}@example.com`,
      hourlyRate: '25.50',
      role: 'tester',
    },
  ];

  try {
    // Manually set a token for testing. In a real scenario, this would be retrieved after login.
    // This is a placeholder; I'll need to get a real one.
    const token = "placeholder-token";
    apiClient.setToken(token);

    console.log('Sending request to /api/employees/import-csv with data:');
    console.log(JSON.stringify(csvData, null, 2));

    const result = await apiClient.importEmployeesFromCSV(csvData);
    
    console.log('--- TEST PASSED ---');
    console.log('API Response:', result);
  } catch (error) {
    console.error('--- TEST FAILED ---');
    console.error('An error occurred during the API call:');
    // Log the full error object to see all details
    console.error(error);
  }
};

testImport();
