# devkit

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.1.0-green.svg)](CHANGELOG.md)
[![Skills](https://img.shields.io/badge/skills-4-blue.svg)]()
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)]()

**Four agent skills and zero-dependency Node.js scanners for security, web standards, CSS design rules, and SEO.**

> Modern Web Standards · Security Audit · Anti-Slop Design · SEO & AEO

---

## What's Inside

| Skill | Triggers On | What It Does |
| :--- | :--- | :--- |
| [**devkit**](SKILL.md) | "audit everything", "full audit" | Root router instructing agents to run security, web standards, design, and SEO audits sequentially with shared state and scope checks. |
| [**security-audit**](security-audit/) | "audit security", "find secrets", launch review | Pattern-based secret scanning, HTTP security header checks, and severity/fix guidance. |
| [**web-best-practices**](web-best-practices/) | Frontend building, reviewing HTML/JSX | Checks HTML documents (and heuristically checks JSX/TSX) for metadata, headings, image attributes, form labels, and accessibility/performance checklists. |
| [**anti-slop-design**](anti-slop-design/) | UI review, CSS styling, redesigns | Flags literal CSS colors outside `:root`/`@theme`, `transition: all`, root `overflow-x: hidden`, `width: 100vw`, missing `:focus-visible` or `prefers-reduced-motion`, and clickable `<div>` elements. |
| [**seo-audit**](seo-audit/) | "audit SEO", site URL, indexation | Checks `robots.txt`, `sitemap.xml`, canonical links, Open Graph tags, JSON-LD syntax/fields, and empty SPA root containers, with technical SEO and AEO checklists. |

---

## Status and Limits

### What Exists Today
- **4 self-contained domain skills + 1 root router:** [`security-audit`](security-audit/), [`web-best-practices`](web-best-practices/), [`anti-slop-design`](anti-slop-design/), [`seo-audit`](seo-audit/), and [`SKILL.md`](SKILL.md), with shared source scripts in [`shared/scripts/`](shared/scripts/) synced into each skill's `scripts/` folder via [`scripts/sync-shared.mjs`](scripts/sync-shared.mjs) and a CLI installer in [`bin/devkit.mjs`](bin/devkit.mjs).
- **Zero npm dependencies:** `package.json` declares no `dependencies` or `devDependencies` and targets Node.js `>=18.0.0`.
- **Unit test suite:** `58` passing tests (`58 pass`, `0 fail`, `0 skipped`) via `node --test`, verified locally on Windows with Node `v24.11.1`.
- **License:** [MIT](LICENSE).
- **No CLI network calls:** The CLI makes no network calls. All local scanners operate offline; only [`check-headers.mjs`](security-audit/scripts/check-headers.mjs) makes outbound HTTP `HEAD`/`GET` `fetch()` requests to the `<url>` you pass to it.

### Pattern-Based and Heuristic Behavior
- **Regex and line-based scanners:** `check-secrets.mjs`, `lint-design.mjs`, `check-html.mjs`, and `check-seo-files.mjs` use regular expressions and line/string matching rather than AST parsing.
- **Heuristic JSX/TSX checks:** `check-html.mjs` tags `.jsx` and `.tsx` findings as `heuristic` because dynamic props and wrapper components cannot be fully resolved by pattern matching.
- **Line-quote verification:** `verify-findings.mjs` validates file existence, line numbers, severities, and whitespace-normalized substring quotes (with a `±3` line tolerance window). It does not perform AST validation.
- **Post-edit scope checking:** `check-scope.mjs` compares `git diff` and untracked files against `.devkit/scope.json` when run; it does not intercept edits in real time.

### What Is Not Measured or Verified Yet
- **Model and small-model pass rates:** Not measured yet. All 20 benchmark entries (5 models × 4 fixtures) in [`evals/README.md`](evals/README.md) are `not measured yet`. See [`evals/`](evals/) for fixtures, prompts, and the automated grader (`evals/grade.mjs`).
- **Cross-platform and Node matrix:** Tested on Windows with Node `v24.11.1`. macOS, Linux, and Node 18 / 20 / 22 have not been tested yet.
- **Live agent discovery:** Standalone single-skill and full-repo scripts pass automated tests in isolated temp directories, but live skill loading inside Cursor, Claude Code, Codex, Gemini, or Windsurf is untested.
- **Static analysis only:** Scanners inspect source files, configs, and static markup. They do not run dynamic penetration tests or browser/runtime profiling.
- **Hosting configuration:** Security headers and caching rules must be configured on your hosting provider or edge proxy (Netlify, Cloudflare Pages, Vercel, nginx), not in local preview servers.
- **Zero invented content:** Agents are instructed never to fabricate customer reviews, testimonials, ratings, or business addresses, and never to declare `"all fixed"` or `"fully verified"` without command output.

---

## Installation

### Main Install Command (Works Today)

Install directly from GitHub using `npx` (requires Node.js `>=18.0.0`):

```bash
# Preview scaffolding without writing files (verified offline via local git+file:// equivalent; remote GitHub fetch untested offline)
npx github:bhattasubash/devkit init --dry-run

# Auto-detect agent folders (.cursor, .claude, .codex, .agents, .gemini, .windsurf)
# Defaults to .agents/skills/devkit if none are found, and initializes .devkit/
npx github:bhattasubash/devkit init
```

Or clone and run the CLI directly with Node.js (verified end-to-end on a local clone):

```bash
git clone https://github.com/bhattasubash/devkit.git
node ./devkit/bin/devkit.mjs init --dry-run
node ./devkit/bin/devkit.mjs init
```

Verified CLI flags and commands (tested locally on Windows, Node `v24.11.1`):

```bash
# Target specific agents
node ./devkit/bin/devkit.mjs init --agent cursor,claude

# Overwrite an existing installation
node ./devkit/bin/devkit.mjs init --agent cursor,claude --force

# Check CLI status, version, or help
node ./devkit/bin/devkit.mjs check
node ./devkit/bin/devkit.mjs --version
node ./devkit/bin/devkit.mjs --help
```

### Installing Individual Skills (`skills` CLI)

Each skill (`security-audit`, `web-best-practices`, `anti-slop-design`, `seo-audit`) bundles its own `scripts/` copy and works standalone without `shared/`:

```bash
# Install a single skill (untested offline; requires the external skills CLI)
npx skills add bhattasubash/devkit --skill security-audit
npx skills add bhattasubash/devkit --skill web-best-practices
npx skills add bhattasubash/devkit --skill anti-slop-design
npx skills add bhattasubash/devkit --skill seo-audit
```

> **Note:** `npx skills add bhattasubash/devkit --list` shows only the root `devkit` skill because `SKILL.md` is at the repository root. Pass `--skill <name>` to install an individual sub-skill. (`npx skills` commands above are untested offline.)

### After Publishing to npm (Not Available Yet)

> **Status:** `@bhattasubash/devkit` is not published on npm yet (`npm view @bhattasubash/devkit` returns `E404`). Do not use this command until after publishing to npm:

```bash
npx @bhattasubash/devkit init
```

Untested install options:
- `npx github:bhattasubash/devkit init` live remote GitHub resolution (only the local `git+file://` equivalent was tested offline).
- `npx skills add bhattasubash/devkit --skill <name>` and `--list`.
- `node ./devkit/bin/devkit.mjs init --global` (global install into user home directories).
- Live host agent discovery when installed into `.cursor`, `.claude`, `.codex`, or `.agents`.

---

## Operating Modes

Each skill documents three operating modes for the AI agent:

1. **Lite Mode**: Targets smaller or faster models. Instructs the agent to review at most 3 files per step and follow sequential gates. *(Small-model pass rates are not measured yet; see [`evals/`](evals/).)*
2. **Standard Mode** *(Default)*: Runs the domain scanner, reviews relevant reference checklists, plans fixes behind `.devkit/scope.json`, and verifies findings.
3. **Full Mode**: Runs the domain scanners along with Tier 1–3 security checklists, the threat-model template, and full-review instructions.

---

## How It Works

```
┌──────────────────────────────────────────────────────────────┐
│  SKILL.md            Standardized instructions (<= 100 lines)│
│  references/         Targeted fix recipes (<= 150 lines)     │
│  scripts/            Zero-dependency Node.js scanners        │
│  .devkit/state.json  Phase state and evidence tracking       │
│  .devkit/scope.json  Allowed-file scope lock configuration   │
└──────────────────────────────────────────────────────────────┘
```

- **Approval Gates**: `SKILL.md` instructs the agent to stop at plan approval with an exact `STOP` prompt and wait for user approval before editing files.
- **Evidence Verification**: `verify-findings.mjs` verifies that every finding in `.devkit/reports/findings.json` references an existing file, valid line number, valid severity, non-empty fix, and matching line quote (within `±3` lines).
- **Scope Locks**: `check-scope.mjs` compares `git diff` and untracked files against `.devkit/scope.json` and fails if files outside `allowed_files` or disallowed dependency files were changed.
- **Zero Dependencies**: Scripts use only Node.js built-ins targeting Node 18+ (verified on Windows Node `v24.11.1`; macOS, Linux, and Node 18/20/22 not yet verified).

---

## Running Scanners Directly

Run the zero-dependency scripts directly from the repository root (`--help` verified for all 6 scripts):

```bash
# Secret Scanner
node security-audit/scripts/check-secrets.mjs .

# Design Slop Linter
node anti-slop-design/scripts/lint-design.mjs .

# HTML & Accessibility Linter
node web-best-practices/scripts/check-html.mjs .

# Technical SEO & Sitemaps Checker
node seo-audit/scripts/check-seo-files.mjs .

# Verify Findings JSON Integrity (requires an existing findings JSON file)
node shared/scripts/verify-findings.mjs .devkit/reports/findings.json

# Check Git Diff Against Scope Lock (requires an existing .devkit/scope.json file)
node shared/scripts/check-scope.mjs .devkit/scope.json
```

---

## Sources and Credits

Previously named in `README.md` (TODO: owner to confirm):
- [modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) — Google Chrome, Edge, Firefox, and MDN teams *(TODO: owner to confirm)*
- [Hallmark](https://github.com/Nutlope/hallmark) — Nutlope / Together AI *(TODO: owner to confirm)*
- [security-audit-skill](https://github.com/cloudflare/security-audit-skill) — Cloudflare *(TODO: owner to confirm)*
- [jev-seo](https://github.com/AgriciDaniel/jev-seo) — AgriciDaniel / TypeSafe *(TODO: owner to confirm)*

Design rules (`anti-slop-design/`) and security checklists (`security-audit/`):
- TODO: owner to confirm exact sources for the design rules and security checklists.

---

## License

[MIT](LICENSE)
