# Telnyx SMS Integration - Product Requirements

## Overview

Add Telnyx SMS as a serverless-compatible alternative to iMessage for sending messages from the gsheet CLI and Sunday School Coordinator.

## Problem Statement

**Current State:**
- iMessage CLI works only on macOS via Messages.app
- Cannot deploy to Vercel or other serverless platforms
- No cross-platform messaging solution

**Attempted Solutions:**
- Google Voice: No official API, unofficial libraries unmaintained
- Browser automation: Violates TOS, fragile, not serverless-compatible

**Solution:**
Add Telnyx SMS provider with multi-provider abstraction layer.

## Why Telnyx?

| Criteria | Telnyx | Twilio | Google Voice |
|----------|--------|--------|--------------|
| **Cost** | $0.004/msg | $0.0075/msg | Free (no API) |
| **Serverless** | ✅ Yes | ✅ Yes | ❌ No |
| **Auth** | 1 API key | 2 credentials | N/A |
| **Support** | Free 24/7 | Paid | N/A |
| **Reliability** | Direct carrier | Reseller | N/A |
| **Savings** | Baseline | 30-70% higher | Free but no API |

## Requirements

### Functional Requirements

**FR1: Multi-Provider Abstraction**
- Support multiple messaging providers (iMessage, Telnyx)
- Unified interface for all providers
- Auto-detect provider based on environment

**FR2: Telnyx Integration**
- Send SMS to single recipient
- Broadcast to multiple recipients (individual messages)
- Group MMS support (max 8 recipients, US/CAN only)
- E.164 phone number validation

**FR3: CLI Integration**
- Add `--provider` flag to `send-message` command
- Support `imessage`, `telnyx`, `auto` provider types
- Maintain backward compatibility

**FR4: Serverless Deployment**
- Provide Vercel API endpoint example
- Environment variable configuration
- No long-running processes required

**FR5: Sunday School Coordinator Update**
- Fix incorrect import path (whatsapp-cli → factory)
- Support provider selection via env var
- Work with both iMessage and Telnyx

### Non-Functional Requirements

**NFR1: Performance**
- Message delivery < 2 seconds
- Support concurrent message sending

**NFR2: Security**
- Secure API key storage (env vars)
- Redact sensitive info in logs
- Validate recipient formats

**NFR3: Reliability**
- Handle API errors gracefully
- Retry failed messages (optional)
- Clear error messages

**NFR4: Maintainability**
- Clear separation of concerns
- Provider-agnostic consuming code
- Easy to add new providers

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────┐
│                   CLI / Application                 │
├─────────────────────────────────────────────────────┤
│           Messaging Factory (Auto-detect)           │
├────────────────────┬────────────────────────────────┤
│  iMessageManager   │      TelnyxManager             │
│  (macOS only)      │   (Cross-platform, serverless) │
├────────────────────┴────────────────────────────────┤
│           MessagingProvider Interface                │
│  - sendText()                                       │
│  - broadcast()                                      │
│  - sendGroupMessage() [optional]                    │
│  - validateRecipient()                              │
└─────────────────────────────────────────────────────┘
```

### Provider Interface

```typescript
interface MessagingProvider {
  sendText(to: string, message: string): Promise<void>;
  broadcast(recipients: string[], message: string): Promise<void>;
  sendGroupMessage?(recipients: string[], message: string): Promise<void>;
  validateRecipient(recipient: string): boolean;
}
```

### Factory Pattern

```typescript
async function getMessagingProvider(
  provider: 'imessage' | 'telnyx' | 'auto'
): Promise<MessagingProvider>
```

**Auto-detection logic:**
- If `provider === 'auto'`:
  - If macOS && no `TELNYX_API_KEY` → iMessage
  - Else → Telnyx

## Implementation Plan

### Phase 1: Core Infrastructure
- [x] Create `MessagingProvider` interface
- [x] Create `getMessagingProvider()` factory
- [x] Update `iMessageManager` to implement interface

### Phase 2: Telnyx Integration
- [x] Create `TelnyxManager` class
- [x] Implement `sendText()`, `broadcast()`, `sendGroupMessage()`
- [x] Add E.164 validation
- [x] Create CLI tool (`send-message.ts`)

### Phase 3: CLI Updates
- [x] Add `--provider` flag to parser
- [x] Update `cmdSendMessage()` to use factory
- [x] Update help text

### Phase 4: Examples & Documentation
- [x] Create Telnyx CLI example
- [x] Create Vercel API example
- [x] Create messaging demos
- [x] Write comprehensive documentation

### Phase 5: Integration Updates
- [x] Fix Sunday School Coordinator imports
- [x] Add provider selection support
- [x] Test end-to-end workflow

## Usage Examples

### CLI

```bash
# Auto-detect provider
./dist/cli/index.js send-message \
  --recipient "+15551234567" \
  --message "Hello!" \
  --confirm

# Force Telnyx
./dist/cli/index.js send-message \
  --recipient "+15551234567" \
  --message "Hello!" \
  --provider telnyx \
  --confirm
```

### Programmatic

```typescript
import { getMessagingProvider } from './src/messaging/factory';

const messenger = await getMessagingProvider('auto');
await messenger.sendText('+15551234567', 'Hello!');
await messenger.broadcast(
  ['+15551111111', '+15552222222'],
  'Team meeting at 3pm!'
);
```

### Vercel Serverless

```typescript
// api/send-message.ts
import { TelnyxManager } from './telnyx-manager';

export default async function handler(req, res) {
  const { recipient, message } = req.body;
  const manager = new TelnyxManager();
  await manager.sendText(recipient, message);
  return res.json({ success: true });
}
```

## Configuration

### Environment Variables

```bash
# Telnyx (required for Telnyx provider)
TELNYX_API_KEY=KEY01234ABC_yourapikey
TELNYX_PHONE_NUMBER=+15551234567

# Provider selection (optional, default: auto)
MESSAGING_PROVIDER=telnyx  # or imessage, auto
```

### Vercel Deployment

```bash
vercel env add TELNYX_API_KEY
vercel env add TELNYX_PHONE_NUMBER
vercel --prod
```

## Testing

### Unit Tests
- Provider interface compliance
- Factory auto-detection logic
- Message validation

### Integration Tests
- Send message via Telnyx
- Send message via iMessage
- Broadcast to multiple recipients
- Error handling

### End-to-End Tests
- CLI send-message command
- Sunday School Coordinator workflow
- Vercel API endpoint

## Security Considerations

**API Key Management:**
- Store in environment variables (never hardcode)
- Use Vercel secrets for production
- Redact in logs

**Input Validation:**
- Validate phone numbers (E.164 format)
- Sanitize message content
- Rate limiting (Vercel API)

**Error Handling:**
- Don't leak API keys in errors
- Redact recipient info in logs
- Clear user-facing error messages

## Migration Path

**For existing iMessage users:**
1. Continue using iMessage on macOS (no changes required)
2. Set `MESSAGING_PROVIDER=imessage` to force iMessage
3. Upgrade to Telnyx when deploying to Vercel

**For Google Voice users:**
1. Create Telnyx account
2. Port Google Voice number to Telnyx (optional)
3. Set `TELNYX_API_KEY` and `TELNYX_PHONE_NUMBER`
4. Use Telnyx provider

## Pricing Analysis

### Example: 1,000 messages/month

**iMessage:**
- Cost: $0 (free via Apple ID)
- Limitation: macOS only

**Telnyx:**
- SMS: 1,000 × $0.004 = $4
- Phone number: $2/month
- **Total: $6/month**

**Twilio (comparison):**
- SMS: 1,000 × $0.0075 = $7.50
- Phone number: $1/month
- **Total: $8.50/month**
- **Savings with Telnyx: 29%**

### Break-even Analysis

For users sending >500 messages/month:
- Telnyx saves 30-70% vs Twilio
- Direct carrier = better reliability

## Success Metrics

- ✅ Multi-provider abstraction implemented
- ✅ Telnyx provider working
- ✅ CLI supports `--provider` flag
- ✅ Vercel deployment example
- ✅ Sunday School Coordinator updated
- ✅ Documentation complete
- ✅ Build passes

## Deliverables

### Code
- [x] 14 new files (providers, examples, docs)
- [x] 7 modified files (CLI, examples, config)
- [x] Tests passing
- [x] Build successful

### Documentation
- [x] Messaging guide (`Docs/MESSAGING.md`)
- [x] Telnyx CLI README
- [x] Vercel API README
- [x] Implementation summary
- [x] This PRD

## Future Enhancements

**Nice-to-have (not in scope):**
- AWS SNS provider
- Plivo provider
- Message delivery tracking
- Webhook support for replies
- Rate limiting built-in
- Message templates

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Telnyx API changes | Low | Medium | Use official SDK |
| Cost overruns | Medium | Low | Clear pricing docs |
| Message delivery failures | Low | High | Retry logic, error handling |
| Security breach (API keys) | Medium | High | Env vars, never hardcode |

## Conclusion

This implementation provides a production-ready, cost-effective alternative to iMessage that works in serverless environments. The multi-provider architecture ensures backward compatibility while enabling future growth.

**Status:** ✅ Complete

All requirements implemented, tested, and documented.
