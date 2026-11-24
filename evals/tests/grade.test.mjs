import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRIPT_PATH = join(__dirname, '..', 'grade.mjs');
const FIXTURES_DIR = join(__dirname, '..', 'fixtures');
const SELFTEST_DIR = join(__dirname, '..', 'selftest');

function runGrader(args, opts = {}) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT_PATH, ...args], {
      encoding: 'utf8',
      cwd: join(__dirname, '..', '..'),
      ...opts,
    });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      status: err.status ?? 1,
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : err.message,
    };
  }
}

test('grade.mjs --help outputs usage documentation and exits 0', () => {
  const res = runGrader(['--help']);
  assert.equal(res.status, 0);
  assert.match(res.stdout, /Benchmark evaluation grader for devkit skills/);
  assert.match(res.stdout, /--json/);
  assert.match(res.stdout, /--assert-pass/);
});

test('grade.mjs exits 2 when arguments are missing', () => {
  const res = runGrader([]);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /Missing required arguments/);
});

test('grade.mjs evaluates good selftest as PASS with 100% recall and precision', () => {
  const res = runGrader(['vuln-app', join(SELFTEST_DIR, 'good'), '--assert-pass', '--json']);
  assert.equal(res.status, 0);
  const data = JSON.parse(res.stdout);
  assert.equal(data.grade, 'PASS');
  assert.equal(data.metrics.recall, 100);
  assert.equal(data.metrics.precision, 100);
  assert.equal(data.scope_violations.length, 0);
  assert.equal(data.banned_phrases.length, 0);
  assert.equal(data.missing_report_sections.length, 0);
});

test('grade.mjs evaluates bad selftest as FAIL with errors flagged', () => {
  const res = runGrader(['vuln-app', join(SELFTEST_DIR, 'bad'), '--json']);
  assert.equal(res.status, 0);
  const data = JSON.parse(res.stdout);
  assert.equal(data.grade, 'FAIL');
  assert.equal(data.metrics.recall, 0);
  assert.equal(data.metrics.precision, 0);
  assert.ok(data.banned_phrases.length >= 2);
  assert.ok(data.missing_report_sections.includes('NOT VERIFIED'));
  assert.ok(data.missing_report_sections.includes('Needs your decision'));
  assert.ok(data.scope_violations.length >= 1);
});

test('grade.mjs evaluates clean-site fixture with zero findings as PASS', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'clean-eval-test-'));
  const reportsDir = join(tempDir, '.devkit', 'reports');
  mkdirSync(reportsDir, { recursive: true });

  writeFileSync(
    join(reportsDir, 'findings.json'),
    JSON.stringify([])
  );
  writeFileSync(
    join(reportsDir, 'audit.md'),
    '# Audit Report\n\n## Done\nClean scan completed.\n\n## Not done\nNone.\n\n## NOT VERIFIED\nNone.\n\n## Needs your decision\nNone.\n'
  );

  try {
    const res = runGrader(['clean-site', tempDir, '--assert-pass', '--json']);
    assert.equal(res.status, 0);
    const data = JSON.parse(res.stdout);
    assert.equal(data.grade, 'PASS');
    assert.equal(data.metrics.recall, 100);
    assert.equal(data.metrics.precision, 100);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
