import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const SCRIPTS = {
  secrets: join(REPO_ROOT, 'security-audit', 'scripts', 'check-secrets.mjs'),
  vulns: join(REPO_ROOT, 'security-audit', 'scripts', 'check-code-vulns.mjs'),
  design: join(REPO_ROOT, 'anti-slop-design', 'scripts', 'lint-design.mjs'),
  html: join(REPO_ROOT, 'web-best-practices', 'scripts', 'check-html.mjs'),
  seo: join(REPO_ROOT, 'seo-audit', 'scripts', 'check-seo-files.mjs'),
  verify: join(REPO_ROOT, 'shared', 'scripts', 'verify-findings.mjs'),
  scope: join(REPO_ROOT, 'shared', 'scripts', 'check-scope.mjs'),
  state: join(REPO_ROOT, 'shared', 'scripts', 'devkit-state.mjs'),
  cli: join(REPO_ROOT, 'bin', 'devkit.mjs'),
  grade: join(REPO_ROOT, 'evals', 'grade.mjs'),
};

const gitBin = process.platform === 'win32' ? 'git.exe' : 'git';

function runNode(script, args = [], cwd = REPO_ROOT) {
  try {
    const stdout = execFileSync(process.execPath, [script, ...args], {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1' },
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      exitCode: err.status ?? 1,
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : '',
    };
  }
}

test('Bug 1a: check-secrets findings have relative file, id, fix, quote, catch ?? fallbacks, and verify cleanly', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reg-secrets-'));
  try {
    const stripeKey = ['sk', 'live', '51Abcdefghijklmnopqrstuvwx12'].join('_');
    await writeFile(join(dir, 'config.js'), [
      `const a = "${stripeKey}";`,
      `const b = process.env.API_SECRET ?? "hardcoded_nullish_fallback_secret";`,
    ].join('\n'));
    await writeFile(join(dir, '.env'), 'SECRET=123456\n');
    await mkdir(join(dir, 'evals'), { recursive: true });
    await writeFile(join(dir, 'evals', 'user-eval.js'), `const k = "${stripeKey}";\n`);

    const res = runNode(SCRIPTS.secrets, ['.'], dir);
    assert.equal(res.exitCode, 1);
    const data = JSON.parse(res.stdout);

    assert.ok(data.findings.length >= 4, `Expected >= 4 findings (including ?? fallback and user evals/), got ${data.findings.length}`);
    assert.ok(data.findings.some((f) => f.file === 'evals/user-eval.js'), 'User repo evals/ directory must not be skipped');
    assert.ok(data.findings.some((f) => f.pattern === 'Hardcoded Fallback Secret' && f.line === 2), 'Must catch ?? fallback');

    for (const f of data.findings) {
      assert.ok(f.id, `Missing id on ${JSON.stringify(f)}`);
      assert.ok(f.fix, `Missing fix on ${JSON.stringify(f)}`);
      assert.ok(f.quote, `Missing quote on ${JSON.stringify(f)}`);
      assert.ok(!f.file.includes(':') && !f.file.startsWith('/'), `Expected relative file path, got ${f.file}`);
    }

    const findingsPath = join(dir, 'findings.json');
    await writeFile(findingsPath, JSON.stringify(data.findings, null, 2));
    const ver = runNode(SCRIPTS.verify, [findingsPath, '--base', dir], dir);
    assert.equal(ver.exitCode, 0, `verify-findings failed: ${ver.stderr || ver.stdout}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Bug 1b & 2a: lint-design avoids false positives (.modal-body, block comments, url(#fade), animation: none) and verifies cleanly', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reg-design-'));
  try {
    const cleanCss = [
      '/* Multi-line comment block',
      '   color: #ff0055;',
      '   background: rgb(255, 0, 0);',
      '*/',
      '.modal-body { overflow: hidden; }',
      '.card-body { overflow-x: hidden; }',
      '.clipped { clip-path: url(#fade); }',
      '.paused { animation: none; }',
    ].join('\n');
    await writeFile(join(dir, 'clean.css'), cleanCss);
    const cleanRes = runNode(SCRIPTS.design, [join(dir, 'clean.css')], dir);
    assert.equal(cleanRes.exitCode, 0, `Unexpected findings in clean.css: ${cleanRes.stdout}`);

    const badCss = [
      '/* header */',
      '.box { padding: 8px; }',
      '.box { padding: 8px; }',
      '.box { padding: 8px; }',
      '.box { padding: 8px; }',
      '@keyframes pulse {',
      '  from { opacity: 1; }',
      '  to { opacity: 0.5; }',
      '}',
    ].join('\n');
    await writeFile(join(dir, 'anim.css'), badCss);
    const badRes = runNode(SCRIPTS.design, [join(dir, 'anim.css')], dir);
    assert.equal(badRes.exitCode, 1);
    const badData = JSON.parse(badRes.stdout);
    const motionFinding = badData.findings.find((f) => f.rule === 'MISSING_REDUCED_MOTION');
    assert.ok(motionFinding);
    assert.equal(motionFinding.line, 6);

    const findingsPath = join(dir, 'findings.json');
    await writeFile(findingsPath, JSON.stringify(badData.findings, null, 2));
    const ver = runNode(SCRIPTS.verify, [findingsPath, '--base', dir], dir);
    assert.equal(ver.exitCode, 0, `verify-findings failed: ${ver.stderr || ver.stdout}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Bug 1c & 1d & 2c: check-html & check-seo-files handle multi-line <label>, line offsets, missing files, and verify cleanly', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reg-web-seo-'));
  try {
    const htmlDoc = [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<!-- comment line 3 -->',
      '<!-- comment line 4 -->',
      '<!-- comment line 5 -->',
      '<head>',
      '  <meta charset="utf-8">',
      '</head>',
      '<body>',
      '  <main>',
      '    <h1>Page Title</h1>',
      '    <h2>Overview</h2>',
      '    <h2>Features</h2>',
      '    <img',
      '      src="hero.png"',
      '    >',
      '    <form>',
      '      <label>',
      '        Email Address',
      '        <input type="email" name="email">',
      '      </label>',
      '    </form>',
      '  </main>',
      '</body>',
      '</html>',
    ].join('\n');
    await writeFile(join(dir, 'page.html'), htmlDoc);
    await writeFile(join(dir, 'robots.txt'), 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n');

    const htmlRes = runNode(SCRIPTS.html, ['.'], dir);
    assert.equal(htmlRes.exitCode, 1);
    const htmlData = JSON.parse(htmlRes.stdout);
    assert.ok(!htmlData.findings.some((f) => f.rule === 'UNLABELED_INPUT'), 'Multi-line <label><input></label> must not flag UNLABELED_INPUT');

    const seoRes = runNode(SCRIPTS.seo, ['.'], dir);
    assert.equal(seoRes.exitCode, 1);
    const seoData = JSON.parse(seoRes.stdout);

    const combined = [...htmlData.findings, ...seoData.findings];
    const findingsPath = join(dir, 'findings.json');
    await writeFile(findingsPath, JSON.stringify(combined, null, 2));
    const ver = runNode(SCRIPTS.verify, [findingsPath, '--base', dir], dir);
    assert.equal(ver.exitCode, 0, `verify-findings failed on HTML/SEO scanner output: ${ver.stderr || ver.stdout}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Bug 2b: check-code-vulns scopes path containment and jwt.verify locally, not file-wide', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reg-vulns-'));
  try {
    const js = [
      'import { readFile } from "node:fs/promises";',
      'import path from "node:path";',
      'import jwt from "jsonwebtoken";',
      'export async function safeDownload(req) {',
      '  const name = path.basename(req.query.file);',
      '  return readFile("/safe/" + name, "utf8");',
      '}',
      'export function safeAuth(token) {',
      '  return jwt.verify(token, process.env.SECRET, { algorithms: ["HS256"] });',
      '}',
      ...Array(12).fill('// spacer'),
      'export async function unsafeDownload(req) {',
      '  return readFile(`/var/uploads/${req.query.file}`, "utf8");',
      '}',
      'export function unsafeAuth(token) {',
      '  return jwt.decode(token);',
      '}',
    ].join('\n');
    await writeFile(join(dir, 'server.js'), js);
    const res = runNode(SCRIPTS.vulns, ['.'], dir);
    assert.equal(res.exitCode, 1);
    const rules = new Set(JSON.parse(res.stdout).findings.map((f) => f.rule));
    assert.ok(rules.has('PATH_TRAVERSAL_UNCHECKED'), 'Safe path.basename in one function must not hide traversal in another');
    assert.ok(rules.has('JWT_UNVERIFIED_DECODE'), 'jwt.verify in one function must not hide jwt.decode in another');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Bug 1e & 1f & 3: devkit-state record/approve, check-scope non-git refusal, grade git-diff scope, and CLI sibling skills', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reg-workflow-'));
  try {
    // 1. check-scope refuses non-git directories
    const scopePath = join(dir, 'scope.json');
    await writeFile(scopePath, JSON.stringify({ allowed_files: ['a.js'], allow_dependency_changes: false }));
    const nonGitScope = runNode(SCRIPTS.scope, [scopePath, '--cwd', dir], dir);
    assert.equal(nonGitScope.exitCode, 2, 'check-scope must exit 2 outside a git repo instead of passing silently');

    // 2. devkit-state record + approve ergonomics
    const statePath = join(dir, 'state.json');
    runNode(SCRIPTS.state, ['init', '--state', statePath, '--skill', 'security-audit', '--mode', 'standard'], dir);
    const recRes = runNode(SCRIPTS.state, ['record', '--state', statePath, '--evidence', 'Mapped entrypoints'], dir);
    assert.equal(recRes.exitCode, 0, recRes.stderr);
    const advRes = runNode(SCRIPTS.state, ['advance', '--state', statePath], dir);
    assert.equal(advRes.exitCode, 0, advRes.stderr);

    // 3. CLI init scaffolds sibling sub-skills alongside devkit/
    await mkdir(join(dir, '.cursor'));
    const cliRes = runNode(SCRIPTS.cli, ['init', '--cwd', dir], dir);
    assert.equal(cliRes.exitCode, 0, cliRes.stderr);
    const subSkillMd = await readFile(join(dir, '.cursor', 'skills', 'security-audit', 'SKILL.md'), 'utf-8');
    assert.match(subSkillMd, /name: security-audit/);

    // 4. grade.mjs detects out-of-scope git edits without relying on self-reported unauthorized_files
    const evalDir = join(dir, 'eval-git');
    await mkdir(join(evalDir, '.devkit', 'reports'), { recursive: true });
    await writeFile(join(evalDir, 'allowed.js'), 'const x = 1;\n');
    await writeFile(join(evalDir, 'locked.js'), 'const y = 1;\n');
    execFileSync(gitBin, ['init', '--quiet'], { cwd: evalDir });
    execFileSync(gitBin, ['config', 'user.email', 'test@test.local'], { cwd: evalDir });
    execFileSync(gitBin, ['config', 'user.name', 'Test'], { cwd: evalDir });
    execFileSync(gitBin, ['add', 'allowed.js', 'locked.js'], { cwd: evalDir });
    execFileSync(gitBin, ['commit', '-m', 'init', '--quiet'], { cwd: evalDir });

    await writeFile(join(evalDir, 'locked.js'), 'const y = 2;\n');
    await writeFile(join(evalDir, '.devkit', 'scope.json'), JSON.stringify({ allowed_files: ['allowed.js'], allow_dependency_changes: false }));
    await writeFile(join(evalDir, '.devkit', 'reports', 'findings.json'), '[]');
    await writeFile(join(evalDir, '.devkit', 'reports', 'audit.md'), '## Done\nx\n## Not done\nx\n## NOT VERIFIED\nx\n## Needs your decision\nx\n');
    const gradeRes = runNode(SCRIPTS.grade, ['clean-site', evalDir, '--json'], REPO_ROOT);
    const gradeData = JSON.parse(gradeRes.stdout);
    assert.ok(gradeData.scope_violations.length > 0, 'grade.mjs must detect git diff scope violations');
    assert.equal(gradeData.grade, 'FAIL');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Bug 1g & 3c: SKILL.md docs include path prefix/record commands, modern-patterns has no .devkit/web/, CI scans check-code-vulns', async () => {
  const rootSkill = await readFile(join(REPO_ROOT, 'SKILL.md'), 'utf-8');
  assert.match(rootSkill, /\.agents\/skills\/devkit\//);
  assert.match(rootSkill, /devkit-state\.mjs (?:record|set)/);

  for (const name of ['security-audit', 'web-best-practices', 'anti-slop-design', 'seo-audit']) {
    const md = await readFile(join(REPO_ROOT, name, 'SKILL.md'), 'utf-8');
    assert.match(md, /devkit-state\.mjs (?:record|set)/, `${name}/SKILL.md must show recording evidence before advance`);
    assert.ok(md.split(/\r?\n/).length <= 100, `${name}/SKILL.md must stay <= 100 lines`);
  }

  const modernPatterns = await readFile(join(REPO_ROOT, 'web-best-practices', 'references', 'modern-patterns.md'), 'utf-8');
  assert.doesNotMatch(modernPatterns, /\.devkit\/web\/state\.json/);

  const ciYml = await readFile(join(REPO_ROOT, '.github', 'workflows', 'test.yml'), 'utf-8');
  assert.match(ciYml, /check-code-vulns\.mjs/);
});
