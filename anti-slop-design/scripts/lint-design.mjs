#!/usr/bin/env node

/**
 * lint-design.mjs — Deterministic linter for AI-generated design slop & token violations
 *
 * Checks:
 *   1. Literal colors outside :root / @theme (CSS, HTML <style>, Tailwind arbitrary values)
 *   2. Purple/blue/indigo AI gradient tropes & Tailwind gradient defaults
 *   3. Un-tokenized AI default font families (Inter, Poppins, Space Grotesk, etc.)
 *   4. transition: all or transition-all
 *   5. overflow: hidden or overflow-x: hidden on html/body (must use overflow-x: clip)
 *   6. width: 100vw or w-[100vw]
 *   7. outline: none/0 without :focus-visible
 *   8. CSS animations without @media (prefers-reduced-motion)
 *   9. !important outside prefers-reduced-motion blocks
 *  10. <div onClick> without button role
 *  11. AI copywriting clichés in headings/hero copy
 *  12. Repeated 3-column icon-card grids & emoji-as-icon bullets
 *  13. Arbitrary Tailwind spacing/radius values (e.g. p-[13px])
 *
 * Usage:
 *   node lint-design.mjs [directory-or-file] [options]
 *
 * Exit codes:
 *   0 = clean (no design slop findings)
 *   1 = design findings detected
 *   2 = usage error or file reading failure
 */

import { readdir, readFile, stat, access } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, extname, resolve, relative, dirname, basename } from 'node:path';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`lint-design.mjs — Deterministic design slop & token linter

Usage:
  node lint-design.mjs [directory-or-file] [options]

Options:
  --help, -h    Show this help message and exit

Checks:
  - Literal colors outside :root or @theme (CSS colors, HTML <style>, Tailwind arbitrary values)
  - Purple/blue/indigo AI gradient tropes
  - Un-tokenized default AI fonts (Inter, Poppins, Space Grotesk, Geist, etc.)
  - "transition: all" or "transition-all"
  - "overflow: hidden" or "overflow-x: hidden" on html / body
  - "width: 100vw" or "w-[100vw]"
  - Outline removed (outline: none/0) without :focus-visible
  - CSS animations without @media (prefers-reduced-motion)
  - !important overrides outside prefers-reduced-motion
  - <div onClick> without role="button"
  - AI copywriting clichés in headings/hero text
  - Repeated 3-column icon-card grids & emoji-as-icon markers
  - Arbitrary Tailwind spacing/radius utilities (e.g. p-[13px])

Exit codes:
  0: Clean — zero design slop findings
  1: Findings detected
  2: Usage or filesystem error
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
const CSS_EXTS = new Set(['.css', '.scss', '.sass', '.less']);
const MARKUP_EXTS = new Set(['.html', '.htm', '.jsx', '.tsx', '.vue', '.svelte']);

const AI_DEFAULT_FONT_RE = /\b(Inter|Poppins|Space Grotesk|Plus Jakarta Sans|DM Sans|Manrope|Sora|Outfit|Urbanist|General Sans|Satoshi|Geist)\b/i;
const AI_GRADIENT_CSS_RE = /(?:linear|radial)-gradient\s*\([^)]*(?:#6366f1|#8b5cf6|#7c3aed|#a855f7|#4f46e5|#9333ea|#c026d3|\bpurple\b|\bviolet\b|\bindigo\b|\bfuchsia\b)/i;
const AI_GRADIENT_TW_RE = /\bfrom-(?:purple|indigo|violet|fuchsia)-\d{2,3}\b.*\b(?:via|to)-(?:indigo|purple|violet|blue|pink)-\d{2,3}\b/;
const AI_CLICHE_RE = /\b(?:unleash(?:ing)? the power|delve into|elevate your|revolutionize your|supercharge your|game[- ]changing|cutting[- ]edge|empower your|next[- ]generation|harness the power|transform the way|take your .{1,30} to the next level|seamless(?:ly)? (?:ai|workflow|integration|experience)|unlock the power)\b/i;
const EMOJI_ICON_RE = /<span[^>]*>\s*[✨🚀⚡🔥💡🎯]\s*<\/span>|<h[1-4][^>]*>[^<]*[✨🚀⚡🔥💡🎯]/u;

const findings = [];
let findingCounter = 0;

function nextId() {
  findingCounter++;
  return `DSGN-${String(findingCounter).padStart(3, '0')}`;
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

const ROOT_SELECTOR_RE = /(?:^|[\s,>+~])(?:html|body)(?=[\s,{:.#\[>+~]|$)/i;

function lintCssContent(content, filePath, lineOffset = 0) {
  const lines = content.split('\n');
  let inRootOrTheme = false;
  let rootDepth = -1;
  let inReducedMotion = false;
  let reducedMotionDepth = -1;
  let inBlockComment = false;
  let braceDepth = 0;
  let hasKeyframes = false;
  let firstAnimationLine = null;
  let firstAnimationQuote = null;
  const hasReducedMotion = content.includes('prefers-reduced-motion');

  let currentSelector = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1 + lineOffset;

    let cleanLine = line;
    if (inBlockComment) {
      const closeIdx = cleanLine.indexOf('*/');
      if (closeIdx === -1) {
        continue;
      }
      cleanLine = cleanLine.slice(closeIdx + 2);
      inBlockComment = false;
    }
    cleanLine = cleanLine.replace(/\/\*[\s\S]*?\*\//g, '');
    const openIdx = cleanLine.indexOf('/*');
    if (openIdx !== -1) {
      cleanLine = cleanLine.slice(0, openIdx);
      inBlockComment = true;
    }
    const cleanTrimmed = cleanLine.trim();
    const isComment = !cleanTrimmed || cleanTrimmed.startsWith('//');

    if (!isComment) {
      if (cleanTrimmed.includes('{')) {
        const parts = cleanTrimmed.split('{');
        currentSelector = (currentSelector + ' ' + parts[0]).trim();
      } else if (braceDepth === 0 && !cleanTrimmed.startsWith('@')) {
        currentSelector = (currentSelector + ' ' + cleanTrimmed).trim();
      }

      if (!inRootOrTheme && (/:root|@theme/i.test(currentSelector) || (/:root|@theme/i.test(cleanTrimmed) && cleanTrimmed.includes('{')))) {
        inRootOrTheme = true;
        rootDepth = braceDepth;
      }
      if (!inReducedMotion && /prefers-reduced-motion/i.test(cleanTrimmed) && cleanTrimmed.includes('{')) {
        inReducedMotion = true;
        reducedMotionDepth = braceDepth;
      }

      for (const ch of cleanLine) {
        if (ch === '{') braceDepth++;
        if (ch === '}') {
          braceDepth = Math.max(0, braceDepth - 1);
          if (inReducedMotion && braceDepth <= reducedMotionDepth) {
            inReducedMotion = false;
            reducedMotionDepth = -1;
          }
          if (inRootOrTheme && braceDepth <= rootDepth) {
            inRootOrTheme = false;
            rootDepth = -1;
            currentSelector = '';
          }
          if (braceDepth === 0) {
            currentSelector = '';
          }
        }
      }
    }

    // A. Purple/blue AI gradient tropes
    if (!isComment && AI_GRADIENT_CSS_RE.test(cleanLine)) {
      const match = cleanLine.match(AI_GRADIENT_CSS_RE);
      findings.push({
        id: nextId(),
        rule: 'AI_PURPLE_BLUE_GRADIENT',
        severity: 'high',
        file: relFile(filePath),
        line: lineNum,
        quote: match[0].slice(0, 100),
        fix: 'Replace generic purple/indigo gradient defaults with an intentional flat surface token or documented brand gradient.',
      });
    }

    // B. Literal colors outside :root/@theme (ignore SVG url(#id) fragment references)
    if (!inRootOrTheme && !isComment) {
      const lineWithoutUrlIds = cleanLine.replace(/\burl\s*\(\s*['"]?#[^)]+['"]?\s*\)/gi, 'url()');
      const colorMatch = lineWithoutUrlIds.match(/(?<![\w-])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![\w-])|\b(?:rgb|rgba|hsl|hsla)\s*\([^)]+\)/);
      if (colorMatch) {
        findings.push({
          id: nextId(),
          rule: 'LITERAL_COLOR',
          severity: 'high',
          file: relFile(filePath),
          line: lineNum,
          quote: colorMatch[0],
          fix: 'Replace literal color with a CSS variable token defined in :root (e.g. var(--color-brand-500)).',
        });
      }
    }

    // C. Default AI font-family outside var(--font-*)
    if (!inRootOrTheme && !isComment && /\bfont-family\s*:/i.test(cleanLine) && !/var\(--font-/i.test(cleanLine)) {
      const fontMatch = cleanLine.match(AI_DEFAULT_FONT_RE);
      if (fontMatch) {
        findings.push({
          id: nextId(),
          rule: 'AI_DEFAULT_FONT',
          severity: 'medium',
          file: relFile(filePath),
          line: lineNum,
          quote: trimmed.slice(0, 100),
          fix: `Avoid defaulting to "${fontMatch[1]}" directly; choose an intentional brand typeface tokenized via --font-sans / --font-heading in :root.`,
        });
      }
    }

    // D. transition: all
    if (!isComment && /transition\s*:\s*all\b/i.test(cleanLine)) {
      const match = cleanLine.match(/transition\s*:\s*all\b/i);
      findings.push({
        id: nextId(),
        rule: 'TRANSITION_ALL',
        severity: 'high',
        file: relFile(filePath),
        line: lineNum,
        quote: match[0],
        fix: 'Never transition "all". Specify explicit properties (e.g. "transition: transform 150ms ease-out, opacity 150ms ease-out").',
      });
    }

    // E. overflow: hidden or overflow-x: hidden on html/body (never match .modal-body / .card-body)
    const isRootSelector =
      ROOT_SELECTOR_RE.test(currentSelector) ||
      (cleanLine.includes('{') && ROOT_SELECTOR_RE.test(cleanLine.split('{')[0]));
    if (!isComment && isRootSelector && /overflow(?:-x)?\s*:\s*hidden\b/i.test(cleanLine)) {
      findings.push({
        id: nextId(),
        rule: 'OVERFLOW_HIDDEN_ROOT',
        severity: 'critical',
        file: relFile(filePath),
        line: lineNum,
        quote: trimmed,
        fix: 'Never use "overflow: hidden" or "overflow-x: hidden" on html or body. Use "overflow-x: clip" instead.',
      });
    }

    // F. width: 100vw
    if (!isComment && /width\s*:\s*100vw\b/i.test(cleanLine)) {
      findings.push({
        id: nextId(),
        rule: 'WIDTH_100VW',
        severity: 'high',
        file: relFile(filePath),
        line: lineNum,
        quote: 'width: 100vw',
        fix: 'Avoid "width: 100vw" as it causes horizontal scrollbars on desktop with scrollbar gutters. Use "width: 100%" instead.',
      });
    }

    // G. Outline removed without :focus-visible
    if (!isComment && /outline\s*:\s*(?:none|0)\b/i.test(cleanLine) && !cleanLine.includes(':focus-visible')) {
      findings.push({
        id: nextId(),
        rule: 'OUTLINE_REMOVED',
        severity: 'high',
        file: relFile(filePath),
        line: lineNum,
        quote: trimmed,
        fix: 'Never set "outline: none" or "outline: 0" without pairing it with an immediate, visible :focus-visible ring.',
      });
    }

    // H. !important override outside prefers-reduced-motion
    if (!inReducedMotion && !isComment && /!important\b/i.test(cleanLine)) {
      findings.push({
        id: nextId(),
        rule: 'IMPORTANT_OVERRIDE',
        severity: 'medium',
        file: relFile(filePath),
        line: lineNum,
        quote: trimmed.slice(0, 100),
        fix: 'Avoid !important overrides; fix selector specificity or cascade layers instead.',
      });
    }

    if (!isComment && (/@keyframes\b/i.test(cleanLine) || (/\banimation\s*:\s*[a-zA-Z]/i.test(cleanLine) && !/\banimation\s*:\s*none\b/i.test(cleanLine)))) {
      hasKeyframes = true;
      if (firstAnimationLine === null) {
        firstAnimationLine = lineNum;
        firstAnimationQuote = cleanTrimmed.slice(0, 100) || trimmed.slice(0, 100);
      }
    }
  }

  // I. Animation without prefers-reduced-motion
  if (hasKeyframes && !hasReducedMotion) {
    findings.push({
      id: nextId(),
      rule: 'MISSING_REDUCED_MOTION',
      severity: 'high',
      file: relFile(filePath),
      line: firstAnimationLine || 1 + lineOffset,
      quote: firstAnimationQuote || '@keyframes',
      fix: 'File defines CSS animation or @keyframes without @media (prefers-reduced-motion: reduce) override.',
    });
  }
}

async function lintCssFile(filePath) {
  let content;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return;
  }
  lintCssContent(content, filePath, 0);
}

async function lintMarkupFile(filePath) {
  let content;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const isHtml = ext === '.html' || ext === '.htm';

  // Lint inline <style> blocks inside HTML files
  if (isHtml) {
    const styleMatches = content.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi);
    for (const sm of styleMatches) {
      const openEnd = sm.index + sm[0].indexOf('>') + 1;
      const lineOffset = lineNumberAt(content, openEnd) - 1;
      lintCssContent(sm[1], filePath, lineOffset);
    }
  }

  // Strip <style> and <script> for copy/DOM-structure checks on HTML
  const visibleContent = isHtml
    ? content
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (m) => m.replace(/[^\n]/g, ' '))
    : content;

  const lines = content.split('\n');
  const visibleLines = visibleContent.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const visLine = visibleLines[i] || '';

    // Google Fonts loading default AI font families
    if (/fonts\.googleapis\.com/i.test(line)) {
      const gfMatch = line.match(/family=(Inter|Poppins|Space\+Grotesk|Plus\+Jakarta\+Sans|DM\+Sans|Manrope|Sora|Outfit|Urbanist|General\+Sans|Satoshi|Geist)\b/i);
      if (gfMatch) {
        findings.push({
          id: nextId(),
          rule: 'AI_DEFAULT_FONT',
          severity: 'medium',
          file: relFile(filePath),
          line: i + 1,
          quote: gfMatch[0],
          fix: `Avoid defaulting to Google Font "${gfMatch[1].replace(/\+/g, ' ')}"; select an intentional brand typeface.`,
        });
      }
    }

    // Tailwind purple/indigo gradient defaults
    const twGrad = line.match(AI_GRADIENT_TW_RE);
    if (twGrad) {
      findings.push({
        id: nextId(),
        rule: 'AI_PURPLE_BLUE_GRADIENT',
        severity: 'high',
        file: relFile(filePath),
        line: i + 1,
        quote: twGrad[0].slice(0, 100),
        fix: 'Replace default AI purple/pink/indigo Tailwind gradient with a subtle surface or intentional brand palette.',
      });
    }

    // Tailwind arbitrary colors: bg-[#...], text-[#...], border-[#...]
    const arbitraryColor = line.match(/\b(?:bg|text|border|fill|stroke|ring)-\[#(?:[0-9a-fA-F]{3,8})\]/);
    if (arbitraryColor) {
      findings.push({
        id: nextId(),
        rule: 'LITERAL_COLOR_TAILWIND',
        severity: 'high',
        file: relFile(filePath),
        line: i + 1,
        quote: arbitraryColor[0],
        fix: 'Avoid arbitrary color utilities. Use semantic theme color tokens (e.g. bg-brand-500, text-neutral-900).',
      });
    }

    // Arbitrary Tailwind spacing / radius hacks (e.g. p-[13px], rounded-[22px])
    const arbitrarySpacing = line.match(/\b(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|rounded)-\[\d+(?:px|rem|em)\]/);
    if (arbitrarySpacing) {
      findings.push({
        id: nextId(),
        rule: 'ARBITRARY_SPACING_TAILWIND',
        severity: 'medium',
        file: relFile(filePath),
        line: i + 1,
        quote: arbitrarySpacing[0],
        fix: 'Use the standard design scale utilities (e.g. p-4, gap-6, rounded-md) rather than arbitrary pixel values.',
      });
    }

    // transition-all class
    if (/\btransition-all\b/.test(line)) {
      findings.push({
        id: nextId(),
        rule: 'TRANSITION_ALL',
        severity: 'high',
        file: relFile(filePath),
        line: i + 1,
        quote: 'transition-all',
        fix: 'Avoid "transition-all". Transition specific properties (e.g. transition-colors transition-opacity).',
      });
    }

    // Arbitrary w-[100vw]
    if (/\bw-\[100vw\]\b/.test(line)) {
      findings.push({
        id: nextId(),
        rule: 'WIDTH_100VW',
        severity: 'high',
        file: relFile(filePath),
        line: i + 1,
        quote: 'w-[100vw]',
        fix: 'Avoid "w-[100vw]". Use "w-full" or "max-w-full" to avoid horizontal scrollbars.',
      });
    }

    // AI copywriting clichés in visible markup
    const clicheMatch = visLine.match(AI_CLICHE_RE);
    if (clicheMatch) {
      findings.push({
        id: nextId(),
        rule: 'AI_COPY_CLICHE',
        severity: 'medium',
        file: relFile(filePath),
        line: i + 1,
        quote: clicheMatch[0],
        fix: 'Replace generic AI marketing clichés with specific, concrete product language.',
      });
    }
  }

  // <div onClick> without button role (supports multi-line JSX/HTML tags)
  const divClickMatches = visibleContent.matchAll(/<div\b([^>]*\b(?:onClick|@click)\b[^>]*)>/gi);
  for (const dm of divClickMatches) {
    const attrs = dm[1];
    const hasRoleButton = /role\s*=\s*["']button["']/i.test(attrs);
    if (!hasRoleButton) {
      findings.push({
        id: nextId(),
        rule: 'DIV_ONCLICK',
        severity: 'high',
        file: relFile(filePath),
        line: lineNumberAt(visibleContent, dm.index),
        quote: dm[0].split(/\r?\n/)[0].replace(/\s+/g, ' ').trim().slice(0, 80),
        fix: 'Replace <div onClick> with a native <button> element, or add role="button" with tabIndex and keyboard handlers.',
      });
    }
  }

  // Repeated 3-column generic icon-card grid detection
  const hasThreeColGrid = /grid-cols-3|repeat\s*\(\s*3\s*,/i.test(content);
  const cardBlocks = [...visibleContent.matchAll(/<(?:div|article)\b[^>]*class(?:Name)?=["'][^"']*\bcard\b[^"']*["'][^>]*>[\s\S]*?<\/(?:div|article)>/gi)];
  const emojiIcons = [...visibleContent.matchAll(new RegExp(EMOJI_ICON_RE.source, 'gu'))];

  if ((hasThreeColGrid && cardBlocks.length >= 3) || (hasThreeColGrid && emojiIcons.length >= 1) || emojiIcons.length >= 3) {
    const anchorMatch = cardBlocks[0] || emojiIcons[0] || visibleContent.match(/grid-cols-3|repeat\s*\(\s*3\s*,/i);
    const lineNum = anchorMatch && typeof anchorMatch.index === 'number' ? lineNumberAt(visibleContent, anchorMatch.index) : 1;
    findings.push({
      id: nextId(),
      rule: 'REPEATED_ICON_CARD_GRID',
      severity: 'medium',
      file: relFile(filePath),
      line: lineNum,
      quote: (anchorMatch ? anchorMatch[0].split('\n')[0] : '3-column icon card grid').slice(0, 80),
      fix: 'Replace generic 3-column icon-card grids and decorative emoji icons with an authentic layout tailored to the content.',
    });
  }
}

async function scanFile(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (CSS_EXTS.has(ext)) {
    await lintCssFile(filePath);
  } else if (MARKUP_EXTS.has(ext)) {
    await lintMarkupFile(filePath);
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
