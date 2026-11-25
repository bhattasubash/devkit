import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');

const SKILLS = [
  { name: 'web-best-practices', scanner: 'check-html.mjs' },
  { name: 'anti-slop-design', scanner: 'lint-design.mjs' },
  { name: 'security-audit', scanner: 'check-secrets.mjs' },
  { name: 'seo-audit', scanner: 'check-seo-files.mjs' },
];

function runNode(args, cwd) {
  try {
    const stdout = execFileSync(process.execPath, args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1' },
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

test('every SKILL.md is <= 100 lines and standalone skills avoid shared/ references', async () => {
  const rootSkill = await readFile(join(REPO_ROOT, 'SKILL.md'), 'utf-8');
  assert.ok(rootSkill.split(/\r?\n/).length <= 100, 'Root SKILL.md exceeds 100 lines');

  for (const { name } of SKILLS) {
    const content = await readFile(join(REPO_ROOT, name, 'SKILL.md'), 'utf-8');
    const lineCount = content.split(/\r?\n/).length;
    assert.ok(lineCount <= 100, `${name}/SKILL.md has ${lineCount} lines (max 100)`);
    assert.doesNotMatch(content, /shared\/scripts\//, `${name}/SKILL.md still references shared/scripts/`);
    assert.doesNotMatch(content, /shared\/severity\.md/, `${name}/SKILL.md still references shared/severity.md`);
    assert.match(content, new RegExp(`${name}/scripts/devkit-state\\.mjs init`));
    assert.match(content, new RegExp(`${name}/scripts/verify-findings\\.mjs`));
    assert.match(content, new RegExp(`${name}/scripts/check-scope\\.mjs`));
  }
});

for (const { name, scanner } of SKILLS) {
  test(`isolated ${name} skill runs documented commands without shared/`, async () => {
    const tempDir = await mkdtemp(join(tmpdir(), `devkit isolated ${name}-`));
    try {
      await cp(join(REPO_ROOT, name), join(tempDir, name), { recursive: true });

      // Confirm no shared/ directory exists in the isolated temp workspace
      await assert.rejects(stat(join(tempDir, 'shared')));

      // Confirm every node <script> path documented in SKILL.md exists inside tempDir
      const skillMd = await readFile(join(tempDir, name, 'SKILL.md'), 'utf-8');
      const scriptRefs = [...skillMd.matchAll(/node\s+([^\s`]+\.mjs)/g)].map((m) => m[1]);
      assert.ok(scriptRefs.length >= 4, `Expected documented script paths in ${name}/SKILL.md`);
      for (const relScript of scriptRefs) {
        assert.ok(relScript.startsWith(`${name}/scripts/`), `Unexpected script path ${relScript}`);
        await stat(join(tempDir, ...relScript.split('/')));
      }

      // 1. state init
      const initRes = runNode(
        [join(name, 'scripts', 'devkit-state.mjs'), 'init', '--skill', name, '--mode', 'standard'],
        tempDir
      );
      assert.equal(initRes.status, 0, initRes.stderr);
      const state = JSON.parse(await readFile(join(tempDir, '.devkit', 'state.json'), 'utf-8'));
      assert.equal(state.skill, name);
      assert.equal(state.mode, 'standard');

      // 2. verify-findings --help
      const verifyHelp = runNode([join(name, 'scripts', 'verify-findings.mjs'), '--help'], tempDir);
      assert.equal(verifyHelp.status, 0, verifyHelp.stderr);
      assert.match(verifyHelp.stdout, /Audit findings validator/);

      // 3. check-scope --help
      const scopeHelp = runNode([join(name, 'scripts', 'check-scope.mjs'), '--help'], tempDir);
      assert.equal(scopeHelp.status, 0, scopeHelp.stderr);
      assert.match(scopeHelp.stdout, /Scope lock enforcer/);

      // 4. skill scanner --help
      const scannerHelp = runNode([join(name, 'scripts', scanner), '--help'], tempDir);
      assert.equal(scannerHelp.status, 0, scannerHelp.stderr);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
}

test('root router SKILL.md works when full repo is installed via CLI', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'devkit full router install-'));
  try {
    const cliPath = join(REPO_ROOT, 'bin', 'devkit.mjs');
    const initRes = runNode([cliPath, 'init', '--cwd', tempDir], REPO_ROOT);
    assert.equal(initRes.status, 0, initRes.stderr);

    const installedRoot = join(tempDir, '.agents', 'skills', 'devkit');
    const rootSkillMd = await readFile(join(installedRoot, 'SKILL.md'), 'utf-8');
    const scriptRefs = [...rootSkillMd.matchAll(/node\s+([^\s`]+\.mjs)/g)].map((m) => m[1]);
    assert.ok(scriptRefs.length >= 6);
    for (const relScript of scriptRefs) {
      await stat(join(installedRoot, ...relScript.split('/')));
    }

    const stateRes = runNode(
      [
        join(installedRoot, 'shared', 'scripts', 'devkit-state.mjs'),
        'init',
        '--skill',
        'devkit',
        '--mode',
        'standard',
        '--phases',
        'security,web,design,seo,plan,fix,verify,report',
      ],
      tempDir
    );
    assert.equal(stateRes.status, 0, stateRes.stderr);

    const state = JSON.parse(await readFile(join(tempDir, '.devkit', 'state.json'), 'utf-8'));
    assert.equal(state.skill, 'devkit');
    assert.equal(state.phases.length, 8);

    const verifyHelp = runNode([join(installedRoot, 'shared', 'scripts', 'verify-findings.mjs'), '--help'], tempDir);
    assert.equal(verifyHelp.status, 0, verifyHelp.stderr);

    const scopeHelp = runNode([join(installedRoot, 'shared', 'scripts', 'check-scope.mjs'), '--help'], tempDir);
    assert.equal(scopeHelp.status, 0, scopeHelp.stderr);

    const secHelp = runNode([join(installedRoot, 'security-audit', 'scripts', 'check-secrets.mjs'), '--help'], tempDir);
    assert.equal(secHelp.status, 0, secHelp.stderr);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
