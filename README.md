# devkit

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.1.0-green.svg)](CHANGELOG.md)
[![Skills](https://img.shields.io/badge/skills-4-blue.svg)]()
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)]()

**Four deterministic agent skills that ship reliable code, not AI slop.**

> Modern Web Standards · Security Audit · Anti-Slop Design · SEO & AEO

---

## What's Inside

| Skill | Triggers On | What It Does |
| :--- | :--- | :--- |
| [**devkit**](SKILL.md) | "audit everything", "full audit" | Root router orchestrating security, web standards, design, and SEO audits sequentially with unified state and scope management. |
| [**security-audit**](security-audit/) | "audit security", "find secrets", launch review | Deterministic secret scanning, dependency exposure scoring, and hosting-level security header verification. |
| [**web-best-practices**](web-best-practices/) | Frontend building, reviewing HTML/JSX | Core Web Vitals, accessibility tags, dialog/modal behaviors, and modern browser APIs. |
| [**anti-slop-design**](anti-slop-design/) | UI review, CSS styling, redesigns | Eliminates AI design tells: tokenizes literal colors, strips `transition: all`, stops root overflow clipping, and enforces `:focus-visible`. |
| [**seo-audit**](seo-audit/) | "audit SEO", site URL, indexation | Sitemaps, robots.txt, canonical links, Open Graph metadata, structured JSON-LD validation, and SPA prerendering checks. |

---

## Installation

### Claude Code
```bash
git clone https://github.com/bhattasubash/devkit.git ~/.claude/skills/devkit
```

### Cursor
```bash
git clone https://github.com/bhattasubash/devkit.git .cursor/skills/devkit
```

### Codex CLI
```bash
git clone https://github.com/bhattasubash/devkit.git ~/.agents/skills/devkit
```

### Other Agents
For other AI coding agents, see your agent's skills folder documentation to find its configured skills directory.

---

## Operating Modes

Every skill in devkit supports three deterministic operating modes to match model capabilities and task requirements:

1. **Lite Mode**: Designed for lightweight, fast, or smaller models. Reviews at most 3 files per step, loads only one reference file into context at a time, and enforces strict sequential steps.
2. **Standard Mode** *(Default)*: Balanced, thorough workflow for daily feature development, pull request checks, and targeted fixes.
3. **Full Mode**: Comprehensive pre-launch and compliance verification. Conducts exhaustive static scanning across all files, formal threat modeling, and complete evidence verification.

---

## How It Works

```
┌──────────────────────────────────────────────────────────────┐
│  SKILL.md            Standardized, strict (<= 100 lines).    │
│  references/         Targeted fix recipes (<= 150 lines).    │
│  scripts/            Zero-dependency deterministic scanners. │
│  .devkit/state.json  State machine tracking evidence & gates.│
│  .devkit/scope.json  Scope lock guarding file modifications. │
└──────────────────────────────────────────────────────────────┘
```

- **Approval Gates**: At critical checkpoints, the agent halts with an exact STOP block. No files are modified without explicit user approval in the chat.
- **Evidence Verification**: Every finding cited by an agent must include a valid file, line number, and exact line quote. Fabricated or hallucinated claims fail verification via `verify-findings.mjs`.
- **Scope Locks**: When a plan is approved, `.devkit/scope.json` locks the allowed file list. Unapproved edits to dependencies or unauthorized files trigger immediate scope violation failures via `check-scope.mjs`.
- **Zero Dependencies**: All scripts run natively on Node.js 18+ without external npm dependencies across Windows, macOS, and Linux.

---

## Honest Limits

- **Static analysis only**: Devkit's scanners inspect source code, configuration files, and static markup. They do not perform active dynamic penetration testing or live network exploitation.
- **Hosting configuration**: Security headers and caching policies must be configured at your hosting provider or edge proxy (Netlify, Cloudflare Pages, Vercel, nginx), not inside local dev or preview servers.
- **Zero invented content**: Devkit strictly forbids inventing customer reviews, fake testimonials, aggregate rating numbers, or business addresses for structured data. Content must exist on the site or be supplied by the user.
- **No buzzword claims**: Devkit reports never declare a codebase "all fixed", "fully verified", or "100% secure" unless accompanied by real, passing tool command output.

---

## Running Scanners Directly

You can also run devkit's zero-dependency scanners directly from your terminal:

```bash
# Secret Scanner
node security-audit/scripts/check-secrets.mjs .

# Design Slop Linter
node anti-slop-design/scripts/lint-design.mjs .

# HTML & Accessibility Linter
node web-best-practices/scripts/check-html.mjs .

# Technical SEO & Sitemaps Checker
node seo-audit/scripts/check-seo-files.mjs .

# Verify Findings JSON Integrity
node shared/scripts/verify-findings.mjs .devkit/reports/findings.json

# Check Git Diff Against Scope Lock
node shared/scripts/check-scope.mjs .devkit/scope.json
```

---

## Credits

Built by studying, adapting, and improving upon:
- [modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) — Google Chrome, Edge, Firefox, and MDN teams
- [Hallmark](https://github.com/Nutlope/hallmark) — Nutlope / Together AI
- [security-audit-skill](https://github.com/cloudflare/security-audit-skill) — Cloudflare
- [jev-seo](https://github.com/AgriciDaniel/jev-seo) — AgriciDaniel / TypeSafe

---

## License

[MIT](LICENSE)
