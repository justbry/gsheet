# Speaking Gig Finder

An AI-powered opportunity matcher that scores speaking events against a speaker profile using weighted multi-factor analysis, then writes prioritized recommendations back to the spreadsheet.

## Run

```bash
bun examples/speaking-gig-finder/speaking-gig-finder.ts
```

## Features

- **Multi-factor scoring** — topic (40%), fee (30%), format (20%), date/location (10%)
- **Topic matching** — keyword overlap analysis between expertise and opportunity
- **Blacklist filtering** — automatically skips unwanted organizations
- **Recommendation tiers** — high / medium / low / dismiss based on composite score
- **Auto-generated MATCHES sheet** — writes results with scoring rationale

## Spreadsheet Setup

| Sheet | Format | Purpose |
|-------|--------|---------|
| SPEAKER_PROFILE | Key-value rows (col A = field, col B = value) | Speaker name, expertise, fee range, formats, travel, blacklist, dates |
| OPPORTUNITIES | Table with headers: Opp ID, Event Name, Organization, Topic, Format, Date, Location, Fee, Status | Open speaking opportunities |
| MATCHES | Auto-created | Scored results written by agent |
| AGENTSCAPE | Auto-created | Agent context |

### SPEAKER_PROFILE fields

| Field | Example |
|-------|---------|
| Name | Jane Doe |
| Expertise | AI, Machine Learning, Data Science |
| Fee Range | 2000 - 5000 |
| Preferred Formats | Keynote, Workshop |
| Travel Willing | Yes |
| Blacklist | Acme Corp |
| Preferred Dates | March 2026, April 2026 |

## Prerequisites

- Spreadsheet with SPEAKER_PROFILE and OPPORTUNITIES sheets
- `SPREADSHEET_ID` and `CREDENTIALS_CONFIG` environment variables

## CLI Simulation

Without the required sheets, the agent exits gracefully:

```bash
$ bun examples/speaking-gig-finder/speaking-gig-finder.ts
```

```
🎤 Speaking Gig Finder - AI-Powered Opportunity Matcher

👤 Loading speaker profile...
❌ Missing required sheets: SPEAKER_PROFILE and OPPORTUNITIES
   Create these sheets in your spreadsheet first. See speaking-gig-finder.md for setup.
```

With a properly configured spreadsheet, the agent will:

1. Load the speaker profile from SPEAKER_PROFILE
2. Scan OPPORTUNITIES for open events
3. Score each opportunity against the profile
4. Display prioritized recommendations (high / medium / low / dismiss)
5. Write scored results to a MATCHES sheet

## Source

`examples/speaking-gig-finder/`
