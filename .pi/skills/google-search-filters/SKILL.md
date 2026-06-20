---
name: google-search-filters
description: >
  Craft ready-to-fire Google search queries using advanced operators and filters.
  Use this skill whenever someone wants to find something specific online, needs a
  precise search string they can paste into Google, or asks to search for content
  by site, date, filetype, title, URL, or any combination. Triggers include:
  "find me...", "search for...", "I want pages about...", "help me Google...",
  "build a search query for...", "find only PDFs/recent articles/pages from...",
  "advanced Google search", "Google dork", competitor research, guest post hunting,
  government docs, academic sources, or any request to locate specific web content.
  Always produce a ready-to-use query — never just explain operators.
---

# Google Search Filters Skill

Produce a ready-to-paste Google search query. No tutorials. No walkthroughs. Just the query.

---

## Core Behavior

**Goal:** Given what the user wants to find, output a Google search query they can copy and paste immediately.

**Output format — always:**

```
[the complete query here]
```
🔗 [Search Google](https://www.google.com/search?q=ENCODED_QUERY)

Then one line max explaining what it finds, only if genuinely non-obvious.
Offer 1 tighter/broader variant if useful. That's it.

**Never:** tutorials, operator tables, "here's what each part does" breakdowns, tips lists, or walls of text.

**If the request is ambiguous**, make a reasonable assumption and include a note like:
> *(Assuming you want recent results — remove `after:2024-01-01` to search all time)*

---

## Building the Query

Use the operator cheatsheet below to construct the best query for the user's intent.

### Operators — Working (use these)

**Boolean**
- `"phrase"` — exact match
- `OR` / `|` — either term (OR must be uppercase)
- `-word` — exclude term
- `*` — wildcard
- `(term1 OR term2)` — grouping

**Site/Domain**
- `site:domain.com` — restrict to one site
- `site:.gov` / `site:.edu` / `site:.org` — restrict to TLD
- `-site:domain.com` — exclude a site
- `related:domain.com` — similar sites

**Page targeting**
- `intitle:"phrase"` — phrase in page title
- `allintitle:word1 word2` — all words in title
- `inurl:word` — word in URL
- `intext:"phrase"` — phrase in page body

**File & format**
- `filetype:pdf` / `filetype:xlsx` / `filetype:pptx` etc.
- `ext:pdf` — same as filetype

**Date**
- `after:YYYY-MM-DD` — published after date
- `before:YYYY-MM-DD` — published before date

**News**
- `source:outlet` — specific outlet in Google News (e.g. `source:bbc`)

### Operators — Unreliable (use only if needed)
- `$50..$150` — price/number range
- `AROUND(X)` — proximity (two words within X words)

### Deprecated (never use)
`link:` `info:` `phonebook:` `inpostauthor:` `blogurl:`

---

## Clickable Link Construction

To generate the Google Search URL, URL-encode the query:
- spaces → `+`
- `"` → `%22`
- `:` → `%3A` (inside operator values only; operator colons stay as-is in the URL for readability)
- `-` stays `-`

Example: `site:github.com "machine learning" filetype:pdf after:2023-01-01`
→ `https://www.google.com/search?q=site%3Agithub.com+%22machine+learning%22+filetype%3Apdf+after%3A2023-01-01`

Always include the clickable link — it's the whole point.

---

## Common Patterns (internal reference)

| Goal | Pattern |
|---|---|
| All pages on a site | `site:example.com` |
| Site + keyword | `site:example.com "keyword"` |
| Recent articles on topic | `"topic" after:2024-01-01` |
| PDFs from gov/edu | `"topic" filetype:pdf site:.gov` |
| Find guest post targets | `"write for us" intitle:"guest post" keyword` |
| Competitor blog content | `site:competitor.com inurl:blog -inurl:tag` |
| Exact phrase research | `"exact phrase" -site:knownsource.com` |
| Forum discussions | `"topic" site:reddit.com after:2024-01-01` |
| Academic sources | `"topic" site:.edu OR site:.gov` |
| LinkedIn profiles | `site:linkedin.com/in "job title" "company"` |
| News from outlet | `topic source:reuters after:2025-01-01` |
| Find templates/files | `"topic" filetype:xlsx OR filetype:docx "template"` |

---

## Reference Files

- `references/operator-table.md` — flat operator list
- `references/use-case-library.md` — query combos by use case
