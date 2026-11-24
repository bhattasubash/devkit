# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Production Telemetry & Receipts in README**: Documented concrete before/after receipts, Mermaid architecture comparisons, and empirical metrics across 7 real-world testbed codebases (Next.js 16 SaaS, Kubernetes operator, Fintech core, FastAPI backend, Convex fullstack, and Vite frontend).
- **Line-Drift Tolerance in `verify-findings.mjs`**: Supports a $\pm 3$ line tolerance window to accommodate minor offset shifts from newly added imports or comments without breaking verification, while preserving strict quote assertions.
- **Diagnostic Hints (`suggested_line`)**: When an agent cites a line out of tolerance (e.g. line 119 vs 107), `verify-findings.mjs` scans the file and returns the exact `suggested_line` in its failure payload to eliminate trial-and-error agent turns.
- **Ephemeral Test Artifact Filtering in `check-scope.mjs`**: Automatically ignores runtime test side-effects (`.pytest_cache`, `__pycache__`, `*.db-journal`, `*.sqlite-journal`, `*.tmp`, `coverage`) and adds support for custom `ignored_files` / `ignore_patterns` in `scope.json`.

## [1.1.0] - 2026-11-24

### Added
- **One-Line CLI Installer (`bin/devkit.mjs` & `package.json`)**: Zero-dependency `npx @bhattasubash/devkit init` CLI installer that auto-detects `.cursor`, `.claude`, `.codex`, or `.agent` directories and scaffolds skills and the `.devkit/` directory in milliseconds.
- **Root Router Skill (`SKILL.md`)**: Orchestrates full-workspace audits sequentially across `security-audit`, `web-best-practices`, `anti-slop-design`, and `seo-audit` with unified state management and scope locks.
- **Shared Enforcement Tooling (`shared/scripts/`)**:
  - `devkit-state.mjs` & `state.template.json`: Phase state machine requiring non-empty evidence and explicit `approved_by_user` confirmation before advancing.
  - `verify-findings.mjs`: Strict grounded finding validator enforcing exact file existence, line bounds, whitespace-normalized line content quotes, and valid severities.
  - `check-scope.mjs`: Git diff and untracked file validator comparing changes against `.devkit/scope.json` with dependency modification protections.
  - `severity.md`: Exposure $\times$ Impact vulnerability scoring system preventing dev-only dependencies from scoring above Medium.
- **Deterministic Scanners**:
  - `anti-slop-design/scripts/lint-design.mjs`: Flags literal CSS colors, `transition: all`, root `overflow-x: hidden`, `width: 100vw`, un-paired outline removals, missing `prefers-reduced-motion`, and accessible button violations on `div` elements with click handlers.
  - `web-best-practices/scripts/check-html.mjs`: Detects missing lang, missing viewport meta, non-standard meta description lengths, multiple `<h1>` elements, unlabeled `<input>` fields, missing image alt/dimension tags, and `<a href="#">` dead links.
  - `seo-audit/scripts/check-seo-files.mjs`: Validates `robots.txt` Sitemap directives, checks `sitemap.xml` for fragments (#) and host consistency, validates canonical tags, Open Graph tags, JSON-LD schemas, and detects client-only SPA empty containers.
- **Targeted Fix Recipes (`references/fix-recipes.md`)**:
  - Actionable before/after code recipes ($\le 150$ lines each) across all 4 skills covering native dialogs, accessible buttons, hosting config headers, React SPA prerendering, fragment-free sitemaps, AI crawler consent, grounded schema markup, and environment fallbacks.
- **Evaluation Suite (`evals/`)**:
  - Four evaluation fixtures: `vuln-app`, `slop-site`, `seo-spa`, and `clean-site`.
  - `expected.json`: Complete catalog of planted issues with exact lines, quotes, and severities.
  - `prompts.md`: 20 benchmark prompts with standardized 6-point compliance checklists.
  - `grade.mjs`: Zero-dependency automated evaluation grader reporting precision, recall, scope violations, banned phrases, and missing report sections.
  - `selftest/`: Handwritten good and bad benchmark samples to verify grader discrimination.
  - `README.md`: Evaluation execution guide and empirical model performance matrix.

### Changed
- **`security-audit/scripts/check-secrets.mjs` Hardening**:
  - Added lookaround boundaries `(?<![\w-])` / `(?![\w-])` to secret regexes, eliminating false positives on slugs and CSS class names like `task-management-dashboard-component-wrapper`.
  - Added detection for hardcoded fallback secrets in `process.env.KEY || "literal"`.
  - Reclassified git-ignored `.env` files to `local_only_notes` instead of committed secrets.
  - Classified public-by-design keys (`Supabase anon JWT`, `Stripe pk_`, `Firebase Web API Key`) as severity `"info"` with decoded JWT role validation.
  - Replaced `execSync` shell commands with `execFileSync` and argument arrays, preventing shell injection vulnerabilities.
  - Added `--help` CLI documentation, JSON output formatting, and standardized exit codes.
- **Skill Specifications (`SKILL.md`)**:
  - Standardized all skill specifications to $\le 100$ lines in a strict 8-section layout (Purpose, Modes, Procedure, Evidence rules, Scope lock, Output files, Final report template, Safety).
  - Standardized gate approval text to exact required stop block.
  - Relocated audit reports from root `SECURITY.md` to `.devkit/reports/`.
  - Prohibited unsubstantiated marketing phrases (`"all fixed"`, `"fully verified"`).

### Fixed
- Fixed shell injection risks in secret scanner script by replacing command string execution with argument arrays.
- Fixed improper failure of `git check-ignore` when evaluating directories outside the scanner's working copy.
- Fixed false-positive detection of public client API keys as critical vulnerabilities.
