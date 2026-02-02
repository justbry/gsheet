/**
 * Messaging Provider Factory
 * Auto-detects and creates appropriate messaging provider
 */

import type { MessagingProvider, MessagingProviderType } from './types';

/**
 * Check if imsg CLI is installed (for iMessage support)
 */
async function checkImsgInstalled(): Promise<boolean> {
  if (process.platform !== 'darwin') return false;

  try {
    const proc = Bun.spawn(['which', 'imsg'], { stdout: 'pipe', stderr: 'pipe' });
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Get messaging provider based on environment or explicit choice
 * @param provider Provider type ('imessage', 'telnyx', 'auto')
 * @returns Initialized messaging provider
 */
export async function getMessagingProvider(
  provider: MessagingProviderType = 'auto'
): Promise<MessagingProvider> {
  // Auto-detect based on platform and available tools
  if (provider === 'auto') {
    // Check for Telnyx config first
    if (process.env.TELNYX_API_KEY) {
      provider = 'telnyx';
    }
    // Check for macOS with imsg installed
    else if (process.platform === 'darwin' && await checkImsgInstalled()) {
      provider = 'imessage';
    }
    // Default to Telnyx (will error if not configured)
    else {
      provider = 'telnyx';
    }
  }

  // Load provider dynamically
  switch (provider) {
    case 'imessage': {
      const { iMessageManager } = await import('../../examples/imessage-cli/imessage-manager');
      return new iMessageManager();
    }

    case 'telnyx': {
      const { TelnyxManager } = await import('../../examples/telnyx-cli/telnyx-manager');
      return new TelnyxManager();
    }

    default:
      throw new Error(`Unknown messaging provider: ${provider}`);
  }
}
