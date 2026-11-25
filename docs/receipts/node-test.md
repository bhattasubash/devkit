# Receipt: Unit and Integration Test Suite

- **Date:** `2026-11-25T05:22:23.436Z`
- **Git Commit:** `50ccdc6db96478b04abcc44a3e16ba746409bcfa`
- **Command:** `node --test`
- **Exit Code:** `0`

## Output (stdout)

~~~~text
✔ CLI --help displays documentation and exits 0 (233.024ms)
✔ Clean design fixture produces zero findings and exits 0 (256.9048ms)
✔ Flags literal colors, transition-all, overflow-hidden on body, width 100vw, and div onClick (206.2394ms)
✔ CLI --help displays usage and commands (228.7179ms)
✔ CLI --version displays version (197.2279ms)
✔ init --dry-run previews scaffolding without writing files (235.5277ms)
✔ init detects .cursor and scaffolds skills and .devkit (494.5395ms)
✔ init detects multiple agent folders and appends .devkit/ to .gitignore (750.3702ms)
✔ init on directory with no agents defaults to .agents/skills/devkit (472.4523ms)
✔ init with existing install requires --force to overwrite (1787.4238ms)
Error: Missing required arguments: <fixture> <results-dir>
Run with --help for usage details.
✔ grade.mjs --help outputs usage documentation and exits 0 (186.033ms)
✔ grade.mjs exits 2 when arguments are missing (190.6017ms)
✔ grade.mjs evaluates good selftest as PASS with 100% recall and precision (190.0471ms)
✔ grade.mjs evaluates bad selftest as FAIL with errors flagged (193.6223ms)
✔ grade.mjs evaluates clean-site fixture with zero findings as PASS (192.7433ms)
✔ every SKILL.md is <= 100 lines and standalone skills avoid shared/ references (47.6958ms)
✔ isolated web-best-practices skill runs documented commands without shared/ (866.7019ms)
✔ isolated anti-slop-design skill runs documented commands without shared/ (830.3977ms)
✔ isolated security-audit skill runs documented commands without shared/ (692.3318ms)
✔ isolated seo-audit skill runs documented commands without shared/ (1034.4849ms)
✔ root router SKILL.md works when full repo is installed via CLI (1536.9383ms)
✔ sync-shared.mjs --help exits 0 and prints usage (189.9445ms)
✔ all skill script copies exist and match shared/scripts/* byte-for-byte (260.6381ms)
✔ sync-shared --check fails when a skill copy differs or is missing, and sync repairs it (1238.1396ms)
✔ CLI --help option outputs usage documentation and exits 0 (210.8092ms)
✔ Invalid directory exits with code 2 (220.5167ms)
✔ Case A: CSS class names containing "sk-" inside slugs are NOT flagged as OpenAI keys (338.3386ms)
✔ Case B: Public-by-design keys (Supabase anon JWT, Stripe pk_, Firebase web apiKey) are severity "info" (555.1225ms)
warning: in the working copy of '.gitignore', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'README.md', LF will be replaced by CRLF the next time Git touches it
✔ Case C: Git-ignored .env is moved to local_only_notes; unignored .env is a critical finding (1510.0694ms)
✔ Case D: Reports hardcoded literal secret in process.env.KEY || "literal" fallback (455.6793ms)
✔ Case E: Safely handles directory paths with spaces and avoids shell injection (333.5784ms)
✔ Clean project with zero findings exits 0 with empty findings array (629.9446ms)
✔ CLI --help displays documentation and exits 0 (238.8586ms)
✔ Clean SEO fixture produces zero findings and exits 0 (204.6969ms)
✔ Flags missing robots.txt sitemap, sitemap fragments, missing canonical, broken JSON-LD, and client-only SPA (220.623ms)
✔ CLI --help displays usage and exits 0 (193.7581ms)
warning: in the working copy of 'README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/components/Button.jsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/index.js', LF will be replaced by CRLF the next time Git touches it
✔ Passes with exit 0 when all modified/untracked files match allowed_files globs (1206.3914ms)
warning: in the working copy of 'app.js', LF will be replaced by CRLF the next time Git touches it
✔ Fails with exit 1 when a file is outside allowed_files scope (1047.0825ms)
warning: in the working copy of 'package.json', LF will be replaced by CRLF the next time Git touches it
✔ Fails with exit 1 when dependency file is modified and allow_dependency_changes is false (1600.0522ms)
warning: in the working copy of 'package.json', LF will be replaced by CRLF the next time Git touches it
✔ Passes with exit 0 when dependency file is modified and allow_dependency_changes is true (1588.5219ms)
warning: in the working copy of 'app.js', LF will be replaced by CRLF the next time Git touches it
✔ Ignores ephemeral test artifacts and custom ignored_files (1358.2643ms)
✔ CLI --help displays usage and exits 0 (199.8461ms)
✔ init creates a valid state.json from template (576.1442ms)
✔ get and set update nested fields (553.317ms)
✔ advance REFUSES when evidence is empty (exit code 1) (366.6861ms)
✔ advance REFUSES when approval gate is not approved_by_user (exit code 1) (516.5105ms)
✔ advance SUCCEEDS when evidence is provided and approval is granted (1367.4697ms)
✔ CLI --help displays documentation and exits 0 (200.9933ms)
✔ Valid findings pass with exit 0 (including whitespace normalization) (169.1481ms)
✔ Fails with exit 1 when file does not exist (220.59ms)
✔ Fails with exit 1 when line number is out of range (190.2235ms)
✔ Fails with exit 1 when quote does not match line content (209.4489ms)
✔ Fails with exit 1 when severity or fix is invalid (212.4188ms)
✔ Passes with exit 0 when quote is within line drift tolerance (+/- 3 lines) (179.0143ms)
✔ Provides suggested_line when quote exists elsewhere in file beyond tolerance (231.0876ms)
✔ CLI --help displays documentation and exits 0 (213.8118ms)
✔ Clean HTML document produces zero findings and exits 0 (189.5365ms)
✔ Flags missing title, short meta description, missing viewport, multiple h1s, unlabeled inputs, and broken links (194.6725ms)
ℹ tests 58
ℹ suites 0
ℹ pass 58
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 7460.5438
~~~~
