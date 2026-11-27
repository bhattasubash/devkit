#!/usr/bin/env node

/**
 * check-code-vulns.mjs — Zero-dependency static code & HTML security scanner
 *
 * Scans HTML, JS, and TS source files for high-confidence exploitable patterns:
 *   1. INSECURE_FORM_ACTION: <form action="http://..."> over cleartext HTTP
 *   2. UNSAFE_TARGET_BLANK: <a target="_blank"> missing rel="noopener"
 *   3. DOM_XSS_INNERHTML: innerHTML/outerHTML/document.write/dangerouslySetInnerHTML with dynamic data
 *   4. COMMAND_INJECTION_EXEC: child_process exec()/execSync() with dynamic input or shell:true
 *   5. SQL_INJECTION_INTERPOLATION: SQL query template/concatenation interpolation
 *   6. PATH_TRAVERSAL_UNCHECKED: fs read/write with request input lacking containment check
 *   7. CORS_WILDCARD_CREDENTIALS: Access-Control-Allow-Origin * combined with credentials:true
 *   8. JWT_UNVERIFIED_DECODE: jwt.decode() without verify() or algorithms:['none']
 *   9. EVAL_CODE_INJECTION: eval() or new Function() execution
 *
 * Usage:
 *   node check-code-vulns.mjs [directory-or-file]
 *
 * Exit codes:
 *   0 = clean (no findings)
 *   1 = vulnerabilities detected
 *   2 = usage error or missing path
 */

import { readdir, readFile, stat, access } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, extname, resolve, relative, dirname } from 'node:path';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`check-code-vulns.mjs — Static code & HTML security scanner

Usage:
  node check-code-vulns.mjs [directory-or-file] [options]

Options:
  --help, -h    Show this help message and exit

Checks:
  - INSECURE_FORM_ACTION (cleartext http:// form submission)
  - UNSAFE_TARGET_BLANK (target="_blank" missing rel="noopener")
  - DOM_XSS_INNERHTML (unsanitized innerHTML/outerHTML/document.write/dangerouslySetInnerHTML)
  - COMMAND_INJECTION_EXEC (child_process exec/execSync or shell:true with dynamic input)
  - SQL_INJECTION_INTERPOLATION (template/concatenated SQL query)
  - PATH_TRAVERSAL_UNCHECKED (fs file access from req input without startsWith containment)
  - CORS_WILDCARD_CREDENTIALS (Access-Control-Allow-Origin * with Allow-Credentials true)
  - JWT_UNVERIFIED_DECODE (jwt.decode without verify, or alg:none)
  - EVAL_CODE_INJECTION (eval / new Function)

Exit codes:
  0: Clean
  1: Vulnerabilities detected
  2: Error
`);
  process.exit(0);
}

const targetArg = args[0] || '.';
const resolved = resolve(targetArg);

try {
  await access(resolved);
} catch {
  console.error(JSON.stringify({ error: `Path does not exist: ${targetArg}`, resolved }));
  process.exit(2);
}

const targetStat = await stat(resolved);
const baseDir = targetStat.isFile() ? dirname(resolved) : resolved;

const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', '.venv', 'venv', 'dist', 'build', '.next', '.nuxt', '.devkit']);
try {
  const pkgPath = join(baseDir, 'package.json');
  if (existsSync(pkgPath) && JSON.parse(readFileSync(pkgPath, 'utf-8'))?.name === '@bhattasubash/devkit') {
    SKIP_DIRS.add('evals');
    SKIP_DIRS.add('eval_fixtures');
  }
} catch {}
const HTML_EXTS = new Set(['.html', '.htm']);
const CODE_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);

const findings = [];
let findingCounter = 0;

function nextId() {
  findingCounter++;
  return `VULN-${String(findingCounter).padStart(3, '0')}`;
}

function lineNumberAt(content, index) {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

function isCommentOrProseLine(line) {
  const trimmed = line.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('<!--')) {
    return true;
  }
  if (/^(?:fix|description|note)\s*:\s*['"`]/.test(trimmed) || /^[-*]\s+[A-Z0-9_]+\s*\(/.test(trimmed)) {
    return true;
  }
  return false;
}

function stripQuotedStrings(line) {
  return line
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

function addFinding({ rule, severity, filePath, line, quote, fix }) {
  findings.push({
    id: nextId(),
    rule,
    severity,
    file: relative(baseDir, filePath).replace(/\\/g, '/') || filePath,
    line,
    quote: quote.trim().slice(0, 120),
    fix,
  });
}

function scanHtmlSecurity(content, filePath) {
  // 1. Insecure http:// form action (allow http://localhost or http://127.0.0.1 for local dev forms)
  const formMatches = content.matchAll(/<form\b[^>]*\baction\s*=\s*["'](http:\/\/(?!(?:localhost|127\.0\.0\.1)\b)[^"']+)["'][^>]*>/gi);
  for (const m of formMatches) {
    addFinding({
      rule: 'INSECURE_FORM_ACTION',
      severity: 'high',
      filePath,
      line: lineNumberAt(content, m.index),
      quote: m[0],
      fix: 'Use an https:// URL (or a relative same-origin path) for <form action="..."> to protect submitted credentials and form data in transit.',
    });
  }

  // 2. target="_blank" without rel="noopener"
  const anchorMatches = content.matchAll(/<a\b[^>]*\btarget\s*=\s*["']_blank["'][^>]*>/gi);
  for (const m of anchorMatches) {
    const tag = m[0];
    const relMatch = tag.match(/\brel\s*=\s*["']([^"']*)["']/i);
    const relTokens = relMatch ? relMatch[1].toLowerCase().split(/\s+/) : [];
    if (!relTokens.includes('noopener') && !relTokens.includes('noreferrer')) {
      addFinding({
        rule: 'UNSAFE_TARGET_BLANK',
        severity: 'medium',
        filePath,
        line: lineNumberAt(content, m.index),
        quote: tag,
        fix: 'Add rel="noopener noreferrer" to links using target="_blank" to prevent reverse tabnabbing and opener leaks.',
      });
    }
  }
}

function scanScriptSecurity(content, filePath, ext) {
  const lines = content.split('\n');
  const hasChildProcessExecImport = /\b(?:exec|execSync)\b/.test(content) && /child_process/.test(content);

  // Check whole-file CORS wildcard + credentials combination
  const hasWildcardOrigin = /['"]Access-Control-Allow-Origin['"]\s*,\s*['"]\*['"]|origin\s*:\s*['"]\*['"]/i.test(content);
  const hasAllowCredsTrue = /['"]Access-Control-Allow-Credentials['"]\s*,\s*['"]?true['"]?|credentials\s*:\s*true\b/i.test(content);
  if (hasWildcardOrigin && hasAllowCredsTrue) {
    const idx = content.search(/Access-Control-Allow-Origin|origin\s*:\s*['"]\*['"]/i);
    addFinding({
      rule: 'CORS_WILDCARD_CREDENTIALS',
      severity: 'critical',
      filePath,
      line: idx >= 0 ? lineNumberAt(content, idx) : 1,
      quote: lines[idx >= 0 ? lineNumberAt(content, idx) - 1 : 0] || 'Access-Control-Allow-Origin: *',
      fix: 'Replace wildcard "*" CORS origin with an explicit allowlist of trusted origins when credentials are enabled.',
    });
  }

  // Check JSX target="_blank" in TSX/JSX
  if (ext === '.jsx' || ext === '.tsx') {
    scanHtmlSecurity(content, filePath);
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentOrProseLine(line)) continue;
    const codeOnly = stripQuotedStrings(line);

    // 3. DOM XSS sinks: innerHTML / outerHTML / document.write / dangerouslySetInnerHTML
    if (/\.(?:innerHTML|outerHTML)\s*=\s*(?!['"]{2}\s*;)/.test(codeOnly)) {
      const rhs = line.split(/\.innerHTML\s*=|\.outerHTML\s*=/)[1] || '';
      const isSafeStatic = /^\s*['"][^'"$<>]*['"]\s*;?\s*$/.test(rhs);
      const isSanitized = /DOMPurify\.sanitize|sanitizeHtml|escapeHtml/i.test(line);
      if (!isSafeStatic && !isSanitized) {
        addFinding({
          rule: 'DOM_XSS_INNERHTML',
          severity: 'critical',
          filePath,
          line: i + 1,
          quote: line,
          fix: 'Use textContent or createElement() instead of innerHTML with dynamic/URL-derived values, or sanitize with DOMPurify.',
        });
      }
    } else if (/\bdocument\.write\s*\(/.test(codeOnly) && !/sanitize/i.test(line)) {
      addFinding({
        rule: 'DOM_XSS_INNERHTML',
        severity: 'critical',
        filePath,
        line: i + 1,
        quote: line,
        fix: 'Replace document.write() with safe DOM insertion APIs (textContent / createElement).',
      });
    } else if (/dangerouslySetInnerHTML\s*=\s*\{\{\s*__html\s*:/.test(codeOnly) && !/DOMPurify\.sanitize|sanitizeHtml/i.test(line)) {
      addFinding({
        rule: 'DOM_XSS_INNERHTML',
        severity: 'high',
        filePath,
        line: i + 1,
        quote: line,
        fix: 'Sanitize HTML passed to dangerouslySetInnerHTML with DOMPurify.sanitize() or render plain text.',
      });
    }

    // 4. Command injection via child_process exec/execSync or shell:true
    if (hasChildProcessExecImport && /(?:^|[^\w.])(?:exec|execSync)\s*\(\s*(?:`[^`]*\$\{|[^'"\n]+\+|req\.)/.test(line)) {
      addFinding({
        rule: 'COMMAND_INJECTION_EXEC',
        severity: 'critical',
        filePath,
        line: i + 1,
        quote: line,
        fix: 'Replace child_process.exec/execSync with execFile/execFileSync using an argument array and validate inputs against an allowlist.',
      });
    } else if (/\bshell\s*:\s*true\b/.test(codeOnly)) {
      addFinding({
        rule: 'COMMAND_INJECTION_EXEC',
        severity: 'high',
        filePath,
        line: i + 1,
        quote: line,
        fix: 'Remove shell: true from child_process spawn/execFile options and pass arguments as an array.',
      });
    }

    // 5. SQL injection via template literal or string concatenation
    if (/\.(?:query|execute)\s*\(\s*`[^`]*\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^`]*\$\{[^}]+\}/i.test(line) ||
        /\.(?:query|execute)\s*\(\s*['"][^'"]*\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^'"]*['"]\s*\+/i.test(line)) {
      addFinding({
        rule: 'SQL_INJECTION_INTERPOLATION',
        severity: 'critical',
        filePath,
        line: i + 1,
        quote: line,
        fix: 'Use parameterized queries/prepared statements (e.g. db.query("SELECT ... WHERE email = $1", [email])) instead of string interpolation.',
      });
    }

    // 6. Unchecked path traversal in fs read/write (local +/- 8 line window)
    if (/\b(?:readFile|readFileSync|writeFile|writeFileSync|createReadStream)\s*\(/.test(codeOnly)) {
      const localWindow = lines.slice(Math.max(0, i - 8), Math.min(lines.length, i + 9)).join('\n');
      const localContainment = /\.startsWith\s*\([^)]*(?:sep|UPLOAD|ROOT|DIR|BASE)/i.test(localWindow) || /\bpath\.basename\s*\(/.test(localWindow);
      const ctx = [lines[i - 1] || '', line].join(' ');
      if (!localContainment && /(?:req\.(?:query|params|body)|`[^`]*\$\{[^}]*(?:req\.|file|path|name))/.test(ctx)) {
        addFinding({
          rule: 'PATH_TRAVERSAL_UNCHECKED',
          severity: 'high',
          filePath,
          line: i + 1,
          quote: line,
          fix: 'Resolve the target path with path.resolve(ROOT, input) and verify requested.startsWith(ROOT + path.sep) before file access.',
        });
      }
    }

    // 7. Unverified JWT decode or alg: none (local +/- 8 line window)
    const localJwtWindow = lines.slice(Math.max(0, i - 8), Math.min(lines.length, i + 9)).join('\n');
    const localJwtVerify = /\bjwt\.verify\s*\(/.test(localJwtWindow);
    if ((!localJwtVerify && /\bjwt\.decode\s*\(/.test(codeOnly)) || /algorithms\s*:\s*\[\s*['"]none['"]\s*\]/i.test(line)) {
      addFinding({
        rule: 'JWT_UNVERIFIED_DECODE',
        severity: 'high',
        filePath,
        line: i + 1,
        quote: line,
        fix: 'Always verify JWT signatures using jwt.verify(token, secret, { algorithms: ["HS256"] }) rather than jwt.decode() or alg: "none".',
      });
    }

    // 8. eval() or new Function()
    if (/(?:^|[^\w.])eval\s*\(\s*(?!['"][^'"]*['"]\s*\))/.test(codeOnly) || /\bnew\s+Function\s*\(/.test(codeOnly)) {
      addFinding({
        rule: 'EVAL_CODE_INJECTION',
        severity: 'critical',
        filePath,
        line: i + 1,
        quote: line,
        fix: 'Never call eval() or new Function() on dynamic input; use JSON.parse() or an explicit safe dispatch map.',
      });
    }
  }
}

async function scanFile(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (!HTML_EXTS.has(ext) && !CODE_EXTS.has(ext)) return;

  let content;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return;
  }

  if (HTML_EXTS.has(ext)) {
    scanHtmlSecurity(content, filePath);
    // Extract inline <script> blocks for JS security checks with accurate line offsets
    const scriptMatches = content.matchAll(/<script\b(?![^>]*\btype\s*=\s*["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi);
    for (const sm of scriptMatches) {
      const scriptBody = sm[1];
      const openTagEnd = sm.index + sm[0].indexOf('>') + 1;
      const offsetLines = lineNumberAt(content, openTagEnd) - 1;
      const beforeCount = findings.length;
      scanScriptSecurity(scriptBody, filePath, '.js');
      for (let j = beforeCount; j < findings.length; j++) {
        findings[j].line += offsetLines;
      }
    }
  } else {
    scanScriptSecurity(content, filePath, ext);
  }
}

async function scanDir(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) await scanDir(full);
    } else if (entry.isFile()) {
      await scanFile(full);
    }
  }
}

if (targetStat.isFile()) {
  await scanFile(resolved);
} else if (targetStat.isDirectory()) {
  await scanDir(resolved);
} else {
  console.error(JSON.stringify({ error: `Not a file or directory: ${targetArg}` }));
  process.exit(2);
}

console.log(JSON.stringify({
  scanned_root: resolved,
  supports_single_file: true,
  total_findings: findings.length,
  findings,
}, null, 2));

process.exit(findings.length > 0 ? 1 : 0);
