---
name: job-seeker-profile
description: >
  Builds and maintains a persistent USER_PROFILE.json with the job seeker's domain,
  work experience, target job titles, location preferences, company type preferences
  (early-stage startup, growth startup, MNC, agency/service-based, etc.), skills,
  salary expectations, and career goals. Use whenever the conversation involves job
  search, career planning, resume tailoring, company research, or application strategy.
---

# Job Seeker Profile Agent

This skill transforms pi into a personalized job search assistant. It maintains a
persistent user profile at `USER_PROFILE.json` in the project root so every session
remembers who you are and what you're looking for.

## How It Works

1. **Profile check** — At the start of any job-search-related conversation, check if
   `USER_PROFILE.json` exists in the working directory. If it does, read it and use it
   to contextualize all subsequent advice and actions.

2. **Profile creation** — If no profile exists, interview the user to build one. Ask
   structured questions (use `ask_user_question` where appropriate), then write the
   profile to `USER_PROFILE.json`.

3. **Profile updates** — When the user mentions a change in circumstances (new role
   interest, relocated, new skills learned), update the relevant section of the
   profile.

4. **Contextual use** — Always reference the profile when:
   - Tailoring resumes or cover letters
   - Searching for jobs (use company/size preferences to filter)
   - Evaluating a job listing against user preferences
   - Planning career strategy

## Profile Fields

Interview the user to populate these sections. Use conversational discovery — don't
firehose all questions at once. Group them naturally.

### Personal & Contact
- Name
- Preferred pronouns (optional)
- Email (optional, for applications)
- LinkedIn URL (optional)
- Portfolio / website (optional)
- Location / timezone

### Domain & Industry
- Primary industry (e.g., FinTech, HealthTech, SaaS, E-commerce, Gaming, AI/ML,
  Cybersecurity, EdTech, ClimateTech, Enterprise Software, etc.)
- Sub-domains or niches
- Industries they explicitly **do not** want

### Work Experience
- Total years of professional experience
- Most recent role(s): title, company, duration, key achievements
- Notable past roles (title, company, duration)
- Employment gaps worth explaining (optional)
- Management vs individual contributor preference

### Skills & Technologies
- Core technical skills (programming languages, frameworks, platforms)
- Soft skills (leadership, communication, stakeholder management)
- Domain expertise (e.g., PCI compliance, real-time systems, growth metrics)
- Skill level for key areas (beginner / intermediate / expert)
- Skills they want to learn or grow in

### Target Job Titles
- Primary target title(s) (e.g., "Senior Frontend Engineer", "Staff ML Engineer")
- Alternative / fallback titles
- Titles they want to avoid
- Minimum seniority level (Intern / Junior / Mid / Senior / Staff / Principal / Head / C-Level)

### Location Preferences
- Remote: full remote, hybrid, or on-site
- If hybrid/on-site: preferred cities or regions
- Relocation willingness (yes / no / depends on offer)
- Timezone preferences for remote work
- Work authorization status (optional)

### Company Preferences

Use the following company archetypes. Let the user rank or pick multiple:

| Type | Description |
|------|-------------|
| **Early-stage Startup** | Pre-seed to Series A, < 20 people, high risk/reward, broad role |
| **Growth Startup** | Series B+, 20-200 people, product-market fit found, scaling |
| **Mid-size Company** | 200-1,000 employees, more structure, established product |
| **Large Enterprise / MNC** | 1,000+ employees, global brand, structured processes |
| **Agency / Service-based** | Client work, project-based, varied domains |
| **Consulting** | Strategy/implementation consulting (Big 4, MBB, boutique) |
| **Freelance / Contract** | Self-employed, short to medium engagements |
| **Non-profit / Social Impact** | Mission-driven, non-commercial |
| **Government / Public Sector** | Civil service, public institutions |

Also capture:
- Company culture values (e.g., async-first, open source, diversity-focused)
- Industries the user wants to work in vs avoid
- Remote-first vs office-first preference
- Publicly traded vs private preference

### Salary & Compensation
- Expected salary range (or "open")
- Preferred currency
- Equity expectations for startups (if applicable)
- Benefits that matter most (health, remote budget, learning stipend, etc.)

### Career Goals
- Short-term (next 6-12 months)
- Medium-term (1-3 years)
- Long-term (3-5+ years)
- "Dream job" description
- Dealbreakers (things that would make them reject an offer)

## Profile File Format

The profile is stored as JSON at `USER_PROFILE.json`. Example structure:

```json
{
  "name": "Alex Chen",
  "last_updated": "2026-06-14",
  "personal": {
    "name": "Alex Chen",
    "location": "San Francisco, CA (PST)",
    "linkedin": "linkedin.com/in/alexchen",
    "portfolio": "alexchen.dev"
  },
  "domain": {
    "primary": ["FinTech", "SaaS"],
    "avoid": ["Gambling", "Crypto (speculative coins)"],
    "niche": ["Payment processing", "Real-time fraud detection"]
  },
  "experience": {
    "total_years": 7,
    "current_role": "Senior Software Engineer @ PayFlow Inc. (2023–present)",
    "past_roles": [
      "Backend Engineer @ DataSync (2020–2023)",
      "Junior Dev @ WebAgency (2017–2020)"
    ],
    "style": "Individual contributor, technical lead on 2-3 person pods",
    "gaps": "3-month sabbatical 2023 for travel"
  },
  "skills": {
    "expert": ["TypeScript", "Node.js", "Go", "PostgreSQL", "Kafka", "AWS", "Docker", "Kubernetes"],
    "intermediate": ["Python", "React", "Terraform", "GraphQL"],
    "learning": ["Rust", "System design for distributed systems"],
    "soft": ["Technical writing", "Cross-team communication", "Mentoring"]
  },
  "target_roles": {
    "primary": ["Staff Software Engineer", "Senior Backend Engineer"],
    "fallback": ["Tech Lead", "Founding Engineer"],
    "avoid": ["Frontend-only", "Test Automation Manager"],
    "min_seniority": "Senior"
  },
  "location": {
    "preferred": "Full remote (US-based)",
    "hybrid_ok": ["SF Bay Area", "NYC (2 days/week max)"],
    "relocation": ["London", "Berlin"],
    "timezone": "PST/Mountain time preferred"
  },
  "company_preferences": {
    "top_choice": "Growth Startup (Series B–C, 50–200 people)",
    "also_open": ["Early-stage Startup", "Mid-size Company"],
    "avoid": ["Agencies", "MNCs with >5,000 people"],
    "culture": ["Async-first", "Written communication", "High-autonomy", "Open source friendly"]
  },
  "compensation": {
    "salary": "$180k–$220k base",
    "equity": "Important, 0.5–1.5% range for early stage",
    "currency": "USD",
    "must_haves": ["Remote budget", "Learning stipend", "4-day week option"]
  },
  "career_goals": {
    "short": "Join a Series B FinTech building real-time payments infra",
    "medium": "Become a Staff Engineer owning a critical domain",
    "long": "CTO at a FinTech startup or distinguished IC path",
    "dream": "Build payment rails for emerging markets",
    "dealbreakers": ["On-site 5 days/week", "No remote culture", "Micromanagement", "Below market"]
  }
}
```

## Workflow

### First Interaction (Profile Doesn't Exist)

1. Greet the user and explain you'll build a job seeker profile.
2. Start with lightweight questions: name, location, current role, target role type.
3. Dive deeper: experience years, top skills, company size preference.
4. Ask about dealbreakers and career goals last (they require more trust).
5. Write the complete profile to `USER_PROFILE.json`.
6. Summarize what you captured and ask if they want to adjust anything.

### Existing Profile Loaded

1. Read `USER_PROFILE.json` at the start of any job-related turn.
2. Reference profile fields naturally in your responses.
3. If search results or job listings come in, evaluate them against the profile
   and highlight matches / mismatches.
4. When the user mentions a change, offer to update the profile.

### Profile Updates

When updating, read `USER_PROFILE.json`, apply the change, and rewrite it
atomically. Preserve fields the user didn't mention.

## Helper Script

A Node.js helper script is available at `scripts/profile.js` for programmatic
profile management:

```bash
# Read the current profile and output key fields as JSON
node ./scripts/profile.js read

# Update a specific field
node ./scripts/profile.js set "salary_range" "200k-250k"

# Check if profile exists
node ./scripts/profile.js exists
```

See the script source for full usage details.

## Commands

This skill also registers a `/skill:job-seeker-profile` command that can be
invoked directly:
- `/skill:job-seeker-profile` — Check/update profile
- `/skill:job-seeker-profile init` — Force re-interview from scratch
- `/skill:job-seeker-profile view` — Display current profile summary
- `/skill:job-seeker-profile set <field> <value>` — Quick field update
