// Clean counterpart fixture (modeled on OWASP Juice Shop *_1_correct patterns)
import express from 'express';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import jwt from 'jsonwebtoken';

const app = express();
const ALLOWED_ORIGIN = 'https://app.example.com';
const UPLOAD_ROOT = resolve('/var/app/uploads');

// 1. Explicit CORS origin allowlist
app.use((req, res, next) => {
  if (req.headers.origin === ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  next();
});

// 2. Safe execFile with argument array and strict allowlist
app.get('/api/ping', (req, res) => {
  const host = String(req.query.host || '');
  if (!/^[a-zA-Z0-9.-]{1,64}$/.test(host)) {
    return res.status(400).json({ error: 'Invalid host' });
  }
  execFile('ping', ['-c', '1', host], (err, out) => {
    if (err) return res.status(500).end();
    res.type('text/plain').send(out);
  });
});

// 3. Parameterized query
export async function findUser(db, email) {
  return db.query('SELECT id, email FROM users WHERE email = $1', [email]);
}

// 4. Canonicalized path containment check
app.get('/api/download', async (req, res) => {
  const requested = resolve(UPLOAD_ROOT, String(req.query.file || ''));
  if (!requested.startsWith(UPLOAD_ROOT + sep)) {
    return res.status(403).end();
  }
  res.type('text/plain').send(await readFile(requested, 'utf-8'));
});

// 5. Strict JWT verification pinned to HS256
export function readToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');
  return jwt.verify(token, secret, { algorithms: ['HS256'] });
}
