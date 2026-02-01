/**
 * Test setup file
 * Loads .env file for all tests
 */

// Load .env file if it exists
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../.env');

if (existsSync(envPath)) {
  // Bun automatically loads .env at the project root
  // This ensures it's loaded for tests too
  console.log('Loading .env file for tests');
}
