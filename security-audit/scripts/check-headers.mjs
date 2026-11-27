#!/usr/bin/env node

/**
 * check-headers.mjs — Zero-dependency security headers checker with SSRF protection
 *
 * Checks a URL for required security headers and reports their status.
 * Refuses localhost, loopback, private, and cloud metadata IP addresses (SSRF guard).
 *
 * Usage:  node check-headers.mjs <url>
 * Output: JSON object with each header's status to stdout.
 *         Exit 0 = all pass, 1 = any fail/missing, 2 = error or blocked SSRF target.
 *
 * Requires Node.js 18+ (native fetch).
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`check-headers.mjs — Zero-dependency security headers checker

Usage:
  node check-headers.mjs <url>

Options:
  --help, -h    Show this help message and exit

Checks:
  - HSTS (Strict-Transport-Security)
  - CSP (Content-Security-Policy)
  - X-Content-Type-Options (nosniff)
  - Referrer-Policy
  - Permissions-Policy
  - Frame Protection (X-Frame-Options or CSP frame-ancestors)
  - COOP (Cross-Origin-Opener-Policy)
  - Set-Cookie flags (HttpOnly, Secure, SameSite) when cookies are set

Exit codes:
  0: All checked headers pass
  1: One or more headers missing/weak
  2: Usage error, blocked private/loopback SSRF target, or network error
`);
  process.exit(0);
}

const url = args[0];

if (!url) {
  console.error('Usage: node check-headers.mjs <url>');
  process.exit(2);
}

if (!/^https?:\/\//i.test(url)) {
  console.error(JSON.stringify({ error: `URL must start with http:// or https://. Got: ${url}` }));
  process.exit(2);
}

function isPrivateOrLoopbackIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // Cloud metadata & link-local
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateOrLoopbackIP(ip) {
  const clean = ip.replace(/^\[|\]$/g, '').toLowerCase();
  if (isIP(clean) === 4) return isPrivateOrLoopbackIPv4(clean);
  if (isIP(clean) === 6) {
    if (clean === '::1' || clean === '::') return true;
    if (clean.startsWith('fc') || clean.startsWith('fd')) return true; // ULA
    if (clean.startsWith('fe80:')) return true; // Link-local
    const v4Mapped = clean.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (v4Mapped) return isPrivateOrLoopbackIPv4(v4Mapped[1]);
  }
  return false;
}

async function assertSafeTargetUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new Error(`Refusing local/private hostname (SSRF protection): ${hostname}`);
  }

  if (isIP(hostname) && isPrivateOrLoopbackIP(hostname)) {
    throw new Error(`Refusing private or loopback IP address (SSRF protection): ${hostname}`);
  }

  if (!isIP(hostname)) {
    try {
      const records = await lookup(hostname, { all: true });
      for (const rec of records) {
        if (isPrivateOrLoopbackIP(rec.address)) {
          throw new Error(`Refusing hostname resolving to private/loopback IP (${rec.address}) (SSRF protection): ${hostname}`);
        }
      }
    } catch (err) {
      if (err.message.includes('SSRF protection')) throw err;
      // Allow fetch() to surface standard DNS resolution failures
    }
  }
}

const TIMEOUT_MS = 10_000;
const UNSAFE_REFERRER_POLICIES = new Set(['unsafe-url', 'no-referrer-when-downgrade']);

const CHECKS = [
  {
    header: 'strict-transport-security',
    name: 'HSTS',
    test: (value) => {
      if (!value) return { status: 'missing', detail: 'Header not present' };
      const maxAge = value.match(/max-age=(\d+)/i);
      if (!maxAge) return { status: 'fail', detail: 'No max-age directive', value };
      if (parseInt(maxAge[1], 10) < 31536000) return { status: 'fail', detail: `max-age=${maxAge[1]} is less than 31536000 (1 year)`, value };
      return { status: 'pass', value };
    },
  },
  {
    header: 'content-security-policy',
    name: 'CSP',
    test: (value) => {
      if (!value) return { status: 'missing', detail: "Header not present. Set at minimum: default-src 'self'" };
      if (/default-src\s[^;]*\*/.test(value))
        return { status: 'fail', detail: 'default-src allows wildcard (*) — this is effectively no CSP', value };
      if (value.includes('unsafe-eval'))
        return { status: 'fail', detail: "Contains 'unsafe-eval' which allows arbitrary script execution", value };
      if (value.includes('unsafe-inline') && !value.includes('nonce-') && !value.includes('strict-dynamic'))
        return { status: 'warn', detail: "Contains 'unsafe-inline' without nonce or strict-dynamic", value };
      return { status: 'pass', value };
    },
  },
  {
    header: 'x-content-type-options',
    name: 'X-Content-Type-Options',
    test: (value) => {
      if (!value) return { status: 'missing', detail: 'Header not present. Set to: nosniff' };
      if (value.toLowerCase() !== 'nosniff') return { status: 'fail', detail: `Expected "nosniff", got "${value}"`, value };
      return { status: 'pass', value };
    },
  },
  {
    header: 'referrer-policy',
    name: 'Referrer-Policy',
    test: (value) => {
      if (!value) return { status: 'missing', detail: 'Header not present. Recommended: strict-origin-when-cross-origin' };
      const policies = value.split(',').map(p => p.trim().toLowerCase());
      const lastPolicy = policies[policies.length - 1];
      if (UNSAFE_REFERRER_POLICIES.has(lastPolicy))
        return { status: 'fail', detail: `"${lastPolicy}" leaks full URLs to other origins. Use strict-origin-when-cross-origin or stricter.`, value };
      return { status: 'pass', value };
    },
  },
  {
    header: 'permissions-policy',
    name: 'Permissions-Policy',
    test: (value) => {
      if (!value) return { status: 'missing', detail: 'Header not present. Restrict unused features: camera=(), microphone=(), geolocation=()' };
      return { status: 'pass', value };
    },
  },
  {
    header: 'x-frame-options',
    name: 'Frame Protection',
    test: (value, headers) => {
      const csp = headers.get('content-security-policy') || '';
      if (csp.includes('frame-ancestors')) return { status: 'pass', detail: 'Protected via CSP frame-ancestors', value: csp };
      if (!value) return { status: 'missing', detail: 'No X-Frame-Options or CSP frame-ancestors. Set X-Frame-Options: DENY or SAMEORIGIN' };
      const v = value.toUpperCase();
      if (v === 'DENY' || v === 'SAMEORIGIN') return { status: 'pass', value };
      return { status: 'fail', detail: `Unexpected value: ${value}`, value };
    },
  },
  {
    header: 'cross-origin-opener-policy',
    name: 'COOP',
    test: (value) => {
      if (!value) return { status: 'missing', detail: 'Header not present. Recommended: same-origin' };
      const v = value.toLowerCase().trim();
      if (v === 'same-origin' || v === 'same-origin-allow-popups') return { status: 'pass', value };
      return { status: 'warn', detail: `Weak COOP value: ${value}`, value };
    },
  },
  {
    header: 'set-cookie',
    name: 'Cookie Flags',
    test: (value) => {
      if (!value) return { status: 'pass', detail: 'No Set-Cookie headers present on response' };
      const missingFlags = [];
      if (!/;\s*httponly\b/i.test(value)) missingFlags.push('HttpOnly');
      if (!/;\s*secure\b/i.test(value)) missingFlags.push('Secure');
      if (!/;\s*samesite=(?:strict|lax)\b/i.test(value)) missingFlags.push('SameSite=Lax|Strict');
      if (missingFlags.length > 0) {
        return { status: 'fail', detail: `Set-Cookie missing security flags: ${missingFlags.join(', ')}` };
      }
      return { status: 'pass', detail: 'Cookies include HttpOnly, Secure, and SameSite flags' };
    },
  },
];

async function fetchWithFallback(targetUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headResponse = await fetch(targetUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    });

    if (headResponse.status === 405) {
      clearTimeout(timeout);
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), TIMEOUT_MS);
      try {
        const getResponse = await fetch(targetUrl, {
          method: 'GET',
          redirect: 'follow',
          signal: controller2.signal,
        });
        return getResponse;
      } finally {
        clearTimeout(timeout2);
      }
    }

    return headResponse;
  } finally {
    clearTimeout(timeout);
  }
}

try {
  await assertSafeTargetUrl(url);
  const response = await fetchWithFallback(url);
  const results = {};
  let hasFailure = false;

  const statusWarning = response.status < 200 || response.status >= 300
    ? `Warning: server returned ${response.status}. Headers may not reflect the real page.`
    : null;

  for (const check of CHECKS) {
    const value = response.headers.get(check.header);
    const result = check.test(value, response.headers);
    results[check.name] = result;
    if (result.status !== 'pass') hasFailure = true;
  }

  results._meta = {
    url,
    status: response.status,
    redirected: response.redirected,
    checked_at: new Date().toISOString(),
    ...(statusWarning && { warning: statusWarning }),
  };

  console.log(JSON.stringify(results, null, 2));
  process.exit(hasFailure ? 1 : 0);
} catch (err) {
  const message = err.name === 'AbortError'
    ? `Request timed out after ${TIMEOUT_MS / 1000}s`
    : err.message;
  console.error(JSON.stringify({ error: message, url }));
  process.exit(2);
}
