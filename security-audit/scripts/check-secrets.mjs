#!/usr/bin/env node

/**
 * check-secrets.mjs — Zero-dependency secret scanner
 *
 * Scans a directory tree for accidentally committed secrets:
 * API keys, tokens, passwords in config, AWS credentials, private keys, and .env files.
 *
 * Usage:  node check-secrets.mjs [directory]
 * Output: JSON array of findings to stdout. Exit 0 = clean, 1 = findings.
 *
 * Skips: node_modules, .git, __pycache__, binary files, lockfiles, images.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', '.venv', 'venv', 'dist', 'build', '.next', '.nuxt']);
const SKIP_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp4', '.mp3', '.zip', '.tar', '.gz', '.lock', '.lockb']);
const MAX_FILE_SIZE = 512 * 1024; // 512 KB

const PATTERNS = [
  { name: 'AWS Access Key',       regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'AWS Secret Key',       regex: /(?:aws_secret_access_key|AWS_SECRET)\s*[=:]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi },
  { name: 'OpenAI API Key',       regex: /sk-[a-zA-Z0-9]{20,}/g },
  { name: 'GitHub PAT',           regex: /ghp_[a-zA-Z0-9]{36}/g },
  { name: 'GitHub OAuth',         regex: /gho_[a-zA-Z0-9]{36}/g },
  { name: 'Stripe Secret Key',    regex: /sk_live_[a-zA-Z0-9]{24,}/g },
  { name: 'Stripe Publishable',   regex: /pk_live_[a-zA-Z0-9]{24,}/g },
  { name: 'Private Key Block',    regex: /-----BEGIN\s+(RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'Generic Secret Assign',regex: /(?:password|secret|token|api_key|apikey|api-key|auth_token)\s*[=:]\s*['"][^'"]{8,}['"]/gi },
  { name: 'Bearer Token',         regex: /bearer\s+[a-zA-Z0-9._\-]{20,}/gi },
  { name: 'Connection String',    regex: /(?:mongodb|postgres|mysql|redis):\/\/[^\s'"]{10,}/gi },
];

const SENSITIVE_FILES = ['.env', '.env.local', '.env.production', '.env.staging', '.env.development'];

const findings = [];

function redact(value) {
  if (value.length <= 8) return '***';
  return value.slice(0, 4) + '…' + value.slice(-4);
}

async function scanFile(filePath) {
  const name = basename(filePath);

  if (SENSITIVE_FILES.includes(name)) {
    findings.push({ file: filePath, line: 0, pattern: 'Sensitive file committed', snippet: `File "${name}" should be in .gitignore` });
  }

  const info = await stat(filePath);
  if (info.size > MAX_FILE_SIZE) return;

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
        // Skip comments and example files
        const trimmed = line.trimStart();
        if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) {
          if (/example|placeholder|your[_-]?key|change[_-]?me|xxx|todo/i.test(line)) continue;
        }
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

const target = process.argv[2] || '.';
await scanDir(target);

console.log(JSON.stringify(findings, null, 2));
process.exit(findings.length > 0 ? 1 : 0);
