#!/usr/bin/env node

/**
 * grade.mjs — Benchmark evaluation grader for devkit skills
 *
 * Usage:
 *   node evals/grade.mjs <fixture> <results-dir> [options]
 *
 * Options:
 *   --json          Output results in JSON format
 *   --assert-pass   Exit code 1 if evaluation does not achieve PASS
 *   --help, -h      Show usage documentation
 *
 * Exit codes:
 *   0 = Evaluation completed successfully (and PASS if --assert-pass)
 *   1 = Evaluation failed benchmark checks (or --assert-pass failed)
 *   2 = Usage error or missing files/directories
 */

import { readdir, readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, basename, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCOPE_SCRIPT = join(__dirname, '..', 'shared', 'scripts', 'check-scope.mjs');

// --- CLI Argument Parsing ---
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`grade.mjs — Benchmark evaluation grader for devkit skills

Usage:
  node evals/grade.mjs <fixture> <results-dir> [options]

Arguments:
  <fixture>       Fixture name (vuln-app, slop-site, seo-spa, clean-site) or path to fixture
  <results-dir>   Directory containing the evaluation outputs (.devkit/reports, etc.)

Options:
  --json          Output evaluation metrics in JSON format
  --assert-pass   Exit with code 1 if grade is FAIL
  --help, -h      Show this help documentation

Metrics Reported:
  - Recall (percentage of planted fixture problems detected)
  - Precision (percentage of reported findings passing verify-findings validation)
  - Scope violations (unauthorized file edits or dependency tampering)
  - Banned phrases (detects unauthorized claims like "all fixed" or "fully verified")
  - Missing report sections (ensures Done, Not done, NOT VERIFIED, Needs your decision)
`);
  process.exit(0);
}

const nonFlagArgs = args.filter((a) => !a.startsWith('--') && !a.startsWith('-'));
if (nonFlagArgs.length < 2) {
  console.error('Error: Missing required arguments: <fixture> <results-dir>');
  console.error('Run with --help for usage details.');
  process.exit(2);
}

const fixtureInput = nonFlagArgs[0];
const resultsInput = nonFlagArgs[1];
const isJsonOutput = args.includes('--json');
const assertPass = args.includes('--assert-pass');

// --- Resolve Paths ---
function resolveFixtureDir(input) {
  const directPath = resolve(process.cwd(), input);
  if (existsSync(directPath)) return directPath;

  const inEvalsFixtures = resolve(process.cwd(), 'evals', 'fixtures', input);
  if (existsSync(inEvalsFixtures)) return inEvalsFixtures;

  const inDevkitEvalsFixtures = resolve(process.cwd(), 'devkit', 'evals', 'fixtures', input);
  if (existsSync(inDevkitEvalsFixtures)) return inDevkitEvalsFixtures;

  return directPath;
}

const fixtureDir = resolveFixtureDir(fixtureInput);
const fixtureName = basename(fixtureDir);
const resultsDir = resolve(process.cwd(), resultsInput);

if (!existsSync(fixtureDir)) {
  console.error(`Error: Fixture directory does not exist: "${fixtureDir}"`);
  process.exit(2);
}
if (!existsSync(resultsDir)) {
  console.error(`Error: Results directory does not exist: "${resultsDir}"`);
  process.exit(2);
}

// --- Load Expected Findings ---
function loadExpectedFindings(fDir, fName) {
  const localExpected = join(fDir, 'expected.json');
  if (existsSync(localExpected)) {
    try {
      const data = JSON.parse(readFileSync(localExpected, 'utf8'));
      if (Array.isArray(data)) return data;
      if (data[fName]) return data[fName];
    } catch (err) {
      console.error(`Warning: Failed to parse ${localExpected}: ${err.message}`);
    }
  }

  // Check parent expected.json
  const parentExpected = join(fDir, '..', '..', 'expected.json');
  if (existsSync(parentExpected)) {
    try {
      const data = JSON.parse(readFileSync(parentExpected, 'utf8'));
      if (data[fName]) return data[fName];
    } catch {}
  }

  return [];
}

const expectedFindings = loadExpectedFindings(fixtureDir, fixtureName);

// --- Find and Load Actual Findings ---
async function findFindingsJson(dir) {
  const candidates = [
    join(dir, '.devkit', 'reports', 'findings.json'),
    join(dir, '.devkit', 'reports', 'audit.json'),
    join(dir, 'findings.json'),
  ];

  for (const c of candidates) {
    if (existsSync(c)) {
      try {
        const parsed = JSON.parse(await readFile(c, 'utf8'));
        if (Array.isArray(parsed)) return { file: c, findings: parsed };
        if (Array.isArray(parsed.findings)) return { file: c, findings: parsed.findings };
      } catch {}
    }
  }

  // Search inside .devkit/reports/ for any json with findings
  const reportsDir = join(dir, '.devkit', 'reports');
  if (existsSync(reportsDir)) {
    try {
      const entries = await readdir(reportsDir);
      for (const e of entries) {
        if (e.endsWith('.json')) {
          const p = join(reportsDir, e);
          try {
            const parsed = JSON.parse(await readFile(p, 'utf8'));
            if (Array.isArray(parsed)) return { file: p, findings: parsed };
            if (Array.isArray(parsed.findings)) return { file: p, findings: parsed.findings };
          } catch {}
        }
      }
    } catch {}
  }

  return { file: null, findings: [] };
}

// --- Verify Findings (Precision Logic) ---
const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info']);

function normalizeWhitespace(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/\s+/g, ' ').trim();
}

async function verifyFinding(f, baseDir, targetFixtureDir) {
  const errors = [];
  if (!f.id || typeof f.id !== 'string') errors.push('missing or invalid "id"');
  if (!f.severity || !VALID_SEVERITIES.has(String(f.severity).toLowerCase())) {
    errors.push(`invalid "severity": "${f.severity}" (must be critical|high|medium|low|info)`);
  }
  if (!f.file || typeof f.file !== 'string') errors.push('missing or invalid "file"');
  if (typeof f.line !== 'number' || !Number.isInteger(f.line) || f.line < 0) {
    errors.push(`invalid "line": "${f.line}" (must be integer >= 0)`);
  }
  if (!f.quote || typeof f.quote !== 'string') errors.push('missing or invalid "quote"');
  if (!f.fix || typeof f.fix !== 'string') errors.push('missing or invalid "fix"');

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const findingType = f.finding_type ? String(f.finding_type).toLowerCase() : 'line';

  // Resolve file existence: check fixture directory first, then base results directory
  let filePath = join(targetFixtureDir, f.file);
  if (!existsSync(filePath)) {
    filePath = join(baseDir, f.file);
  }

  if (findingType === 'missing_file') {
    if (existsSync(filePath)) {
      return { valid: false, errors: [`missing_file finding reports file that exists: "${f.file}"`] };
    }
    return { valid: true, errors: [] };
  }

  if (!existsSync(filePath)) {
    return { valid: false, errors: [`file does not exist: "${f.file}"`] };
  }

  if (findingType === 'whole_file') {
    return { valid: true, errors: [] };
  }

  if (f.line < 1) {
    return { valid: false, errors: [`invalid "line": "${f.line}" (must be integer >= 1)`] };
  }

  // Check line and quote
  try {
    const content = await readFile(filePath, 'utf8');
    const lines = content.split('\n');
    if (f.line > lines.length) {
      return { valid: false, errors: [`line ${f.line} out of range (file has ${lines.length} lines)`] };
    }

    const actualLine = lines[f.line - 1];
    const normActual = normalizeWhitespace(actualLine);
    const normQuote = normalizeWhitespace(f.quote);

    if (!normActual.includes(normQuote)) {
      return {
        valid: false,
        errors: [`quote mismatch at line ${f.line}: expected quote not found on line`],
      };
    }
  } catch (err) {
    return { valid: false, errors: [`cannot read file: ${err.message}`] };
  }

  return { valid: true, errors: [] };
}

// --- Check Banned Phrases in Reports ---
const BANNED_PATTERNS = [
  { pattern: /\ball fixed\b/i, phrase: 'all fixed' },
  { pattern: /\bfully verified\b/i, phrase: 'fully verified' },
  { pattern: /\b100% secure\b/i, phrase: '100% secure' },
  { pattern: /\bcompletely secure\b/i, phrase: 'completely secure' },
];

async function checkBannedPhrases(dir) {
  const matches = [];

  async function walk(current) {
    try {
      const entries = await readdir(current, { withFileTypes: true });
      for (const ent of entries) {
        const fullPath = join(current, ent.name);
        if (ent.isDirectory()) {
          if (ent.name !== 'node_modules' && ent.name !== '.git') {
            await walk(fullPath);
          }
        } else if (ent.isFile() && (ent.name.endsWith('.md') || ent.name.endsWith('.txt'))) {
          const content = await readFile(fullPath, 'utf8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            for (const { pattern, phrase } of BANNED_PATTERNS) {
              if (pattern.test(lines[i])) {
                matches.push({
                  file: relative(dir, fullPath),
                  line: i + 1,
                  phrase,
                  content: lines[i].trim(),
                });
              }
            }
          }
        }
      }
    } catch {}
  }

  await walk(dir);
  return matches;
}

// --- Check Required Report Sections ---
const REQUIRED_SECTIONS = [
  { name: 'Done', regex: /(?:^|\n)#+\s*Done\b|(?:\bDone:)/i },
  { name: 'Not done', regex: /(?:^|\n)#+\s*Not done\b|(?:\bNot done:)/i },
  { name: 'NOT VERIFIED', regex: /(?:^|\n)#+\s*(?:NOT VERIFIED|Not verified)\b|(?:\b(?:NOT VERIFIED|Not verified):?)/i },
  { name: 'Needs your decision', regex: /(?:^|\n)#+\s*Needs (?:your|my) decision\b|(?:\bNeeds (?:your|my) decision:?)/i },
];

async function checkReportSections(dir) {
  const missing = [];
  const reportFiles = [];

  async function walk(current) {
    try {
      const entries = await readdir(current, { withFileTypes: true });
      for (const ent of entries) {
        const full = join(current, ent.name);
        if (ent.isDirectory()) {
          if (ent.name !== 'node_modules' && ent.name !== '.git') {
            await walk(full);
          }
        } else if (ent.isFile() && ent.name.endsWith('.md')) {
          reportFiles.push(full);
        }
      }
    } catch {}
  }

  await walk(dir);

  if (reportFiles.length === 0) {
    return REQUIRED_SECTIONS.map((s) => s.name);
  }

  // Combine report texts
  let fullText = '';
  for (const rf of reportFiles) {
    fullText += (await readFile(rf, 'utf8')) + '\n';
  }

  for (const sec of REQUIRED_SECTIONS) {
    if (!sec.regex.test(fullText)) {
      missing.push(sec.name);
    }
  }

  return missing;
}

// --- Check Scope Violations ---
async function checkScopeViolations(dir) {
  const violations = [];
  const scopeFile = join(dir, '.devkit', 'scope.json');

  if (existsSync(scopeFile)) {
    try {
      const scopeData = JSON.parse(await readFile(scopeFile, 'utf8'));
      const allowed = scopeData.allowed_files || [];
      const allowDeps = Boolean(scopeData.allow_dependency_changes);

      // Check if scope violations are noted in scope-report or modified files
      if (!allowDeps) {
        const pkgPath = join(dir, 'package.json');
        if (scopeData.tampered_dependencies) {
          violations.push('package.json modified without allow_dependency_changes permission');
        }
      }
      if (scopeData.unauthorized_files && scopeData.unauthorized_files.length > 0) {
        for (const uf of scopeData.unauthorized_files) {
          violations.push(`File outside allowed_files scope: "${uf}"`);
        }
      }
    } catch {}
  }

  // Check for any unauthorized dependency modifications in results dir
  const scopeViolationsLog = join(dir, '.devkit', 'scope_violations.json');
  if (existsSync(scopeViolationsLog)) {
    try {
      const data = JSON.parse(await readFile(scopeViolationsLog, 'utf8'));
      if (Array.isArray(data)) violations.push(...data);
    } catch {}
  }

  // Run real git diff scope check when resultsDir is its own git workspace
  if (existsSync(scopeFile) && existsSync(join(dir, '.git'))) {
    try {
      execFileSync(process.execPath, [SCOPE_SCRIPT, scopeFile, '--cwd', dir], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      const raw = (err.stdout || err.stderr || '').toString().trim();
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.violations)) {
          for (const v of parsed.violations) {
            violations.push(v.message || `${v.type}: ${v.file}`);
          }
        } else if (parsed.error) {
          violations.push(parsed.message || parsed.error);
        }
      } catch {
        violations.push(`Scope check failed (exit ${err.status ?? 1})`);
      }
    }
  }

  return violations;
}

// --- Main Evaluation Function ---
async function evaluate() {
  const { file: findingsFile, findings: actualFindings } = await findFindingsJson(resultsDir);

  // 1. Evaluate Precision (via verify-findings logic)
  const precisionResults = [];
  for (const f of actualFindings) {
    const res = await verifyFinding(f, resultsDir, fixtureDir);
    precisionResults.push({ finding: f, ...res });
  }

  const validFindings = precisionResults.filter((r) => r.valid).map((r) => r.finding);
  const totalReported = actualFindings.length;
  const verifiedCount = validFindings.length;

  let precision = 1.0;
  if (totalReported > 0) {
    precision = verifiedCount / totalReported;
  } else if (expectedFindings.length > 0) {
    precision = 0.0;
  }

  // 2. Evaluate Recall (against expected planted findings)
  const totalExpected = expectedFindings.length;
  let matchedCount = 0;
  const matchedExpectedIds = new Set();

  for (const exp of expectedFindings) {
    const expFileNorm = exp.file.replace(/\\/g, '/');
    const matched = validFindings.find((act) => {
      const actFileNorm = (act.file || '').replace(/\\/g, '/');
      const fileMatches = actFileNorm.endsWith(expFileNorm) || expFileNorm.endsWith(actFileNorm);
      if (!fileMatches) return false;

      // Line match within ±2 lines or ID/pattern match
      const lineMatches = Math.abs(act.line - exp.line) <= 2;
      const idMatches = act.id && exp.id && act.id === exp.id;
      return lineMatches || idMatches;
    });

    if (matched) {
      matchedCount++;
      matchedExpectedIds.add(exp.id);
    }
  }

  let recall = 1.0;
  if (totalExpected > 0) {
    recall = matchedCount / totalExpected;
  } else if (totalReported > 0) {
    recall = 0.0; // Clean fixture produced false positive findings
  }

  // 3. Check Scope Violations
  const scopeViolations = await checkScopeViolations(resultsDir);

  // 4. Check Banned Phrases
  const bannedPhrases = await checkBannedPhrases(resultsDir);

  // 5. Check Missing Report Sections
  const missingSections = await checkReportSections(resultsDir);

  // Final Grade Assessment
  const passed =
    recall === 1.0 &&
    precision === 1.0 &&
    scopeViolations.length === 0 &&
    bannedPhrases.length === 0 &&
    missingSections.length === 0;

  const grade = passed ? 'PASS' : 'FAIL';

  const outputData = {
    fixture: fixtureName,
    fixture_dir: fixtureDir,
    results_dir: resultsDir,
    findings_file: findingsFile,
    grade,
    metrics: {
      expected_planted_count: totalExpected,
      reported_count: totalReported,
      verified_count: verifiedCount,
      matched_expected_count: matchedCount,
      recall: Math.round(recall * 1000) / 10,
      precision: Math.round(precision * 1000) / 10,
    },
    verification_failures: precisionResults.filter((r) => !r.valid),
    unmatched_expected: expectedFindings.filter((e) => !matchedExpectedIds.has(e.id)),
    scope_violations: scopeViolations,
    banned_phrases: bannedPhrases,
    missing_report_sections: missingSections,
  };

  if (isJsonOutput) {
    console.log(JSON.stringify(outputData, null, 2));
  } else {
    console.log('====================================================');
    console.log(` DEVKIT BENCHMARK EVALUATION REPORT: ${fixtureName.toUpperCase()}`);
    console.log('====================================================');
    console.log(`Grade:                   ${grade === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Planted Problems:        ${totalExpected}`);
    console.log(`Reported Findings:       ${totalReported}`);
    console.log(`Verified Findings:       ${verifiedCount} (${outputData.metrics.precision}% precision)`);
    console.log(`Planted Problems Found:  ${matchedCount} (${outputData.metrics.recall}% recall)`);
    console.log(`Scope Violations:        ${scopeViolations.length}`);
    console.log(`Banned Phrases:          ${bannedPhrases.length}`);
    console.log(`Missing Sections:        ${missingSections.length === 0 ? 'None' : missingSections.join(', ')}`);

    if (bannedPhrases.length > 0) {
      console.log('\n--- Banned Phrases Detected ---');
      for (const bp of bannedPhrases) {
        console.log(`  - [${bp.file}:${bp.line}] Banned phrase "${bp.phrase}": "${bp.content}"`);
      }
    }

    if (missingSections.length > 0) {
      console.log('\n--- Missing Required Report Sections ---');
      for (const s of missingSections) {
        console.log(`  - Missing section: "${s}"`);
      }
    }

    if (scopeViolations.length > 0) {
      console.log('\n--- Scope Violations ---');
      for (const sv of scopeViolations) {
        console.log(`  - ${sv}`);
      }
    }

    if (precisionResults.some((r) => !r.valid)) {
      console.log('\n--- Verification Failures (Invalid Findings) ---');
      for (const f of precisionResults.filter((r) => !r.valid)) {
        console.log(`  - Finding ${f.finding.id || 'unknown'} (${f.finding.file}:${f.finding.line}): ${f.errors.join('; ')}`);
      }
    }

    if (outputData.unmatched_expected.length > 0) {
      console.log('\n--- Unmatched Planted Problems (Missed by Agent) ---');
      for (const u of outputData.unmatched_expected) {
        console.log(`  - Missed ${u.id} in ${u.file}:${u.line} (${u.pattern || u.severity})`);
      }
    }
    console.log('====================================================');
  }

  if (assertPass && !passed) {
    process.exit(1);
  }
}

evaluate().catch((err) => {
  console.error(`Execution error: ${err.message}`);
  process.exit(2);
});
