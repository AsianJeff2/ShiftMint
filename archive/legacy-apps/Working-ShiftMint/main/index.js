const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const express = require('express');

let mainWindow;
let server;

// Simple Express server for API
function startServer() {
  const app = express();
  const port = 3001;
  
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'dist')));
  
  // API endpoints for ShiftMint functionality
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'ShiftMint is running!' });
  });
  
  // Setup status check - multiple endpoints for compatibility
  app.get('/api/setup', (req, res) => {
    res.json({ 
      needsSetup: true,
      message: 'Welcome to ShiftMint! Complete setup to begin.'
    });
  });

  app.get('/api/auth/setup', (req, res) => {
    res.json({ 
      needsSetup: true,
      message: 'Welcome to ShiftMint! Complete setup to begin.'
    });
  });

  // Setup endpoint - creates business and user (multiple paths for compatibility)
  app.post('/api/setup', (req, res) => {
    console.log('📝 Setup request received:', req.body);
    
    const { email, password, firstName, lastName, businessName } = req.body;
    
    // Simulate successful setup
    const user = {
      id: 'user_' + Date.now(),
      email: email,
      firstName: firstName,
      lastName: lastName,
      role: 'owner',
      businessId: 'business_' + Date.now()
    };
    
    const token = 'token_' + Math.random().toString(36).substring(2);
    
    console.log('✅ Setup completed for:', user);
    
    res.json({
      success: true,
      user: user,
      token: token,
      business: {
        id: user.businessId,
        name: businessName,
        type: 'restaurant'
      }
    });
  });

  // Setup endpoint - alternative path for compatibility
  app.post('/api/auth/setup', (req, res) => {
    console.log('📝 Setup request received (auth path):', req.body);
    
    const { email, password, firstName, lastName, businessName } = req.body;
    
    // Simulate successful setup
    const user = {
      id: 'user_' + Date.now(),
      email: email,
      firstName: firstName,
      lastName: lastName,
      role: 'owner',
      businessId: 'business_' + Date.now()
    };
    
    const token = 'token_' + Math.random().toString(36).substring(2);
    
    console.log('✅ Setup completed for:', user);
    
    res.json({
      success: true,
      user: user,
      token: token,
      business: {
        id: user.businessId,
        name: businessName,
        type: 'restaurant'
      }
    });
  });

  // Login endpoint
  app.post('/api/login', (req, res) => {
    console.log('🔑 Login request received:', req.body);
    
    const { email, password } = req.body;
    
    // Simulate successful login
    const user = {
      id: 'user_existing',
      email: email,
      firstName: 'Demo',
      lastName: 'User',
      role: 'owner',
      businessId: 'business_demo'
    };
    
    const token = 'token_' + Math.random().toString(36).substring(2);
    
    console.log('✅ Login successful for:', user);
    
    res.json({
      success: true,
      user: user,
      token: token
    });
  });

  // Get current user endpoint
  app.get('/api/user', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }
    
    // Simulate getting current user
    const user = {
      id: 'user_current',
      email: 'demo@shiftmint.com',
      firstName: 'Demo',
      lastName: 'User',
      role: 'owner',
      businessId: 'business_demo'
    };
    
    console.log('👤 Current user request:', user);
    
    res.json({
      success: true,
      user: user
    });
  });

  // Additional endpoints for basic functionality
  app.get('/api/employees', (req, res) => {
    res.json([]);
  });

  app.get('/api/shifts', (req, res) => {
    res.json([]);
  });

  app.get('/api/tips', (req, res) => {
    res.json([]);
  });

  app.get('/api/payroll/periods', (req, res) => {
    res.json([]);
  });
  
  // Serve frontend for all other routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
  
  server = app.listen(port, () => {
    console.log(`✅ ShiftMint server running at http://localhost:${port}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,  // Disable web security for local development
      allowRunningInsecureContent: true,  // Allow HTTP content
      experimentalFeatures: true
    },
    title: 'ShiftMint - Restaurant Payroll OS'
  });

  // Add request logging to debug SSL issues
  mainWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    console.log('🌐 Request:', details.method, details.url);
    callback({ cancel: false });
  });

  // Handle certificate errors (ignore them for local development)
  mainWindow.webContents.session.setCertificateVerifyProc((request, callback) => {
    console.log('🔒 Certificate verification for:', request.hostname);
    // Always allow certificates for localhost
    if (request.hostname === 'localhost' || request.hostname === '127.0.0.1') {
      callback(0); // 0 means success
    } else {
      callback(-2); // -2 means use default verification
    }
  });

  // Load the app
  mainWindow.loadURL('http://localhost:3001');
  
  // Open DevTools for debugging
  mainWindow.webContents.openDevTools();
  
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (server) {
      server.close();
    }
  });
}

// Disable certificate error warnings
app.commandLine.appendSwitch('--ignore-certificate-errors');
app.commandLine.appendSwitch('--ignore-ssl-errors');
app.commandLine.appendSwitch('--ignore-certificate-errors-spki-list');
app.commandLine.appendSwitch('--disable-web-security');

// App event listeners
app.whenReady().then(() => {
  console.log('🚀 Starting ShiftMint Desktop...');
  startServer();
  
  setTimeout(() => {
    createWindow();
    console.log('✅ ShiftMint Desktop is ready!');
  }, 1000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

console.log('🍽️ ShiftMint Desktop Application Starting...');