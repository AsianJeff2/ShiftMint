const { PrismaClient } = require('@prisma/client')
const path = require('path')
const fs = require('fs')
const os = require('os')

// Get platform-specific data directory
const getDataDirectory = () => {
  const platform = process.platform
  
  if (platform === 'darwin') {
    // macOS: ~/Library/Application Support/ShiftMint/
    return path.join(os.homedir(), 'Library', 'Application Support', 'ShiftMint')
  } else if (platform === 'win32') {
    // Windows: %APPDATA%/ShiftMint/
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
    return path.join(appData, 'ShiftMint')
  } else {
    // Linux: ~/.shiftmint/
    return path.join(os.homedir(), '.shiftmint')
  }
}

const initDatabase = async () => {
  try {
    console.log('Initializing ShiftMint database...')
    
    const dataDir = getDataDirectory()
    
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
      console.log(`Created data directory: ${dataDir}`)
    }
    
    // Ensure logs directory exists
    const logsDir = path.join(dataDir, 'logs')
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true })
      console.log(`Created logs directory: ${logsDir}`)
    }
    
    const dbPath = path.join(dataDir, 'shiftmint.db')
    
    // Set the DATABASE_URL environment variable
    process.env.DATABASE_URL = `file:${dbPath}`
    
    // Initialize Prisma client
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    })
    
    // Test the connection
    await prisma.$connect()
    console.log(`Database connected successfully: ${dbPath}`)
    
    // Check if database is empty (first run)
    const userCount = await prisma.user.count()
    
    if (userCount === 0) {
      console.log('Fresh installation detected.')
      
      // Create default app settings
      const defaultSettings = [
        { key: 'app_version', value: '2.0.0' },
        { key: 'first_run', value: 'true' },
        { key: 'install_date', value: new Date().toISOString() },
        { key: 'analytics_enabled', value: 'false' },
        { key: 'backup_enabled', value: 'true' },
        { key: 'backup_frequency', value: 'weekly' }
      ]
      
      for (const setting of defaultSettings) {
        await prisma.appSetting.upsert({
          where: { key: setting.key },
          update: { value: setting.value },
          create: {
            key: setting.key,
            value: setting.value
          }
        })
      }
      
      console.log('Default settings created.')
    } else {
      console.log(`Existing installation found with ${userCount} user(s).`)
    }
    
    await prisma.$disconnect()
    console.log('Database initialization completed successfully!')
    
  } catch (error) {
    console.error('Database initialization failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  initDatabase()
}

module.exports = { initDatabase, getDataDirectory } 