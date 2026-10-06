const { initializeDatabase } = require('../electron/backend/database');
const { startBackendServer } = require('../electron/backend/server');

async function startBackend() {
  try {
    console.log('🔧 Initializing database...');
    await initializeDatabase();
    
    console.log('🚀 Starting backend server...');
    await startBackendServer();
    
    console.log('✅ Backend server started successfully!');
  } catch (error) {
    console.error('❌ Failed to start backend:', error);
    process.exit(1);
  }
}

startBackend(); 