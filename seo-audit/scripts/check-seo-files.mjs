#!/usr/bin/env node

/**
 * check-seo-files.mjs — Deterministic SEO, Structured Data & AEO validator
 *
 * Checks:
 *   1. robots.txt present and contains a Sitemap: directive (directory scans)
 *   2. sitemap.xml present with valid absolute URLs on a single host, NO fragments (#) (directory scans)
 *   3. Canonical link (<link rel="canonical" href="...">) present on HTML pages
 *   4. Open Graph meta tags (og:title, og:description) present
 *   5. <meta name="robots" content="noindex"> detection on public pages
 *   6. JSON-LD presence, syntax, @context, @type, and required properties across common types
 *   7. Client-only SPA rendering detection (empty root container)
 *   8. AEO extractability checks: vague CTA headings & llms.txt discovery
 *   9. Next.js App Router static check: 'use client' with ignored metadata exports
 *
 * Usage:
 *   node check-seo-files.mjs [directory-or-file] [options]
 *
 * Exit codes:
 *   0 = clean (no actionable SEO findings; info advisories do not fail)
 *   1 = actionable findings detected
 *   2 = usage error or filesystem error
 */

import { readdir, readFile, stat, access } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, extname, resolve, relative, dirname, basename } from 'node:path';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`check-seo-files.mjs — Deterministic SEO & AEO validator

Usage:
  node check-seo-files.mjs [directory-or-file] [options]

Options:
  --help, -h    Show this help message and exit

Checks:
  - robots.txt exists and contains Sitemap: line (directory mode)
  - sitemap.xml exists, URLs are absolute, single host, and contain no fragments (#) (directory mode)
  - <link rel="canonical"> present on HTML pages
  - Open Graph tags (og:title, og:description) present on HTML pages
  - No accidental <meta name="robots" content="noindex">
  - JSON-LD presence and valid @context, @type, and required properties
  - Client-only rendering detection (empty root container with no pre-rendered markup)
  - AEO vague headings & llms.txt reference checks
  - Next.js 'use client' with exported metadata

Exit codes:
  0: Clean (no actionable findings)
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
const isSingleFile = targetStat.isFile();

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.devkit']);
try {
  const pkgPath = join(baseDir, 'package.json');
  if (existsSync(pkgPath) && JSON.parse(readFileSync(pkgPath, 'utf-8'))?.name === '@bhattasubash/devkit') {
    SKIP_DIRS.add('evals');
    SKIP_DIRS.add('eval_fixtures');
  }
} catch {}
const VAGUE_AEO_HEADING_RE = /^(?:learn more|read more|overview|features|details|about us|services|more info|introduction|click here|get started)$/i;
const QUESTION_HEADING_RE = /\?$|^(?:how|what|why|when|where|which|who|can|do|does|is|are|should|will)\b/i;

const findings = [];
const advisories = [];
let findingCounter = 0;

function nextId() {
  findingCounter++;
  return `SEO-${String(findingCounter).padStart(3, '0')}`;
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

async function findFileInDirs(filename, dirs) {
  for (const d of dirs) {
    const candidate = join(d, filename);
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  return null;
}

const searchDirs = [baseDir, join(baseDir, 'public'), join(baseDir, 'static'), join(baseDir, 'dist')];

// 1. Check robots.txt
async function checkRobotsTxt(explicitPath = null) {
  const robotsPath = explicitPath || (await findFileInDirs('robots.txt', searchDirs));
  if (!robotsPath) {
    findings.push({
      id: nextId(),
      rule: 'MISSING_ROBOTS_TXT',
      finding_type: 'missing_file',
      severity: 'high',
      file: 'robots.txt',
      line: 1,
      quote: 'robots.txt',
      fix: 'Create a robots.txt file in the site root with crawl permissions and a Sitemap: directive.',
    });
    return;
  }

  const rel = relFile(robotsPath);
  let content = '';
  try {
    content = await readFile(robotsPath, 'utf-8');
  } catch {
    return;
  }

  const lines = content.split('\n');
  const sitemapLine = lines.find(l => /^sitemap\s*:\s*https?:\/\//i.test(l.trim()));
  if (!sitemapLine) {
    findings.push({
      id: nextId(),
      rule: 'ROBOTS_MISSING_SITEMAP',
      severity: 'high',
      file: rel,
      line: 1,
      quote: lines[0] || 'robots.txt',
      fix: 'Add a "Sitemap: https://yourdomain.com/sitemap.xml" directive to robots.txt.',
    });
  }

  // Parse User-agent blocks for blanket Disallow: / and AI crawler blocks
  const AI_BOTS = new Set(['gptbot', 'oai-searchbot', 'perplexitybot', 'claudebot', 'claudebot-searchbot', 'google-extended']);
  let currentAgents = [];
  const blockedAiBots = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].replace(/#.*$/, '').trim();
    if (!raw) continue;
    const uaMatch = raw.match(/^user-agent\s*:\s*(.+)$/i);
    if (uaMatch) {
      const agent = uaMatch[1].trim().toLowerCase();
      if (i > 0 && !/^user-agent\s*:/i.test(lines[i - 1].trim())) {
        currentAgents = [agent];
      } else {
        currentAgents.push(agent);
      }
      continue;
    }
    const disallowMatch = raw.match(/^disallow\s*:\s*(.*)$/i);
    if (disallowMatch && disallowMatch[1].trim() === '/') {
      if (currentAgents.includes('*')) {
        findings.push({
          id: nextId(),
          rule: 'ROBOTS_DISALLOW_ALL',
          severity: 'critical',
          file: rel,
          line: i + 1,
          quote: lines[i].trim(),
          fix: 'User-agent: * with Disallow: / blocks all search engines from indexing your site. Restrict only private paths.',
        });
      }
      for (const a of currentAgents) {
        if (AI_BOTS.has(a)) blockedAiBots.push({ bot: a, line: i + 1, quote: lines[i].trim() });
      }
    }
  }

  if (blockedAiBots.length > 0) {
    const firstLine = blockedAiBots[0].line;
    findings.push({
      id: nextId(),
      rule: 'ROBOTS_BLOCKS_AI_BOTS',
      severity: 'medium',
      file: rel,
      line: firstLine,
      quote: (lines[firstLine - 1] || blockedAiBots[0].quote).trim(),
      detail: blockedAiBots.map((b) => b.bot).join(', '),
      fix: 'AI search/crawler bots are blocked with Disallow: /. Confirm whether blocking search citations (OAI-SearchBot, PerplexityBot) is intentional.',
    });
  }
}

// 2. Check sitemap.xml
async function checkSitemapXml(explicitPath = null) {
  const sitemapPath = explicitPath || (await findFileInDirs('sitemap.xml', searchDirs));
  if (!sitemapPath) {
    findings.push({
      id: nextId(),
      rule: 'MISSING_SITEMAP_XML',
      finding_type: 'missing_file',
      severity: 'high',
      file: 'sitemap.xml',
      line: 1,
      quote: 'sitemap.xml',
      fix: 'Create a sitemap.xml listing all public, indexable page URLs with <loc> and <lastmod>.',
    });
    return;
  }

  const rel = relFile(sitemapPath);
  let content = '';
  try {
    content = await readFile(sitemapPath, 'utf-8');
  } catch {
    return;
  }

  const lines = content.split('\n');
  const locMatches = Array.from(content.matchAll(/<loc\b[^>]*>(.*?)<\/loc>/gi));

  if (locMatches.length === 0) {
    findings.push({
      id: nextId(),
      rule: 'EMPTY_SITEMAP',
      severity: 'high',
      file: rel,
      line: 1,
      quote: content.slice(0, 80),
      fix: 'sitemap.xml contains no <loc> URLs.',
    });
    return;
  }

  let baseHost = null;

  for (const match of locMatches) {
    const rawUrl = match[1].trim();
    const lineNum = lines.findIndex(l => l.includes(match[0])) + 1;

    if (rawUrl.includes('#')) {
      findings.push({
        id: nextId(),
        rule: 'SITEMAP_URL_FRAGMENT',
        severity: 'critical',
        file: rel,
        line: lineNum > 0 ? lineNum : 1,
        quote: match[0],
        fix: `Sitemap URL contains a fragment (#): "${rawUrl}". Search engines index documents, not fragments. Remove the fragment.`,
      });
    }

    try {
      const parsed = new URL(rawUrl);
      if (!parsed.protocol.startsWith('http')) {
        findings.push({
          id: nextId(),
          rule: 'SITEMAP_NON_HTTP_URL',
          severity: 'high',
          file: rel,
          line: lineNum > 0 ? lineNum : 1,
          quote: match[0],
          fix: `Sitemap URL "${rawUrl}" must use https: scheme.`,
        });
      }

      const hostLower = parsed.hostname.toLowerCase();
      const isLocalOrStaging =
        hostLower === 'localhost' ||
        hostLower === '127.0.0.1' ||
        hostLower.endsWith('.local') ||
        hostLower.endsWith('.internal') ||
        /(?:^|\.)(?:staging|dev|preview)\./.test(hostLower);

      if (isLocalOrStaging) {
        findings.push({
          id: nextId(),
          rule: 'SITEMAP_LOCAL_OR_STAGING_URL',
          severity: 'critical',
          file: rel,
          line: lineNum > 0 ? lineNum : 1,
          quote: match[0],
          fix: `Sitemap URL "${rawUrl}" points to a local or staging host. Replace with your production canonical HTTPS domain.`,
        });
      } else if (parsed.protocol === 'http:') {
        findings.push({
          id: nextId(),
          rule: 'SITEMAP_INSECURE_HTTP_URL',
          severity: 'high',
          file: rel,
          line: lineNum > 0 ? lineNum : 1,
          quote: match[0],
          fix: `Sitemap URL "${rawUrl}" uses cleartext http:// instead of canonical https://.`,
        });
      }

      if (!baseHost) {
        baseHost = parsed.host;
      } else if (parsed.host !== baseHost) {
        findings.push({
          id: nextId(),
          rule: 'SITEMAP_MULTIPLE_HOSTS',
          severity: 'medium',
          file: rel,
          line: lineNum > 0 ? lineNum : 1,
          quote: match[0],
          fix: `Sitemap URL has host "${parsed.host}", but earlier URLs use "${baseHost}". Sitemaps should list URLs on a single host.`,
        });
      }
    } catch {
      findings.push({
        id: nextId(),
        rule: 'SITEMAP_INVALID_URL',
        severity: 'critical',
        file: rel,
        line: lineNum > 0 ? lineNum : 1,
        quote: match[0],
        fix: `Sitemap URL is not a valid absolute URL: "${rawUrl}".`,
      });
    }
  }
}

// 3. Check HTML Pages
async function checkHtmlFile(filePath, hasSiteLlmsTxt) {
  let content = '';
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return;
  }

  const lines = content.split('\n');
  const rel = relFile(filePath);
  const headOpenMatch = content.match(/<head\b[^>]*>/i);
  const headLine = headOpenMatch ? lineNumberAt(content, headOpenMatch.index) : 1;
  const headQuote = headOpenMatch ? headOpenMatch[0].split(/\r?\n/)[0].trim().slice(0, 80) : '<html';

  // A. Canonical tag
  const canonicalMatch = content.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i) ||
                         content.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i);
  if (!canonicalMatch) {
    findings.push({
      id: nextId(),
      rule: 'MISSING_CANONICAL',
      severity: 'high',
      file: rel,
      line: headLine,
      quote: headQuote,
      fix: 'Add <link rel="canonical" href="https://yourdomain.com/canonical-url"> inside <head>.',
    });
  }

  // B. Open Graph tags
  const ogTitle = content.match(/<meta\b[^>]*property=["']og:title["'][^>]*>/i);
  const ogDesc = content.match(/<meta\b[^>]*property=["']og:description["'][^>]*>/i);
  if (!ogTitle || !ogDesc) {
    findings.push({
      id: nextId(),
      rule: 'MISSING_OG_TAGS',
      severity: 'medium',
      file: rel,
      line: headLine,
      quote: headQuote,
      fix: 'Include Open Graph tags (<meta property="og:title"> and <meta property="og:description">) for social & AI citation sharing.',
    });
  }

  // C. Accidental noindex meta tag
  const noindexMatch = content.match(/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*\bnoindex\b[^"']*["'][^>]*>/i) ||
                       content.match(/<meta\b[^>]*content=["'][^"']*\bnoindex\b[^"']*["'][^>]*name=["']robots["'][^>]*>/i);
  if (noindexMatch) {
    findings.push({
      id: nextId(),
      rule: 'META_ROBOTS_NOINDEX',
      severity: 'critical',
      file: rel,
      line: lineNumberAt(content, noindexMatch.index),
      quote: noindexMatch[0].split(/\r?\n/)[0].trim().slice(0, 100),
      fix: 'Remove "noindex" from <meta name="robots"> if this page is intended for public search and AI indexing.',
    });
  }

  // D. JSON-LD presence & validation
  const jsonLdBlocks = Array.from(content.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  const isFullHtmlDoc = /<head\b/i.test(content) && /<body\b/i.test(content);

  if (isFullHtmlDoc && jsonLdBlocks.length === 0) {
    findings.push({
      id: nextId(),
      rule: 'MISSING_JSONLD',
      severity: 'high',
      file: rel,
      line: headLine,
      quote: headQuote,
      fix: 'Add a valid <script type="application/ld+json"> block (e.g. Organization, Article, Product, or FAQPage) matching visible page content.',
    });
  }

  for (const block of jsonLdBlocks) {
    const rawJson = block[1].trim();
    const jsonOffset = rawJson.length > 0 ? block.index + block[0].indexOf(rawJson) : block.index;
    const lineNum = lineNumberAt(content, jsonOffset);
    const jsonQuote = (rawJson.split(/\r?\n/)[0] || block[0].split(/\r?\n/)[0]).trim().slice(0, 80);

    try {
      const parsed = JSON.parse(rawJson);
      const topItems = Array.isArray(parsed) ? parsed : [parsed];
      const expandedItems = [];

      for (const item of topItems) {
        if (!item['@context'] || !/schema\.org/i.test(item['@context'])) {
          findings.push({
            id: nextId(),
            rule: 'JSONLD_INVALID_CONTEXT',
            severity: 'high',
            file: rel,
            line: lineNum,
            quote: jsonQuote,
            fix: 'JSON-LD "@context" must be "https://schema.org".',
          });
        }
        if (Array.isArray(item['@graph'])) {
          for (const gNode of item['@graph']) {
            if (gNode && typeof gNode === 'object') expandedItems.push(gNode);
          }
        } else {
          expandedItems.push(item);
        }
      }

      for (const item of expandedItems) {
        if (!item['@type']) {
          findings.push({
            id: nextId(),
            rule: 'JSONLD_MISSING_TYPE',
            severity: 'high',
            file: rel,
            line: lineNum,
            quote: jsonQuote,
            fix: 'JSON-LD object missing required "@type" declaration.',
          });
        }

        const typeStr = item['@type'];
        if (['Article', 'BlogPosting', 'TechArticle'].includes(typeStr)) {
          if (!item.headline || !item.author) {
            findings.push({
              id: nextId(),
              rule: 'JSONLD_MISSING_REQUIRED_PROP',
              severity: 'medium',
              file: rel,
              line: lineNum,
              quote: jsonQuote,
              fix: `Schema @type "${typeStr}" requires "headline" and "author".`,
            });
          }
        } else if (typeStr === 'Organization') {
          if (!item.name || !item.url) {
            findings.push({
              id: nextId(),
              rule: 'JSONLD_MISSING_REQUIRED_PROP',
              severity: 'medium',
              file: rel,
              line: lineNum,
              quote: jsonQuote,
              fix: 'Schema @type "Organization" requires "name" and "url".',
            });
          }
        } else if (typeStr === 'FAQPage') {
          if (!Array.isArray(item.mainEntity) || item.mainEntity.length === 0) {
            findings.push({
              id: nextId(),
              rule: 'JSONLD_MISSING_REQUIRED_PROP',
              severity: 'medium',
              file: rel,
              line: lineNum,
              quote: jsonQuote,
              fix: 'Schema @type "FAQPage" requires a non-empty "mainEntity" array of Question items.',
            });
          }
        } else if (['Product', 'SoftwareApplication', 'LocalBusiness'].includes(typeStr)) {
          if (!item.name) {
            findings.push({
              id: nextId(),
              rule: 'JSONLD_MISSING_REQUIRED_PROP',
              severity: 'medium',
              file: rel,
              line: lineNum,
              quote: jsonQuote,
              fix: `Schema @type "${typeStr}" requires "name".`,
            });
          }
        } else if (typeStr === 'BreadcrumbList') {
          if (!Array.isArray(item.itemListElement) || item.itemListElement.length === 0) {
            findings.push({
              id: nextId(),
              rule: 'JSONLD_MISSING_REQUIRED_PROP',
              severity: 'medium',
              file: rel,
              line: lineNum,
              quote: jsonQuote,
              fix: 'Schema @type "BreadcrumbList" requires a non-empty "itemListElement" array.',
            });
          }
        }
      }
    } catch (err) {
      findings.push({
        id: nextId(),
        rule: 'JSONLD_PARSE_ERROR',
        severity: 'critical',
        file: rel,
        line: lineNum,
        quote: jsonQuote,
        fix: `Invalid JSON inside <script type="application/ld+json">: ${err.message}`,
      });
    }
  }

  // E. Client-Only Rendering detection
  const rootDivMatch = content.match(/<div\b[^>]*(?:id=["'](?:root|app|__next)["']|class=["'][^"']*(?:app-root|app-container)[^"']*)[^>]*>\s*<\/div>/i);
  if (rootDivMatch) {
    const bodyContentMatch = content.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyContentMatch ? bodyContentMatch[1] : content;
    const stripped = bodyContent
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (stripped.length < 40) {
      const lineNum = lineNumberAt(content, rootDivMatch.index);
      findings.push({
        id: nextId(),
        rule: 'CLIENT_ONLY_RENDERING',
        severity: 'critical',
        file: rel,
        line: lineNum,
        quote: rootDivMatch[0].split(/\r?\n/)[0].trim().slice(0, 100),
        fix: 'Client-only SPA detected with empty root container and no pre-rendered content. Use SSG, SSR, or static prerendering so crawlers and AI assistants can extract content.',
      });
    }
  }

  // F. AEO vague headings check (e.g. "Learn More", "Overview", "Features" without question headings)
  const subHeadings = Array.from(content.matchAll(/<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi)).map((m) => ({
    text: m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    raw: m[0],
    index: m.index,
  }));
  const vagueHeadings = subHeadings.filter((h) => VAGUE_AEO_HEADING_RE.test(h.text));
  const questionHeadings = subHeadings.filter((h) => QUESTION_HEADING_RE.test(h.text));

  if (vagueHeadings.length >= 2 && questionHeadings.length === 0) {
    findings.push({
      id: nextId(),
      rule: 'AEO_VAGUE_HEADINGS',
      severity: 'medium',
      file: rel,
      line: lineNumberAt(content, vagueHeadings[0].index),
      quote: vagueHeadings[0].raw.split(/\r?\n/)[0].trim().slice(0, 100),
      detail: vagueHeadings.map((h) => h.text).join(', '),
      fix: 'Replace generic headings ("Learn More", "Overview", "Features") with specific, question-based headings so answer engines can extract direct answers.',
    });
  }

  // G. AEO llms.txt reference check
  const hasHtmlLlmsRef = /href=["'][^"']*llms\.txt["']/i.test(content);
  if (isFullHtmlDoc && !hasHtmlLlmsRef && !hasSiteLlmsTxt) {
    const note = {
      id: nextId(),
      rule: 'AEO_NO_LLMS_TXT_REF',
      severity: 'info',
      file: rel,
      line: headLine,
      quote: headQuote,
      fix: 'Consider adding /llms.txt at site root and referencing <link rel="alternate" type="text/plain" href="/llms.txt"> for AI documentation ingestion.',
    };
    if (jsonLdBlocks.length === 0) {
      findings.push(note);
    } else {
      advisories.push(note);
    }
  }
}

async function checkNextClientMetadata(filePath) {
  let content = '';
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return;
  }
  const trimmedHead = content.trimStart();
  if (/^['"]use client['"]/.test(trimmedHead) && /export\s+(?:const\s+metadata\b|async\s+function\s+generateMetadata\b|function\s+generateMetadata\b)/.test(content)) {
    const match = content.match(/export\s+(?:const\s+metadata\b|(?:async\s+)?function\s+generateMetadata\b)/);
    findings.push({
      id: nextId(),
      rule: 'NEXT_CLIENT_METADATA_IGNORED',
      severity: 'high',
      file: relFile(filePath),
      line: match ? lineNumberAt(content, match.index) : 1,
      quote: match ? match[0] : 'export const metadata',
      fix: 'Next.js ignores metadata/generateMetadata exports inside "use client" components. Move metadata to a Server Component page or layout.',
    });
  }
}

let htmlFileCount = 0;
const hasSiteLlmsTxt = Boolean(await findFileInDirs('llms.txt', searchDirs));

async function scanHtmlFiles(dir) {
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
        await scanHtmlFiles(full);
      }
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (['.html', '.htm'].includes(ext)) {
        htmlFileCount++;
        await checkHtmlFile(full, hasSiteLlmsTxt);
      } else if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
        await checkNextClientMetadata(full);
      }
    }
  }
}

if (isSingleFile) {
  const name = basename(targetPath).toLowerCase();
  const ext = extname(targetPath).toLowerCase();
  if (name === 'robots.txt') {
    await checkRobotsTxt(targetPath);
  } else if (name === 'sitemap.xml') {
    await checkSitemapXml(targetPath);
  } else if (ext === '.html' || ext === '.htm') {
    htmlFileCount++;
    await checkHtmlFile(targetPath, hasSiteLlmsTxt);
  } else if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    await checkNextClientMetadata(targetPath);
  }
} else {
  await scanHtmlFiles(targetPath);
  const hasWebAssets = htmlFileCount > 0 || (await findFileInDirs('robots.txt', searchDirs)) || (await findFileInDirs('sitemap.xml', searchDirs));
  if (hasWebAssets) {
    await checkRobotsTxt();
    await checkSitemapXml();
  }
}

const actionable = findings.filter((f) => f.severity !== 'info');

const output = {
  scanned_dir: targetPath,
  supports_single_file: true,
  total_findings: findings.length,
  findings,
  ...(advisories.length > 0 ? { advisories } : {}),
};

console.log(JSON.stringify(output, null, 2));
process.exit(actionable.length > 0 ? 1 : 0);
