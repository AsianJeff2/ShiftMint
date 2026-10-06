// Standalone backend server for development testing
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Simple health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'ShiftMint Backend Server is running',
    timestamp: new Date().toISOString()
  });
});

// Simple setup check endpoint  
app.get('/api/auth/setup', (req, res) => {
  res.json({ needsSetup: true });
});

// Start server
app.listen(PORT, 'localhost', () => {
  console.log(`🚀 ShiftMint Standalone Backend running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = { app }; 