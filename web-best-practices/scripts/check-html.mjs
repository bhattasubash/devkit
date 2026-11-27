#!/usr/bin/env node

/**
 * check-html.mjs — Deterministic scanner for HTML & component best practices
 *
 * Checks:
 *   1. <title> present and non-empty in HTML documents
 *   2. <meta name="description"> present and length 50–160 characters
 *   3. <meta name="viewport" content="width=device-width, ..."> and no zoom lock
 *   4. <html lang="..."> attribute set
 *   5. Exactly one <h1> heading per page
 *   6. Semantic landmark regions when using <div> layout wrappers
 *   7. <img> elements have alt attribute and explicit width/height dimensions
 *   8. Form <input>, <select>, and <textarea> elements have accessible labels
 *   9. Broken anchor links (<a href="#">)
 *
 * Confidence:
 *   - .html documents: "deterministic"
 *   - .jsx / .tsx components: "heuristic" (since props or wrappers may be dynamic)
 *
 * Usage:
 *   node check-html.mjs [directory-or-file] [options]
 *
 * Exit codes:
 *   0 = clean (no HTML best practice issues)
 *   1 = findings detected
 *   2 = usage error or filesystem error
 */

import { readdir, readFile, stat, access } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, extname, resolve, relative, dirname, basename } from 'node:path';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`check-html.mjs — HTML and component standards scanner

Usage:
  node check-html.mjs [directory-or-file] [options]

Options:
  --help, -h    Show this help message and exit

Checks:
  - <title> tag present and non-empty
  - <meta name="description"> length between 50 and 160 characters
  - <meta name="viewport"> with width=device-width and zoom enabled
  - <html lang="..."> attribute set
  - Exactly one <h1> element per page
  - Semantic landmark containers (<main>/<article>/<section>) when layout uses <div> wrappers
  - <img> has alt attribute and explicit width/height
  - <input>, <select>, and <textarea> have an associated label or aria-label
  - No empty dummy links (<a href="#">)

Exit codes:
  0: Clean (no issues found)
  1: Issues detected
  2: Error
`);
  process.exit(0);
}

const targetArg = args[0] || '.';
const targetPath = resolve(targetArg);

try {
  await access(targetPath);
} catch {
  console.error(JSON.stringify({ error: `Path does not exist: ${targetArg}` }));
  process.exit(2);
}

const targetStat = await stat(targetPath);
const baseDir = targetStat.isFile() ? dirname(targetPath) : targetPath;

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.devkit']);
try {
  const pkgPath = join(baseDir, 'package.json');
  if (existsSync(pkgPath) && JSON.parse(readFileSync(pkgPath, 'utf-8'))?.name === '@bhattasubash/devkit') {
    SKIP_DIRS.add('evals');
    SKIP_DIRS.add('eval_fixtures');
  }
} catch {}
const HTML_EXTS = new Set(['.html', '.htm']);
const JSX_EXTS = new Set(['.jsx', '.tsx']);

const findings = [];
let findingCounter = 0;

function nextId() {
  findingCounter++;
  return `HTML-${String(findingCounter).padStart(3, '0')}`;
}

function relFile(filePath) {
  return relative(baseDir, filePath).replace(/\\/g, '/') || basename(filePath);
}

function lineNumberAt(content, index) {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

async function checkHtmlDoc(filePath) {
  let content;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return;
  }

  const lines = content.split('\n');
  const relPath = relFile(filePath);
  const confidence = 'deterministic';
  const headOpenMatch = content.match(/<head\b[^>]*>/i);
  const headLine = headOpenMatch ? lineNumberAt(content, headOpenMatch.index) : 1;
  const headQuote = headOpenMatch ? headOpenMatch[0].split(/\r?\n/)[0].trim().slice(0, 80) : '<html';
  const bodyOpenMatch = content.match(/<body\b[^>]*>/i);
  const bodyLine = bodyOpenMatch ? lineNumberAt(content, bodyOpenMatch.index) : 1;
  const bodyQuote = bodyOpenMatch ? bodyOpenMatch[0].split(/\r?\n/)[0].trim().slice(0, 80) : '<body';

  // 1. Check <html lang="...">
  const htmlTagMatch = content.match(/<html\b[^>]*>/i);
  if (htmlTagMatch) {
    if (!/lang=["'][a-zA-Z0-9_-]+["']/i.test(htmlTagMatch[0])) {
      const lineNum = lineNumberAt(content, htmlTagMatch.index);
      findings.push({
        id: nextId(),
        rule: 'MISSING_HTML_LANG',
        severity: 'high',
        confidence,
        file: relPath,
        line: lineNum,
        quote: htmlTagMatch[0],
        fix: 'Add lang attribute to <html> tag (e.g. <html lang="en">).',
      });
    }
  }

  // 2. Check <title>
  const titleMatch = content.match(/<title\b[^>]*>(.*?)<\/title>/is);
  if (!titleMatch || !titleMatch[1].trim()) {
    findings.push({
      id: nextId(),
      rule: 'MISSING_TITLE',
      severity: 'critical',
      confidence,
      file: relPath,
      line: titleMatch ? lineNumberAt(content, titleMatch.index) : headLine,
      quote: titleMatch ? titleMatch[0].split(/\r?\n/)[0].trim().slice(0, 80) : headQuote,
      fix: 'Include a descriptive, non-empty <title> tag inside <head>.',
    });
  }

  // 3. Check viewport meta & zoom lock
  const viewportMatch = content.match(/<meta\b[^>]*name=["']viewport["'][^>]*>/i) ||
                        content.match(/<meta\b[^>]*content=["'][^"']*width=device-width[^"']*["'][^>]*name=["']viewport["'][^>]*>/i);
  if (!viewportMatch || !viewportMatch[0].includes('width=device-width')) {
    findings.push({
      id: nextId(),
      rule: 'MISSING_VIEWPORT_META',
      severity: 'critical',
      confidence,
      file: relPath,
      line: viewportMatch ? lineNumberAt(content, viewportMatch.index) : headLine,
      quote: viewportMatch ? viewportMatch[0].split(/\r?\n/)[0].trim().slice(0, 80) : headQuote,
      fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> inside <head>.',
    });
  } else if (/user-scalable\s*=\s*(?:no|0)\b|maximum-scale\s*=\s*1(?:\.0+)?\b/i.test(viewportMatch[0])) {
    findings.push({
      id: nextId(),
      rule: 'ZOOM_DISABLED_VIEWPORT',
      severity: 'high',
      confidence,
      file: relPath,
      line: lineNumberAt(content, viewportMatch.index),
      quote: viewportMatch[0].split(/\r?\n/)[0].trim().slice(0, 100),
      fix: 'Allow pinch-to-zoom on mobile devices; remove user-scalable=no and maximum-scale=1.',
    });
  }

  // 4. Check meta description
  const metaDescMatch = content.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                        content.match(/<meta\b[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
  if (!metaDescMatch) {
    findings.push({
      id: nextId(),
      rule: 'MISSING_META_DESCRIPTION',
      severity: 'high',
      confidence,
      file: relPath,
      line: headLine,
      quote: headQuote,
      fix: 'Add a <meta name="description" content="..."> tag with 50–160 characters summarizing the page.',
    });
  } else {
    const descText = metaDescMatch[1].trim();
    if (descText.length < 50 || descText.length > 160) {
      const lineNum = lineNumberAt(content, metaDescMatch.index);
      findings.push({
        id: nextId(),
        rule: 'META_DESCRIPTION_LENGTH',
        severity: 'medium',
        confidence,
        file: relPath,
        line: lineNum,
        quote: metaDescMatch[0].split(/\r?\n/)[0].trim().slice(0, 80),
        fix: `Meta description length (${descText.length} chars) is outside recommended range (50–160 chars).`,
      });
    }
  }

  // 5. Check <h1> count
  const h1Matches = Array.from(content.matchAll(/<h1\b[^>]*>/gi));
  if (h1Matches.length === 0) {
    findings.push({
      id: nextId(),
      rule: 'MISSING_H1',
      severity: 'high',
      confidence,
      file: relPath,
      line: bodyLine,
      quote: bodyQuote,
      fix: 'Page must have exactly one <h1> element denoting the primary topic.',
    });
  } else if (h1Matches.length > 1) {
    const secondH1Line = lineNumberAt(content, h1Matches[1].index);
    findings.push({
      id: nextId(),
      rule: 'MULTIPLE_H1',
      severity: 'high',
      confidence,
      file: relPath,
      line: secondH1Line,
      quote: h1Matches[1][0].split(/\r?\n/)[0].trim(),
      fix: `Page has ${h1Matches.length} <h1> tags. Use exactly one <h1> for the page title and <h2>–<h6> for subsections.`,
    });
  }

  // 6. Semantic landmarks when layout uses nested <div> wrappers
  const bodyMatch = content.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    const bodyHtml = bodyMatch[1];
    const divMatches = Array.from(bodyHtml.matchAll(/<div\b[^>]*>/gi));
    const hasSemanticLandmark = /<(?:main|article|section)\b/i.test(bodyHtml);
    if (divMatches.length >= 2 && !hasSemanticLandmark) {
      findings.push({
        id: nextId(),
        rule: 'MISSING_SEMANTIC_LANDMARKS',
        severity: 'high',
        confidence,
        file: relPath,
        line: lineNumberAt(content, bodyMatch.index + bodyMatch[0].indexOf(divMatches[0][0])),
        quote: divMatches[0][0].slice(0, 80),
        fix: 'Replace generic nested <div> layout wrappers with semantic HTML landmarks (<main>, <article>, <section>).',
      });
    }
  }

  await checkElements(content, lines, relPath, confidence);
}

async function checkJsxComponent(filePath) {
  let content;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return;
  }

  const lines = content.split('\n');
  const relPath = relFile(filePath);
  const confidence = 'heuristic';

  await checkElements(content, lines, relPath, confidence);
}

async function checkElements(fullContent, lines, relPath, confidence) {
  const firstLineQuote = (raw) => raw.split(/\r?\n/)[0].replace(/\s+/g, ' ').trim().slice(0, 80);

  // 7. <img> checks (supports multi-line tags)
  const imgMatches = Array.from(fullContent.matchAll(/<img\b([^>]*?)\/?>/gi));
  for (const match of imgMatches) {
    const attrs = match[1];
    const lineNum = lineNumberAt(fullContent, match.index);

    if (!/\balt\s*=/i.test(attrs)) {
      findings.push({
        id: nextId(),
        rule: 'IMG_MISSING_ALT',
        severity: 'high',
        confidence,
        file: relPath,
        line: lineNum,
        quote: firstLineQuote(match[0]),
        fix: 'Every <img> must have an alt attribute (alt="" if decorative, or descriptive text).',
      });
    }

    const hasWidth = /\bwidth\s*=/i.test(attrs) || /style=["'][^"']*width\s*:/i.test(attrs);
    const hasHeight = /\bheight\s*=/i.test(attrs) || /style=["'][^"']*height\s*:/i.test(attrs);
    if (!hasWidth || !hasHeight) {
      findings.push({
        id: nextId(),
        rule: 'IMG_MISSING_DIMENSIONS',
        severity: 'medium',
        confidence,
        file: relPath,
        line: lineNum,
        quote: firstLineQuote(match[0]),
        fix: 'Set explicit width and height on <img> (or CSS aspect-ratio) to prevent Cumulative Layout Shift (CLS).',
      });
    }
  }

  // 8. Unlabeled inputs, selects, and textareas (supports multi-line tags & multi-line <label> wrapping)
  const formFieldMatches = Array.from(fullContent.matchAll(/<(input|select|textarea)\b([^>]*?)\/?>/gi));
  for (const match of formFieldMatches) {
    const tagName = match[1].toLowerCase();
    const attrs = match[2];
    const lineNum = lineNumberAt(fullContent, match.index);

    if (tagName === 'input') {
      const typeMatch = attrs.match(/\btype=["']([^"']*)["']/i);
      const inputType = typeMatch ? typeMatch[1].toLowerCase() : 'text';
      if (['hidden', 'submit', 'button', 'reset'].includes(inputType)) {
        continue;
      }
    }

    const hasAriaLabel = /\baria-label\s*=/i.test(attrs) || /\baria-labelledby\s*=/i.test(attrs);
    const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
    let hasMatchingLabel = false;

    if (idMatch) {
      const escapedId = idMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const labelRegex = new RegExp(`<label\\b[^>]*for=["']${escapedId}["']`, 'i');
      if (labelRegex.test(fullContent)) {
        hasMatchingLabel = true;
      }
    }

    const prefixSlice = fullContent.slice(Math.max(0, match.index - 800), match.index);
    const lastOpenLabel = prefixSlice.search(/<label\b[^>]*>(?![\s\S]*<label\b)/i);
    const lastCloseLabel = prefixSlice.search(/<\/label>(?![\s\S]*<\/label>)/i);
    const isWrapped = lastOpenLabel !== -1 && lastOpenLabel > lastCloseLabel;

    if (!hasAriaLabel && !hasMatchingLabel && !isWrapped) {
      const isInput = tagName === 'input';
      findings.push({
        id: nextId(),
        rule: isInput ? 'UNLABELED_INPUT' : 'UNLABELED_SELECT_TEXTAREA',
        severity: 'high',
        confidence,
        file: relPath,
        line: lineNum,
        quote: firstLineQuote(match[0]),
        fix: `Provide a visible <label for="...">, wrap <${tagName}> in <label>, or add aria-label for accessibility.`,
      });
    }
  }

  // 9. Broken anchor links (<a href="#">)
  const brokenLinks = Array.from(fullContent.matchAll(/<a\b[^>]*href=["']#["'][^>]*>/gi));
  for (const m of brokenLinks) {
    findings.push({
      id: nextId(),
      rule: 'BROKEN_HASH_LINK',
      severity: 'medium',
      confidence,
      file: relPath,
      line: lineNumberAt(fullContent, m.index),
      quote: firstLineQuote(m[0]),
      fix: 'Avoid <a href="#">. Use a <button> for clickable actions or provide a meaningful href URL.',
    });
  }
}

async function scanFile(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (HTML_EXTS.has(ext)) {
    await checkHtmlDoc(filePath);
  } else if (JSX_EXTS.has(ext)) {
    await checkJsxComponent(filePath);
  }
}

async function scan(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        await scan(full);
      }
    } else if (entry.isFile()) {
      await scanFile(full);
    }
  }
}

if (targetStat.isFile()) {
  await scanFile(targetPath);
} else if (targetStat.isDirectory()) {
  await scan(targetPath);
} else {
  console.error(JSON.stringify({ error: `Not a file or directory: ${targetArg}` }));
  process.exit(2);
}

const output = {
  scanned_dir: targetPath,
  supports_single_file: true,
  total_findings: findings.length,
  findings,
};

console.log(JSON.stringify(output, null, 2));
process.exit(findings.length > 0 ? 1 : 0);
