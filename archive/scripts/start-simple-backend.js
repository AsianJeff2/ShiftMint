const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Fast middleware
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json({ limit: '1mb' }));

// Quick health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend running fast!' });
});

// Quick auth endpoints
app.get('/api/auth/setup', (req, res) => {
  res.json({ needsSetup: true });
});

app.post('/api/auth/setup', (req, res) => {
  res.json({ 
    user: { id: '1', email: req.body.email, firstName: req.body.firstName, lastName: req.body.lastName },
    token: 'test-token'
  });
});

app.post('/api/auth/login', (req, res) => {
  res.json({
    user: { id: '1', email: req.body.email, firstName: 'Test', lastName: 'User' },
    token: 'test-token'
  });
});

app.get('/api/auth/me', (req, res) => {
  res.json({
    user: { id: '1', email: 'test@example.com', firstName: 'Test', lastName: 'User' }
  });
});

// Start server with quick timeout
const server = app.listen(PORT, 'localhost', () => {
  console.log(`⚡ Fast backend running on http://localhost:${PORT}`);
});

// Set quick timeouts
server.keepAliveTimeout = 1000;
server.headersTimeout = 1100;

module.exports = { app }; 