# Job System

The job system helps a job seeker discover, evaluate, and track job opportunities across multiple portals and company career pages.

## Language

**Job portal**:
A website that aggregates job listings from multiple employers.
_Avoid_: Job board, job site, recruitment site

**Company career page**:
A company's own official recruitment page listing its open positions.
_Avoid_: Careers page, hiring page

**Job seeker profile**:
The persistent profile (`USER_PROFILE.json`) defining the user's skills, experience, location preferences, salary expectations, target roles, and career goals.
_Avoid_: Resume, CV, candidate profile

**Scrape**:
Extracting content from a job URL and filtering it to only the sections relevant to a stated goal.
_Avoid_: Fetch, grab, pull

**Goal**:
A free-text instruction specifying what to extract from a scraped page (e.g., "extract salary", "find required skills", "evaluate match against profile").

**Job hunt**:
A single orchestrated run of the job-hunter-agent to discover, scrape, and record job opportunities across all configured sources.
_Avoid_: Search session, crawl

**Listing**:
A structured JSON record in `.listing/` capturing a discovered job opportunity, including company info, role details, source provenance, and match assessment. Consumed by downstream resume-tailoring agents.
_Avoid_: Job card, opportunity record

**Hunt report**:
A rich markdown summary generated after each hunt, saved to `.hunt-reports/`, covering new listings, updated listings, and source statistics.

**Base resume**:
The canonical LaTeX resume file at the project root (`./resume.tex`). Used as the structural template for all JD-tailored variants. Generated once from `USER_PROFILE.json` if absent; never modified per listing.
_Avoid_: Master resume, template resume

**ATS resume writer**:
The `ats-resume-writer` subagent that tailors the base resume to a specific job listing by rewriting bullet content, reordering skills, and optionally adding/removing sections — all while preserving LaTeX formatting and structure.

**ATS resume**:
A resume tailored to pass Applicant Tracking System (ATS) parsing, optimized with job description keywords, action verbs, and quantified metrics. Stored at `resume/{listing_id}/resume.tex` with a compiled `resume/{listing_id}/resume.pdf`.
_Avoid_: Tailored resume, optimized CV, custom resume
