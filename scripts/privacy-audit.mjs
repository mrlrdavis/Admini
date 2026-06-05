import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const scanRoots = ['apps', 'packages', 'workers', 'shared'];
const ignoredDirs = new Set(['node_modules', 'dist', '.git', '.netlify', '.wrangler']);

const checks = [
  {
    name: 'No Web Storage',
    pattern: /\b(?:localStorage|sessionStorage)\b/,
    message: 'Use IndexedDB or Supabase-backed state instead of Web Storage.'
  },
  {
    name: 'No direct Anthropic API calls',
    pattern: /api\.anthropic\.com/,
    message: 'All AI calls must go through the Cloudflare Worker and privacy layer.'
  },
  {
    name: 'No production console.log',
    pattern: /\bconsole\.log\s*\(/,
    message: 'Use Sentry or structured Worker observability instead of console.log.'
  }
];

const files = [];

for (const scanRoot of scanRoots) {
  collect(join(root, scanRoot));
}

const failures = [];

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const check of checks) {
    if (check.pattern.test(text)) {
      failures.push({ check: check.name, file: relative(root, file), message: check.message });
    }
  }
}

if (failures.length) {
  process.stderr.write('AdminI privacy audit failed:\n');
  for (const failure of failures) {
    process.stderr.write(`- ${failure.check}: ${failure.file} — ${failure.message}\n`);
  }
  process.exit(1);
}

process.stdout.write(`AdminI privacy audit passed for ${files.length} files.\n`);

function collect(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (ignoredDirs.has(entry)) continue;
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      collect(path);
    } else if (/\.(?:ts|tsx|js|jsx|mjs|html|css)$/.test(entry)) {
      files.push(path);
    }
  }
}
