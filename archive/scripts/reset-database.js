const { PrismaClient } = require('@prisma/client')
const path = require('path')
const fs = require('fs')
const os = require('os')

// Get platform-specific data directory
const getDataDirectory = () => {
  const platform = process.platform
  
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'ShiftMint')
  } else if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
    return path.join(appData, 'ShiftMint')
  } else {
    return path.join(os.homedir(), '.shiftmint')
  }
}

const resetDatabase = async () => {
  try {
    console.log('🔄 Resetting ShiftMint database...')
    
    const dataDir = getDataDirectory()
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
    
    await prisma.$connect()
    console.log(`📍 Connected to database: ${dbPath}`)
    
    // Delete all data in reverse order of dependencies
    console.log('🗑️  Clearing all data...')
    
    await prisma.analyticsEntry.deleteMany({})
    await prisma.auditLog.deleteMany({})
    await prisma.punchEvent.deleteMany({})
    await prisma.payrollEntry.deleteMany({})
    await prisma.payrollPeriod.deleteMany({})
    await prisma.tipEntry.deleteMany({})
    await prisma.shift.deleteMany({})
    await prisma.businessConfiguration.deleteMany({})
    await prisma.employee.deleteMany({})
    await prisma.user.deleteMany({})
    await prisma.business.deleteMany({})
    await prisma.appSetting.deleteMany({})
    
    console.log('✅ All data cleared')
    
    // Recreate default app settings
    const defaultSettings = [
      { key: 'app_version', value: '2.0.0' },
      { key: 'first_run', value: 'true' },
      { key: 'install_date', value: new Date().toISOString() },
      { key: 'analytics_enabled', value: 'false' },
      { key: 'backup_enabled', value: 'true' },
      { key: 'backup_frequency', value: 'weekly' }
    ]
    
    for (const setting of defaultSettings) {
      await prisma.appSetting.create({
        data: {
          key: setting.key,
          value: setting.value
        }
      })
    }
    
    console.log('✅ Default settings recreated')
    
    await prisma.$disconnect()
    console.log('🎉 Database reset completed successfully!')
    console.log('💡 You can now run the setup process again.')
    
  } catch (error) {
    console.error('❌ Database reset failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  resetDatabase()
}

module.exports = { resetDatabase }