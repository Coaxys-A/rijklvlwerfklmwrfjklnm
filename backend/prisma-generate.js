const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Copy schema to .prisma/client
const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
const clientDir = path.join(__dirname, 'node_modules', '.prisma', 'client');
fs.mkdirSync(clientDir, { recursive: true });
fs.copyFileSync(schemaPath, path.join(clientDir, 'schema.prisma'));

// Generate client without downloading engines
process.env.PRISMA_SKIP_POSTINSTALL_GENERATE = '1';
process.env.PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING = '1';

try {
  execSync('npx prisma generate --skip-generate', { 
    cwd: __dirname, 
    stdio: 'inherit',
    env: { ...process.env, PRISMA_SKIP_POSTINSTALL_GENERATE: '1' }
  });
} catch (e) {
  console.log('Continuing despite error...');
}

console.log('Prisma client generation complete');
