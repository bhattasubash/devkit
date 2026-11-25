# Receipt: check-html on evals/fixtures/slop-site

- **Date:** `2026-11-25T05:22:33.069Z`
- **Git Commit:** `50ccdc6db96478b04abcc44a3e16ba746409bcfa`
- **Command:** `node web-best-practices/scripts/check-html.mjs evals/fixtures/slop-site`
- **Exit Code:** `1`

## Output (stdout)

~~~~text
{
  "scanned_dir": "C:\\Users\\SUBASH\\Desktop\\test\\My Own SKill\\devkit\\evals\\fixtures\\slop-site",
  "total_findings": 3,
  "findings": [
    {
      "id": "HTML-001",
      "rule": "MISSING_VIEWPORT_META",
      "severity": "critical",
      "confidence": "deterministic",
      "file": "index.html",
      "line": 1,
      "quote": "<head>",
      "fix": "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> inside <head>."
    },
    {
      "id": "HTML-002",
      "rule": "MISSING_META_DESCRIPTION",
      "severity": "high",
      "confidence": "deterministic",
      "file": "index.html",
      "line": 1,
      "quote": "<head>",
      "fix": "Add a <meta name=\"description\" content=\"...\"> tag with 50–160 characters summarizing the page."
    },
    {
      "id": "HTML-003",
      "rule": "MISSING_H1",
      "severity": "high",
      "confidence": "deterministic",
      "file": "index.html",
      "line": 1,
      "quote": "<body>",
      "fix": "Page must have exactly one <h1> element denoting the primary topic."
    }
  ]
}
~~~~
