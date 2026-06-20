# Google Search Use-Case Library

Real-world query combinations by profession and task. Swap in your domain/keyword.

---

## SEO & Digital Marketing

### Site Indexation Audit
```
site:yourdomain.com
```
Compare count to your CMS. Large discrepancy = indexation problems.

### Find Duplicate Content
```
site:yourdomain.com intitle:"your page title"
```

### Check What's Not HTTPS
```
site:yourdomain.com -inurl:https
```

### Find Competitor's Top Content
```
site:competitor.com intitle:"keyword" after:2024-01-01
```

### Competitor Blog Audit
```
site:competitor.com inurl:blog -inurl:tag -inurl:category -inurl:author
```

### Content Gap Analysis
```
intitle:"your keyword" -site:yourdomain.com after:2024-01-01
```

### Find Pages with Thin Content
```
site:yourdomain.com intext:"last updated" before:2022-01-01
```

---

## Link Building & Outreach

### Find Guest Post Opportunities
```
"write for us" intitle:"guest post" your-niche
"submit a guest post" inurl:blog topic-keyword
"contributor guidelines" your-industry
```

### Find Resource Pages
```
intitle:"resources" OR intitle:"useful links" your-topic inurl:resources
```

### Find Broken Link Building Targets
```
site:competitor.com inurl:resources
```

### Find Unlinked Brand Mentions
```
"your brand name" -site:yourdomain.com
```

---

## Content Research & Journalism

### Find Government/Academic Sources
```
"topic" site:.gov OR site:.edu filetype:pdf after:2023-01-01
```

### Find Recent Studies/Reports
```
"topic" filetype:pdf "study" OR "report" after:2024-01-01
```

### Find Data/Statistics
```
"topic statistics" OR "topic data" filetype:pdf site:.gov OR site:.org
```

### Track a Story Across Sources
```
"exact quote or headline" -site:original-publisher.com
```

### Research a Company
```
intitle:"company name" "annual report" OR "earnings" filetype:pdf after:2023-01-01
```

### Find Quotes on a Topic
```
"topic" intitle:"said" OR intitle:"according to" after:2025-01-01
```

---

## Recruiting & HR

### Find LinkedIn Profiles
```
site:linkedin.com/in "job title" "city" "company"
```

### Find Resumes
```
filetype:pdf intitle:"resume" OR intitle:"CV" "software engineer" "San Francisco"
```

---

## Sales & Lead Generation

### Find Decision Makers
```
intitle:"VP of Marketing" OR intitle:"Head of Marketing" site:linkedin.com "company name"
```

### Find Company Contact Pages
```
site:targetcompany.com inurl:contact OR inurl:team
```

### Prospect in a Niche
```
intitle:"company profile" "industry keyword" site:.com after:2023-01-01
```

---

## Security Research / OSINT

### Find Exposed Documents
```
site:company.com filetype:xls OR filetype:csv
```

### Find Login Pages
```
site:domain.com inurl:login OR inurl:admin
```

### Find Exposed Config Files
```
site:domain.com ext:env OR ext:config
```

> ⚠️ Only use on domains you own or have permission to audit.

---

## General Research

### Find How-To Guides from Trusted Sources
```
intitle:"how to" "your topic" site:.edu OR site:.gov
```

### Find Forum Discussions
```
"your topic" site:reddit.com OR site:quora.com after:2024-01-01
```

### Find Comparison Articles
```
intitle:"vs" OR intitle:"versus" "product A" "product B" after:2024-01-01
```

### Find Free Templates
```
"your topic" filetype:xlsx OR filetype:docx "template" site:.com
```

### Find Definitions / Explanations
```
define:"technical term"
"what is" intitle:"your topic" site:.edu
```

---

## Advanced Combinations

### High-Authority Pages Only
```
"topic" site:.edu OR site:.gov OR site:.org -site:wikipedia.org
```

### Find Recent News from Multiple Sources
```
"topic" (source:bbc OR source:reuters OR source:techcrunch) after:2025-01-01
```

### Locate a Specific Person's Writing
```
"Author Name" intitle:"wrote" OR inurl:author site:publication.com
```

### Find Pages Linking to a Competitor
```
"competitor.com" -site:competitor.com -site:yourdomain.com
```

### Find Indexed Subdomains
```
site:*.yourdomain.com -site:www.yourdomain.com
```
