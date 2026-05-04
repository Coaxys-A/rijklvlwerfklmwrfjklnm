import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const hasMigrations = existsSync(new URL('../prisma/migrations', import.meta.url));
const args = hasMigrations
  ? ['prisma', 'migrate', 'deploy']
  : ['prisma', 'db', 'push', '--skip-generate'];

const result = spawnSync('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(result.status ?? 1);
