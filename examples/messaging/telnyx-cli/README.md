# Telnyx SMS Integration

Send SMS messages via Telnyx API - a serverless-friendly alternative to iMessage that works on Vercel, AWS Lambda, and other cloud platforms.

## Why Telnyx?

- **30-70% cheaper than Twilio** ($0.004/message)
- **Simpler authentication** (1 API key vs Twilio's 2 credentials)
- **Works everywhere** (serverless, Linux, macOS, Windows)
- **Better support** (24/7 free support, Twilio charges)
- **Direct carrier** (owns infrastructure, not a reseller)
- **Official API** (unlike Google Voice which has no API)

## Setup

### 1. Create Telnyx Account

1. Sign up at [telnyx.com](https://telnyx.com)
2. Get API key from portal
3. Purchase a phone number (very affordable rates)

### 2. Set Environment Variables

```bash
# .env
TELNYX_API_KEY=KEY01234ABC_yourapikey
TELNYX_PHONE_NUMBER=+15551234567
```

For Vercel deployment:
```bash
vercel env add TELNYX_API_KEY
vercel env add TELNYX_PHONE_NUMBER
```

### 3. Install Dependencies

```bash
bun add telnyx
```

## Usage

### Send Individual Message

```bash
bun examples/telnyx-cli/send-message.ts \
  --recipient "+15551234567" \
  --message "Hello from Telnyx!"
```

### Programmatic Usage

```typescript
import { TelnyxManager } from './examples/telnyx-cli/telnyx-manager';

const manager = new TelnyxManager({
  apiKey: process.env.TELNYX_API_KEY!,
  phoneNumber: process.env.TELNYX_PHONE_NUMBER!,
});

// Send single message
await manager.sendText('+15551234567', 'Hello!');

// Broadcast to multiple recipients (individual messages)
await manager.broadcast(
  ['+15551111111', '+15552222222', '+15553333333'],
  'Team meeting at 3pm!'
);

// Group MMS (max 8 recipients, US/CAN only)
await manager.sendGroupMessage(
  ['+15551111111', '+15552222222'],
  'Small team chat'
);
```

## Features

### Individual Messages (`sendText`)
- Send to single recipient
- Global support (anywhere Telnyx supports)
- $0.004 per message

### Broadcast Messaging (`broadcast`)
- Send to unlimited recipients
- Each recipient gets individual message (no group chat)
- Privacy-friendly (recipients don't see each other)
- Perfect for newsletters, notifications, teacher coordination

### Group MMS (`sendGroupMessage`)
- Max 8 recipients per group
- US/Canada only
- All recipients see each other's messages
- Charged per recipient with MMS rates
- Use for small team coordination

## Integration with CLI

Use the multi-provider CLI:

```bash
# Auto-detect provider (Telnyx on Linux, iMessage on macOS)
./dist/cli/index.js send-message \
  --recipient "+15551234567" \
  --message "Hello!" \
  --confirm

# Force Telnyx provider
./dist/cli/index.js send-message \
  --recipient "+15551234567" \
  --message "Hello!" \
  --provider telnyx \
  --confirm
```

## Vercel Deployment

See `examples/vercel-api/` for serverless API endpoint example.

## Pricing

- **SMS**: $0.004/message (30-70% cheaper than Twilio)
- **MMS**: ~$0.02/message
- **Phone number**: ~$2/month
- **No support fees** (24/7 free support included)

## Migration from Google Voice

If you want to keep your Google Voice number:
1. Port your Google Voice number to Telnyx (one-time process)
2. Use Telnyx API for programmatic messaging
3. Keep using voice.google.com for manual calls/texts

## API Reference

### `TelnyxManager`

#### Constructor
```typescript
new TelnyxManager(config?: TelnyxConfig)
```

Config options:
- `apiKey` - Telnyx API key (or use `TELNYX_API_KEY` env var)
- `phoneNumber` - Your Telnyx phone number (or use `TELNYX_PHONE_NUMBER` env var)

#### Methods

**`sendText(to: string, message: string): Promise<void>`**
- Send SMS to single recipient
- `to` - Phone number in E.164 format (+15551234567)
- `message` - Text content

**`broadcast(recipients: string[], message: string): Promise<void>`**
- Send individual messages to multiple recipients
- No recipient limit
- Each person gets their own message

**`sendGroupMessage(recipients: string[], message: string): Promise<void>`**
- Send group MMS (max 8 recipients, US/CAN only)
- All recipients see each other's messages
- Uses MMS protocol

**`validateRecipient(recipient: string): boolean`**
- Validate phone number format (E.164)

## Troubleshooting

### "Telnyx API key required"
Set `TELNYX_API_KEY` environment variable or pass `apiKey` in config.

### "Invalid recipient format"
Use E.164 format: `+[country code][number]`
- US: `+15551234567`
- UK: `+447911123456`

### "Group MMS supports max 8 recipients"
Use `broadcast()` instead of `sendGroupMessage()` for larger groups.

## Resources

- [Telnyx Node.js SDK Docs](https://developers.telnyx.com/docs/messaging/messages/send-message?lang=node)
- [Telnyx vs Twilio Comparison](https://telnyx.com/resources/comparing-telnyx-twilio)
- [Telnyx API Reference](https://developers.telnyx.com/docs/api/v2/messaging)
