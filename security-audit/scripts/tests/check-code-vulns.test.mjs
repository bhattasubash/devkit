import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const SCRIPT = join(REPO_ROOT, 'security-audit', 'scripts', 'check-code-vulns.mjs');

function runVulnCheck(targetPath) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, targetPath], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { exitCode: 0, data: JSON.parse(out) };
  } catch (err) {
    return { exitCode: err.status ?? 1, data: JSON.parse((err.stdout || err.stderr || '{}').toString()) };
  }
}

test('CLI --help exits 0', () => {
  const out = execFileSync(process.execPath, [SCRIPT, '--help'], { encoding: 'utf-8' });
  assert.match(out, /Static code & HTML security scanner/);
});

test('Flags all Juice-Shop-style vulnerabilities in vulnerable.js and zero in clean.js', () => {
  const vulnPath = join(REPO_ROOT, 'evals', 'fixtures', 'security-codefixes', 'vulnerable.js');
  const cleanPath = join(REPO_ROOT, 'evals', 'fixtures', 'security-codefixes', 'clean.js');

  const vulnRes = runVulnCheck(vulnPath);
  assert.equal(vulnRes.exitCode, 1);
  const rules = new Set(vulnRes.data.findings.map((f) => f.rule));
  assert.ok(rules.has('CORS_WILDCARD_CREDENTIALS'));
  assert.ok(rules.has('COMMAND_INJECTION_EXEC'));
  assert.ok(rules.has('SQL_INJECTION_INTERPOLATION'));
  assert.ok(rules.has('PATH_TRAVERSAL_UNCHECKED'));
  assert.ok(rules.has('JWT_UNVERIFIED_DECODE'));

  const cleanRes = runVulnCheck(cleanPath);
  assert.equal(cleanRes.exitCode, 0, `Expected 0 findings on clean.js, got: ${JSON.stringify(cleanRes.data.findings)}`);
  assert.equal(cleanRes.data.total_findings, 0);
});

test('Flags http form action, unsafe target=_blank, and innerHTML XSS in 02_security_leaks.html', () => {
  const htmlPath = join(REPO_ROOT, 'eval_fixtures', '02_security_leaks.html');
  const res = runVulnCheck(htmlPath);
  assert.equal(res.exitCode, 1);
  const rules = new Set(res.data.findings.map((f) => f.rule));
  assert.ok(rules.has('INSECURE_FORM_ACTION'));
  assert.ok(rules.has('UNSAFE_TARGET_BLANK'));
  assert.ok(rules.has('DOM_XSS_INNERHTML'));
});
