# Job Hunt Agent

An AI-powered job search orchestrator built on the [pi](https://github.com/earendil-works/pi-coding-agent) framework. It discovers, evaluates, and tracks job opportunities across multiple portals and company career pages, then generates ATS-optimized resumes tailored to each listing.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Skills & Extensions](#skills--extensions)

---

## Features

- **Multi-portal search** — searches LinkedIn, Indeed, Naukri, Wellfound, We Work Remotely, Instahyre, and Weekday
- **Company career page scraping** — monitors specific company career pages you're interested in
- **Intelligent job matching** — evaluates discovered jobs against your profile (skills, location, salary, etc.)
- **ATS resume tailoring** — generates ATS-optimized resumes customized to each job listing
- **LaTeX-based resume generation** — produces professional PDFs from LaTeX templates
- **Hunt reports** — generates detailed summaries after each search run
- **Persistent state** — tracks discovered listings and avoids duplicates across hunts
- **Warm introduction finder** — discovers contacts at target companies who can provide warm introductions via LinkedIn

---

## Prerequisites

### Required

| Dependency | Version | Purpose |
|------------|---------|---------|
| **Node.js** | v20+ | Runtime for pi and extensions |
| **pi** | v0.79+ | AI coding agent harness |
| **pi-subagents** | v0.28+ | Subagent delegation (chains, parallel execution) |
| **pi-mcp-adapter** | v2.10+ | MCP server integration for web search |
| **LightPanda** | Latest | Headless browser for interactive web browsing |
| **pdflatex** | TeX Live | LaTeX resume compilation |

### Optional (for enhanced features)

| Dependency | Purpose |
|------------|---------|
| **Firecrawl CLI** | Web search and full-page scraping |
| **jq** | JSON parsing in shell scripts |

---

## Installation

### 1. Install Node.js (if not already installed)

```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install 24
nvm use 24

# Verify
node --version  # Should show v24.x.x or higher
```

### 2. Install pi

```bash
npm install -g @earendil-works/pi-coding-agent

# Verify
pi --version
```

### 3. Install pi packages

```bash
pi install npm:pi-subagents
pi install npm:pi-mcp-adapter
```

### 4. Install LightPanda (headless browser)

```bash
curl -fsSL https://pkg.lightpanda.io/install.sh | bash

# Verify
lightpanda --version
```

### 5. Install LaTeX dependencies (for resume generation)

Use the LaTeX document skill's built-in setup script, which handles cross-platform installation:

```bash
bash .pi/skills/latex-document-skill/setup.sh
```

This script will:
- Install TeX Live (pdflatex, xelatex, lualatex, biber, latexmk)
- Install Poppler (PDF utilities)
- Install ImageMagick (image processing)
- Install Pandoc (document conversion)
- Install Python packages (matplotlib, numpy, pandas, jinja2)
- Verify all dependencies

To only check what's installed without installing anything:
```bash
bash .pi/skills/latex-document-skill/setup.sh --check
```

**Supported package managers:** apt (Debian/Ubuntu), brew (macOS), dnf (Fedora/RHEL), apk (Alpine), pacman (Arch)

### 6. Install Firecrawl CLI (optional, for web search)

```bash
npm install -g firecrawl
```

Set your Firecrawl API key:
```bash
export FIRECRAWL_API_KEY="your-api-key-here"
```

### 7. Clone this repository

```bash
git clone https://github.com/your-username/jobhunt-agent.git
cd jobhunt-agent
```

### 8. Install extension dependencies (if modifying extensions)

```bash
cd .pi/extensions
npm install
cd ../..
```

---

## Configuration

### 1. Set up your job seeker profile

Use the job-seeker-profile agent to create your profile interactively:

```
Use job-seeker-profile to create my profile
```

The agent will ask about your skills, experience, target roles, location preferences, salary expectations, and career goals, then generate `USER_PROFILE.json`.

### 2. Configure job portals

Use the job-tracker extension to manage portals. View, add, or toggle portals:

```
/portals
```

You can ask pi to add or deactivate portals:

```
Add Naukri as a job portal
Deactivate LinkedIn
```

### 3. Add target company career pages

Use the job-tracker extension to manage company career pages. View, add, or toggle companies:

```
/companies
```

You can ask pi to add or deactivate companies:

```
Add Stripe with career page https://stripe.com/jobs
Deactivate Google
```

### 4. Add your base resume (optional)

Place your existing LaTeX resume as `resume.tex` in the project root. If you don't, the ATS agent will generate one from `USER_PROFILE.json`.

```bash
cp /path/to/your/resume.tex ./resume.tex
```

Your resume should use ATS-friendly formatting:
- Single-column layout
- Standard fonts (no custom/decorative fonts)
- No tables for layout, no graphics
- Standard section headings (`\section*{...}`)
- Uses `\item` for bullet points

The agent will preserve your template structure and only rewrite content (bullet points, skill ordering, sections).

### 5. Configure MCP servers (optional)

Edit `.pi/mcp.json` to add search capabilities:

```json
{
  "mcpServers": {
    "exa": {
      "url": "https://mcp.exa.ai/mcp"
    }
  }
}
```

---

## Usage

### Start pi

```bash
pi
```

### Run a job hunt

Once pi is running, you can initiate a job hunt:

**Guided mode** (with specific instructions):
```
/hunt Backend Engineer intern Python Golang remote 2026 India
```

**Autonomous mode** (uses default queries from your profile):
```
/hunt
```

### Manage portals and companies

```
/portals    # View, add, deactivate portals
/companies  # View, add, deactivate companies
```

### Find warm introductions

The warm-intro extension discovers people at your target companies who can provide warm introductions. It uses the Crustdata API to find contacts based on your LinkedIn profile.

**Basic usage:**
```
Find warm intro contacts at Stripe
```

**With explicit company URL:**
```
Find warm introductions at https://www.linkedin.com/company/stripe
```

**Output format (JSON):**
```json
{
  "success": true,
  "me": { "name": "...", "headline": "...", "linkedinUrl": "..." },
  "company": { "name": "Stripe", "linkedinUrl": "..." },
  "contacts": [
    {
      "name": "John Doe",
      "currentRole": "Senior Engineer",
      "matchScore": 8,
      "confidence": "strong",
      "isStrongMatch": true,
      "linkedinUrl": "...",
      "matchReasons": ["Both in engineering"]
    }
  ],
  "summary": {
    "totalContacts": 5,
    "strongMatches": 2,
    "averageMatchScore": 6.5
  }
}
```

**Key fields:**
- `matchScore` (0-10): How strong the potential connection is
- `confidence`: `"strong"` or `"soft"` — reliability of the match
- `isStrongMatch`: Boolean shortcut for filtering
- `matchReasons`: Why this person is a good match

### Generate ATS resume

The ATS resume writer agent tailors your base resume to match specific job descriptions. It rewrites bullet points with action verbs and metrics, reorders skills to match JD keywords, and adds/removes sections as needed — all while preserving your resume's formatting and structure.

Tailored resumes are saved to `resume/{listing_id}/`.

#### Input modes

**Mode 1: Listing ID** (from job hunt results)

Use a listing ID from a previous hunt. The agent reads the job description from the stored listing and scrape files:

```
/ats-resume listing: 2026-06-16-backend-engineer-intern-stripe
```

With `full: true` to skip section approval and proceed directly:

```
/ats-resume listing: 2026-06-16-backend-engineer-intern-stripe full: true
```

**Mode 2: Inline job description**

Paste the full job description text directly:

```
/ats-resume jd: We are looking for a Backend Engineer Intern to join our team at Stripe. You will work on distributed systems, build RESTful APIs using Go and Python, and collaborate with cross-functional teams to deliver high-impact features...
```

Optionally specify a name, title, and company:

```
/ats-resume name: stripe-backend-intern company: Stripe title: Backend Engineer Intern jd: We are looking for a Backend Engineer Intern...
```

**Mode 3: Job description from file**

Point to a local file containing the JD:

```
/ats-resume jd_file: ./my-jds/stripe-backend.md
```

Or with explicit metadata:

```
/ats-resume jd_file: ./my-jds/stripe-backend.md company: Stripe title: Backend Engineer Intern full: true
```

#### Using your own base resume

The ATS agent uses `resume.tex` in the project root as the base resume. By default, it auto-generates one from `USER_PROFILE.json` if the file doesn't exist.

**To use your own resume:**

1. Place your LaTeX resume file as `resume.tex` in the project root:
   ```bash
   cp /path/to/your/resume.tex ./resume.tex
   ```

2. Ensure it follows ATS-friendly formatting:
   - Single-column layout
   - Standard fonts (no custom/decorative fonts)
   - No tables for layout, no graphics
   - Standard section headings (`\section*{...}`)
   - Uses common entry commands (`\item` for bullet points)

3. The agent will preserve your resume's:
   - Document class and packages
   - Margin settings and fonts
   - Custom command definitions
   - Overall layout and structure

4. The agent will only modify:
   - Bullet point content (action verbs, keywords, metrics)
   - Skill ordering in the Technical Skills section
   - Add/remove entries within existing sections
   - Add/remove entire sections (with approval unless `full: true`)

---

## Project Structure

```
jobhunt-agent/
├── .pi/                          # Pi configuration and agents
│   ├── agents/                   # Agent definitions
│   │   ├── job-hunter-agent.md   # Main orchestrator
│   │   ├── search-agent.md       # Web search delegation
│   │   ├── scrape-agent.md       # Page scraping delegation
│   │   └── ats-resume-writer.md  # Resume tailoring agent
│   ├── extensions/               # Custom extensions
│   │   ├── job-tracker.ts        # Portal/company management
│   │   ├── lightpanda/           # Browser automation
│   │   └── warm-intro.ts         # Warm introduction finder
│   ├── skills/                   # Skill definitions
│   │   ├── firecrawl/            # Web search/scraping
│   │   ├── google-search-filters/# Advanced search queries
│   │   ├── job-seeker-profile/   # Profile management
│   │   └── latex-document-skill/ # LaTeX compilation
│   └── mcp.json                  # MCP server config
├── resume.tex                    # Base resume template (LaTeX)
├── resume.pdf                    # Compiled base resume
├── resume/                       # ATS-tailored resumes
│   └── {listing_id}/
│       ├── resume.tex
│       └── resume.pdf
├── USER_PROFILE.json             # Your job seeker profile
├── PORTALS.json                  # Configured job portals
├── COMPANY_CARRIER.json          # Target company career pages
├── .listing/                     # Discovered job listings (JSON)
├── .scrapes/                     # Scraped page content (Markdown)
├── .search/                      # Search results (JSON)
├── .hunt-reports/                # Hunt summary reports
├── .hunt-state.json              # Current hunt state machine
└── CONTEXT.md                    # Project context documentation
```

---

## Skills & Extensions

### Skills

| Skill | Description |
|-------|-------------|
| `firecrawl` | Web search with full page content extraction |
| `google-search-filters` | Craft advanced Google search queries with operators |
| `job-seeker-profile` | Build and maintain user profile (USER_PROFILE.json) |
| `latex-document-skill` | Universal LaTeX document creation and compilation |

### Extensions

| Extension | Description |
|-----------|-------------|
| `job-tracker` | Manages portals (PORTALS.json) and companies (COMPANY_CARRIER.json) via tools |
| `lightpanda` | Headless browser for interactive web browsing |
| `warm-intro` | Finds warm introduction contacts at target companies via Crustdata API (returns JSON) |

### Agents

| Agent | Description |
|-------|-------------|
| `job-hunter-agent` | Main orchestrator — state machine that coordinates the full hunt pipeline |
| `search-agent` | Delegates web searches via firecrawl or MCP |
| `scrape-agent` | Extracts content from specific URLs |
| `ats-resume-writer` | Tailors base resume to match specific job listings |

---

## Troubleshooting

### LaTeX compilation fails

```bash
# Run the skill's setup script to install/reinstall dependencies
bash .pi/skills/latex-document-skill/setup.sh --check

# Test with a simple document
echo '\documentclass{article}\begin{document}Hello\end{document}' > test.tex
pdflatex test.tex
```

### LightPanda not found

```bash
# Reinstall LightPanda
curl -fsSL https://pkg.lightpanda.io/install.sh | bash

# Verify installation
lightpanda --version
```

### Firecrawl search not working

```bash
# Verify API key is set
echo $FIRECRAWL_API_KEY

# Test firecrawl CLI
firecrawl search "test query" --limit 1
```

### Hunt state stuck

If a hunt gets stuck, reset the state manually:

```bash
echo '{"phase": "idle"}' > .hunt-state.json
```

### Pi not recognizing agents

Ensure the `.pi/agents/` directory contains valid agent markdown files with proper frontmatter.

---

## License

See [LICENSE](LICENSE) for details.
