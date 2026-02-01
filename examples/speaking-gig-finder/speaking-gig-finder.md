# Speaking Gig Finder

An AI-powered opportunity matcher demonstrating intelligent search, scoring algorithms, and recommendation generation using gsheet.

## What This Demonstrates

- **AI-Powered Matching**: Intelligent content analysis and scoring
- **Weighted Scoring Algorithm**: Multi-factor evaluation (topic, fee, format, date/location)
- **Key-Value Parsing**: Extract structured data from freeform key-value sheets
- **Object Format Reading**: Using header-based object conversion
- **Automated Recommendations**: Categorize opportunities into priority levels
- **Blacklist Filtering**: Exclude unwanted organizations

## Spreadsheet Structure

Create a new Google Spreadsheet with the following sheets:

### 1. SPEAKER_PROFILE (Key-Value Format)

| Key | Value |
|-----|-------|
| Speaker Name | Dr. Jane Smith |
| Bio | Expert in leadership and organizational culture |
| Expertise Topics | leadership, culture, change management, team building |
| Fee Range | 5000 - 15000 |
| Preferred Formats | keynote, workshop, panel |
| Travel Willing | yes |
| Blacklist Orgs | CompetitorCo, BadEventOrg |
| Preferred Dates | Q2 2026, Fall 2026 |

### 2. OPPORTUNITIES (Table Format)

| Opp ID | Event Name | Organization | Topic | Format | Date | Location | Fee | Status |
|--------|------------|--------------|-------|--------|------|----------|-----|--------|
| OP001 | Leadership Summit | TechCorp | leadership | keynote | 2026-05-15 | San Francisco | 12000 | open |
| OP002 | Culture Conference | StartupHub | culture | workshop | 2026-06-20 | Remote | 8000 | open |
| OP003 | Team Building Workshop | SmallBiz | team building | workshop | 2026-07-10 | Austin | 3000 | open |
| OP004 | Innovation Day | CompetitorCo | innovation | panel | 2026-08-05 | New York | 10000 | open |

### 3. MATCHES (Auto-Generated)

This sheet is created by the script:

| Match ID | Opp ID | Event Name | Match Score | Reason | Recommendation | Created At |
|----------|--------|------------|-------------|--------|----------------|------------|
| M001 | OP001 | Leadership Summit | 92 | Strong topic alignment (100%). Fee in ideal range ($12000). Preferred format (keynote) | high | 2026-02-01T... |

### 4. AGENTSCAPE (Auto-Created)

Agent context and file storage.

## How It Works

### Step 1: Load Speaker Profile

Reads the SPEAKER_PROFILE sheet and parses key-value pairs into a structured profile object:

```typescript
interface SpeakerProfile {
  name: string;
  bio: string;
  expertiseTopics: string[];
  feeRange: { min: number; max: number };
  preferredFormats: string[];
  travelWilling: boolean;
  blacklistOrgs: string[];
  preferredDates: string[];
}
```

### Step 2: Load Open Opportunities

Searches the OPPORTUNITIES sheet for rows where `Status = "open"`:

```typescript
const openOpportunities = await agent.search({
  sheet: 'OPPORTUNITIES',
  query: { Status: 'open' },
  matching: 'strict',
});
```

Alternatively, reads all and filters in memory (as shown in example).

### Step 3: Calculate Match Scores

For each opportunity, calculates a weighted match score (0-100):

#### Topic Match (40% weight)
- **100**: Exact topic match
- **70-99**: Keyword overlap
- **<70**: Weak or no overlap

#### Fee Match (30% weight)
- **100**: Fee within speaker's range
- **<100**: Fee below range (penalty based on gap)
- **100**: Fee above range (bonus for higher fees, capped)

#### Format Match (20% weight)
- **100**: Exact format match
- **70**: Partial format match
- **30**: No format match

#### Date/Location Match (10% weight)
- **60**: Remote/virtual event
- **40**: Willing to travel + in-person
- **10**: Not willing to travel + in-person
- **+40**: Date matches preferred dates

**Final Score = (TopicScore × 0.4) + (FeeScore × 0.3) + (FormatScore × 0.2) + (DateLocationScore × 0.1)**

### Step 4: Generate Recommendations

Categorizes matches into priority levels:

- **🔥 High Priority**: Score ≥ 75
- **⭐ Medium Priority**: Score ≥ 55
- **📋 Low Priority**: Score ≥ 35
- **❌ Dismiss**: Score < 35

### Step 5: Write Results

Writes all matches to the MATCHES sheet with:
- Match ID (auto-generated)
- Opportunity details
- Match score
- AI-generated reason
- Recommendation category
- Timestamp

## Running the Example

### Prerequisites

1. Create spreadsheet with SPEAKER_PROFILE and OPPORTUNITIES sheets
2. Populate with sample data (see structure above)
3. Set environment variables:

```bash
export SPREADSHEET_ID="your-spreadsheet-id"
export CREDENTIALS_CONFIG="path/to/credentials.json"
```

### Execute

```bash
bun examples/speaking-gig-finder.ts
```

## Expected Output

```
🎤 Speaking Gig Finder - AI-Powered Opportunity Matcher

👤 Loading speaker profile...
   Speaker: Dr. Jane Smith
   Expertise: leadership, culture, change management, team building
   Fee Range: $5000 - $15000
   Formats: keynote, workshop, panel

🔍 Searching for open opportunities...
   Found 4 open opportunities

🎯 Calculating match scores...

══════════════════════════════════════════════════════════════════════
  SPEAKING GIG RECOMMENDATIONS
  Speaker: Dr. Jane Smith
  Generated: 2/1/2026, 12:30:00 AM
══════════════════════════════════════════════════════════════════════

## 🔥 HIGH PRIORITY (2)

🔥 Leadership Summit (Score: 92)
   Organization: TechCorp
   Topic: leadership
   Format: keynote | Date: 2026-05-15 | Location: San Francisco
   Fee: $12000
   Reason: Strong topic alignment (100%). Fee in ideal range ($12000). Preferred format (keynote)

🔥 Culture Conference (Score: 88)
   Organization: StartupHub
   Topic: culture
   Format: workshop | Date: 2026-06-20 | Location: Remote
   Fee: $8000
   Reason: Strong topic alignment (100%). Fee in ideal range ($8000). Preferred format (workshop)

## ⭐ MEDIUM PRIORITY (1)

⭐ Team Building Workshop (Score: 65)
   Organization: SmallBiz
   Topic: team building
   Format: workshop | Date: 2026-07-10 | Location: Austin
   Fee: $3000
   Reason: Strong topic alignment (100%). Fee below preference ($3000). Preferred format (workshop)

## ❌ DISMISS (0)

(Note: Innovation Day from CompetitorCo was filtered out due to blacklist)

══════════════════════════════════════════════════════════════════════

💾 Writing matches to MATCHES sheet...
   Wrote 3 matches to MATCHES sheet

📊 SUMMARY
   High Priority: 2
   Medium Priority: 1
   Low Priority: 0
   Dismissed: 0

✅ Analysis complete! Check the MATCHES sheet for full results.
```

## Key Features

### Intelligent Topic Matching

Uses keyword overlap analysis:
- Splits topics into keywords
- Compares speaker expertise with opportunity topics
- Calculates overlap percentage

### Fee Analysis

Sophisticated fee matching:
- Penalties for fees below range
- No penalty (or bonus) for fees above range
- Graduated scoring based on gap size

### Blacklist Enforcement

Automatically filters out opportunities from blacklisted organizations before scoring.

### Multi-Factor Weighting

Customizable weights for different factors:
```typescript
const matchScore = Math.round(
  topicScore * 0.4 +      // Topic most important
  feeScore * 0.3 +        // Fee second
  formatScore * 0.2 +     // Format matters
  dateLocationScore * 0.1 // Date/location least critical
);
```

## Extending This Example

### Add Email Outreach

For high-priority matches, generate outreach emails:

```typescript
if (match.recommendation === 'high') {
  const email = generateOutreachEmail(profile, match.opportunity);
  await sendEmail(email);
}
```

### Create Outreach Plan

Use the plan system to track outreach:

```typescript
await agent.createPlan('Speaking Gig Outreach', 'Secure 3 high-priority gigs', [
  {
    name: 'Initial Outreach',
    steps: highMatches.map(m => ({
      title: `Contact ${m.opportunity.organization}`,
      description: `Send proposal for ${m.opportunity.eventName}`,
    })),
  },
]);
```

### Add Calendar Integration

Check speaker availability against calendar:

```typescript
async function checkAvailability(date: string): Promise<boolean> {
  // Integration with Google Calendar API
  // Return true if available
}
```

### Store Outreach Templates

Use AGENTSCAPE to store email templates:

```typescript
await agentscape.writeFile({
  file: 'EMAIL_TEMPLATES.md',
  desc: 'Outreach email templates',
  tags: 'outreach,templates',
  content: `
# Keynote Proposal Template

Dear [Organizer],

I am excited to propose a keynote on [Topic]...
  `,
});
```

### Add Historical Tracking

Track which opportunities were pursued and outcomes:

```typescript
// Create OUTCOMES sheet
await agent.write({
  sheet: 'OUTCOMES',
  data: [
    ['Match ID', 'Contacted', 'Response', 'Outcome', 'Notes'],
  ],
});
```

## Learn More

- [SheetAgent Search API](../src/agent.ts#L912)
- [Weighted Scoring Algorithms](https://en.wikipedia.org/wiki/Weighted_sum_model)
- [Sunday School Coordinator Example](./sunday-school-coordinator.ts) - Similar matching pattern
