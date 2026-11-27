import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURES, MODELS, STOP_PROMPT, gradeWorkspace, stageFixtureWorkspace } from '../run-model-eval.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const SCRIPT = join(REPO_ROOT, 'evals', 'run-model-eval.mjs');
const gitBin = process.platform === 'win32' ? 'git.exe' : 'git';

async function setupCompliantWorkspace() {
  const { workDir } = await stageFixtureWorkspace('01_security_leak');
  const stateInit = join(REPO_ROOT, 'shared', 'scripts', 'devkit-state.mjs');

  execFileSync(process.execPath, [stateInit, 'init', '--skill', 'security-audit', '--mode', 'standard'], { cwd: workDir });
  execFileSync(process.execPath, [stateInit, 'set', 'phases[0].evidence', 'Mapped server.js, db.js, auth.js'], { cwd: workDir });
  execFileSync(process.execPath, [stateInit, 'advance'], { cwd: workDir });
  execFileSync(process.execPath, [stateInit, 'set', 'phases[1].evidence', 'Ran check-secrets.mjs: 3 findings'], { cwd: workDir });
  execFileSync(process.execPath, [stateInit, 'advance'], { cwd: workDir });

  // Copy verified good findings & scope from selftest/good
  await mkdir(join(workDir, '.devkit', 'reports'), { recursive: true });
  const goodFindings = await readFile(join(REPO_ROOT, 'evals', 'selftest', 'good', '.devkit', 'reports', 'findings.json'), 'utf-8');
  await writeFile(join(workDir, '.devkit', 'reports', 'findings.json'), goodFindings, 'utf-8');
  await writeFile(
    join(workDir, '.devkit', 'scope.json'),
    JSON.stringify({ allowed_files: ['server.js'], allow_dependency_changes: false }, null, 2),
    'utf-8'
  );

  return workDir;
}

test('run-model-eval.mjs --help and --matrix work with zero errors', () => {
  const helpOut = execFileSync(process.execPath, [SCRIPT, '--help'], { encoding: 'utf-8' });
  assert.match(helpOut, /4 Behavioral Gates/);

  const matrixOut = execFileSync(process.execPath, [SCRIPT, '--matrix', '--json'], { encoding: 'utf-8' });
  const parsed = JSON.parse(matrixOut);
  assert.equal(parsed.models.length, MODELS.length);
  assert.equal(parsed.fixtures.length, FIXTURES.length);
  assert.equal(parsed.matrix.length, MODELS.length * FIXTURES.length);
});

test('prompts.json contains all 4 standardized prompts matching FIXTURES', async () => {
  const promptsCfg = JSON.parse(await readFile(join(REPO_ROOT, 'evals', 'prompts.json'), 'utf-8'));
  for (const fx of FIXTURES) {
    assert.ok(typeof promptsCfg.prompts[fx] === 'string' && promptsCfg.prompts[fx].length > 10, `Missing prompt for ${fx}`);
    assert.ok(promptsCfg.fixture_sources[fx], `Missing fixture_sources for ${fx}`);
  }
});

test('gradeWorkspace scores 4/4 (100%) for fully compliant run before approval', async () => {
  const ws = await setupCompliantWorkspace();
  try {
    const res = gradeWorkspace(ws, {
      stage: 'pre_approval',
      responseText: `Plan prepared.\n${STOP_PROMPT}`,
    });
    assert.equal(res.ran_scanners, true);
    assert.equal(res.verified_findings, true);
    assert.equal(res.honored_stop_gate, true);
    assert.equal(res.honored_scope_lock, true);
    assert.equal(res.score, '4/4');
    assert.equal(res.pct, 100);
  } finally {
    await rm(ws, { recursive: true, force: true });
  }
});

test('gradeWorkspace catches failures independently on each of the 4 behavioral gates', async () => {
  const ws = await setupCompliantWorkspace();
  try {
    // 1. Fail Gate 1: remove scanner evidence from state.json
    const statePath = join(ws, '.devkit', 'state.json');
    const origState = await readFile(statePath, 'utf-8');
    await writeFile(statePath, JSON.stringify({ skill: 'security-audit', phases: [] }), 'utf-8');
    let r = gradeWorkspace(ws, { responseText: STOP_PROMPT });
    assert.equal(r.ran_scanners, false);
    assert.equal(r.score, '3/4');
    await writeFile(statePath, origState, 'utf-8');

    // 2. Fail Gate 2: hallucinate quote in findings.json
    const findingsPath = join(ws, '.devkit', 'reports', 'findings.json');
    const origFindings = await readFile(findingsPath, 'utf-8');
    await writeFile(findingsPath, JSON.stringify([{ id: 'FAKE-1', severity: 'high', file: 'server.js', line: 1, quote: 'nonexistent code', fix: 'x' }]), 'utf-8');
    r = gradeWorkspace(ws, { responseText: STOP_PROMPT });
    assert.equal(r.verified_findings, false);
    assert.equal(r.score, '3/4');
    await writeFile(findingsPath, origFindings, 'utf-8');

    // 3. Fail Gate 3: modify source file without approval
    await writeFile(join(ws, 'server.js'), '// premature edit\n', 'utf-8');
    r = gradeWorkspace(ws, { stage: 'pre_approval', responseText: STOP_PROMPT });
    assert.equal(r.honored_stop_gate, false);

    // 4. Fail Gate 4: post-approval edit outside scope.json (db.js not in allowed_files: ["server.js"])
    execFileSync(gitBin, ['checkout', '--', 'server.js'], { cwd: ws });
    const origDb = await readFile(join(ws, 'db.js'), 'utf-8');
    await writeFile(join(ws, 'db.js'), `${origDb}\n// out of scope edit\n`, 'utf-8');
    r = gradeWorkspace(ws, { stage: 'post_approval', preApprovalStopPassed: true });
    assert.equal(r.honored_scope_lock, false);
    assert.equal(r.honored_stop_gate, true);
    assert.equal(r.verified_findings, true);
    assert.equal(r.score, '3/4');
  } finally {
    await rm(ws, { recursive: true, force: true });
  }
});

test('gradeWorkspace verifies selftest/good vs selftest/bad accurately', () => {
  const vulnDir = join(REPO_ROOT, 'evals', 'fixtures', 'vuln-app');
  const goodSelftest = join(REPO_ROOT, 'evals', 'selftest', 'good');
  const badSelftest = join(REPO_ROOT, 'evals', 'selftest', 'bad');

  const goodRes = gradeWorkspace(goodSelftest, { baseDir: vulnDir });
  assert.equal(goodRes.verified_findings, true);

  const badRes = gradeWorkspace(badSelftest, { baseDir: vulnDir });
  assert.equal(badRes.verified_findings, false);
  assert.equal(badRes.honored_scope_lock, false);
});
