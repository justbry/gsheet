# g-sheet-agent-io Web Demo

Interactive web UI demonstrating the g-sheet-agent-io library with real-time plan management, agent context editing, and task tracking.

## Features

- **Real-time Updates**: WebSocket connection for live synchronization across browser tabs
- **Agent Context Management**: View and edit agent system prompts stored in AGENT_BASE!A2
- **Plan Management**: Create plans with phases and steps
- **Interactive Task List**: Update task statuses (todo → doing → done/blocked/review)
- **Operation Log**: Track all operations with timestamps
- **Status Monitoring**: Live connection status and spreadsheet info

## Prerequisites

1. **Google Cloud Setup**:
   - Create a Google Cloud project
   - Enable Google Sheets API
   - Create a service account
   - Download credentials JSON

2. **Spreadsheet Setup**:
   - Create a Google Spreadsheet (or use existing)
   - Share the spreadsheet with your service account email (found in credentials JSON)

3. **Environment**:
   - Bun runtime installed
   - Node.js 18+ (for types)

## Setup

### 1. Environment Variables

Create a `.env` file in the project root:

```bash
# Required: Your Google Spreadsheet ID
SPREADSHEET_ID=your-spreadsheet-id-here

# Option 1: Base64-encoded credentials (recommended for production)
CREDENTIALS_CONFIG=base64-encoded-credentials

# Option 2: Path to credentials file (local development)
GOOGLE_KEY_FILE=./path/to/service-account.json

# Optional: Server port (default: 3000)
PORT=3000
```

**To get SPREADSHEET_ID**: Open your Google Sheet, the ID is in the URL:
```
https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit
```

**To encode credentials** (Option 1):
```bash
base64 -i service-account.json | pbcopy  # macOS
base64 -w 0 service-account.json         # Linux
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Run the Demo

```bash
bun --hot examples/web-demo/server.ts
```

The server will start at `http://localhost:3000`

## Usage

### Initial Connection

1. Open `http://localhost:3000` in your browser
2. The server will automatically connect to your spreadsheet
3. If AGENT_BASE sheet doesn't exist, it will be created with starter content

### Agent Context

- **View**: See the current agent system prompt (stored in AGENT_BASE!A2)
- **Edit**: Click "Edit Context" to modify the prompt
- **Save**: Changes are immediately synced to Google Sheets

### Task Management

**Viewing Tasks**:
- Tasks are organized by phases
- Color-coded by status:
  - Gray = todo
  - Blue (pulsing) = doing
  - Green = done
  - Red = blocked
  - Yellow = review

**Updating Task Status**:
1. Click "Start" on a todo task → changes to "doing"
2. Click "Complete" on a doing task → changes to "done"
3. Click "Block" → enter reason → task becomes blocked
4. Click "Review" → enter note → task needs review
5. Click "Resume" on blocked/review tasks → back to doing

**Creating a New Plan**:
1. Click "New Plan"
2. Fill in title and goal
3. Add phases with multiple steps
4. Click "Create Plan"

### Live Updates

Open multiple browser tabs to see real-time synchronization:
- Task status changes appear instantly across all tabs
- Agent context updates propagate immediately
- Plan changes are broadcast to all connected clients

### Operation Log

The right panel shows recent operations:
- Connection events
- Plan updates
- Task changes
- Context saves
- Errors (if any)

## Architecture

### Backend (server.ts)

- **Framework**: Bun.serve() with built-in routing and WebSocket support
- **API Routes**: RESTful endpoints for all operations
- **WebSocket**: Real-time broadcasting to all connected clients
- **SheetAgent**: Single instance shared across all requests

### Frontend (React)

- **app.tsx**: Main application with WebSocket connection
- **AgentContext.tsx**: View/edit agent system prompt
- **TaskList.tsx**: Plan display with interactive task management
- **LiveStatus.tsx**: Connection status and operation log

### Data Flow

```
┌──────────┐     WebSocket      ┌──────────┐     SheetAgent     ┌──────────────┐
│ Browser  │ ◄─────────────────► │  Server  │ ◄─────────────────► │ Google Sheets│
└──────────┘     REST API        └──────────┘     API Calls      └──────────────┘
```

1. User action in browser → REST API call
2. Server executes via SheetAgent → Updates Google Sheets
3. Server broadcasts WebSocket event → All browsers update

## API Endpoints

### Status
- `GET /api/status` - Connection status and spreadsheet info

### Plan
- `GET /api/plan` - Get current plan
- `POST /api/plan` - Create new plan

### Tasks
- `GET /api/tasks/next` - Get next todo task
- `GET /api/tasks/review` - Get tasks needing review
- `PATCH /api/tasks/:step` - Update task status

### Context
- `GET /api/context` - Get agent system prompt
- `POST /api/context` - Update agent context

### Sheets
- `GET /api/sheets` - List all sheets in spreadsheet

### Notes
- `POST /api/notes` - Append line to plan notes

## WebSocket Events

### Server → Client
- `connected` - Initial connection with spreadsheet ID
- `plan_updated` - Plan was created or modified
- `task_updated` - Task status changed
- `context_updated` - Agent context saved

### Client → Server
- `ping` - Keepalive (server responds with `pong`)

## Troubleshooting

### "Cannot access spreadsheet" error
- Verify SPREADSHEET_ID is correct
- Ensure spreadsheet is shared with service account email
- Check credentials are valid

### WebSocket disconnects
- Browser will attempt to reconnect after 3 seconds
- Check network connectivity
- Verify server is running

### Task updates not appearing
- Refresh the page to force sync
- Check browser console for errors
- Verify Google Sheets API quota

### Styles not loading
- Ensure styles.css is in the same directory as index.html
- Check browser dev tools for CSS errors
- Try hard refresh (Cmd+Shift+R or Ctrl+Shift+R)

## Development

### Hot Reload

The `--hot` flag enables hot module reloading:

```bash
bun --hot examples/web-demo/server.ts
```

Changes to server.ts will automatically restart the server.
Changes to frontend files (app.tsx, components, styles.css) will trigger HMR.

### Adding Features

**New API Endpoint**:
```typescript
'/api/myendpoint': {
  GET: async (req) => {
    // Your logic
    return Response.json({ data: 'value' });
  }
}
```

**New WebSocket Event**:
```typescript
// Server broadcast
broadcast({ type: 'my_event', data: { ... } });

// Client handler (in app.tsx)
case 'my_event':
  // Handle event
  break;
```

## Production Deployment

1. **Environment Variables**: Use CREDENTIALS_CONFIG (base64) instead of key file
2. **HTTPS**: Enable SSL for WebSocket security (wss://)
3. **Rate Limiting**: Consider adding rate limits for API endpoints
4. **Error Logging**: Implement proper error logging/monitoring
5. **Build**: No build step needed - Bun handles everything at runtime

## License

Same as g-sheet-agent-io (see parent README)

## Support

For issues or questions, please check:
- [g-sheet-agent-io Documentation](../../README.md)
- [Google Sheets API Docs](https://developers.google.com/sheets/api)
- [Bun Documentation](https://bun.sh/docs)
