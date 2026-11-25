# Contributing to devkit

Thank you for contributing to `devkit`. Please keep every change zero-dependency (Node.js 18+ built-ins only), cross-platform (Windows, macOS, and Linux), and safe for workspace paths containing spaces.

## Running Tests and Scanners Locally

From the repository root:

```bash
# Run the unit and integration test suite
node --test

# Verify shared/scripts/* copies inside each skill match the source
node scripts/sync-shared.mjs --check

# Run the repository's own scanners against the repo
node security-audit/scripts/check-secrets.mjs .
node anti-slop-design/scripts/lint-design.mjs .
node web-best-practices/scripts/check-html.mjs .
node seo-audit/scripts/check-seo-files.mjs .
```

## Updating Shared Scripts

Shared helper scripts live in `shared/scripts/` and are copied into each standalone skill's `scripts/` directory (`anti-slop-design/scripts/`, `security-audit/scripts/`, `seo-audit/scripts/`, `web-best-practices/scripts/`).

If you edit a file in `shared/scripts/`, sync all four skill copies before committing:

```bash
node scripts/sync-shared.mjs
node scripts/sync-shared.mjs --check
```

Do not edit copied shared scripts inside individual skill folders without updating `shared/scripts/` and running `node scripts/sync-shared.mjs`, or `node --test` will fail.

## Keeping Skills Self-Contained and Concise

- Keep every `SKILL.md` at `100` lines or fewer.
- Keep each `references/*.md` file at `150` lines or fewer.
- Do not introduce `shared/` path dependencies into the four domain skills' `SKILL.md` files.

## Reporting a False Positive

If a scanner flags valid code, markup, or configuration as an issue:

1. Use the **False Positive** issue template in [`.github/ISSUE_TEMPLATE/false-positive.md`](.github/ISSUE_TEMPLATE/false-positive.md).
2. Include the file path, line number, exact quote from that line, which scanner/tool reported it, and what behavior you expected.
3. Never paste real secrets, API keys, or private credentials into an issue; replace them with synthetic placeholders that still reproduce the pattern.

## Submitting Evaluation Results

See [`evals/README.md`](evals/README.md) and the **Eval Result** issue template in [`.github/ISSUE_TEMPLATE/eval-result.md`](.github/ISSUE_TEMPLATE/eval-result.md) to share measured `evals/grade.mjs` runs.
