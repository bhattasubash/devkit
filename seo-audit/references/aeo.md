# Answer Engine Optimization (AEO)

AEO builds **on top of SEO**, it does not replace it.
Goal: make your content **citable by AI assistants** (ChatGPT, Gemini, Perplexity, Copilot).

---

## 1. Write for Extraction

AI assistants pull answers from pages that are easy to parse.

| Rule | How |
|------|-----|
| Direct answer first | Open with the answer, then explain. No burying the lead. |
| Question-style headings | Use `## How do I …` / `## What is …` — matches user queries |
| Lists and tables | Easier to extract than paragraphs. Use them for steps, comparisons, specs. |
| Define terms | Bold the term, follow with its definition in the same sentence. |
| One idea per section | Each `##` should answer exactly one question. |

---

## 2. Be Credible and Citable

AI prioritizes sources it can trust and attribute.

- [ ] Include **original data** (benchmarks, case studies, survey results)
- [ ] **Cite sources** with links — don't make unsupported claims
- [ ] Show **visible authorship**: author name, role, date published, date updated
- [ ] Have an **About page** with credentials and contact info
- [ ] Keep **entity info consistent** across site, social profiles, and structured data

---

## 3. Make Machines' Job Easy

- [ ] Add **structured data** (see `structured-data.md`) for every applicable page type
- [ ] Use **semantic HTML**: `<article>`, `<section>`, `<nav>`, `<header>`, `<footer>`, `<main>`
- [ ] **Server-render** content — AI crawlers often don't execute JavaScript
- [ ] Keep pages **fast** (LCP < 2.5s) — slow pages get crawled less
- [ ] Consider adding `/llms.txt` at site root — a plain-text summary of what your site offers and how to cite it (emerging standard, not yet widely supported)

---

## 4. AI Crawler Access

Manage in `robots.txt`. Decide per-crawler:

| Crawler | Operator | Default |
|---------|----------|---------|
| `GPTBot` | OpenAI | Allow (recommended) |
| `ChatGPT-User` | OpenAI (browsing) | Allow |
| `ClaudeBot` | Anthropic | Allow (recommended) |
| `PerplexityBot` | Perplexity | Allow (recommended) |
| `Google-Extended` | Google AI | Allow (recommended) |
| `CCBot` | Common Crawl | Your choice |
| `Amazonbot` | Amazon/Alexa | Your choice |

```
# Example: allow all AI crawlers
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

# Example: block one
User-agent: CCBot
Disallow: /
```

**Gate**: Confirm crawler policy with the user before modifying `robots.txt`.

---

## 5. Measurement

AEO results are harder to measure than SEO. Use these signals:

| Signal | How to check |
|--------|-------------|
| Citation test | Search your topic in ChatGPT, Gemini, Perplexity. Are you cited? |
| Referral traffic | Check analytics for traffic from `chat.openai.com`, `gemini.google.com`, `perplexity.ai` |
| Brand mentions | Search `"yourbrand.com"` in AI assistants periodically |
| Search console | Monitor impression/click changes after AEO improvements |

---

## Honest Limits

> [!IMPORTANT]
> - Citation is **never guaranteed** — AI models choose sources unpredictably
> - AI behavior **changes without notice** — re-test quarterly
> - `llms.txt` is an **emerging convention**, not a standard — adoption is limited
> - AEO **supplements** technical SEO and content quality, it cannot replace them
> - No tool can verify AI citation programmatically — manual testing required

---

## Checklist for Agent

- [ ] Review content structure against "Write for Extraction" rules
- [ ] Verify authorship, dates, and About page exist
- [ ] Check structured data is in place (defer to `structured-data.md`)
- [ ] Review `robots.txt` AI crawler policy — **ask user before changes**
- [ ] Test 3 topic queries in at least one AI assistant, record results
- [ ] Log all findings in state file
