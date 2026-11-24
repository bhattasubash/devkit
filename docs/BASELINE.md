# Baseline Audit — devkit v1.0 (d9ff523)

Date: 2024-11-24
Branch: v1.1 (pre-work baseline)

## Repo Tree (24 files)

```
anti-slop-design/SKILL.md
anti-slop-design/references/anti-patterns.md
anti-slop-design/references/component-states.md
anti-slop-design/references/design-tokens.md
anti-slop-design/references/review-prompt.md
security-audit/SKILL.md
security-audit/references/threat-model-template.md
security-audit/references/tier1-blockers.md
security-audit/references/tier2-vulnerabilities.md
security-audit/references/tier3-advanced.md
security-audit/scripts/check-headers.mjs
security-audit/scripts/check-secrets.mjs
seo-audit/SKILL.md
seo-audit/references/aeo.md
seo-audit/references/on-page-checklist.md
seo-audit/references/structured-data.md
seo-audit/references/technical-seo.md
web-best-practices/SKILL.md
web-best-practices/references/accessibility.md
web-best-practices/references/checklist.md
web-best-practices/references/modern-patterns.md
web-best-practices/references/performance.md
LICENSE
README.md
```

## Known Problem Reproduction

### (a) check-secrets.mjs flags CSS class names containing "sk-"

**Status: REPRODUCED**

Fixture: `.task-management-dashboard-sk-wrapper { color: red; }` in `component.css`.

Output:
```json
{
  "file": "…\\component.css",
  "line": 1,
  "pattern": "OpenAI API Key",
  "snippet": "sk-…er"
}
```

Root cause: The OpenAI pattern `sk-(?:proj-|ant-)?[a-zA-Z0-9_-]{20,}` has no word boundary or start-of-token anchor. It matches `sk-wrapper` inside the class name string because the CSS class contains `sk-` followed by 20+ alphanumeric characters in the full line.

---

### (b) Flags public-by-design keys (Supabase anon JWT)

**Status: REPRODUCED**

Fixture: `const SUPABASE_KEY = "eyJhbG…"` containing a JWT with `"role": "anon"`.

Output:
```json
{
  "file": "…\\config.js",
  "line": 1,
  "pattern": "JWT Token",
  "snippet": "eyJ…ef"
}
```

Root cause: All JWTs are flagged as the same severity. No distinction between anon/public-role tokens (Supabase anon, Firebase web apiKey) and service-role/admin tokens. The scanner does not decode the JWT payload to check the role claim.

---

### (c) Flags a git-ignored .env as a committed secret

**Status: REPRODUCED**

Fixture: `.env` file in a git repo where `.gitignore` lists `.env`. Running `git check-ignore -v .env` from inside the fixture repo correctly identifies it as ignored.

Output:
```json
{
  "file": "…\\.env",
  "line": 0,
  "pattern": "Sensitive file committed",
  "snippet": "File \".env\" found and not in .gitignore"
}
```

Root cause: The `isGitIgnored()` function on line 75 runs `execSync('git check-ignore -q "${filePath}"')` without setting `cwd` to the target directory. The `git rev-parse` on line 187 correctly sets `cwd: resolved`, but `git check-ignore` runs in the scanner's own repo context. When the target is outside the scanner's git repo, `git check-ignore` fails with "is outside repository" and the catch block returns `false`.

---

### (d) Skips process.env fallback literals

**Status: REPRODUCED**

Fixture: Tested with a hardcoded fallback literal `process.env.KEY || fallback` in a test fixture.

Output: **Not flagged.** The literal `sk_live_…` on the same line as `process.env` was completely skipped.

Root cause: The `isEnvRef()` function on line 100 matches `process\.env` and returns `true` for the entire line. This skips all pattern checks for the whole line, including the hardcoded fallback literal after `||`.

---

### (e) Uses execSync with string interpolation (command injection risk)

**Status: REPRODUCED**

Line 75 of `check-secrets.mjs`:
```js
execSync(`git check-ignore -q "${filePath}"`, { stdio: 'ignore' });
```

A filename containing `"`, backticks, or `$(…)` could escape the double-quotes and inject shell commands. Should use `execFileSync('git', ['check-ignore', '-q', filePath])` with no shell.

Line 187 uses `execSync` with a hardcoded string (no user input) — safe but should still use `execFileSync` for consistency.

---

### (f) verify-anti-slop.mjs referenced but does not exist

**Status: NOT REPRODUCED**

Searched all `.md`, `.mjs`, and `.json` files in the repo for "verify-anti-slop". Zero matches found. This script is not referenced anywhere in the current repo.

Note: The concern is valid — no deterministic verification script exists for the anti-slop-design skill. The skill relies entirely on the agent's judgment and a fresh-context review prompt. A lint script would be valuable.

---

### (g) SECURITY.md used as the report filename

**Status: REPRODUCED**

`security-audit/SKILL.md` line 22 (Quick mode Report phase):
```
`SECURITY.md`: findings table (id, severity, file, line, evidence, fix)…
```

`security-audit/SKILL.md` line 32 (Full mode Report phase):
```
`SECURITY.md` and `findings.json`…
```

GitHub treats a file named `SECURITY.md` in the repo root as the project's Security Policy and links to it from the "Security" tab. Writing audit findings there is misleading — it looks like a vulnerability disclosure policy, not a one-time scan report. Reports should go to `.devkit/reports/` instead.

---

### (h) check-headers.mjs accepts localhost and private-network URLs

**Status: REPRODUCED**

Test commands and output:

```
> node check-headers.mjs "http://localhost:9999"
{"error":"fetch failed","url":"http://localhost:9999"}
EXIT CODE: 2

> node check-headers.mjs "http://192.168.1.1"
{"error":"Request timed out after 10s","url":"http://192.168.1.1"}
EXIT CODE: 2

> node check-headers.mjs "http://127.0.0.1:8080"
{"error":"fetch failed","url":"http://127.0.0.1:8080"}
EXIT CODE: 2
```

The script does not reject these URLs — it happily tries to fetch them and either times out or gets a connection error. While it exits non-zero, it should **reject** private/localhost URLs before making any request. If an agent runs this on user-supplied input, it becomes an SSRF vector.

---

### (i) No state.json template or validator

**Status: REPRODUCED**

All four SKILL.md files reference `state.json` with described fields:

- `anti-slop-design/SKILL.md` → `.devkit/design/state.json`
- `security-audit/SKILL.md` → `.devkit/security/state.json`
- `seo-audit/SKILL.md` → `.devkit/seo/state.json`
- `web-best-practices/SKILL.md` → `.devkit/web/state.json`

But:
- No `state.template.json` file exists
- No JSON schema for the state file exists
- No validator script exists
- Each SKILL.md describes the fields in prose, slightly differently
- An agent must guess the JSON structure from natural language

No files named `state*` exist anywhere in the repo.

---

## Summary

| ID | Problem | Status |
|----|---------|--------|
| a | CSS "sk-" class flagged as OpenAI key | **REPRODUCED** |
| b | Public-by-design keys flagged same as secrets | **REPRODUCED** |
| c | Git-ignored .env flagged as committed | **REPRODUCED** (cwd bug) |
| d | process.env fallback literal skipped | **REPRODUCED** |
| e | execSync with string interpolation | **REPRODUCED** |
| f | verify-anti-slop.mjs referenced but missing | **NOT REPRODUCED** (no reference found) |
| g | SECURITY.md as report filename | **REPRODUCED** |
| h | Localhost/private URLs accepted | **REPRODUCED** |
| i | No state.json template or validator | **REPRODUCED** |

8 of 9 problems reproduced. Problem (f) was not found in the current repo but the underlying concern (no deterministic design linter) is valid and addressed in Phase 3.
