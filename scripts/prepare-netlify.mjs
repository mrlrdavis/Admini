import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const publishRoot = join(root, 'dist', 'netlify');
mkdirSync(publishRoot, { recursive: true });

for (const app of ['desktop', 'mobile']) {
  const appDist = join(root, 'dist', 'netlify', app);
  if (!existsSync(appDist)) {
    throw new Error(`Expected ${app} build output at ${appDist}`);
  }
}

cpSync(join(root, 'dist', 'netlify', 'desktop', 'index.html'), join(publishRoot, 'index.html'));
