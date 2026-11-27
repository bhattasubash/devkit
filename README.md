# devkit

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.1.1-green.svg)](CHANGELOG.md)
[![Node >=18](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](package.json)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)

**devkit** is an audit and remediation toolkit for coding agents across **security**, **web standards**, **design quality**, and **SEO/AEO**.

Instead of letting an agent eyeball files or claim `"all fixed"` from memory, devkit forces every audit through zero-dependency Node.js scanners, a mandatory `STOP` approval gate before edits, verbatim line-quote checks, and `git diff` scope enforcement.

## Table of Contents

- [How Good Is It?](#how-good-is-it)
- [Getting Started](#getting-started)
- [How to Use](#how-to-use)
- [What's Inside](#whats-inside)
- [Running Scanners Directly](#running-scanners-directly)
- [Updating & Contributing](#updating--contributing)
- [License](#license)

---

## How Good Is It?

Most agent skills are prompts alone. devkit wraps its prompts in deterministic checks so findings and edits are verified against real files on disk:

- **No hallucinated line numbers or quotes** — `verify-findings.mjs` validates every finding's file path, line number (`±3`-line drift window), severity, fix, and verbatim quote before reporting.
- **No silent out-of-scope edits** — `check-scope.mjs` diffs your git working tree against `.devkit/scope.json` so agents cannot touch unrelated files or alter dependencies without approval.
- **Zero npm supply-chain footprint** — Uses pure Node.js 18+ built-ins with `0` external dependencies, installing and scanning offline in milliseconds.

### Verified Numbers

Tested locally on Windows with Node `v24.11.1`:

| Check | Result | Command |
| :--- | :--- | :--- |
| Unit & integration suite | **89 pass**, 0 fail, 0 skipped | `node --test` |
| 10-case scanner benchmark | **20/20** defect recall (`100%`), **5/5** clean, **0** false positives | `node evals/run-10-cases.mjs --assert-pass` |
| Hard Mode trap cases | **10/10** pass (5 false-positive traps + 5 evasion/integrity traps) | `node --test evals/tests/hard-mode.test.mjs` |
| Shared script sync | `inSync: true` | `node scripts/sync-shared.mjs --check` |
| Repo self-scans (all 5 scripts) | **Exit 0** (`0` findings, `0` warnings) | Scanners on `.` |

### Honest Scope & Current Limits

- **Static scanners, not a full AST or pentest** — Scanners match high-confidence patterns fast (`check-html.mjs` flags `.jsx`/`.tsx` checks as heuristic). Security headers must still be configured on your server or edge proxy.
- **Live LLM matrix not yet measured** — Automated scanner and guardrail tests pass locally, while live API pass rates in [`evals/README.md`](evals/README.md) remain `not measured yet`.
- **Not on npm yet** — `@bhattasubash/devkit` is not published to the npm registry yet; install from GitHub or a local clone.

---

## Getting Started

**Requires Node.js `>= 18.0.0`** and Git (for post-edit scope verification).

### Quick Install

Auto-detects `.cursor`, `.claude`, `.codex`, `.agents`, `.gemini`/`.antigravity`, and `.windsurf` in your project (defaulting to `.agents/skills/` if none exist) and initializes `.devkit/`:

```bash
# Preview target paths without writing files
npx github:bhattasubash/devkit init --dry-run

# Install skills and create .devkit/ workspace config
npx github:bhattasubash/devkit init
```

### Target a Specific Agent

```bash
npx github:bhattasubash/devkit init --agent claude     # .claude/skills/
npx github:bhattasubash/devkit init --agent cursor     # .cursor/skills/
npx github:bhattasubash/devkit init --agent codex      # .codex/skills/
npx github:bhattasubash/devkit init --agent gemini     # .gemini/skills/ (Gemini / Antigravity)
npx github:bhattasubash/devkit init --agent windsurf   # .windsurf/skills/
npx github:bhattasubash/devkit init --agent agents     # .agents/skills/ (universal)
```

### From a Local Clone

```bash
git clone https://github.com/bhattasubash/devkit.git
node ./devkit/bin/devkit.mjs init
```

Useful flags: `--global` (install to `~/`), `--force` (overwrite existing skills), `--no-flat` (skip sibling standalone domain folders), `--cwd <path>`, and `check` (verify installation health).

---

## How to Use

### 1. Trigger an Audit in Your Agent

Ask naturally in chat or invoke a slash command directly:

| Scope | Prompt Example | Slash Command |
| :--- | :--- | :--- |
| Full project (all 4 domains) | *"Run a full devkit audit on this repo"* | `/devkit` |
| Security only | *"Run a security audit and check secrets"* | `/security-audit` |
| Web standards & accessibility | *"Audit HTML semantics and accessibility"* | `/web-best-practices` |
| Design quality & AI slop | *"Check the UI for AI design slop and token leaks"* | `/anti-slop-design` |
| SEO & AEO readiness | *"Audit technical SEO, JSON-LD, and AEO"* | `/seo-audit` |

Append `lite` (max 3 files per fix batch) or `full` (deep review) to any slash command, e.g., `/security-audit full`. Default mode is `standard`.

### 2. Follow the Gated Workflow

```text
Scan ─▶ Findings ─▶ Scope Lock ─▶ STOP (you approve) ─▶ Fix ─▶ Verify ─▶ Report
```

1. **Scan** — Runs deterministic scanners first rather than guessing from memory.
2. **Findings & Scope Lock** — Writes structured findings to `.devkit/reports/findings.json` and freezes allowed edit paths in `.devkit/scope.json`.
3. **STOP Gate** — Halts cleanly before editing source files and waits for you to reply `approve` (or ask for changes).
4. **Fix** — Applies approved changes in domain-isolated batches (security → web → design → SEO).
5. **Verify & Report** — Runs `verify-findings.mjs` and `check-scope.mjs`, then writes `.devkit/reports/audit.md` (or domain `.md`) with explicit **Done**, **Not done**, **NOT VERIFIED**, and **Needs your decision** sections.

---

## What's Inside

| Skill | Scanner Scripts | What It Catches |
| :--- | :--- | :--- |
| [`security-audit`](security-audit/) | `check-secrets.mjs`, `check-code-vulns.mjs`, `check-headers.mjs` | Exposed API keys & secrets, hardcoded fallbacks, `.env` leaks, command/SQL injection, path traversal, DOM XSS, unverified `jwt.decode`, wildcard CORS + credentials, SSRF-guarded HTTP header/COOP/cookie checks |
| [`web-best-practices`](web-best-practices/) | `check-html.mjs` | Missing `<title>` or viewport, short meta descriptions, heading hierarchy/multiple `<h1>`s, missing landmarks, unlabeled form controls, missing image dimensions/`alt`, dead `#` links |
| [`anti-slop-design`](anti-slop-design/) | `lint-design.mjs` | Literal colors outside `:root`/`@theme`, default purple/indigo gradients, AI font & copy tropes, 3-column icon grids, `transition: all`, root `overflow: hidden`, `width: 100vw`, `!important`, missing `:focus-visible` or `prefers-reduced-motion`, clickable `<div>`s |
| [`seo-audit`](seo-audit/) | `check-seo-files.mjs` | Missing or misconfigured `robots.txt` (`Disallow: /`, blocked AI bots) and `sitemap.xml` (`http://`, fragments, localhost URLs), missing canonicals/OG, `noindex`, broken JSON-LD, empty SPA shells, ignored `'use client'` Next.js metadata, missing `llms.txt` / vague AEO headings |

- **Root router (`devkit`)** — [`SKILL.md`](SKILL.md) coordinates all four skills under shared state and one combined report.
- **Shared enforcement (`shared/scripts/`)** — `devkit-state.mjs`, `verify-findings.mjs`, and `check-scope.mjs` keep state, citations, and edit boundaries strict (synced into each skill so standalone installs work independently).

---

## Running Scanners Directly

Run any scanner standalone from the repo root (all scripts support `--help`):

```bash
# Security
node security-audit/scripts/check-secrets.mjs .
node security-audit/scripts/check-code-vulns.mjs .
node security-audit/scripts/check-headers.mjs https://example.com

# Web Standards, Design Quality, SEO/AEO
node web-best-practices/scripts/check-html.mjs .
node anti-slop-design/scripts/lint-design.mjs .
node seo-audit/scripts/check-seo-files.mjs .

# Run full verification suite
node --test
node evals/run-10-cases.mjs --assert-pass
```

---

## Updating & Contributing

Refresh installed skills in an existing project without manual cleanup:

```bash
npx github:bhattasubash/devkit init --force
```

Want to add rules, fix edge cases, or contribute model benchmark runs? See [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## License

[MIT](LICENSE)

---

**Zero telemetry.** Neither the installer nor any offline scanner makes network requests. Network calls only occur when you explicitly pass a public URL to `check-headers.mjs` or invoke `evals/run-model-eval.mjs --run`.
