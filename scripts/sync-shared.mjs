#!/usr/bin/env node

/**
 * sync-shared.mjs — Syncs shared/scripts/* files into every standalone skill's scripts/ directory.
 *
 * Usage:
 *   node scripts/sync-shared.mjs          Copy shared scripts into each skill
 *   node scripts/sync-shared.mjs --check  Verify every skill copy matches shared/scripts/* (exit 1 on drift)
 *   node scripts/sync-shared.mjs --help   Show help message
 */

import { readdir, readFile, copyFile, mkdir } from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const DEFAULT_REPO_ROOT = resolve(__dirname, '..');
export const TARGET_SKILLS = [
  'anti-slop-design',
  'security-audit',
  'seo-audit',
  'web-best-practices',
];

function printHelp() {
  console.log(`sync-shared.mjs — Sync shared scripts into standalone skills

Usage:
  node scripts/sync-shared.mjs [options]

Options:
  --check, -c   Verify copies match shared/scripts/* without modifying files
  --root <dir>  Repository root directory (default: repo root)
  --help, -h    Show this help message
`);
}

export async function getSharedScriptFiles(repoRoot = DEFAULT_REPO_ROOT) {
  const sharedDir = join(repoRoot, 'shared', 'scripts');
  const entries = await readdir(sharedDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

export async function syncSharedScripts(repoRoot = DEFAULT_REPO_ROOT) {
  const sharedDir = join(repoRoot, 'shared', 'scripts');
  const files = await getSharedScriptFiles(repoRoot);
  const copied = [];

  for (const skill of TARGET_SKILLS) {
    const destDir = join(repoRoot, skill, 'scripts');
    await mkdir(destDir, { recursive: true });
    for (const file of files) {
      const srcPath = join(sharedDir, file);
      const destPath = join(destDir, file);
      await copyFile(srcPath, destPath);
      copied.push({ skill, file, srcPath, destPath });
    }
  }

  return { files, copied };
}

export async function checkSharedSync(repoRoot = DEFAULT_REPO_ROOT) {
  const sharedDir = join(repoRoot, 'shared', 'scripts');
  const files = await getSharedScriptFiles(repoRoot);
  const mismatches = [];

  for (const file of files) {
    const srcPath = join(sharedDir, file);
    const srcBuf = await readFile(srcPath);

    for (const skill of TARGET_SKILLS) {
      const destPath = join(repoRoot, skill, 'scripts', file);
      if (!existsSync(destPath)) {
        mismatches.push({ skill, file, reason: 'missing', destPath });
        continue;
      }
      const destBuf = await readFile(destPath);
      if (!srcBuf.equals(destBuf)) {
        mismatches.push({ skill, file, reason: 'differs', destPath });
      }
    }
  }

  return { inSync: mismatches.length === 0, files, mismatches };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  let checkOnly = false;
  let repoRoot = DEFAULT_REPO_ROOT;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check' || args[i] === '-c') {
      checkOnly = true;
    } else if (args[i] === '--root') {
      if (!args[i + 1]) {
        console.error(JSON.stringify({ error: '--root requires a directory path' }));
        process.exit(2);
      }
      repoRoot = resolve(args[++i]);
    }
  }

  if (checkOnly) {
    const result = await checkSharedSync(repoRoot);
    if (!result.inSync) {
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }
    console.log(JSON.stringify({ inSync: true, files: result.files, skills: TARGET_SKILLS }, null, 2));
    process.exit(0);
  }

  const result = await syncSharedScripts(repoRoot);
  console.log(JSON.stringify({
    synced: true,
    files: result.files,
    skills: TARGET_SKILLS,
    total_copied: result.copied.length,
  }, null, 2));
}

function isCliEntrypoint() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(__filename);
  } catch {
    return resolve(process.argv[1]) === __filename;
  }
}

if (isCliEntrypoint()) {
  main().catch((err) => {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(2);
  });
}
