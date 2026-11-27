#!/usr/bin/env node

/**
 * run-10-cases.mjs — Empirical 10-case benchmark evaluator for devkit scanners
 *
 * Runs all available devkit deterministic scanners in isolation against each of the
 * 10 cases in eval_fixtures/ (Group A flawed cases + Group B clean control cases)
 * and measures recall, false positives, and precision.
 *
 * Usage:
 *   node evals/run-10-cases.mjs [--json] [--assert-pass]
 */

import { mkdtemp, copyFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const FIXTURES_DIR = join(REPO_ROOT, 'eval_fixtures');
const EXPECTED_PATH = join(__dirname, 'cases-10.expected.json');

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`run-10-cases.mjs — 10-case devkit benchmark suite

Usage:
  node evals/run-10-cases.mjs [options]

Options:
  --json         Emit machine-readable JSON report
  --assert-pass  Exit 1 if Group A recall < 100% or any Group B clean page has actionable findings
  --help, -h     Show this help message
`);
  process.exit(0);
}

const isJson = args.includes('--json');
const assertPass = args.includes('--assert-pass');

const SCANNER_DEFS = [
  { key: 'secrets', script: join(REPO_ROOT, 'security-audit/scripts/check-secrets.mjs'), required: true },
  { key: 'code-security', script: join(REPO_ROOT, 'security-audit/scripts/check-code-vulns.mjs'), required: false },
  { key: 'design', script: join(REPO_ROOT, 'anti-slop-design/scripts/lint-design.mjs'), required: true },
  { key: 'html', script: join(REPO_ROOT, 'web-best-practices/scripts/check-html.mjs'), required: true },
  { key: 'seo', script: join(REPO_ROOT, 'seo-audit/scripts/check-seo-files.mjs'), required: true },
];

function invokeScanner(scriptPath, targetArg) {
  try {
    const stdout = execFileSync(process.execPath, [scriptPath, targetArg], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { exitCode: 0, data: JSON.parse(stdout || '{}') };
  } catch (err) {
    const stdout = err.stdout ? err.stdout.toString() : '';
    const stderr = err.stderr ? err.stderr.toString() : '';
    const combined = stdout.trim() || stderr.trim() || '{}';
    try {
      return { exitCode: err.status ?? 1, data: JSON.parse(combined) };
    } catch {
      return { exitCode: err.status ?? 2, data: { findings: [], raw_error: combined } };
    }
  }
}

async function scanSingleCase(filename, activeScanners) {
  const srcFile = join(FIXTURES_DIR, filename);
  const tempDir = await mkdtemp(join(tmpdir(), 'devkit-10case-'));
  try {
    const stagedFile = join(tempDir, filename);
    await copyFile(srcFile, stagedFile);

    const perDomain = {};
    const allFindings = [];

    for (const s of activeScanners) {
      // Try single-file mode if scanner advertises supports_single_file or falls back cleanly;
      // pre-Phase-2 scanners only accept directories (and lint-design/check-html/check-seo-files silently return [] on file paths).
      let res = invokeScanner(s.script, stagedFile);
      const isNotDir = res.exitCode === 2 && typeof res.data?.error === 'string' && /not a directory/i.test(res.data.error);
      const legacyFileNoop = res.exitCode === 0 && res.data?.supports_single_file !== true;
      if (isNotDir || legacyFileNoop) {
        res = invokeScanner(s.script, tempDir);
      }

      const rawList = Array.isArray(res.data.findings) ? res.data.findings : [];
      const normalized = rawList.map((f) => ({
        domain: s.key,
        rule: f.rule || f.pattern || 'UNKNOWN',
        severity: String(f.severity || 'medium').toLowerCase(),
        line: f.line ?? 1,
        quote: f.quote || f.snippet || '',
      }));
      perDomain[s.key] = normalized;
      allFindings.push(...normalized);
    }

    return { perDomain, allFindings };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function runBenchmark() {
  const expected = JSON.parse(await readFile(EXPECTED_PATH, 'utf-8'));
  const activeScanners = SCANNER_DEFS.filter((s) => s.required || existsSync(s.script));

  const groupAResults = [];
  let totalExpected = 0;
  let totalMatched = 0;

  for (const [filename, spec] of Object.entries(expected.group_a)) {
    const { perDomain, allFindings } = await scanSingleCase(filename, activeScanners);
    const checks = spec.expected_checks.map((chk) => {
      const domainFindings = perDomain[chk.domain] || [];
      const matched = domainFindings.some((f) => chk.any_rules.includes(f.rule));
      return { ...chk, matched };
    });

    const matchedCount = checks.filter((c) => c.matched).length;
    totalExpected += checks.length;
    totalMatched += matchedCount;

    groupAResults.push({
      file: filename,
      matched: matchedCount,
      total: checks.length,
      recall_pct: Math.round((matchedCount / checks.length) * 1000) / 10,
      missed: checks.filter((c) => !c.matched).map((c) => `${c.id}: ${c.label}`),
      observed_rules: allFindings.map((f) => `${f.domain}:${f.rule}(${f.severity})`),
    });
  }

  const groupBResults = [];
  let cleanPassed = 0;
  let totalFalsePositives = 0;

  for (const [filename, spec] of Object.entries(expected.group_b)) {
    const { allFindings } = await scanSingleCase(filename, activeScanners);
    // "info" severity items are non-blocking advisories (consistent with check-secrets.mjs)
    const actionable = allFindings.filter((f) => f.severity !== 'info');
    const advisories = allFindings.filter((f) => f.severity === 'info');
    const passed = actionable.length <= spec.max_actionable_findings;
    if (passed) cleanPassed++;
    totalFalsePositives += actionable.length;

    groupBResults.push({
      file: filename,
      passed,
      actionable_count: actionable.length,
      advisory_count: advisories.length,
      actionable_rules: actionable.map((f) => `${f.domain}:${f.rule}(${f.severity})`),
      advisory_rules: advisories.map((f) => `${f.domain}:${f.rule}(info)`),
    });
  }

  const recallPct = totalExpected > 0 ? Math.round((totalMatched / totalExpected) * 1000) / 10 : 100;
  const totalClean = Object.keys(expected.group_b).length;
  const cleanPassPct = totalClean > 0 ? Math.round((cleanPassed / totalClean) * 1000) / 10 : 100;

  return {
    active_scanners: activeScanners.map((s) => s.key),
    summary: {
      group_a_matched: totalMatched,
      group_a_total: totalExpected,
      group_a_recall_pct: recallPct,
      group_b_clean_passed: cleanPassed,
      group_b_total: totalClean,
      group_b_clean_pct: cleanPassPct,
      group_b_false_positives: totalFalsePositives,
      overall_pass: totalMatched === totalExpected && totalFalsePositives === 0,
    },
    group_a: groupAResults,
    group_b: groupBResults,
  };
}

const isCli = process.argv[1] && resolve(process.argv[1]) === __filename;
if (isCli) {
  const report = await runBenchmark();
  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('====================================================');
    console.log(' DEVKIT 10-CASE BENCHMARK REPORT');
    console.log('====================================================');
    console.log(`Active Scanners:         ${report.active_scanners.join(', ')}`);
    console.log(`Group A Defect Recall:   ${report.summary.group_a_matched}/${report.summary.group_a_total} (${report.summary.group_a_recall_pct}%)`);
    console.log(`Group B Clean Controls:  ${report.summary.group_b_clean_passed}/${report.summary.group_b_total} (${report.summary.group_b_clean_pct}%)`);
    console.log(`Group B False Positives: ${report.summary.group_b_false_positives}`);
    console.log('\n--- Group A (Flawed Cases) ---');
    for (const r of report.group_a) {
      console.log(`  ${r.file}: ${r.matched}/${r.total} (${r.recall_pct}%)`);
      if (r.missed.length > 0) {
        for (const m of r.missed) console.log(`    [MISS] ${m}`);
      }
    }
    console.log('\n--- Group B (Clean Control Cases) ---');
    for (const r of report.group_b) {
      console.log(`  ${r.file}: ${r.passed ? 'PASS' : 'FAIL'} (actionable=${r.actionable_count}, info=${r.advisory_count})`);
      if (r.actionable_rules.length > 0) {
        console.log(`    [FP] ${r.actionable_rules.join(', ')}`);
      }
    }
    console.log('====================================================');
  }

  if (assertPass && !report.summary.overall_pass) {
    process.exit(1);
  }
}
