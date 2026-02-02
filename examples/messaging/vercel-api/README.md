# Vercel Serverless API - SMS via Telnyx

Deploy a serverless SMS API to Vercel in seconds!

## Features

- ✅ Serverless (no server management)
- ✅ Auto-scaling (handles any load)
- ✅ Free tier (100GB bandwidth/month)
- ✅ Global CDN (fast everywhere)
- ✅ Simple deployment (`vercel --prod`)

## Setup

### 1. Install Vercel CLI

```bash
bun add -g vercel
```

### 2. Set Environment Variables

```bash
# Login to Vercel
vercel login

# Set secrets
vercel env add TELNYX_API_KEY
vercel env add TELNYX_PHONE_NUMBER
```

### 3. Deploy

```bash
cd examples/vercel-api
vercel --prod
```

## Usage

### Send Message

```bash
curl -X POST https://your-app.vercel.app/api/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "+15551234567",
    "message": "Hello from Vercel!"
  }'
```

Response:
```json
{
  "success": true,
  "recipient": "****4567",
  "message": "Message sent successfully"
}
```

### Error Response

```json
{
  "error": "Failed to send message",
  "message": "Invalid recipient format: abc. Use E.164 format (+15551234567)"
}
```

## API Reference

### `POST /api/send-message`

Send SMS to a phone number.

**Request Body:**
```json
{
  "recipient": "+15551234567",  // E.164 format
  "message": "Your message here"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "recipient": "****4567",
  "message": "Message sent successfully"
}
```

**Error Responses:**

- `400 Bad Request` - Missing or invalid input
- `405 Method Not Allowed` - Not a POST request
- `500 Internal Server Error` - Telnyx API error

## Local Development

```bash
# Install dependencies
bun install

# Run locally with Vercel dev server
vercel dev

# Test locally
curl -X POST http://localhost:3000/api/send-message \
  -H "Content-Type: application/json" \
  -d '{"recipient": "+15551234567", "message": "Test"}'
```

## Security

### Add Authentication (Recommended)

```typescript
// api/send-message.ts
const API_KEY = process.env.API_SECRET_KEY;

if (req.headers.authorization !== `Bearer ${API_KEY}`) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

Set secret:
```bash
vercel env add API_SECRET_KEY
```

Use:
```bash
curl -X POST https://your-app.vercel.app/api/send-message \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"recipient": "+15551234567", "message": "Hello!"}'
```

### Rate Limiting

Use Vercel's built-in rate limiting or add [upstash/ratelimit](https://github.com/upstash/ratelimit):

```bash
bun add @upstash/ratelimit @upstash/redis
```

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
});

const { success } = await ratelimit.limit(req.headers['x-forwarded-for'] as string);
if (!success) {
  return res.status(429).json({ error: 'Rate limit exceeded' });
}
```

## Integration Examples

### Next.js App

```typescript
// app/api/notify/route.ts
import { TelnyxManager } from '@/lib/telnyx-manager';

export async function POST(request: Request) {
  const { recipient, message } = await request.json();

  const manager = new TelnyxManager();
  await manager.sendText(recipient, message);

  return Response.json({ success: true });
}
```

### React Hook

```typescript
// hooks/useSMS.ts
import { useState } from 'react';

export function useSMS() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendSMS = async (recipient: string, message: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient, message }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send message');
      }

      return await response.json();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { sendSMS, loading, error };
}
```

## Costs

**Vercel Free Tier:**
- 100GB bandwidth/month
- Unlimited API requests
- 100 hours serverless execution/month

**Telnyx:**
- $0.004 per SMS
- ~$2/month for phone number

**Example:** 1,000 SMS/month = $4 + $2 = $6/month total

## Troubleshooting

### "Module not found: @vercel/node"
```bash
bun add -D @vercel/node
```

### "TELNYX_API_KEY is not defined"
```bash
vercel env pull .env.local
```

### "Cannot find module '../../telnyx-cli/telnyx-manager'"
Ensure `telnyx-manager.ts` is in the deployment. Check `vercel.json` includes pattern.

## Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Telnyx API Docs](https://developers.telnyx.com/docs/api/v2/messaging)
- [Vercel Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
