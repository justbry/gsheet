/**
 * Telnyx Manager - SMS/MMS messaging via Telnyx API
 *
 * Provides messaging interface for serverless environments (Vercel, AWS Lambda, etc.)
 * 30-70% cheaper than Twilio with better support and simpler auth
 */

import Telnyx from 'telnyx';
import type { MessagingProvider } from '../../src/messaging/types';

export interface TelnyxConfig {
  apiKey: string;
  phoneNumber: string;  // Your Telnyx phone number (E.164 format)
}

export class TelnyxManager implements MessagingProvider {
  private client: Telnyx;
  private phoneNumber: string;

  constructor(config?: TelnyxConfig) {
    // Load from config or environment
    const apiKey = config?.apiKey || process.env.TELNYX_API_KEY;
    const phoneNumber = config?.phoneNumber || process.env.TELNYX_PHONE_NUMBER;

    if (!apiKey) {
      throw new Error(
        'Telnyx API key required. Set TELNYX_API_KEY env var or pass config.apiKey'
      );
    }

    if (!phoneNumber) {
      throw new Error(
        'Telnyx phone number required. Set TELNYX_PHONE_NUMBER env var or pass config.phoneNumber'
      );
    }

    this.client = new Telnyx(apiKey);
    this.phoneNumber = phoneNumber;
  }

  /**
   * Send an SMS to a single recipient
   * @param to Phone number (E.164 format: +15551234567)
   * @param message Message content
   */
  async sendText(to: string, message: string): Promise<void> {
    try {
      // Validate recipient format
      if (!this.validateRecipient(to)) {
        throw new Error(
          `Invalid recipient format: ${to}. Use E.164 format (+15551234567)`
        );
      }

      // Send via Telnyx SDK
      const response = await this.client.messages.create({
        from: this.phoneNumber,
        to: to,
        text: message,
      });

      console.log(`✅ SMS sent successfully to ${this.redactRecipient(to)}`);
      console.log(`   Message ID: ${response.data.id}`);
    } catch (error: any) {
      console.error(`❌ Failed to send SMS to ${this.redactRecipient(to)}:`, error.message);
      throw error;
    }
  }

  /**
   * Send individual messages to multiple recipients (broadcast)
   * Each recipient gets their own message - no group chat
   * @param recipients Array of phone numbers
   * @param message Message content
   */
  async broadcast(recipients: string[], message: string): Promise<void> {
    console.log(`📢 Broadcasting to ${recipients.length} recipients...`);

    const results = await Promise.allSettled(
      recipients.map(recipient => this.sendText(recipient, message))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`\n✅ Broadcast complete: ${successful} sent, ${failed} failed`);

    if (failed > 0) {
      const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map(r => r.reason.message);
      throw new Error(`Broadcast partially failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * Send group MMS where all recipients can see each other
   * LIMITATIONS:
   * - Max 8 recipients per group
   * - US/Canada only
   * - Uses MMS protocol (charged per recipient)
   * @param recipients Array of phone numbers (max 8)
   * @param message Message content
   */
  async sendGroupMessage(recipients: string[], message: string): Promise<void> {
    if (recipients.length > 8) {
      throw new Error(
        `Group MMS supports max 8 recipients, got ${recipients.length}. Use broadcast() instead.`
      );
    }

    try {
      // Validate all recipients
      for (const recipient of recipients) {
        if (!this.validateRecipient(recipient)) {
          throw new Error(
            `Invalid recipient format: ${recipient}. Use E.164 format (+15551234567)`
          );
        }
      }

      // Send group MMS via Telnyx API (not available in SDK, use direct HTTP)
      const response = await fetch('https://api.telnyx.com/v2/messages/group_mms', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: this.phoneNumber,
          to: recipients,
          text: message
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Telnyx API error: ${error}`);
      }

      const data = await response.json();

      console.log(`✅ Group MMS sent to ${recipients.length} recipients`);
      console.log(`   Message ID: ${data.data.id}`);
    } catch (error: any) {
      console.error(`❌ Failed to send group MMS:`, error.message);
      throw error;
    }
  }

  /**
   * Validate recipient is a phone number in E.164 format
   * @param recipient Phone number to validate
   */
  validateRecipient(recipient: string): boolean {
    // E.164 format: +[country code][number]
    // Examples: +15551234567, +447911123456
    const e164Pattern = /^\+[1-9]\d{1,14}$/;
    return e164Pattern.test(recipient);
  }

  /**
   * Redact recipient for logging (show only last 4 characters)
   * @param recipient Phone number to redact
   */
  private redactRecipient(recipient: string): string {
    if (recipient.length <= 4) return '****';
    return '****' + recipient.slice(-4);
  }
}
