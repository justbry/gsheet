/**
 * Web Demo Server
 * Interactive demo of g-sheet-agent-io with WebSocket support
 */
import { SheetAgent, ValidationError, PermissionError, AuthError } from '../../src/index';
import type { PhaseInput, TaskUpdate } from '../../src/types';
import index from './index.html';

const PORT = Number(process.env.PORT) || 3000;

// WebSocket clients
const clients = new Set<any>();

// Initialize agent
let agent: SheetAgent;

async function initAgent() {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID environment variable is required');
  }

  console.log('Connecting to SheetAgent...');

  // Use SheetAgent.connect() factory method
  agent = await SheetAgent.connect({
    spreadsheetId,
    credentials: process.env.CREDENTIALS_CONFIG
      ? JSON.parse(Buffer.from(process.env.CREDENTIALS_CONFIG, 'base64').toString())
      : undefined,
    keyFile: process.env.GOOGLE_KEY_FILE,
    defaultFormat: 'object',
  });

  console.log(`✅ Connected to spreadsheet: ${agent.spreadsheetId}`);
}

// Broadcast message to all WebSocket clients
function broadcast(message: any) {
  const msg = JSON.stringify(message);
  clients.forEach(client => {
    try {
      client.send(msg);
    } catch (error) {
      // Client disconnected, remove it
      clients.delete(client);
    }
  });
}

// Error response helper
function errorResponse(error: unknown): Response {
  if (error instanceof ValidationError) {
    return Response.json(
      { error: error.message, fix: error.fix },
      { status: 400 }
    );
  }
  if (error instanceof PermissionError) {
    return Response.json(
      { error: error.message, fix: error.fix },
      { status: 403 }
    );
  }
  if (error instanceof AuthError) {
    return Response.json(
      { error: error.message, fix: 'Check your credentials configuration' },
      { status: 401 }
    );
  }
  console.error('Unexpected error:', error);
  return Response.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}

// Start server
async function main() {
  try {
    await initAgent();
  } catch (error) {
    console.error('Failed to initialize agent:', error);
    process.exit(1);
  }

  Bun.serve({
    port: PORT,
    routes: {
      '/': index,

      // Status endpoint
      '/api/status': {
        GET: async () => {
          try {
            return Response.json({
              spreadsheetId: agent.spreadsheetId,
              connected: true,
              system: agent.system,
            });
          } catch (error) {
            return errorResponse(error);
          }
        },
      },

      // Plan endpoints
      '/api/plan': {
        GET: async () => {
          try {
            const plan = await agent.getPlan();
            return Response.json(plan);
          } catch (error) {
            return errorResponse(error);
          }
        },
        POST: async (req) => {
          try {
            const body = await req.json();
            const { title, goal, phases } = body as {
              title: string;
              goal: string;
              phases: PhaseInput[]
            };

            await agent.createPlan(title, goal, phases);

            // Broadcast update
            const plan = await agent.getPlan();
            broadcast({ type: 'plan_updated', data: plan });

            return Response.json({ success: true });
          } catch (error) {
            return errorResponse(error);
          }
        },
      },

      // Task endpoints
      '/api/tasks/next': {
        GET: async () => {
          try {
            const task = await agent.getNextTask();
            return Response.json(task);
          } catch (error) {
            return errorResponse(error);
          }
        },
      },

      '/api/tasks/review': {
        GET: async () => {
          try {
            const tasks = await agent.getReviewTasks();
            return Response.json(tasks);
          } catch (error) {
            return errorResponse(error);
          }
        },
      },

      '/api/tasks/:step': {
        PATCH: async (req) => {
          try {
            const step = req.params.step;
            const update = await req.json() as TaskUpdate;

            await agent.updateTask(step, update);

            // Broadcast update
            broadcast({
              type: 'task_updated',
              data: { step, status: update.status }
            });

            return Response.json({ success: true });
          } catch (error) {
            return errorResponse(error);
          }
        },
      },

      // Notes endpoint
      '/api/notes': {
        POST: async (req) => {
          try {
            const body = await req.json();
            const { line } = body as { line: string };

            await agent.appendNotes(line);

            // Broadcast update
            const plan = await agent.getPlan();
            broadcast({ type: 'plan_updated', data: plan });

            return Response.json({ success: true });
          } catch (error) {
            return errorResponse(error);
          }
        },
      },

      // Context endpoints
      '/api/context': {
        GET: async () => {
          try {
            return Response.json({ system: agent.system });
          } catch (error) {
            return errorResponse(error);
          }
        },
        POST: async (req) => {
          try {
            const body = await req.json();
            const { context } = body as { context: string };

            // Update AGENT_BASE!A2
            await agent.write({
              sheet: 'AGENT_BASE',
              range: 'A2',
              data: [[context]],
              headers: false,
            });

            // Broadcast update
            broadcast({ type: 'context_updated', data: { system: context } });

            return Response.json({ success: true });
          } catch (error) {
            return errorResponse(error);
          }
        },
      },

      // Sheets endpoints
      '/api/sheets': {
        GET: async () => {
          try {
            const sheets = await agent.listSheets();
            return Response.json(sheets);
          } catch (error) {
            return errorResponse(error);
          }
        },
      },
    },

    // WebSocket support
    websocket: {
      open: (ws) => {
        clients.add(ws);
        console.log(`WebSocket client connected (${clients.size} total)`);

        // Send initial connection message
        ws.send(JSON.stringify({
          type: 'connected',
          data: {
            spreadsheetId: agent.spreadsheetId,
            system: agent.system,
          }
        }));
      },

      message: (ws, message) => {
        try {
          const msg = JSON.parse(message as string);

          if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      },

      close: (ws) => {
        clients.delete(ws);
        console.log(`WebSocket client disconnected (${clients.size} remaining)`);
      },
    },

    development: {
      hmr: true,
      console: true,
    },
  });

  console.log(`🚀 Server running at http://localhost:${PORT}`);
}

main().catch(console.error);
