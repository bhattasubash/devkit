import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const SCRIPT = join(REPO_ROOT, 'security-audit', 'scripts', 'check-headers.mjs');

function runHeaders(args) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, ...args], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { exitCode: 0, stdout: out, stderr: '' };
  } catch (err) {
    return {
      exitCode: err.status ?? 1,
      stdout: (err.stdout || '').toString(),
      stderr: (err.stderr || '').toString(),
    };
  }
}

test('check-headers.mjs --help exits 0', () => {
  const res = runHeaders(['--help']);
  assert.equal(res.exitCode, 0);
  assert.match(res.stdout, /SSRF/);
});

test('check-headers.mjs blocks localhost, 127.0.0.1, private IPs, and cloud metadata (SSRF guard)', () => {
  for (const blockedUrl of [
    'http://localhost:3000',
    'http://127.0.0.1:8080',
    'http://192.168.1.1',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]:8080',
  ]) {
    const res = runHeaders([blockedUrl]);
    assert.equal(res.exitCode, 2, `Expected exit 2 for blocked URL ${blockedUrl}`);
    assert.match(res.stderr, /SSRF protection/);
  }
});
