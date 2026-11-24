#!/usr/bin/env node

/**
 * check-secrets.mjs — Zero-dependency secret scanner
 *
 * Scans a directory tree for accidentally committed secrets.
 *
 * Usage:  node check-secrets.mjs [directory]
 * Output: JSON array of findings to stdout. Exit 0 = clean, 1 = findings, 2 = error.
 *
 * Skips: node_modules, .git, __pycache__, binary files, lockfiles, images.
 */

import { readdir, readFile, stat, access } from 'node:fs/promises';
import { join, extname, basename, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', '.venv', 'venv', 'dist', 'build', '.next', '.nuxt']);
const SKIP_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp4', '.mp3', '.zip', '.tar', '.gz', '.lock', '.lockb']);
const MAX_FILE_SIZE = 512 * 1024; // 512 KB

const PATTERNS = [
  // AWS
  { name: 'AWS Access Key',       regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'AWS Secret Key',       regex: /(?:aws_secret_access_key|AWS_SECRET)\s*[=:]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi },
  // OpenAI (all prefixes)
  { name: 'OpenAI API Key',       regex: /sk-(?:proj-|ant-)?[a-zA-Z0-9_-]{20,}/g },
  // Anthropic
  { name: 'Anthropic API Key',    regex: /sk-ant-[a-zA-Z0-9_-]{20,}/g },
  // Google AI
  { name: 'Google API Key',       regex: /AIza[0-9A-Za-z_-]{35}/g },
  // GitHub
  { name: 'GitHub PAT (classic)', regex: /ghp_[a-zA-Z0-9]{36}/g },
  { name: 'GitHub PAT (fine)',    regex: /github_pat_[a-zA-Z0-9_]{22,}/g },
  { name: 'GitHub OAuth',         regex: /gho_[a-zA-Z0-9]{36}/g },
  // Stripe (secret only — pk_live_ is public by design)
  { name: 'Stripe Secret Key',    regex: /sk_live_[a-zA-Z0-9]{24,}/g },
  // Slack
  { name: 'Slack Bot Token',      regex: /xoxb-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24,}/g },
  { name: 'Slack User Token',     regex: /xoxp-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24,}/g },
  // SendGrid
  { name: 'SendGrid API Key',     regex: /SG\.[a-zA-Z0-9_-]{22,}\.[a-zA-Z0-9_-]{22,}/g },
  // Private keys
  { name: 'Private Key Block',    regex: /-----BEGIN\s+(RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
  // Connection strings
  { name: 'Connection String',    regex: /(?:mongodb|postgres|mysql|redis):\/\/[^\s'"]{10,}/gi },
  // Django / Flask / Rails
  { name: 'Secret Key Assign',    regex: /(?:SECRET_KEY|DJANGO_SECRET_KEY|FLASK_SECRET_KEY|Rails\.application\.credentials)\s*[=:]\s*['"][^'"]{8,}['"]/gi },
  // JSON config secrets: "api_key": "value", "password": "value", etc.
  { name: 'JSON Secret Field',    regex: /["'](?:api_key|apiKey|api_secret|apiSecret|password|secret_key|secretKey|auth_token|authToken|access_token|accessToken|private_key|privateKey)["']\s*:\s*["'][^'"]{8,}["']/gi },
  // Generic assignment: password = "value", token = "value" (but NOT env refs)
  { name: 'Generic Secret Assign',regex: /(?:password|secret|token|api_key|apikey|api-key|auth_token)\s*[=:]\s*['"][^'"]{8,}['"]/gi },
  // JWT (compact form)
  { name: 'JWT Token',            regex: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g },
  // Bearer tokens (but skip template vars)
  { name: 'Bearer Token',         regex: /[Bb]earer\s+[a-zA-Z0-9._\-]{20,}/g },
];

const SENSITIVE_FILES = ['.env', '.env.local', '.env.production', '.env.staging', '.env.development'];

const findings = [];
const warnings = [];
let gitignorePatterns = null;

function redact(value) {
  if (value.length <= 10) return '***';
  // Show only first 3 and last 2 characters
  return value.slice(0, 3) + '…' + value.slice(-2);
}

/** Check if a file is git-ignored by running git check-ignore. */
function isGitIgnored(filePath) {
  if (gitignorePatterns === null) return false;
  try {
    execSync(`git check-ignore -q "${filePath}"`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isEnvRef(match) {
  // Skip process.env, os.environ, ${VAR}, $VAR references
  return /process\.env|os\.environ|\$\{?\w+\}?|getenv|env\(|env\[/i.test(match);
}

async function scanFile(filePath) {
  const name = basename(filePath);

  // Only flag sensitive files if they are NOT gitignored (actually committed)
  if (SENSITIVE_FILES.includes(name)) {
    if (!isGitIgnored(filePath)) {
      findings.push({ file: filePath, line: 0, pattern: 'Sensitive file committed', snippet: `File "${name}" found and not in .gitignore` });
    }
  }

  const info = await stat(filePath);
  if (info.size > MAX_FILE_SIZE) {
    warnings.push({ file: filePath, reason: `Skipped: ${(info.size / 1024).toFixed(0)} KB exceeds ${MAX_FILE_SIZE / 1024} KB limit` });
    return;
  }

  let content;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return; // binary or unreadable
  }

  // Skip if content looks binary
  if (content.includes('\0')) return;

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match;
      while ((match = pattern.regex.exec(line)) !== null) {
        const trimmed = line.trimStart();

        // Skip comments that contain example/placeholder markers
        if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*') || trimmed.startsWith('<!--')) {
          if (/example|placeholder|your[_-]?key|change[_-]?me|xxx|todo|sample|dummy|fake|test/i.test(line)) continue;
        }

        // Skip environment variable references (not actual secrets)
        if (isEnvRef(line)) continue;

        // Skip Bearer with template variable
        if (pattern.name === 'Bearer Token' && /\$\{|%s|{{/.test(match[0])) continue;

        findings.push({
          file: filePath,
          line: i + 1,
          pattern: pattern.name,
          snippet: redact(match[0]),
        });
      }
    }
  }
}

async function scanDir(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.devkit')) {
        await scanDir(full);
      }
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (!SKIP_EXTS.has(ext)) {
        await scanFile(full);
      }
    }
  }
}

// --- Main ---
const target = process.argv[2] || '.';
const resolved = resolve(target);

// Verify target exists
try {
  await access(resolved);
} catch {
  console.error(JSON.stringify({ error: `Path does not exist: ${target}`, resolved }));
  process.exit(2);
}

const targetStat = await stat(resolved);
if (!targetStat.isDirectory()) {
  console.error(JSON.stringify({ error: `Not a directory: ${target}`, resolved }));
  process.exit(2);
}

// Check if git is available for .gitignore detection
try {
  execSync('git rev-parse --is-inside-work-tree', { cwd: resolved, stdio: 'ignore' });
  gitignorePatterns = true; // git is available, use git check-ignore
} catch {
  gitignorePatterns = null; // not a git repo, skip gitignore checks
}

await scanDir(resolved);

const output = { findings, warnings, scanned_root: resolved };
console.log(JSON.stringify(output, null, 2));
process.exit(findings.length > 0 ? 1 : 0);
