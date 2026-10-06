import { logger } from '../../../lib/infrastructure/Logger';
import { createHash } from 'crypto';
import { platform, hostname, cpus, networkInterfaces } from 'os';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getDataDirectory } from '../database';

// Generate a stable device ID based on system characteristics
function generateDeviceId(): string {
  try {
    // Collect stable system information
    const systemInfo = {
      platform: platform(),
      hostname: hostname(),
      cpuModel: cpus()[0]?.model || 'unknown',
      cpuCores: cpus().length,
      // Get MAC addresses of network interfaces (stable across reboots)
      macAddresses: Object.values(networkInterfaces())
        .flat()
        .filter(iface => iface && !iface.internal && iface.mac)
        .map(iface => iface!.mac)
        .sort()
        .join('-')
    };
    
    // Create a hash from the system info
    const hash = createHash('sha256');
    hash.update(JSON.stringify(systemInfo));
    return hash.digest('hex').substring(0, 16);
  } catch (error) {
    logger.error('Failed to generate device ID from system info:', error);
    // Fallback to random ID if system info fails
    return createHash('sha256')
      .update(Math.random().toString() + Date.now().toString())
      .digest('hex')
      .substring(0, 16);
  }
}

// Get or create a persistent device ID
export function getDeviceId(): string {
  try {
    // Try to read existing device ID from file
    const deviceIdPath = join(getDataDirectory(), '.device-id');
    
    if (existsSync(deviceIdPath)) {
      const savedId = readFileSync(deviceIdPath, 'utf-8').trim();
      if (savedId && savedId.length === 16) {
        return savedId;
      }
    }
    
    // Generate new device ID
    const newDeviceId = generateDeviceId();
    
    // Save it for future use
    try {
      writeFileSync(deviceIdPath, newDeviceId, 'utf-8');
    } catch (writeError) {
      logger.error('Failed to save device ID:', writeError);
    }
    
    return newDeviceId;
  } catch (error) {
    logger.error('Failed to get device ID:', error);
    // Return a stable fallback ID
    return 'fallback-device-id';
  }
}

// Get anonymized device info for analytics
export function getDeviceInfo() {
  return {
    platform: platform(),
    platformVersion: process.platform,
    nodeVersion: process.version,
    electronVersion: process.versions.electron || 'unknown',
    arch: process.arch,
    cpuCores: cpus().length,
  };
}