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

## Outreach

**Outreach message**:
A structured professional message composed by the `outreach-writer` subagent, sent to initiate or follow up on career-related communication with a target person.
_Avoid_: Cold DM, cold email, pitch

**Referral request**:
A type of outreach asking someone at a target company to refer the job seeker to a specific open role. Acknowledges the social capital being asked for and makes the ask easy (includes resume, JD link).
_Avoid_: Referral ask, referral ping

**HR pitch**:
A type of outreach pitching the job seeker's profile directly to a recruiter or HR professional. Confident and concise, focused on value proposition and role fit.
_Avoid_: Recruiter spam, cold pitch

**Follow-up**:
A type of outreach sent after an interview, application, or prior conversation to express gratitude, reiterate interest, and prompt a next step.
_Avoid_: Reminder, nudge, chasing up

**Interview request**:
A type of outreach asking for a conversation with someone. Has two sub-types: _informational_ (low-pressure ask to learn about their experience) and _job-interview_ (direct ask for a formal interview after applying).
_Avoid_: Coffee chat request, meeting request, catch-up

**Outreach writer**:
The `outreach-writer` pi subagent that composes personalized outreach messages. Takes structured input (purpose, person, context, tone, channel) and returns structured JSON output with an opener, body, suggestions, and platform notes. Uses per-type prompting strategies and may optionally scrape LinkedIn profiles for personalization.
_Avoid_: DM composer, outreach generator

**Opener**:
The first line of an outreach message designed to catch attention. On LinkedIn it appears as a bold first line; in email it serves as the subject line. Must be relevant and contextual, never generic.
_Avoid_: Subject line, hook, intro line

**Channel**:
The platform through which an outreach message is delivered. Determines the output format: LinkedIn DM (no formal subject, bold opener) vs email (subject line + body + signature).
_Avoid_: Platform, medium

**Person relation**:
The known connection type between the job seeker and the target person. One of: stranger, alumni, mutual-connection, acquaintance, or interviewer. Affects the message's tone, reference points, and level of formality.
_Avoid_: Connection type, relationship
