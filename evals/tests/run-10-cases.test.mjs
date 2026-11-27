import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBenchmark } from '../run-10-cases.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const SCRIPT = join(REPO_ROOT, 'evals', 'run-10-cases.mjs');

test('run-10-cases.mjs --help prints usage and exits 0', () => {
  const out = execFileSync(process.execPath, [SCRIPT, '--help'], { encoding: 'utf-8' });
  assert.match(out, /10-case devkit benchmark suite/);
});

test('runBenchmark evaluates all 5 Group A and 5 Group B fixtures cleanly', async () => {
  const report = await runBenchmark();
  assert.equal(report.group_a.length, 5);
  assert.equal(report.group_b.length, 5);
  assert.equal(report.summary.group_a_total, 20);
  assert.equal(report.summary.group_b_total, 5);
  assert.ok(typeof report.summary.group_a_recall_pct === 'number');
});
