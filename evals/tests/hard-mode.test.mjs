import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const HM_DIR = join(REPO_ROOT, 'evals', 'hard_mode');
const gitBin = process.platform === 'win32' ? 'git.exe' : 'git';

const SCRIPTS = {
  design: join(REPO_ROOT, 'anti-slop-design', 'scripts', 'lint-design.mjs'),
  html: join(REPO_ROOT, 'web-best-practices', 'scripts', 'check-html.mjs'),
  secrets: join(REPO_ROOT, 'security-audit', 'scripts', 'check-secrets.mjs'),
  vulns: join(REPO_ROOT, 'security-audit', 'scripts', 'check-code-vulns.mjs'),
  seo: join(REPO_ROOT, 'seo-audit', 'scripts', 'check-seo-files.mjs'),
  verify: join(REPO_ROOT, 'shared', 'scripts', 'verify-findings.mjs'),
  scope: join(REPO_ROOT, 'shared', 'scripts', 'check-scope.mjs'),
};

function runScript(scriptPath, args, cwd = REPO_ROOT) {
  try {
    const stdout = execFileSync(process.execPath, [scriptPath, ...args], {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { exitCode: 0, data: JSON.parse(stdout || '{}') };
  } catch (err) {
    const out = (err.stdout || err.stderr || '{}').toString();
    return { exitCode: err.status ?? 1, data: JSON.parse(out || '{}') };
  }
}

test('Hard Mode 01: valid :root/@theme tokens, scoped transitions, reduced-motion, and overflow-x: clip pass', () => {
  const res = runScript(SCRIPTS.design, [join(HM_DIR, '01_css_tokens_and_svg_colors.css')]);
  assert.equal(res.exitCode, 0, JSON.stringify(res.data.findings));
  assert.equal(res.data.total_findings, 0);
});

test('Hard Mode 02: decorative alt="", aria-label icon button, and aria-labelledby input pass', () => {
  const htmlRes = runScript(SCRIPTS.html, [join(HM_DIR, '02_decorative_images_and_aria.html')]);
  assert.equal(htmlRes.exitCode, 0, JSON.stringify(htmlRes.data.findings));
  const designRes = runScript(SCRIPTS.design, [join(HM_DIR, '02_decorative_images_and_aria.html')]);
  assert.equal(designRes.exitCode, 0, JSON.stringify(designRes.data.findings));
});

test('Hard Mode 03: accessible JSX <Card role="button" tabIndex={0}> and custom wrappers pass', () => {
  const htmlRes = runScript(SCRIPTS.html, [join(HM_DIR, '03_jsx_dynamic_components.tsx')]);
  assert.equal(htmlRes.exitCode, 0, JSON.stringify(htmlRes.data.findings));
  const designRes = runScript(SCRIPTS.design, [join(HM_DIR, '03_jsx_dynamic_components.tsx')]);
  assert.equal(designRes.exitCode, 0, JSON.stringify(designRes.data.findings));
  const vulnRes = runScript(SCRIPTS.vulns, [join(HM_DIR, '03_jsx_dynamic_components.tsx')]);
  assert.equal(vulnRes.exitCode, 0, JSON.stringify(vulnRes.data.findings));
});

test('Hard Mode 04: env refs, placeholders, dynamic 0000 dummies, and pk_live_ pass cleanly', async () => {
  const res = runScript(SCRIPTS.secrets, [join(HM_DIR, '04_docs_example_keys_and_env.js')]);
  assert.equal(res.exitCode, 0, JSON.stringify(res.data.findings));
  const actionable = (res.data.findings || []).filter((f) => f.severity !== 'info');
  assert.equal(actionable.length, 0, 'No actionable findings expected for placeholder/env keys');
  assert.ok(res.data.findings.some((f) => f.pattern === 'Stripe Publishable Key' && f.severity === 'info'));

  // Test 24-zero dummy placeholder suppression dynamically in temp file (avoids static secret blobs in git history)
  const tmp = await mkdtemp(join(tmpdir(), 'hm-zero-dummy-'));
  try {
    const testDummy = ['sk', 'test', '0'.repeat(24)].join('_');
    const liveDummy = ['sk', 'live', '0'.repeat(24)].join('_');
    await writeFile(join(tmp, 'dummies.js'), `const a = '${testDummy}';\nconst b = '${liveDummy}';\n`);
    const dummyRes = runScript(SCRIPTS.secrets, [join(tmp, 'dummies.js')]);
    assert.equal(dummyRes.exitCode, 0, JSON.stringify(dummyRes.data.findings));
    assert.equal((dummyRes.data.findings || []).length, 0);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('Hard Mode 05: SSR-hydrated <div id="root"> and @graph JSON-LD (Organization + FAQPage) pass', () => {
  const seoRes = runScript(SCRIPTS.seo, [join(HM_DIR, '05_spa_with_ssr_hydration_and_jsonld.html')]);
  assert.equal(seoRes.exitCode, 0, JSON.stringify(seoRes.data.findings));
  assert.equal(seoRes.data.total_findings, 0);
  const htmlRes = runScript(SCRIPTS.html, [join(HM_DIR, '05_spa_with_ssr_hydration_and_jsonld.html')]);
  assert.equal(htmlRes.exitCode, 0, JSON.stringify(htmlRes.data.findings));
});

test('Hard Mode 06: catches inline <style> literal hex + width: 100vw + clickable <div onClick>', () => {
  const res = runScript(SCRIPTS.design, [join(HM_DIR, '06_css_slop_in_inline_and_calc.html')]);
  assert.equal(res.exitCode, 1);
  const rules = new Set(res.data.findings.map((f) => f.rule));
  assert.ok(rules.has('LITERAL_COLOR'));
  assert.ok(rules.has('WIDTH_100VW'));
  assert.ok(rules.has('DIV_ONCLICK'));
});

test('Hard Mode 07: catches GitHub PAT in template literal and OpenSSH private key header', () => {
  const res = runScript(SCRIPTS.secrets, [join(HM_DIR, '07_split_and_encoded_secrets.ts')]);
  assert.equal(res.exitCode, 1);
  const patterns = new Set(res.data.findings.map((f) => f.pattern));
  assert.ok(patterns.has('GitHub PAT (classic)'));
  assert.ok(patterns.has('Private Key Block'));
});

test('Hard Mode 08: catches empty <div id="app"></div> SPA shell and invalid trailing-comma JSON-LD', () => {
  const res = runScript(SCRIPTS.seo, [join(HM_DIR, '08_broken_jsonld_and_empty_spa.html')]);
  assert.equal(res.exitCode, 1);
  const rules = new Set(res.data.findings.map((f) => f.rule));
  assert.ok(rules.has('CLIENT_ONLY_RENDERING'));
  assert.ok(rules.has('JSONLD_PARSE_ERROR'));
});

test('Hard Mode 09: catches robots Disallow: /, AI bot blocks, missing Sitemap, http://, and localhost/staging URLs', () => {
  const res = runScript(SCRIPTS.seo, [join(HM_DIR, '09_deceptive_seo_files')]);
  assert.equal(res.exitCode, 1);
  const rules = new Set(res.data.findings.map((f) => f.rule));
  assert.ok(rules.has('ROBOTS_MISSING_SITEMAP'));
  assert.ok(rules.has('ROBOTS_DISALLOW_ALL'));
  assert.ok(rules.has('ROBOTS_BLOCKS_AI_BOTS'));
  assert.ok(rules.has('SITEMAP_LOCAL_OR_STAGING_URL'));
  assert.ok(rules.has('SITEMAP_INSECURE_HTTP_URL'));
});

test('Hard Mode 10: verify-findings catches drift (> ±3 lines) + fabricated quotes, and check-scope enforces scope lock', async () => {
  const trapDir = join(HM_DIR, '10_multi_file_hallucination_trap');
  const verifyRes = runScript(SCRIPTS.verify, [
    join(trapDir, '.devkit', 'reports', 'hallucinated-findings.json'),
    '--base',
    trapDir,
  ]);
  assert.equal(verifyRes.exitCode, 1);
  assert.equal(verifyRes.data.failure_count, 2);
  assert.equal(verifyRes.data.failures[0].id, 'TRAP-002');
  assert.equal(verifyRes.data.failures[0].suggested_line, 10);
  assert.equal(verifyRes.data.failures[1].id, 'TRAP-003');
  assert.equal(verifyRes.data.failures[1].hallucination_flag, true);

  // Verify check-scope allows styles.css changes and rejects out-of-scope app.js edits
  const tmp = await mkdtemp(join(tmpdir(), 'hm-scope-'));
  try {
    await cp(trapDir, tmp, { recursive: true });
    execFileSync(gitBin, ['init', '--quiet'], { cwd: tmp });
    execFileSync(gitBin, ['config', 'user.email', 'test@test.local'], { cwd: tmp });
    execFileSync(gitBin, ['config', 'user.name', 'Test'], { cwd: tmp });
    execFileSync(gitBin, ['add', 'app.js', 'styles.css'], { cwd: tmp });
    execFileSync(gitBin, ['commit', '-m', 'init', '--quiet'], { cwd: tmp });

    // Edit allowed styles.css -> exit 0
    await writeFile(join(tmp, 'styles.css'), '.header { color: var(--brand); }\n');
    const okScope = runScript(SCRIPTS.scope, [join(tmp, '.devkit', 'scope.json')], tmp);
    assert.equal(okScope.exitCode, 0);

    // Edit locked app.js -> exit 1
    await writeFile(join(tmp, 'app.js'), '// unauthorized edit\n');
    const badScope = runScript(SCRIPTS.scope, [join(tmp, '.devkit', 'scope.json')], tmp);
    assert.equal(badScope.exitCode, 1);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
