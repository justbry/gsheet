/**
 * Vercel Serverless API - Send SMS via Telnyx
 *
 * Deploy to Vercel and send SMS from anywhere!
 *
 * Usage:
 *   POST /api/send-message
 *   Body: { "recipient": "+15551234567", "message": "Hello!" }
 *
 * Environment:
 *   TELNYX_API_KEY       - Your Telnyx API key
 *   TELNYX_PHONE_NUMBER  - Your Telnyx phone number
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TelnyxManager } from '../../telnyx-cli/telnyx-manager';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { recipient, message } = req.body;

    // Validate input
    if (!recipient || typeof recipient !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid recipient' });
    }

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid message' });
    }

    // Send via Telnyx
    const manager = new TelnyxManager();
    await manager.sendText(recipient, message);

    return res.status(200).json({
      success: true,
      recipient: recipient.slice(-4).padStart(recipient.length, '*'), // Redacted
      message: 'Message sent successfully'
    });
  } catch (error: any) {
    console.error('Error sending message:', error);
    return res.status(500).json({
      error: 'Failed to send message',
      message: error.message
    });
  }
}
