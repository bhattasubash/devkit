# Running Benchmark Evaluations

This guide describes how to run an AI model against a `devkit` fixture, grade the outputs with `evals/grade.mjs`, and submit results.

## Prerequisites

- Node.js `>=18.0.0` (`node --version`)
- Zero external npm dependencies required

## 1. Sanity-Check the Grader (Optional)

Verify `evals/grade.mjs` locally against the built-in selftest samples:

```bash
node evals/grade.mjs vuln-app evals/selftest/good --assert-pass
node evals/grade.mjs vuln-app evals/selftest/bad
```

## 2. Stage a Fixture in an Isolated Temp Workspace

Copy one fixture (`vuln-app`, `slop-site`, `seo-spa`, or `clean-site`) to a temporary folder outside the repository. Remove `expected.json` from the staged copy so the model does not read the answer key (`evals/grade.mjs` falls back to `evals/expected.json` automatically).

**macOS / Linux (`bash`):**
```bash
WORK_DIR="$(mktemp -d)"
cp -r evals/fixtures/vuln-app "$WORK_DIR/vuln-app"
rm -f "$WORK_DIR/vuln-app/expected.json"
```

**Windows (`PowerShell`):**
```powershell
$WorkDir = Join-Path $env:TEMP ("devkit-eval-" + [guid]::NewGuid().ToString("N").Substring(0,8))
New-Item -ItemType Directory -Path $WorkDir | Out-Null
Copy-Item -Path "evals/fixtures/vuln-app" -Destination "$WorkDir\vuln-app" -Recurse
Remove-Item -Path "$WorkDir\vuln-app\expected.json" -ErrorAction SilentlyContinue
```

If testing an isolated single skill (`security-audit`, `web-best-practices`, `anti-slop-design`, or `seo-audit`) or the full `devkit` toolkit inside `$WORK_DIR/vuln-app`, install or copy the skill folder into the staged project (for example with `node /path/to/devkit/bin/devkit.mjs init --cwd "$WORK_DIR/vuln-app"`).

## 3. Run the Model

1. Pick a prompt from [`prompts.md`](prompts.md) matching the fixture and mode (`lite`, `standard`, or `full`).
2. Supply the model with the target `SKILL.md` (root `SKILL.md` for full-router prompts, or `<skill>/SKILL.md` for single-skill prompts).
3. Run the model inside the staged fixture folder until completion.
4. Confirm the model writes its state, scope lock, and reports under `.devkit/` (`state.json`, `scope.json`, `reports/`).

## 4. Grade the Outputs

Run `evals/grade.mjs` pointing at the fixture name and the staged workspace:

```bash
# Human-readable summary
node evals/grade.mjs vuln-app /path/to/staged/vuln-app

# Machine-readable JSON for reporting
node evals/grade.mjs vuln-app /path/to/staged/vuln-app --json

# Non-zero exit code on FAIL
node evals/grade.mjs vuln-app /path/to/staged/vuln-app --assert-pass
```

## 5. Report Results

Open a new issue using the **Eval Result** template at [`.github/ISSUE_TEMPLATE/eval-result.md`](../.github/ISSUE_TEMPLATE/eval-result.md) and fill in:
- **Model** (exact model name and version)
- **Mode** (`lite`, `standard`, or `full`)
- **Fixture** (`vuln-app`, `slop-site`, `seo-spa`, or `clean-site`)
- **Grader Output** (full unedited output of `node evals/grade.mjs <fixture> <results-dir> --json`)

## 6. Current Results Status

No real model evaluation result files exist in this repository yet. All model rows in [`evals/README.md`](README.md) remain `not measured yet`:

| Model | Fixture | Recall | Precision | Scope Violations | Banned Phrases | Missing Sections | Grade |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Claude 3.5 Sonnet** | `vuln-app`, `slop-site`, `seo-spa`, `clean-site` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
| **Claude 3.5 Haiku** | `vuln-app`, `slop-site`, `seo-spa`, `clean-site` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
| **GPT-4o** | `vuln-app`, `slop-site`, `seo-spa`, `clean-site` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
| **GPT-4o-mini** | `vuln-app`, `slop-site`, `seo-spa`, `clean-site` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
| **Gemini 2.0 Flash** | `vuln-app`, `slop-site`, `seo-spa`, `clean-site` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
