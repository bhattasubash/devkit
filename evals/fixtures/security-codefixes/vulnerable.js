// Paired SAST benchmark fixture (modeled on OWASP Juice Shop codefixes pattern)
import express from 'express';
import { exec } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import jwt from 'jsonwebtoken';

const app = express();

// 1. CORS wildcard + credentials
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});

// 2. Command injection via exec() with user input
app.get('/api/ping', (req, res) => {
  exec(`ping -c 1 ${req.query.host}`, (err, out) => {
    res.send(out);
  });
});

// 3. SQL template interpolation
export async function findUser(db, email) {
  return db.query(`SELECT id, email FROM users WHERE email = '${email}'`);
}

// 4. Path traversal
app.get('/api/download', async (req, res) => {
  const filePath = `/var/app/uploads/${req.query.file}`;
  res.send(await readFile(filePath, 'utf-8'));
});

// 5. JWT none algorithm / unverified decode
export function readToken(token) {
  return jwt.decode(token);
}
