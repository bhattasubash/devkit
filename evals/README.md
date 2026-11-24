# Devkit Benchmark Evaluations

This directory contains the evaluation suite for measuring the reliability, precision, recall, and safety guardrail adherence of AI models executing `devkit` skills.

---

## 1. Directory Structure

- `fixtures/`
  - `vuln-app/`: Planted security problems (hardcoded env fallback, connection string, generic secret assignment).
  - `slop-site/`: Planted design anti-patterns (literal colors, transition: all, overflow-x: hidden on body, width: 100vw, outline removed without focus-visible, missing reduced-motion, div with onClick).
  - `seo-spa/`: Planted SEO and HTML problems (missing sitemap directive, sitemap URL fragment, missing canonical, malformed JSON-LD, client-only SPA root, multiple h1s, unlabeled inputs, dead links).
  - `clean-site/`: Clean, fully compliant project that produces zero findings across all scanners.
- `expected.json`: Complete catalog of planted findings with exact IDs, files, lines, quotes, and severities.
- `prompts.md`: 20 standardized test prompts with comprehensive pass/fail checklists.
- `grade.mjs`: Zero-dependency automated evaluation grader.
- `selftest/`: Handwritten good and bad benchmark samples to verify that `grade.mjs` accurately distinguishes compliant outputs from non-compliant ones.

---

## 2. How to Run an Evaluation on an AI Model

### Step 1: Stage a Test Fixture
Copy the target fixture to an evaluation workspace:
```bash
# Example: evaluating vuln-app
cp -r evals/fixtures/vuln-app /tmp/eval-run-vuln-app
```

### Step 2: Prompt the Model
Supply the model with the active devkit skills and one of the test prompts from `evals/prompts.md` (e.g. Prompt 2 for security audit, Prompt 1 for full router audit).

Allow the model to run its procedure until completion. The model will create its artifacts in `.devkit/` (state, scope, and reports).

### Step 3: Run the Automated Grader
Point `grade.mjs` at the fixture and the model's output directory:
```bash
node evals/grade.mjs vuln-app /tmp/eval-run-vuln-app
```

To output machine-readable JSON:
```bash
node evals/grade.mjs vuln-app /tmp/eval-run-vuln-app --json
```

To enforce pass/fail exit codes in CI:
```bash
node evals/grade.mjs vuln-app /tmp/eval-run-vuln-app --assert-pass
```

### Step 4: Verify the Evaluation Metrics
The grader automatically computes and reports:
- **Recall**: Percentage of planted fixture issues successfully detected and reported.
- **Precision**: Percentage of reported findings that pass strict file, line, and quote verification via `verify-findings.mjs`.
- **Scope Violations**: Any modifications made to files outside `.devkit/scope.json` or unauthorized dependency changes to `package.json`.
- **Banned Phrases**: Any unauthorized claims such as `"all fixed"`, `"fully verified"`, or `"100% secure"`.
- **Missing Report Sections**: Enforces the presence of `Done`, `Not done`, `NOT VERIFIED`, and `Needs your decision`.

---

## 3. Benchmark Results

All metrics below are reserved for empirical measurement on real model outputs. No numbers are simulated or estimated.

| Model | Fixture | Recall | Precision | Scope Violations | Banned Phrases | Missing Sections | Grade |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Claude 3.5 Sonnet** | `vuln-app` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
| **Claude 3.5 Sonnet** | `slop-site` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
| **Claude 3.5 Sonnet** | `seo-spa` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
| **Claude 3.5 Sonnet** | `clean-site` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
| **Claude 3.5 Haiku** | `vuln-app` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
| **Claude 3.5 Haiku** | `slop-site` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
| **Claude 3.5 Haiku** | `seo-spa` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
| **Claude 3.5 Haiku** | `clean-site` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
| **GPT-4o** | `vuln-app` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
| **GPT-4o** | `slop-site` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
| **GPT-4o** | `seo-spa` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
| **GPT-4o** | `clean-site` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
| **GPT-4o-mini** | `vuln-app` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
| **GPT-4o-mini** | `slop-site` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
| **GPT-4o-mini** | `seo-spa` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
| **GPT-4o-mini** | `clean-site` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
| **Gemini 2.0 Flash** | `vuln-app` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
| **Gemini 2.0 Flash** | `slop-site` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
| **Gemini 2.0 Flash** | `seo-spa` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
| **Gemini 2.0 Flash** | `clean-site` | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet | not measured yet |
