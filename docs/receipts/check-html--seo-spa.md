# Receipt: check-html on evals/fixtures/seo-spa

- **Date:** `2026-11-25T05:22:34.481Z`
- **Git Commit:** `50ccdc6db96478b04abcc44a3e16ba746409bcfa`
- **Command:** `node web-best-practices/scripts/check-html.mjs evals/fixtures/seo-spa`
- **Exit Code:** `1`

## Output (stdout)

~~~~text
{
  "scanned_dir": "C:\\Users\\SUBASH\\Desktop\\test\\My Own SKill\\devkit\\evals\\fixtures\\seo-spa",
  "total_findings": 8,
  "findings": [
    {
      "id": "HTML-001",
      "rule": "MISSING_HTML_LANG",
      "severity": "high",
      "confidence": "deterministic",
      "file": "index.html",
      "line": 2,
      "quote": "<html>",
      "fix": "Add lang attribute to <html> tag (e.g. <html lang=\"en\">)."
    },
    {
      "id": "HTML-002",
      "rule": "MISSING_VIEWPORT_META",
      "severity": "critical",
      "confidence": "deterministic",
      "file": "index.html",
      "line": 1,
      "quote": "<head>",
      "fix": "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> inside <head>."
    },
    {
      "id": "HTML-003",
      "rule": "MISSING_META_DESCRIPTION",
      "severity": "high",
      "confidence": "deterministic",
      "file": "index.html",
      "line": 1,
      "quote": "<head>",
      "fix": "Add a <meta name=\"description\" content=\"...\"> tag with 50–160 characters summarizing the page."
    },
    {
      "id": "HTML-004",
      "rule": "MULTIPLE_H1",
      "severity": "high",
      "confidence": "deterministic",
      "file": "index.html",
      "line": 11,
      "quote": "<h1>",
      "fix": "Page has 2 <h1> tags. Use exactly one <h1> for the page title and <h2>–<h6> for subsections."
    },
    {
      "id": "HTML-005",
      "rule": "IMG_MISSING_ALT",
      "severity": "high",
      "confidence": "deterministic",
      "file": "index.html",
      "line": 13,
      "quote": "<img src=\"logo.png\">",
      "fix": "Every <img> must have an alt attribute (alt=\"\" if decorative, or descriptive text)."
    },
    {
      "id": "HTML-006",
      "rule": "IMG_MISSING_DIMENSIONS",
      "severity": "medium",
      "confidence": "deterministic",
      "file": "index.html",
      "line": 13,
      "quote": "<img src=\"logo.png\">",
      "fix": "Set explicit width and height on <img> (or CSS aspect-ratio) to prevent Cumulative Layout Shift (CLS)."
    },
    {
      "id": "HTML-007",
      "rule": "UNLABELED_INPUT",
      "severity": "high",
      "confidence": "deterministic",
      "file": "index.html",
      "line": 14,
      "quote": "<input type=\"text\">",
      "fix": "Provide a visible <label for=\"...\">, wrap input in <label>, or add aria-label for accessibility."
    },
    {
      "id": "HTML-008",
      "rule": "BROKEN_HASH_LINK",
      "severity": "medium",
      "confidence": "deterministic",
      "file": "index.html",
      "line": 15,
      "quote": "<a href=\"#\">",
      "fix": "Avoid <a href=\"#\">. Use a <button> for clickable actions or provide a meaningful href URL."
    }
  ]
}
~~~~
