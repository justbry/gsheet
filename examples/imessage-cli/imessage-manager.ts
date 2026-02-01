/**
 * iMessage Manager - Simple wrapper for sending iMessages via macOS Messages.app
 *
 * Provides a clean interface for sending messages with error handling
 * Uses the local send-message.ts tool
 */

import { $ } from "bun";
import { spawn } from "bun";
import { join } from "path";

export interface iMessageConfig {
  // No credentials needed - uses macOS Messages.app
}

export class iMessageManager {
  private sendMessagePath: string;

  constructor(config?: iMessageConfig) {
    // Path to local send-message.ts tool
    this.sendMessagePath = join(
      import.meta.dir,
      "send-message.ts"
    );
  }

  /**
   * Send an iMessage to a phone number or email
   * @param to Phone number (e.g., +15551234567) or email address
   * @param text Message content
   */
  async sendText(to: string, text: string): Promise<void> {
    try {
      // Validate recipient format
      if (!this.isValidRecipient(to)) {
        throw new Error(
          `Invalid recipient format: ${to}. Use phone number (+15551234567) or email address`
        );
      }

      // Call SendMessage.ts tool with proper argument escaping
      const proc = spawn({
        cmd: ["bun", this.sendMessagePath, "--recipient", to, "--message", text],
        stdout: "pipe",
        stderr: "pipe",
      });

      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        throw new Error(`SendMessage.ts exited with code ${exitCode}: ${stderr}`);
      }

      console.log(`✅ iMessage sent successfully to ${this.redactRecipient(to)}`);
    } catch (error: any) {
      console.error(`❌ Failed to send iMessage to ${this.redactRecipient(to)}:`, error.message);
      throw error;
    }
  }

  /**
   * Validate recipient is a phone number or email
   * @param recipient Recipient to validate
   */
  private isValidRecipient(recipient: string): boolean {
    // Phone number (E.164 format or US format)
    const phonePattern = /^\+?[1-9]\d{1,14}$/;
    // Email address
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return phonePattern.test(recipient) || emailPattern.test(recipient);
  }

  /**
   * Redact recipient for logging (show only last 4 characters)
   * @param recipient Recipient to redact
   */
  private redactRecipient(recipient: string): string {
    if (recipient.length <= 4) return "****";
    return "****" + recipient.slice(-4);
  }
}
