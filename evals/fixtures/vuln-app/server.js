const express = require('express');
const app = express();

// SEC-001: Hardcoded environment fallback secret
const JWT_SECRET = process.env.JWT_SECRET || "development-fallback-secret-key-32chars";

app.get('/health', (req, res) => res.json({ status: 'ok' }));

module.exports = { app, JWT_SECRET };
