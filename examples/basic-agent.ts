/**
 * Basic Agent Example
 *
 * This example demonstrates the minimal setup required to use g-sheet-agent-io
 * for reading and writing data to Google Sheets.
 *
 * Prerequisites:
 * 1. Create a Google Cloud project and enable the Sheets API
 * 2. Create a service account and download the credentials JSON
 * 3. Share your spreadsheet with the service account email
 * 4. Set the CREDENTIALS_CONFIG environment variable (base64-encoded credentials)
 *    or use a keyFile path for local development
 *
 * Run: bun examples/basic-agent.ts
 */

import { SheetAgent, ValidationError, AuthError } from '../src/index';

// Configuration
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || 'your-spreadsheet-id-here';

async function main() {
  console.log('🚀 Starting Basic Agent Example\n');

  // Initialize the agent
  // Credentials are loaded automatically from CREDENTIALS_CONFIG env var (base64-encoded)
  // or you can specify keyFile for local development
  const agent = new SheetAgent({
    spreadsheetId: SPREADSHEET_ID,
    // Optional: keyFile: './credentials.json', // For local dev only
    defaultFormat: 'object', // Returns data as array of objects
  });

  try {
    // ─────────────────────────────────────────────────────────────────────
    // 1. READING DATA
    // ─────────────────────────────────────────────────────────────────────
    console.log('📖 Reading data from sheet...');

    // Read entire sheet (auto-detects headers from first row)
    const allData = await agent.read({
      sheet: 'TESTS', // Can also use sheet index: 0
    });
    console.log(`   Found ${allData.rows.length} rows`);
    console.log(`   Headers: ${allData.headers?.join(', ')}`);

    // Read a specific range
    const rangeData = await agent.read({
      sheet: 'TESTS',
      range: 'A1:C10',
      format: 'object', // or 'array' for raw 2D array
    });
    console.log(`   Range A1:C10 has ${rangeData.rows.length} rows\n`);

    // ─────────────────────────────────────────────────────────────────────
    // 2. WRITING DATA
    // ─────────────────────────────────────────────────────────────────────
    console.log('✏️  Writing data to sheet...');

    // Write data as objects (headers auto-generated from object keys)
    const writeResult = await agent.write({
      sheet: 'TESTS',
      range: 'A1',
      data: [
        { name: 'Alice', email: 'alice@example.com', role: 'Admin' },
        { name: 'Bob', email: 'bob@example.com', role: 'User' },
      ],
      headers: true, // Write headers from first object's keys
    });
    console.log(`   Updated ${writeResult.updatedCells} cells`);
    console.log(`   Range: ${writeResult.updatedRange}\n`);

    // Write raw 2D array data
    const arrayWriteResult = await agent.write({
      sheet: 'TESTS',
      range: 'E1',
      data: [
        ['Status', 'Count'],
        ['Active', 100],
        ['Inactive', 25],
      ],
      headers: false, // First row is data, not headers
    });
    console.log(`   Array write updated ${arrayWriteResult.updatedCells} cells\n`);

    // ─────────────────────────────────────────────────────────────────────
    // 3. SEARCHING DATA
    // ─────────────────────────────────────────────────────────────────────
    console.log('🔍 Searching data...');

    // Strict match (exact values)
    const strictResults = await agent.search({
      sheet: 'TESTS',
      query: { role: 'Admin' },
      operator: 'and', // All conditions must match
      matching: 'strict', // Exact match
    });
    console.log(`   Found ${strictResults.matchedCount} admins`);

    // Loose match (case-insensitive, substring)
    const looseResults = await agent.search({
      sheet: 'TESTS',
      query: { name: 'alice' },
      matching: 'loose', // Case-insensitive substring match
    });
    console.log(`   Found ${looseResults.matchedCount} results for "alice"\n`);

    // ─────────────────────────────────────────────────────────────────────
    // 4. RATE LIMIT STATUS
    // ─────────────────────────────────────────────────────────────────────
    console.log('📊 Rate limit status...');
    const rateLimitStatus = await agent.rateLimitStatus();
    console.log(`   Requests this minute: ${rateLimitStatus.requestsThisMinute}`);
    console.log(`   Remaining: ${rateLimitStatus.remaining}`);
    console.log(`   Resets at: ${rateLimitStatus.resetsAt.toISOString()}\n`);

    console.log('✅ Basic example completed successfully!');
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('❌ Validation Error:', error.message);
      console.error('   Fix:', error.fix);
    } else if (error instanceof AuthError) {
      console.error('❌ Auth Error:', error.message);
      console.error('   Make sure CREDENTIALS_CONFIG env var is set');
    } else {
      throw error;
    }
  }
}

main();
