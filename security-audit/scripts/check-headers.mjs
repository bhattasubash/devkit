#!/usr/bin/env node

/**
 * check-headers.mjs — Zero-dependency security headers checker
 *
 * Checks a URL for required security headers and reports their status.
 *
 * Usage:  node check-headers.mjs <url>
 * Output: JSON object with each header's status to stdout. Exit 0 = all pass, 1 = any fail.
 *
 * Requires Node.js 18+ (native fetch).
 */

const url = process.argv[2];

if (!url) {
  console.error('Usage: node check-headers.mjs <url>');
  process.exit(2);
}

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
      if (!value) return { status: 'missing', detail: 'Header not present. Set at minimum: default-src \'self\'' };
      if (value.includes('unsafe-inline') && !value.includes('nonce-') && !value.includes('strict-dynamic'))
        return { status: 'warn', detail: 'Contains unsafe-inline without nonce or strict-dynamic', value };
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
];

try {
  const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
  const results = {};
  let hasFailure = false;

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
  };

  console.log(JSON.stringify(results, null, 2));
  process.exit(hasFailure ? 1 : 0);
} catch (err) {
  console.error(JSON.stringify({ error: err.message, url }));
  process.exit(2);
}
