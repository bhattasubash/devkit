# Receipt: check-secrets on evals/fixtures/vuln-app

- **Date:** `2026-11-25T05:22:31.434Z`
- **Git Commit:** `50ccdc6db96478b04abcc44a3e16ba746409bcfa`
- **Command:** `node security-audit/scripts/check-secrets.mjs evals/fixtures/vuln-app`
- **Exit Code:** `1`

## Output (stdout)

~~~~text
{
  "findings": [
    {
      "file": "C:\\Users\\SUBASH\\Desktop\\test\\My Own SKill\\devkit\\evals\\fixtures\\vuln-app\\auth.js",
      "line": 3,
      "pattern": "Generic Secret Assign",
      "severity": "high",
      "snippet": "ins…99"
    },
    {
      "file": "C:\\Users\\SUBASH\\Desktop\\test\\My Own SKill\\devkit\\evals\\fixtures\\vuln-app\\db.js",
      "line": 3,
      "pattern": "Connection String",
      "severity": "critical",
      "snippet": "pos…db"
    },
    {
      "file": "C:\\Users\\SUBASH\\Desktop\\test\\My Own SKill\\devkit\\evals\\fixtures\\vuln-app\\expected.json",
      "line": 17,
      "pattern": "Connection String",
      "severity": "critical",
      "snippet": "pos…b\\"
    },
    {
      "file": "C:\\Users\\SUBASH\\Desktop\\test\\My Own SKill\\devkit\\evals\\fixtures\\vuln-app\\server.js",
      "line": 5,
      "pattern": "Hardcoded Fallback Secret",
      "severity": "high",
      "snippet": "dev…rs"
    }
  ],
  "warnings": [],
  "local_only_notes": [],
  "scanned_root": "C:\\Users\\SUBASH\\Desktop\\test\\My Own SKill\\devkit\\evals\\fixtures\\vuln-app"
}
~~~~
