# Receipt: lint-design on evals/fixtures/slop-site

- **Date:** `2026-11-25T05:22:32.686Z`
- **Git Commit:** `50ccdc6db96478b04abcc44a3e16ba746409bcfa`
- **Command:** `node anti-slop-design/scripts/lint-design.mjs evals/fixtures/slop-site`
- **Exit Code:** `1`

## Output (stdout)

~~~~text
{
  "scanned_dir": "C:\\Users\\SUBASH\\Desktop\\test\\My Own SKill\\devkit\\evals\\fixtures\\slop-site",
  "total_findings": 7,
  "findings": [
    {
      "id": "DSGN-001",
      "rule": "DIV_ONCLICK",
      "severity": "high",
      "file": "index.html",
      "line": 10,
      "quote": "<div onClick={() =>",
      "fix": "Replace <div onClick> with a native <button> element, or add role=\"button\" with tabIndex and keyboard handlers."
    },
    {
      "id": "DSGN-002",
      "rule": "OVERFLOW_HIDDEN_ROOT",
      "severity": "critical",
      "file": "src/styles.css",
      "line": 3,
      "quote": "overflow-x: hidden;",
      "fix": "Never use \"overflow: hidden\" or \"overflow-x: hidden\" on html or body. Use \"overflow-x: clip\" instead."
    },
    {
      "id": "DSGN-003",
      "rule": "WIDTH_100VW",
      "severity": "high",
      "file": "src/styles.css",
      "line": 4,
      "quote": "width: 100vw",
      "fix": "Avoid \"width: 100vw\" as it causes horizontal scrollbars on desktop with scrollbar gutters. Use \"width: 100%\" instead."
    },
    {
      "id": "DSGN-004",
      "rule": "LITERAL_COLOR",
      "severity": "high",
      "file": "src/styles.css",
      "line": 8,
      "quote": "#ff0055",
      "fix": "Replace literal color with a CSS variable token defined in :root (e.g. var(--color-brand-500))."
    },
    {
      "id": "DSGN-005",
      "rule": "TRANSITION_ALL",
      "severity": "high",
      "file": "src/styles.css",
      "line": 9,
      "quote": "transition: all",
      "fix": "Never transition \"all\". Specify explicit properties (e.g. \"transition: transform 150ms ease-out, opacity 150ms ease-out\")."
    },
    {
      "id": "DSGN-006",
      "rule": "OUTLINE_REMOVED",
      "severity": "high",
      "file": "src/styles.css",
      "line": 13,
      "quote": "outline: none;",
      "fix": "Never set \"outline: none\" or \"outline: 0\" without pairing it with an immediate, visible :focus-visible ring."
    },
    {
      "id": "DSGN-007",
      "rule": "MISSING_REDUCED_MOTION",
      "severity": "high",
      "file": "src/styles.css",
      "line": 1,
      "quote": "@keyframes / animation",
      "fix": "File defines CSS animation or @keyframes without @media (prefers-reduced-motion: reduce) override."
    }
  ]
}
~~~~
