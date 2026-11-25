# Receipt: check-seo-files on evals/fixtures/slop-site

- **Date:** `2026-11-25T05:22:33.393Z`
- **Git Commit:** `50ccdc6db96478b04abcc44a3e16ba746409bcfa`
- **Command:** `node seo-audit/scripts/check-seo-files.mjs evals/fixtures/slop-site`
- **Exit Code:** `1`

## Output (stdout)

~~~~text
{
  "scanned_dir": "C:\\Users\\SUBASH\\Desktop\\test\\My Own SKill\\devkit\\evals\\fixtures\\slop-site",
  "total_findings": 4,
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
      "rule": "MISSING_ROBOTS_TXT",
      "severity": "high",
      "file": "robots.txt",
      "line": 1,
      "quote": "robots.txt",
      "fix": "Create a robots.txt file in the site root with crawl permissions and a Sitemap: directive."
    },
    {
      "id": "SEO-004",
      "rule": "MISSING_SITEMAP_XML",
      "severity": "high",
      "file": "sitemap.xml",
      "line": 1,
      "quote": "sitemap.xml",
      "fix": "Create a sitemap.xml listing all public, indexable page URLs with <loc> and <lastmod>."
    }
  ]
}
~~~~
