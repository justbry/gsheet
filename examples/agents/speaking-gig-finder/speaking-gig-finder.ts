#!/usr/bin/env bun

/**
 * Speaking Gig Finder Example
 *
 * This example demonstrates AI-powered search and analysis by matching speaking
 * opportunities to speaker expertise. Shows how to use gsheet for intelligent
 * content matching, scoring algorithms, and recommendation generation.
 *
 * Prerequisites:
 * - Spreadsheet with SPEAKER_PROFILE, OPPORTUNITIES sheets
 * - AGENTSCAPE sheet (auto-created)
 *
 * Usage:
 *   bun examples/speaking-gig-finder.ts [--spreadsheet-id=ID]
 *
 * Environment Variables:
 *   SPREADSHEET_ID - Google Sheets spreadsheet ID
 *   CREDENTIALS_CONFIG - Path to Google service account credentials
 */

import { SheetAgent, ValidationError, AuthError } from '../../src/index';

// Parse command-line arguments
const args = process.argv.slice(2);
const spreadsheetIdArg = args.find(arg => arg.startsWith('--spreadsheet-id='))?.split('=')[1];

// Configuration
const SPREADSHEET_ID = spreadsheetIdArg || process.env.SPREADSHEET_ID || 'your-spreadsheet-id-here';

// Interfaces
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

interface Opportunity {
  id: string;
  eventName: string;
  organization: string;
  topic: string;
  format: string;
  date: string;
  location: string;
  fee: number;
  status: string;
}

interface Match {
  opportunity: Opportunity;
  matchScore: number;
  topicScore: number;
  feeScore: number;
  formatScore: number;
  dateLocationScore: number;
  reason: string;
  recommendation: 'high' | 'medium' | 'low' | 'dismiss';
}

async function main() {
  console.log(`🎤 Speaking Gig Finder - AI-Powered Opportunity Matcher\n`);

  try {
    const agent = await SheetAgent.connect({
      spreadsheetId: SPREADSHEET_ID,
    });
    // ─────────────────────────────────────────────────────────────────────
    // STEP 1: Load Speaker Profile
    // ─────────────────────────────────────────────────────────────────────
    console.log('👤 Loading speaker profile...');

    const profileData = await agent.read({
      sheet: 'SPEAKER_PROFILE',
      format: 'array',
    });

    const profileRows = profileData.rows as unknown[][];
    const profile = parseSpeakerProfile(profileRows);

    console.log(`   Speaker: ${profile.name}`);
    console.log(`   Expertise: ${profile.expertiseTopics.join(', ')}`);
    console.log(`   Fee Range: $${profile.feeRange.min} - $${profile.feeRange.max}`);
    console.log(`   Formats: ${profile.preferredFormats.join(', ')}\n`);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 2: Load Open Opportunities
    // ─────────────────────────────────────────────────────────────────────
    console.log('🔍 Searching for open opportunities...');

    const opportunitiesData = await agent.read({
      sheet: 'OPPORTUNITIES',
      format: 'object',
      headers: true,
    });

    type OppRow = {
      'Opp ID': string;
      'Event Name': string;
      'Organization': string;
      'Topic': string;
      'Format': string;
      'Date': string;
      'Location': string;
      'Fee': number;
      'Status': string;
    };

    const allOpportunities = opportunitiesData.rows as OppRow[];
    const openOpportunities = allOpportunities
      .filter(opp => String(opp.Status).toLowerCase() === 'open')
      .map(opp => ({
        id: String(opp['Opp ID']),
        eventName: String(opp['Event Name']),
        organization: String(opp['Organization']),
        topic: String(opp['Topic']),
        format: String(opp['Format']),
        date: String(opp['Date']),
        location: String(opp['Location']),
        fee: Number(opp['Fee']),
        status: String(opp['Status']),
      }));

    console.log(`   Found ${openOpportunities.length} open opportunities\n`);

    if (openOpportunities.length === 0) {
      console.log('✅ No open opportunities at this time.');
      return;
    }

    // ─────────────────────────────────────────────────────────────────────
    // STEP 3: Calculate Match Scores
    // ─────────────────────────────────────────────────────────────────────
    console.log('🎯 Calculating match scores...\n');

    const matches: Match[] = [];

    for (const opp of openOpportunities) {
      // Topic Match (40%)
      const topicScore = analyzeTopicMatch(profile.expertiseTopics, opp.topic);

      // Fee Match (30%)
      const feeScore = analyzeFeeMatch(profile.feeRange, opp.fee);

      // Format Match (20%)
      const formatScore = analyzeFormatMatch(profile.preferredFormats, opp.format);

      // Date/Location Match (10%)
      const dateLocationScore = analyzeDateLocationMatch(
        profile.travelWilling,
        opp.location,
        opp.date,
        profile.preferredDates
      );

      // Blacklist check
      const isBlacklisted = profile.blacklistOrgs.some(org =>
        opp.organization.toLowerCase().includes(org.toLowerCase())
      );

      if (isBlacklisted) {
        continue; // Skip blacklisted organizations
      }

      // Weighted total score
      const matchScore = Math.round(
        topicScore * 0.4 +
        feeScore * 0.3 +
        formatScore * 0.2 +
        dateLocationScore * 0.1
      );

      // Generate AI-powered reason
      const reason = generateMatchReason(
        matchScore,
        topicScore,
        feeScore,
        formatScore,
        dateLocationScore,
        opp
      );

      // Categorize recommendation
      const recommendation = categorizeMatch(matchScore);

      matches.push({
        opportunity: opp,
        matchScore,
        topicScore,
        feeScore,
        formatScore,
        dateLocationScore,
        reason,
        recommendation,
      });
    }

    // Sort by match score (highest first)
    matches.sort((a, b) => b.matchScore - a.matchScore);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 4: Display Results
    // ─────────────────────────────────────────────────────────────────────
    console.log('═'.repeat(70));
    console.log(`  SPEAKING GIG RECOMMENDATIONS`);
    console.log(`  Speaker: ${profile.name}`);
    console.log(`  Generated: ${new Date().toLocaleString()}`);
    console.log('═'.repeat(70));
    console.log();

    const highMatches = matches.filter(m => m.recommendation === 'high');
    const mediumMatches = matches.filter(m => m.recommendation === 'medium');
    const lowMatches = matches.filter(m => m.recommendation === 'low');
    const dismissMatches = matches.filter(m => m.recommendation === 'dismiss');

    // High Priority Matches
    if (highMatches.length > 0) {
      console.log(`## 🔥 HIGH PRIORITY (${highMatches.length})`);
      console.log();
      for (const match of highMatches) {
        displayMatch(match);
      }
    }

    // Medium Priority Matches
    if (mediumMatches.length > 0) {
      console.log(`## ⭐ MEDIUM PRIORITY (${mediumMatches.length})`);
      console.log();
      for (const match of mediumMatches) {
        displayMatch(match);
      }
    }

    // Low Priority Matches
    if (lowMatches.length > 0) {
      console.log(`## 📋 LOW PRIORITY (${lowMatches.length})`);
      console.log();
      for (const match of lowMatches) {
        displayMatch(match);
      }
    }

    // Dismissed Matches
    if (dismissMatches.length > 0) {
      console.log(`## ❌ DISMISS (${dismissMatches.length})`);
      console.log();
      for (const match of dismissMatches.slice(0, 3)) {
        displayMatch(match);
      }
      if (dismissMatches.length > 3) {
        console.log(`   ... and ${dismissMatches.length - 3} more low-scoring opportunities\n`);
      }
    }

    console.log('═'.repeat(70));
    console.log();

    // ─────────────────────────────────────────────────────────────────────
    // STEP 5: Write Matches to Sheet
    // ─────────────────────────────────────────────────────────────────────
    console.log('💾 Writing matches to MATCHES sheet...');

    // Create MATCHES sheet if it doesn't exist
    try {
      await agent.createSheet('MATCHES');
    } catch (error) {
      // Sheet may already exist, that's OK
    }

    const matchRows = [
      ['Match ID', 'Opp ID', 'Event Name', 'Match Score', 'Reason', 'Recommendation', 'Created At'],
      ...matches.map((m, idx) => [
        `M${String(idx + 1).padStart(3, '0')}`,
        m.opportunity.id,
        m.opportunity.eventName,
        m.matchScore,
        m.reason,
        m.recommendation,
        new Date().toISOString(),
      ]),
    ];

    await agent.write({
      sheet: 'MATCHES',
      range: 'A1',
      data: matchRows,
    });

    console.log(`   Wrote ${matches.length} matches to MATCHES sheet\n`);

    // Summary
    console.log('📊 SUMMARY');
    console.log(`   High Priority: ${highMatches.length}`);
    console.log(`   Medium Priority: ${mediumMatches.length}`);
    console.log(`   Low Priority: ${lowMatches.length}`);
    console.log(`   Dismissed: ${dismissMatches.length}\n`);

    console.log('✅ Analysis complete! Check the MATCHES sheet for full results.\n');

  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('❌ Validation Error:', error.message);
      console.error('   Fix:', error.fix);
    } else if (error instanceof AuthError) {
      console.error('❌ Auth Error:', error.message);
      console.error('   Set CREDENTIALS_CONFIG environment variable');
    } else {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('Unable to parse range')) {
        console.error('❌ Missing required sheets: SPEAKER_PROFILE and OPPORTUNITIES');
        console.error('   Create these sheets in your spreadsheet first. See speaking-gig-finder.md for setup.');
      } else {
        throw error;
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════

function parseSpeakerProfile(rows: unknown[][]): SpeakerProfile {
  const getValueByKey = (key: string): string => {
    const row = rows.find(r => String(r[0]).toLowerCase().includes(key.toLowerCase()));
    return String(row?.[1] ?? '');
  };

  const name = getValueByKey('name');
  const bio = getValueByKey('bio');
  const expertiseTopics = getValueByKey('expertise').split(',').map(t => t.trim()).filter(t => t);

  const feeStr = getValueByKey('fee range');
  const feeMatch = feeStr.match(/(\d+)\s*-\s*(\d+)/);
  const feeRange = feeMatch
    ? { min: parseInt(feeMatch[1]!), max: parseInt(feeMatch[2]!) }
    : { min: 0, max: 10000 };

  const preferredFormats = getValueByKey('preferred formats').split(',').map(f => f.trim()).filter(f => f);
  const travelWilling = getValueByKey('travel willing').toLowerCase().includes('yes');
  const blacklistOrgs = getValueByKey('blacklist').split(',').map(o => o.trim()).filter(o => o);
  const preferredDates = getValueByKey('preferred dates').split(',').map(d => d.trim()).filter(d => d);

  return {
    name,
    bio,
    expertiseTopics,
    feeRange,
    preferredFormats,
    travelWilling,
    blacklistOrgs,
    preferredDates,
  };
}

function analyzeTopicMatch(expertiseTopics: string[], oppTopic: string): number {
  const oppTopicLower = oppTopic.toLowerCase();
  const expertiseLower = expertiseTopics.map(t => t.toLowerCase());

  // Exact match
  if (expertiseLower.includes(oppTopicLower)) {
    return 100;
  }

  // Keyword overlap
  const oppKeywords = oppTopicLower.split(/\s+/);
  const expertiseKeywords = expertiseLower.flatMap(t => t.split(/\s+/));

  const overlapCount = oppKeywords.filter(kw => expertiseKeywords.includes(kw)).length;
  const overlapRatio = overlapCount / oppKeywords.length;

  return Math.round(overlapRatio * 100);
}

function analyzeFeeMatch(feeRange: { min: number; max: number }, oppFee: number): number {
  if (oppFee >= feeRange.min && oppFee <= feeRange.max) {
    return 100; // Perfect match
  }

  if (oppFee < feeRange.min) {
    const gap = feeRange.min - oppFee;
    const penalty = Math.min(gap / feeRange.min, 1);
    return Math.round((1 - penalty) * 100);
  }

  if (oppFee > feeRange.max) {
    const premium = (oppFee - feeRange.max) / feeRange.max;
    return Math.min(100 + premium * 20, 100); // Bonus for higher fees (capped at 100)
  }

  return 50;
}

function analyzeFormatMatch(preferredFormats: string[], oppFormat: string): number {
  const oppFormatLower = oppFormat.toLowerCase();
  const preferredLower = preferredFormats.map(f => f.toLowerCase());

  if (preferredLower.includes(oppFormatLower)) {
    return 100;
  }

  // Partial match (e.g., "keynote" matches "keynote presentation")
  const partialMatch = preferredLower.some(f =>
    f.includes(oppFormatLower) || oppFormatLower.includes(f)
  );

  return partialMatch ? 70 : 30;
}

function analyzeDateLocationMatch(
  travelWilling: boolean,
  location: string,
  date: string,
  preferredDates: string[]
): number {
  let score = 0;

  // Travel preference
  const isRemote = location.toLowerCase().includes('remote') || location.toLowerCase().includes('virtual');
  if (isRemote) {
    score += 60; // Remote events always convenient
  } else if (travelWilling) {
    score += 40; // Willing to travel
  } else {
    score += 10; // Not willing to travel, not remote
  }

  // Date preference (if specified)
  if (preferredDates.length > 0) {
    const dateMatches = preferredDates.some(pd => date.includes(pd));
    score += dateMatches ? 40 : 0;
  } else {
    score += 40; // No preference, so any date is fine
  }

  return Math.min(score, 100);
}

function generateMatchReason(
  matchScore: number,
  topicScore: number,
  feeScore: number,
  formatScore: number,
  dateLocationScore: number,
  opp: Opportunity
): string {
  const reasons: string[] = [];

  if (topicScore >= 70) {
    reasons.push(`Strong topic alignment (${topicScore}%)`);
  } else if (topicScore >= 40) {
    reasons.push(`Moderate topic fit (${topicScore}%)`);
  } else {
    reasons.push(`Weak topic alignment (${topicScore}%)`);
  }

  if (feeScore >= 90) {
    reasons.push(`Fee in ideal range ($${opp.fee})`);
  } else if (feeScore >= 60) {
    reasons.push(`Fee acceptable ($${opp.fee})`);
  } else {
    reasons.push(`Fee below preference ($${opp.fee})`);
  }

  if (formatScore >= 90) {
    reasons.push(`Preferred format (${opp.format})`);
  }

  return reasons.join('. ');
}

function categorizeMatch(matchScore: number): 'high' | 'medium' | 'low' | 'dismiss' {
  if (matchScore >= 75) return 'high';
  if (matchScore >= 55) return 'medium';
  if (matchScore >= 35) return 'low';
  return 'dismiss';
}

function displayMatch(match: Match) {
  const emoji =
    match.recommendation === 'high' ? '🔥' :
    match.recommendation === 'medium' ? '⭐' :
    match.recommendation === 'low' ? '📋' :
    '❌';

  console.log(`${emoji} ${match.opportunity.eventName} (Score: ${match.matchScore})`);
  console.log(`   Organization: ${match.opportunity.organization}`);
  console.log(`   Topic: ${match.opportunity.topic}`);
  console.log(`   Format: ${match.opportunity.format} | Date: ${match.opportunity.date} | Location: ${match.opportunity.location}`);
  console.log(`   Fee: $${match.opportunity.fee}`);
  console.log(`   Reason: ${match.reason}`);
  console.log();
}

main();
