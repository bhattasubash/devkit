# Security Policy

This policy covers security vulnerabilities in **devkit** itself (the CLI installer in `bin/devkit.mjs`, scanner scripts, state/scope enforcement scripts, and skill instructions) — not audit reports generated on user projects (which are written to `.devkit/reports/security.md`).

## Supported Versions

Only the latest code on the `main` branch and the current `1.1.x` release line are supported with security fixes.

## Reporting a Vulnerability

Please do **not** open a public GitHub issue for suspected security vulnerabilities in `devkit` (such as command injection, path traversal in `bin/devkit.mjs`, SSRF in `check-headers.mjs`, or unsafe regex/script behavior).

Report vulnerabilities privately to:

- **Contact:** TODO: owner to add private security contact email or enable GitHub Private Security Advisories URL

Please include:
1. The affected file path and line number(s) in `devkit`.
2. Steps or a minimal reproduction payload demonstrating the issue.
3. Your environment (`OS` and `node --version`).
4. Any suggested fix or mitigation, if known.
