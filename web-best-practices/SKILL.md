---
name: web-best-practices
description: >
  Modern web development standards for any frontend build or review. Triggers on:
  building components, reviewing frontend code, accessibility checks, performance
  audits, responsive layout, forms, modals, animations, images, fonts, dark mode.
  Does NOT trigger on: backend, CI/CD, database, or tooling config.
---

# Web Best Practices

Enforce modern HTML, CSS, and JavaScript standards during any frontend build or review. Catch accessibility violations, performance regressions, and legacy patterns before they ship.

## Modes

### Quick Mode (default) — 3 phases

| # | Phase    | Input                                              | Output                                           | Gate                                      |
|---|----------|----------------------------------------------------|--------------------------------------------------|-------------------------------------------|
| 1 | **Scan** | All HTML/CSS/JS in project. Load `references/checklist.md`. | Completed checklist table with Pass/Fail per item | All critical items pass or are logged      |
| 2 | **Fix**  | Failed checklist items from Scan                   | Code changes applying modern patterns             | Each fix addresses exactly one failure     |
| 3 | **Verify** | Modified files                                   | Lighthouse scores, contrast check, keyboard test  | Performance > 90, Accessibility > 95       |

### Full Mode — 7 phases

| # | Phase                      | Input                                                       | Output                                            | Gate                                        |
|---|----------------------------|-------------------------------------------------------------|---------------------------------------------------|---------------------------------------------|
| 1 | **Inventory**              | Project file tree                                           | File manifest with tech stack, entry points        | Manifest reviewed                           |
| 2 | **Scan**                   | All HTML/CSS/JS. Load `references/checklist.md`.            | Completed checklist table with Pass/Fail per item  | All critical items pass or are logged       |
| 3 | **Plan**                   | Failed items from Scan                                      | Ordered fix plan with effort estimates             | Plan approved by user                       |
| 4 | **Fix**                    | Approved plan                                               | Code changes. Load `references/modern-patterns.md` when replacing a legacy pattern. | Each fix addresses exactly one failure |
| 5 | **Accessibility Deep-Dive**| Modified files. Load `references/accessibility.md`.         | Keyboard walkthrough log, contrast audit, axe scan | Zero critical a11y violations               |
| 6 | **Performance Tune**       | Modified files. Load `references/performance.md`.           | Lighthouse report, CWV measurements                | LCP < 2.5s, INP < 200ms, CLS < 0.1         |
| 7 | **Verify**                 | Final state of all files                                    | Full Lighthouse run, manual keyboard test           | Performance > 90, Accessibility > 95        |

## State

Reads and writes `.devkit/web/state.json`. Update `phase`, per-phase `status`, `evidence`, and `gate` after each phase completes. Log every changed file in `files_touched`. Record non-obvious decisions in `decisions` with alternatives considered.

## Reference Loading

- Load `references/checklist.md` at **Scan**.
- Load `references/accessibility.md` at **Accessibility Deep-Dive** (Full) or when a11y items fail in Scan (Quick).
- Load `references/performance.md` at **Performance Tune** (Full) or at Verify (Quick).
- Load `references/modern-patterns.md` only when replacing a legacy pattern during Fix.

## Safety

- Never install packages or dependencies.
- Never modify files outside the project directory.
- Confirm with the user before changes touching more than 5 files.
- Never run commands that write to disk without explicit user approval.
