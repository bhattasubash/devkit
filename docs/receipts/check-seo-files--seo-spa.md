# Receipt: check-seo-files on evals/fixtures/seo-spa

- **Date:** `2026-11-25T05:22:34.637Z`
- **Git Commit:** `50ccdc6db96478b04abcc44a3e16ba746409bcfa`
- **Command:** `node seo-audit/scripts/check-seo-files.mjs evals/fixtures/seo-spa`
- **Exit Code:** `1`

## Output (stdout)

~~~~text
{
  "scanned_dir": "C:\\Users\\SUBASH\\Desktop\\test\\My Own SKill\\devkit\\evals\\fixtures\\seo-spa",
  "total_findings": 6,
  "findings": [
    {
      "id": "SEO-001",
      "rule": "MISSING_CANONICAL",
      "severity": "high",
      "file": "index.html",
      "line": 1,
      "quote": "<head>",
      "fix": "Add <link rel=\"canonical\" href=\"https://yourdomain.com/canonical-url\"> inside <head>."
    },
    {
      "id": "SEO-002",
      "rule": "MISSING_OG_TAGS",
      "severity": "medium",
      "file": "index.html",
      "line": 1,
      "quote": "<head>",
      "fix": "Include Open Graph tags (<meta property=\"og:title\"> and <meta property=\"og:description\">) for social & AI citation sharing."
    },
    {
      "id": "SEO-003",
      "rule": "JSONLD_PARSE_ERROR",
      "severity": "critical",
      "file": "index.html",
      "line": 6,
      "quote": "{ \"not_valid_json\":",
      "fix": "Invalid JSON inside <script type=\"application/ld+json\">: Unexpected end of JSON input"
    },
    {
      "id": "SEO-004",
      "rule": "CLIENT_ONLY_RENDERING",
      "severity": "critical",
      "file": "index.html",
      "line": 16,
      "quote": "<div id=\"root\"></div>",
      "fix": "Client-only SPA detected with empty root container and no pre-rendered content. Use SSG, SSR, or static prerendering so crawlers and AI assistants can extract content."
    },
    {
      "id": "SEO-005",
      "rule": "ROBOTS_MISSING_SITEMAP",
      "severity": "high",
      "file": "public/robots.txt",
      "line": 1,
      "quote": "User-agent: *\r",
      "fix": "Add a \"Sitemap: https://yourdomain.com/sitemap.xml\" directive to robots.txt."
    },
    {
      "id": "SEO-006",
      "rule": "SITEMAP_URL_FRAGMENT",
      "severity": "critical",
      "file": "public/sitemap.xml",
      "line": 4,
      "quote": "<loc>https://example.com/pricing#plans</loc>",
      "fix": "Sitemap URL contains a fragment (#): \"https://example.com/pricing#plans\". Search engines index documents, not fragments. Remove the fragment."
    }
  ]
}
~~~~
