import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = resolve(__dirname, '..', 'devkit.mjs');
const NODE_BIN = process.execPath;

function runCli(args = [], cwd = process.cwd()) {
  try {
    const stdout = execFileSync(NODE_BIN, [CLI_PATH, ...args], {
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

test('CLI --help displays usage and commands', () => {
  const res = runCli(['--help']);
  assert.equal(res.status, 0);
  assert.match(res.stdout, /devkit \[command\]/i);
  assert.match(res.stdout, /init/i);
});

test('CLI --version displays version', () => {
  const res = runCli(['--version']);
  assert.equal(res.status, 0);
  assert.match(res.stdout, /1\.1\./);
});

test('init --dry-run previews scaffolding without writing files', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'devkit-test-dry-'));
  try {
    await mkdir(join(tempDir, '.cursor'));
    const res = runCli(['init', '--dry-run'], tempDir);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /dry-run/i);
    assert.match(res.stdout, /\.cursor/);

    // Ensure nothing was actually written
    await assert.rejects(stat(join(tempDir, '.devkit')));
    await assert.rejects(stat(join(tempDir, '.cursor', 'skills', 'devkit')));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('init detects .cursor and scaffolds skills and .devkit', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'devkit-test-cursor-'));
  try {
    await mkdir(join(tempDir, '.cursor'));
    const res = runCli(['init'], tempDir);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /Cursor/i);
    assert.match(res.stdout, /scaffolded/i);

    // Verify .devkit directory contents
    const stateContent = await readFile(join(tempDir, '.devkit', 'state.json'), 'utf-8');
    const state = JSON.parse(stateContent);
    assert.equal(state.skill, 'devkit');

    const scopeContent = await readFile(join(tempDir, '.devkit', 'scope.json'), 'utf-8');
    const scope = JSON.parse(scopeContent);
    assert.ok(Array.isArray(scope.allowed_files));

    // Verify installed skill files in .cursor/skills/devkit
    const skillContent = await readFile(join(tempDir, '.cursor', 'skills', 'devkit', 'SKILL.md'), 'utf-8');
    assert.match(skillContent, /name: devkit/);

    // Verify sub-skills copied
    const secretScanner = await readFile(
      join(tempDir, '.cursor', 'skills', 'devkit', 'security-audit', 'scripts', 'check-secrets.mjs'),
      'utf-8'
    );
    assert.match(secretScanner, /check-secrets\.mjs/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('init detects multiple agent folders and appends .devkit/ to .gitignore', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'devkit-test-multi-'));
  try {
    await mkdir(join(tempDir, '.claude'));
    await mkdir(join(tempDir, '.codex'));
    await writeFile(join(tempDir, '.gitignore'), 'node_modules/\ndist/\n');

    const res = runCli(['init'], tempDir);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /Claude/i);
    assert.match(res.stdout, /Codex/i);

    // Check .gitignore update
    const gitignore = await readFile(join(tempDir, '.gitignore'), 'utf-8');
    assert.match(gitignore, /\.devkit\//);

    // Check both locations have skills
    const claudeSkill = await readFile(join(tempDir, '.claude', 'skills', 'devkit', 'SKILL.md'), 'utf-8');
    assert.match(claudeSkill, /name: devkit/);

    const codexSkill = await readFile(join(tempDir, '.codex', 'skills', 'devkit', 'SKILL.md'), 'utf-8');
    assert.match(codexSkill, /name: devkit/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('init on directory with no agents defaults to .agents/skills/devkit', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'devkit-test-none-'));
  try {
    const res = runCli(['init'], tempDir);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /\.agents/i);

    const skillContent = await readFile(join(tempDir, '.agents', 'skills', 'devkit', 'SKILL.md'), 'utf-8');
    assert.match(skillContent, /name: devkit/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('init with existing install requires --force to overwrite', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'devkit-test-force-'));
  try {
    await mkdir(join(tempDir, '.cursor'));
    runCli(['init'], tempDir);

    // Run again without force
    const res1 = runCli(['init'], tempDir);
    assert.equal(res1.status, 0);
    assert.match(res1.stdout, /already exists/i);

    // Run with --force
    const res2 = runCli(['init', '--force'], tempDir);
    assert.equal(res2.status, 0);
    assert.match(res2.stdout, /scaffolded/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
