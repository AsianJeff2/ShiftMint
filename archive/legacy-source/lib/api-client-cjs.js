const fetch = require('node-fetch'); // Correctly require the CJS-compatible version

// This is a CommonJS version of the ApiClient for use in scripts.
const API_BASE_URL = 'http://localhost:3001/api';

class ApiClient {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.token = null;
  }

  setToken(token) {
    this.token = token;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    console.log(`SCRIPT Making Request: ${options.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = new Error(`HTTP error! status: ${response.status}`);
      try {
        error.response = await response.json();
      } catch (e) {
        error.response = await response.text();
      }
      throw error;
    }

    return response.json();
  }

  importEmployeesFromCSV(csvData) {
    return this.request('/employees/import-csv', {
      method: 'POST',
      body: JSON.stringify({ csvData }),
    });
  }
}

module.exports = new ApiClient();
