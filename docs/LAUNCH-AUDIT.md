# Launch Audit (`devkit`)

- **Date:** 2026-11-25
- **Branch:** `launch-fixes` (branched from `main` at `449ce9f`)
- **Environment:** Windows, Node.js `v24.11.1`

---

## Summary of Reproduction Checks (a–f)

| Check | Description | Status | Key Evidence |
| :--- | :--- | :--- | :--- |
| **a** | `@bhattasubash/devkit` not on npm | **reproduced** | `npm view "@bhattasubash/devkit"` exited 1 (`E404 Not Found`) |
| **b** | Unbacked numbers / percentages / absolute claims in `README.md` and `CHANGELOG.md` | **reproduced** | `node --test` ran 49 tests (not 363); `verify-findings.mjs` has no AST parser; 7-repo benchmarks have no repo receipts |
| **c** | `"telemetry"` wording vs actual network behavior | **reproduced** | Only `security-audit/scripts/check-headers.mjs` makes `fetch()` calls (to user-supplied URL); CLI & other scripts make zero network calls; zero telemetry exists |
| **d** | Isolated skill folders break on `shared/` references | **reproduced** | All 4 skills fail `MODULE_NOT_FOUND` on `shared/scripts/{devkit-state,check-scope,verify-findings}.mjs`; `security-audit` also misses `shared/severity.md` |
| **e** | Missing repo hygiene files | **reproduced** | `.github/`, `.gitattributes`, `CONTRIBUTING.md`, `SECURITY.md`, and `.github/ISSUE_TEMPLATE` are all absent (`False`) |
| **f** | `evals/README.md` benchmark table unmeasured | **reproduced** | All 20 rows (5 models × 4 fixtures = 120 metric cells) are `"not measured yet"` |

---

## (a) npm Package Availability

Command run:
```powershell
npm view "@bhattasubash/devkit"
```

Real output (exit code `1`):
```text
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/@bhattasubash%2fdevkit - Not found
npm error 404
npm error 404  The requested resource '@bhattasubash/devkit@*' could not be found or you do not have permission to access it.
```
*(Note: an earlier run of the same command returned a transient `npm error code E502 Too many open files` from the registry before the clean `E404` run above.)*

**Verdict:** **Reproduced.** `npx @bhattasubash/devkit init` advertised in `README.md` (lines 15, 164, 175, 178, 181, 184) and `CHANGELOG.md` (line 19) cannot resolve from npm today.

---

## (b) Audit of Numbers, Percentages, and Absolute Claims

### Real `node --test` Output
Command run: `node --test` (on Node `v24.11.1`, Windows)
- `tests 49`
- `suites 0`
- `pass 49`
- `fail 0`
- `cancelled 0`
- `skipped 0`
- `todo 0`
- `duration_ms 6693.7022` (second standalone run; initial run was `6853.3264`)
- Across 9 `*.test.mjs` files: `anti-slop-design/scripts/tests/lint-design.test.mjs`, `bin/tests/devkit-cli.test.mjs`, `evals/tests/grade.test.mjs`, `security-audit/scripts/tests/check-secrets.test.mjs`, `seo-audit/scripts/tests/check-seo-files.test.mjs`, `shared/scripts/tests/check-scope.test.mjs`, `shared/scripts/tests/devkit-state.test.mjs`, `shared/scripts/tests/verify-findings.test.mjs`, `web-best-practices/scripts/tests/check-html.test.mjs`.

### Does `shared/scripts/verify-findings.mjs` Do Any AST Parsing?
**No.** Reading `shared/scripts/verify-findings.mjs` (lines 1–243) and grepping all `.mjs` files confirms zero AST libraries or parsers (`acorn`, `babel`, `typescript`, `esprima`, `espree`, `parse5`, `recast`, `tree-sitter`) exist in the repository. `verify-findings.mjs` reads files as UTF-8, splits on `'\n'` (line 141), normalizes whitespace with `.trim().replace(/\s+/g, ' ')` (line 76), and checks `normActual.includes(normQuote)` (line 176) with a `± 3` line tolerance window (line 183).

### Complete Inventory of Claims in `README.md`

| Location | Claim | Backing in Repo (File or Command) | Verdict |
| :--- | :--- | :--- | :--- |
| `README.md:4` | `version-1.1.0` | `package.json:3`, `CHANGELOG.md:16` | **supported** (local repo version; not on npm) |
| `README.md:5,15,164,175,178,181,184` | `npx @bhattasubash/devkit init` (plus flags) | `npm view "@bhattasubash/devkit"` -> `E404 Not Found` | **unsupported** |
| `README.md:6,9,24-28` | `4` skills (`skills-4`), `"Four deterministic agent skills"` | 4 skill dirs + root `SKILL.md` exist. However `check-html.mjs:18` & `web-best-practices/SKILL.md:37` mark JSX/TSX checks `heuristic`; scanners use regex/string matching, not full deterministic parsing | **unsupported** (count `4` supported; blanket `"deterministic"` overstated) |
| `README.md:7,14,167,237,252` | `0` dependencies (`dependencies-0`, `"zero dependencies"`, `"Node.js 18+ ... across Windows, macOS, and Linux"`) | `package.json` has no `dependencies`/`devDependencies` and `"engines": { "node": ">=18.0.0" }`; `node --test` passes on Windows Node `v24.11.1` | **supported** for zero dependencies; **unknown** for macOS, Linux, and Node 18/20/22 (not tested here) |
| `README.md:14,161` | `"< 50ms"` / `"scaffolds ... in under 50ms"` | `node bin/devkit.mjs init --dry-run --cwd <tmp>` printed `8.4ms` (dry-run only; excludes `npx` network install and real file-copy duration) | **unsupported** for `npx`; **unknown** for real non-dry-run `init` across environments |
| `README.md:32,34,36` | `"Proven Across 7 Production Codebases (Real Receipts)"`, `"7 distinct production systems (Next.js 16 SaaS, FastAPI enterprise backends, Kubernetes self-healing operators, fintech monorepos, Convex reactive apps, and Vite frontends)"` | No receipt files, logs, or testbed artifacts in repo (also parenthetical names 6 categories, not 7) | **unsupported** |
| `README.md:40` | `"12 – 21 files"`, `"2 – 3 files"`, `"-85% blast radius"` | No benchmark logs or calculation scripts in repo | **unsupported** |
| `README.md:41` | `"100% intercepted by check-scope.mjs"`, `"Zero git pollution"` | `shared/scripts/check-scope.mjs` exists (6 passing unit tests), but `"100% intercepted"` / `"Zero git pollution"` across 7 repos has no receipts, and `check-scope.mjs` is post-edit only | **unsupported** |
| `README.md:42` | `"Zero accepted"`, `"AST + line-quote validation"`, `"100% grounded"` | `verify-findings.mjs` uses line-based substring matching, **no AST parsing**; `evals/README.md` has zero measured runs | **unsupported** (`AST` is false) |
| `README.md:43` | `"363 passing unit/regression tests executed"`, `"100% pass rate"` | `node --test` ran **49** passing tests; no 363-test suite or log exists in repo | **unsupported** |
| `README.md:44` | `"~45 mins (triaging 500+ lines...)"`, `"~3 mins"`, `"93% time saved"` | No timing measurements or study data in repo | **unsupported** |
| `README.md:50-71` (Mermaid) | `"15+ unrelated files"`, `"Out-of-scope edit halted"`, `"2-3 files"`, `"AST & line quote verified"`, `"~3 mins"` | Same unbacked numbers + false `"AST"` claim; `check-scope.mjs` runs post-edit, not inline | **unsupported** |
| `README.md:73-97` | Raw CLI Receipt: `K8S-003`, `brain/app/services/k8s_executor.py`, line `119` -> `107`, `"total_findings": 4`, `node .devkit/shared/scripts/verify-findings.mjs` | File does not exist in repo; `.devkit/shared/scripts/` does not match repo (`shared/scripts/`) or CLI install layout (`.agents/skills/devkit/shared/scripts/`) | **unsupported** |
| `README.md:103-119` | Receipt 1 (`Project Heal`): `brain/app/main.py`, `data/temporal_store.db`, `4 findings`, `165 passed in 39.00s`, `0 phantom passes`, `3 scoped files`, `0 out-of-scope edits` | No logs or files for `Project Heal` exist in repo | **unsupported** |
| `README.md:121-135` | Receipt 2 (`Investment Platform Monorepo`): `21 uncommitted files`, `0.001 USDT`, `2 scoped files`, `0 out-of-scope edits`, `5 deterministic test failures`, `5 audit findings`, `"AST quotes"`, `18 new unit tests`, `8/8 backend suites (40/40 tests)`, `zero regressions` | No logs or files exist in repo; `"AST quotes"` is false | **unsupported** |
| `README.md:137-151` | Receipt 3 (`ZENTRO` & `CIT Scheduler`): `src/lib/stripe.ts:4`, `users.py`, `0 secret leaks`, `88 total unit & security assertions` | No logs or files exist in repo | **unsupported** |
| `README.md:192,197,202` | `git clone https://github.com/bhattasubash/devkit.git ...` | `git remote -v` confirms `https://github.com/bhattasubash/devkit.git` | **supported** for URL; target layout behavior **unknown** (untested) |
| `README.md:216` | `"Lite Mode ... Reviews at most 3 files per step"` | Documented in all `SKILL.md` files (`Max 3 files per step`); effectiveness on small models unmeasured (`evals/README.md`) | **supported** as documented rule; effectiveness **unknown** |
| `README.md:226-227` | `SKILL.md (<= 100 lines)`, `references/ (<= 150 lines)` | Verified by line count: root `SKILL.md` = 60 lines; 4 skill `SKILL.md` = 58 lines each; all 20 `*/references/*.md` files = 17–148 lines | **supported** |
| `README.md:245-246` | `"Zero invented content"`, `"never declare a codebase 'all fixed', 'fully verified', or '100% secure'"` | Policy rules in `SKILL.md` files and checked by `evals/grade.mjs` | **supported** as documented policy |
| `README.md:256-271` | 6 direct `node <path>` scanner/validator commands | All 6 script paths exist inside the full repo; `verify-findings.mjs` and `check-scope.mjs` require `.devkit/` files and fail when a skill is copied standalone without `shared/` | **supported** in full repo; **unsupported** for standalone skill installs |
| `README.md:278-282` | Credits: `modern-web-guidance`, `Hallmark`, `security-audit-skill`, `jev-seo` | External URLs named in README; provenance not independently verifiable from repo history | **unknown** (owner to confirm) |

### Complete Inventory of Claims in `CHANGELOG.md`

| Location | Claim | Backing in Repo (File or Command) | Verdict |
| :--- | :--- | :--- | :--- |
| `CHANGELOG.md:11` | `"Production Telemetry & Receipts in README ... empirical metrics across 7 real-world testbed codebases (Next.js 16 SaaS, Kubernetes operator, Fintech core, FastAPI backend, Convex fullstack, and Vite frontend)"` | No receipts or telemetry exist in repo; lists 6 technologies for 7 systems; mislabels static examples as telemetry | **unsupported** |
| `CHANGELOG.md:12` | `"± 3 line tolerance window"` in `verify-findings.mjs` | `shared/scripts/verify-findings.mjs:183` (`const tolerance = 3;`) | **supported** |
| `CHANGELOG.md:13` | `suggested_line`, `"(e.g. line 119 vs 107)"`, `"eliminate trial-and-error agent turns"` | `suggested_line` implemented in `verify-findings.mjs:203-221`; `119 vs 107` comes from unbacked `K8S-003` receipt; `"eliminate"` is an unverified absolute claim | **supported** for feature; **unsupported** for example & `"eliminate"` |
| `CHANGELOG.md:14` | Ephemeral filtering & custom `ignored_files` / `ignore_patterns` in `check-scope.mjs` | `shared/scripts/check-scope.mjs:194-209` and passing test in `check-scope.test.mjs` | **supported** |
| `CHANGELOG.md:19` | `npx @bhattasubash/devkit init` scaffolds skills + `.devkit/` `"in milliseconds"` | `bin/devkit.mjs` dry-run ran in `8.4ms`, but `npx @bhattasubash/devkit init` fails with npm `E404` | **unsupported** for `npx` command |
| `CHANGELOG.md:25` | `Exposure × Impact` scoring preventing dev-only deps from exceeding Medium | Policy defined in `shared/severity.md` (lines 9, 54); not enforced programmatically by scanners | **supported** as documented policy |
| `CHANGELOG.md:31` | `"<= 150 lines each across all 4 skills"` (`references/fix-recipes.md`) | Line counts: `anti-slop-design` = 130, `security-audit` = 109, `seo-audit` = 145, `web-best-practices` = 125 | **supported** |
| `CHANGELOG.md:33` | `"Four evaluation fixtures: vuln-app, slop-site, seo-spa, and clean-site"` | Verified in `evals/fixtures/` | **supported** |
| `CHANGELOG.md:35` | `"20 benchmark prompts with standardized 6-point compliance checklists"` | Verified in `evals/prompts.md` (Prompts 1–20, 6-point checklist lines 5–11) | **supported** |
| `CHANGELOG.md:38` | `"empirical model performance matrix"` in `evals/README.md` | `evals/README.md:65-86` has only `"not measured yet"` in every cell | **unsupported** (nothing empirical measured) |
| `CHANGELOG.md:46,55` | Replaced `execSync` with `execFileSync` | `Select-String` for `execSync` across all `.mjs` files returned zero matches; `check-secrets.mjs:86,102` and `check-scope.mjs:147` use `execFileSync` | **supported** |
| `CHANGELOG.md:49` | `"all skill specifications to <= 100 lines in a strict 8-section layout"` | Root `SKILL.md` = 60 lines; all 4 skill `SKILL.md` files = 58 lines each, all with the 8 headings | **supported** |

---

## (c) `"telemetry"` Wording and Network Calls Audit

Occurrences of `telemetry` (case-insensitive):
- `README.md:36`: `### Benchmark Telemetry Across 7 Repositories`
- `CHANGELOG.md:11`: `- **Production Telemetry & Receipts in README**: ...`

Grep across `bin/`, `shared/scripts/`, `anti-slop-design/scripts/`, `security-audit/scripts/`, `seo-audit/scripts/`, `web-best-practices/scripts/`, and `evals/` for `fetch(`, `node:http`, `node:https`, `node:dns`, `node:net`, `node:tls`, `node:dgram`, `XMLHttpRequest`, `WebSocket`, `createConnection`, `request(` and `\b(fetch|http|https|dns|net)\b`:

| File | Matches | Behavior |
| :--- | :--- | :--- |
| `bin/devkit.mjs` | Line 222 (`$schema: 'https://json-schema.org/draft/2020-12/schema'`) | **No network calls.** String literal only. |
| `security-audit/scripts/check-headers.mjs` | Lines 12, 23–24, 110 (`await fetch(targetUrl, ...)`), 122 (`await fetch(targetUrl, ...)`) | **Makes outbound HTTP `HEAD`/`GET` `fetch()` requests** exclusively to the user-supplied `<url>` argument. |
| `seo-audit/scripts/check-seo-files.mjs` | Lines 107, 116, 183, 191, 245, 283 | **No network calls.** String/URL scheme validation only. |
| All other `.mjs` scripts (`shared/scripts/*`, `check-secrets.mjs`, `lint-design.mjs`, `check-html.mjs`, `evals/grade.mjs`) | None | **No network calls.** |

**Verdict:** **Reproduced.** Neither the CLI nor any script collects or transmits telemetry. However, saying the whole toolkit makes zero network calls without qualification would omit `security-audit/scripts/check-headers.mjs`, which intentionally fetches the `<url>` passed to it. The CLI (`bin/devkit.mjs`) itself makes zero network calls.

---

## (d) Isolated Single-Skill Folder Test (No `shared/`)

Each skill directory was copied alone into an isolated temp folder (`<temp>/<skill>/<skill>` with no `shared/`), and every command in its `SKILL.md` was run from `<temp>/<skill>`.

| Skill | Commands Run | Exists? | Exit Code & Output Summary |
| :--- | :--- | :--- | :--- |
| **`web-best-practices`** | `node shared/scripts/devkit-state.mjs init --skill web-best-practices --mode standard` | **MISSING** | Exit `1`: `Error: Cannot find module '...\shared\scripts\devkit-state.mjs'` |
| | `node web-best-practices/scripts/check-html.mjs .` | Exists | Exit `0`: JSON `total_findings: 0` |
| | `node shared/scripts/check-scope.mjs .devkit/scope.json` | **MISSING** | Exit `1`: `Error: Cannot find module '...\shared\scripts\check-scope.mjs'` |
| | `node shared/scripts/verify-findings.mjs .devkit/reports/findings.json` | **MISSING** | Exit `1`: `Error: Cannot find module '...\shared\scripts\verify-findings.mjs'` |
| | `node shared/scripts/devkit-state.mjs advance` | **MISSING** | Exit `1`: `Error: Cannot find module '...\shared\scripts\devkit-state.mjs'` |
| **`anti-slop-design`** | `node shared/scripts/devkit-state.mjs init --skill anti-slop-design --mode standard` | **MISSING** | Exit `1`: `Error: Cannot find module '...\shared\scripts\devkit-state.mjs'` |
| | `node anti-slop-design/scripts/lint-design.mjs .` | Exists | Exit `0`: JSON `total_findings: 0` |
| | `node shared/scripts/check-scope.mjs .devkit/scope.json` | **MISSING** | Exit `1`: `Error: Cannot find module '...\shared\scripts\check-scope.mjs'` |
| | `node shared/scripts/verify-findings.mjs .devkit/reports/findings.json` | **MISSING** | Exit `1`: `Error: Cannot find module '...\shared\scripts\verify-findings.mjs'` |
| | `node shared/scripts/devkit-state.mjs advance` | **MISSING** | Exit `1`: `Error: Cannot find module '...\shared\scripts\devkit-state.mjs'` |
| **`security-audit`** | `node shared/scripts/devkit-state.mjs init --skill security-audit --mode standard` | **MISSING** | Exit `1`: `Error: Cannot find module '...\shared\scripts\devkit-state.mjs'` |
| | `node security-audit/scripts/check-secrets.mjs .` | Exists | Exit `0`: JSON `findings: []` |
| | `node security-audit/scripts/check-headers.mjs` | Exists | Exit `2`: `Usage: node check-headers.mjs <url>` (no `<url>` arg supplied) |
| | `node shared/scripts/check-scope.mjs .devkit/scope.json` | **MISSING** | Exit `1`: `Error: Cannot find module '...\shared\scripts\check-scope.mjs'` |
| | `node shared/scripts/verify-findings.mjs .devkit/reports/findings.json` | **MISSING** | Exit `1`: `Error: Cannot find module '...\shared\scripts\verify-findings.mjs'` |
| | `node shared/scripts/devkit-state.mjs advance` | **MISSING** | Exit `1`: `Error: Cannot find module '...\shared\scripts\devkit-state.mjs'` |
| | `shared/severity.md` (referenced in `SKILL.md:37`) | **MISSING** | `Test-Path shared/severity.md` -> `False` |
| **`seo-audit`** | `node shared/scripts/devkit-state.mjs init --skill seo-audit --mode standard` | **MISSING** | Exit `1`: `Error: Cannot find module '...\shared\scripts\devkit-state.mjs'` |
| | `node seo-audit/scripts/check-seo-files.mjs .` | Exists | Exit `0`: JSON `total_findings: 0` |
| | `node shared/scripts/check-scope.mjs .devkit/scope.json` | **MISSING** | Exit `1`: `Error: Cannot find module '...\shared\scripts\check-scope.mjs'` |
| | `node shared/scripts/verify-findings.mjs .devkit/reports/findings.json` | **MISSING** | Exit `1`: `Error: Cannot find module '...\shared\scripts\verify-findings.mjs'` |
| | `node shared/scripts/devkit-state.mjs advance` | **MISSING** | Exit `1`: `Error: Cannot find module '...\shared\scripts\devkit-state.mjs'` |

**Verdict:** **Reproduced.** None of the four skills can run their documented workflow when installed standalone without `shared/`. *(Note: even `<skill>/scripts/...` assumes `cwd` is the parent directory containing `<skill>/`, not the target project root when installed inside `.agents/skills/<skill>/`.)*

---

## (e) Repository Hygiene Files

Command check on repo root:

| Path | Exists |
| :--- | :--- |
| `.github/` | `False` |
| `.gitattributes` | `False` |
| `CONTRIBUTING.md` | `False` |
| `SECURITY.md` | `False` |
| `.github/ISSUE_TEMPLATE` | `False` |

**Verdict:** **Reproduced.** All five hygiene items are missing. *(Note: `node --test` also printed `LF will be replaced by CRLF the next time Git touches it` warnings during temporary git fixture tests on Windows because `.gitattributes` is absent.)*

---

## (f) `evals/README.md` Results Matrix

Inspection of `evals/README.md` lines 65–86 (`## 3. Benchmark Results`):
- Models listed: `Claude 3.5 Sonnet`, `Claude 3.5 Haiku`, `GPT-4o`, `GPT-4o-mini`, `Gemini 2.0 Flash` (5 models × 4 fixtures = 20 rows).
- Columns: `Recall`, `Precision`, `Scope Violations`, `Banned Phrases`, `Missing Sections`, `Grade` (120 cells total).
- Value in all 120 cells: `not measured yet`.

**Verdict:** **Reproduced.** Every result in `evals/README.md` is `"not measured yet"`.
