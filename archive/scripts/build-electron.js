const { build } = require('electron-builder')
const path = require('path')

const buildElectron = async () => {
  try {
    console.log('Building Electron application...')
    
    const config = {
      appId: 'com.shiftmint.desktop',
      productName: 'ShiftMint',
      directories: {
        output: 'dist-installer'
      },
      files: [
        'dist/**/*',
        'dist-electron/**/*',
        'package.json',
        'prisma/schema.prisma',
        {
          from: 'node_modules/@prisma/client/',
          to: 'node_modules/@prisma/client/',
          filter: ['**/*']
        },
        {
          from: 'node_modules/.prisma/',
          to: 'node_modules/.prisma/',
          filter: ['**/*']
        },
        {
          from: 'node_modules/prisma/',
          to: 'node_modules/prisma/',
          filter: ['**/*']
        }
      ],
      extraResources: [
        {
          from: 'prisma/schema.prisma',
          to: 'prisma/schema.prisma'
        }
      ],
      mac: {
        category: 'public.app-category.business',
        target: {
          target: 'dmg',
          arch: ['x64', 'arm64']
        },
        icon: 'assets/icon.icns'
      },
      win: {
        target: 'nsis',
        publisherName: 'ShiftMint LLC',
        icon: 'assets/icon.ico.ico'
      },
      linux: {
        category: 'Office',
        target: 'AppImage',
        icon: 'assets/icon.png.png'
      },
      nsis: {
        oneClick: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true
      }
    }
    
    await build({
      config,
      publish: 'never'
    })
    
    console.log('✅ Electron build completed successfully!')
    console.log('📦 Installers created in dist-installer/')
    
  } catch (error) {
    console.error('❌ Electron build failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  buildElectron()
}

module.exports = buildElectron 