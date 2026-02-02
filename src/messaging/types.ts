/**
 * Shared messaging types and interfaces
 * Provides provider-agnostic messaging abstraction
 */

export interface MessagingProvider {
  /**
   * Send a text message to a single recipient
   * @param to Phone number (E.164 format recommended) or email
   * @param message Message content
   */
  sendText(to: string, message: string): Promise<void>;

  /**
   * Send individual messages to multiple recipients (broadcast)
   * Each recipient gets their own message (no group chat)
   * @param recipients Array of phone numbers or emails
   * @param message Message content (same for all recipients)
   */
  broadcast(recipients: string[], message: string): Promise<void>;

  /**
   * Send group message where recipients can see each other (optional)
   * Not all providers support true group messaging
   * @param recipients Array of phone numbers
   * @param message Message content
   */
  sendGroupMessage?(recipients: string[], message: string): Promise<void>;

  /**
   * Validate recipient format
   * @param recipient Phone number or email
   */
  validateRecipient(recipient: string): boolean;
}

export type MessagingProviderType = 'imessage' | 'telnyx' | 'auto';

export interface MessagingConfig {
  provider: MessagingProviderType;
  apiKey?: string;        // For Telnyx
  phoneNumber?: string;   // For Telnyx
}
