// Script to set analytics webhook URL for production builds
const fs = require('fs');
const path = require('path');

const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwehWvm70jVZA2m5cN2-1TegMSa_NrK34BZQepBtZ8gasXr6S6xoMjnCzAtbKKfoYpxcg/exec';

// Create or update .env.production file
const envContent = `# Analytics webhook configuration
ANALYTICS_WEBHOOK_URL=${WEBHOOK_URL}
`;

try {
  fs.writeFileSync(path.join(__dirname, '..', '.env.production'), envContent);
  console.log('✅ Analytics webhook URL configured successfully!');
  console.log(`📊 Webhook URL: ${WEBHOOK_URL}`);
  console.log('\nYou can now build ShiftMint with analytics support:');
  console.log('  npm run build');
} catch (error) {
  console.error('❌ Failed to set webhook URL:', error);
  console.log('\nPlease manually set the environment variable:');
  console.log(`  ANALYTICS_WEBHOOK_URL="${WEBHOOK_URL}"`);
}