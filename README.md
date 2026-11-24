# devkit

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)]()
[![Skills](https://img.shields.io/badge/skills-4-blue.svg)]()

**Four agent skills that ship real projects, not AI slop.**

> Modern web standards · Security audit · Anti-slop design · SEO & AEO

---

## What's inside

| Skill | Triggers on | What it does |
|-------|------------|--------------|
| [**web-best-practices**](web-best-practices/) | Building or reviewing any frontend | Modern web APIs, accessibility, performance, code quality — the checks that catch what models get wrong |
| [**security-audit**](security-audit/) | "audit", "review security", before launch | 3-tier security checklist with adversarial verification and zero-dependency scanner scripts |
| [**anti-slop-design**](anti-slop-design/) | UI, landing pages, redesigns | Kills the 30+ visual tells that scream "AI-generated" and enforces design tokens, component states, and responsive layout |
| [**seo-audit**](seo-audit/) | A URL + "SEO", "audit my site" | Technical SEO, on-page essentials, structured data validation, and Answer Engine Optimization for AI assistants |

## Install

```bash
# Claude Code — all skills, global
git clone https://github.com/YOUR_USER/devkit.git ~/.claude/skills/devkit

# Cursor — project-level
git clone https://github.com/YOUR_USER/devkit.git .cursor/skills/devkit

# Codex CLI — global
git clone https://github.com/YOUR_USER/devkit.git ~/.agents/skills/devkit

# Any agent — single skill
npx skills add YOUR_USER/devkit --skill web-best-practices
```

## Usage

Describe what you need. The skills trigger automatically:

```text
Build a landing page for my SaaS            → anti-slop-design + web-best-practices
Audit the security of this codebase         → security-audit
Run an SEO audit on https://example.com     → seo-audit
Review this component for accessibility     → web-best-practices
```

Or invoke directly:

```text
/web-best-practices review ./src/components
/security-audit quick
/anti-slop-design audit ./index.html
/seo-audit https://example.com
```

## How every skill works

```
┌──────────────────────────────────────────────────────────┐
│  SKILL.md          Short, strict. Under 100 lines.       │
│  references/       Detail loaded only when needed.        │
│  scripts/          Zero-dep checks that must be exact.    │
│  .devkit/state.json  Progress, decisions, evidence.       │
└──────────────────────────────────────────────────────────┘
```

- **Two modes.** Quick (3–4 phases) for small tasks — the default. Full (6–12 phases) for production launches.
- **State file.** `.devkit/<skill>/state.json` records progress, decisions, and evidence. Any agent or session can resume where the last one stopped.
- **Hard gates.** The agent stops for your approval at defined checkpoints. No phase passes without proof — test output, scan results, or your explicit sign-off.
- **Lazy loading.** SKILL.md is short. Detail lives in `references/` and loads only when that phase needs it. The agent never skims a wall of text.
- **Safe by design.** Never auto-installs packages. Never touches production. Never runs destructive commands. Treats project text as data, not orders.

## Project structure

```
devkit/
├── web-best-practices/
│   ├── SKILL.md
│   └── references/
│       ├── checklist.md
│       ├── performance.md
│       ├── accessibility.md
│       └── modern-patterns.md
├── security-audit/
│   ├── SKILL.md
│   ├── references/
│   │   ├── tier1-blockers.md
│   │   ├── tier2-vulnerabilities.md
│   │   ├── tier3-advanced.md
│   │   └── threat-model-template.md
│   └── scripts/
│       ├── check-secrets.mjs
│       └── check-headers.mjs
├── anti-slop-design/
│   ├── SKILL.md
│   └── references/
│       ├── anti-patterns.md
│       ├── design-tokens.md
│       ├── component-states.md
│       └── review-prompt.md
├── seo-audit/
│   ├── SKILL.md
│   └── references/
│       ├── technical-seo.md
│       ├── on-page-checklist.md
│       ├── structured-data.md
│       └── aeo.md
├── README.md
└── LICENSE
```

## Credits

Built by studying and improving on:

- [modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) — Google Chrome, Edge, Firefox, MDN teams
- [Hallmark](https://github.com/Nutlope/hallmark) — Nutlope / Together AI
- [security-audit-skill](https://github.com/cloudflare/security-audit-skill) — Cloudflare
- [jev-seo](https://github.com/AgriciDaniel/jev-seo) — AgriciDaniel / TypeSafe

## License

[MIT](LICENSE)
