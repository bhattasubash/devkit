import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_REPO_ROOT,
  TARGET_SKILLS,
  checkSharedSync,
  getSharedScriptFiles,
} from '../sync-shared.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SYNC_SCRIPT = resolve(__dirname, '..', 'sync-shared.mjs');

function runSync(args = []) {
  try {
    const stdout = execFileSync(process.execPath, [SYNC_SCRIPT, ...args], {
      cwd: DEFAULT_REPO_ROOT,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      status: err.status ?? 1,
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : '',
    };
  }
}

test('sync-shared.mjs --help exits 0 and prints usage', () => {
  const res = runSync(['--help']);
  assert.equal(res.status, 0);
  assert.match(res.stdout, /--check/);
  assert.match(res.stdout, /shared\/scripts/);
});

test('all skill script copies exist and match shared/scripts/* byte-for-byte', async () => {
  const sharedFiles = await getSharedScriptFiles(DEFAULT_REPO_ROOT);
  assert.ok(sharedFiles.includes('devkit-state.mjs'));
  assert.ok(sharedFiles.includes('state.template.json'));
  assert.ok(sharedFiles.includes('verify-findings.mjs'));
  assert.ok(sharedFiles.includes('check-scope.mjs'));
  assert.ok(!sharedFiles.includes('tests'));

  for (const file of sharedFiles) {
    const srcBuf = await readFile(join(DEFAULT_REPO_ROOT, 'shared', 'scripts', file));
    for (const skill of TARGET_SKILLS) {
      const copyPath = join(DEFAULT_REPO_ROOT, skill, 'scripts', file);
      const copyBuf = await readFile(copyPath);
      assert.ok(
        srcBuf.equals(copyBuf),
        `${skill}/scripts/${file} differs from shared/scripts/${file}. Run: node scripts/sync-shared.mjs`
      );
    }
  }

  const res = runSync(['--check']);
  assert.equal(res.status, 0);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.inSync, true);
});

test('sync-shared --check fails when a skill copy differs or is missing, and sync repairs it', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'devkit-sync test-'));
  try {
    await cp(join(DEFAULT_REPO_ROOT, 'shared'), join(tempRoot, 'shared'), { recursive: true });
    for (const skill of TARGET_SKILLS) {
      await cp(join(DEFAULT_REPO_ROOT, skill), join(tempRoot, skill), { recursive: true });
    }

    // Mutate one copied file -> check must fail
    const targetFile = join(tempRoot, 'web-best-practices', 'scripts', 'verify-findings.mjs');
    const original = await readFile(targetFile, 'utf-8');
    await writeFile(targetFile, original + '\n// drifted\n', 'utf-8');

    const drifted = await checkSharedSync(tempRoot);
    assert.equal(drifted.inSync, false);
    assert.ok(drifted.mismatches.some((m) => m.skill === 'web-best-practices' && m.reason === 'differs'));

    const cliDrifted = runSync(['--check', '--root', tempRoot]);
    assert.equal(cliDrifted.status, 1);

    // Delete one copied file -> check must fail
    const deletedFile = join(tempRoot, 'seo-audit', 'scripts', 'check-scope.mjs');
    await unlink(deletedFile);
    const cliMissing = runSync(['--check', '--root', tempRoot]);
    assert.equal(cliMissing.status, 1);

    // Re-sync repairs both
    const cliSync = runSync(['--root', tempRoot]);
    assert.equal(cliSync.status, 0);

    const cliClean = runSync(['--check', '--root', tempRoot]);
    assert.equal(cliClean.status, 0);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
