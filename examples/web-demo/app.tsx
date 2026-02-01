import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { AgentContext } from './components/AgentContext';
import { TaskList } from './components/TaskList';
import { LiveStatus } from './components/LiveStatus';
import type { Plan } from '../../src/types';

// WebSocket message types
interface WSMessage {
  type: 'connected' | 'plan_updated' | 'task_updated' | 'context_updated' | 'pong';
  data?: any;
}

// Operation log entry
interface Operation {
  timestamp: Date;
  type: string;
  message: string;
}

function App() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [agentContext, setAgentContext] = useState<string>('');
  const [spreadsheetId, setSpreadsheetId] = useState<string>('');
  const [connected, setConnected] = useState(false);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);

  // Add operation to log
  const addOperation = (type: string, message: string) => {
    setOperations(prev => [
      { timestamp: new Date(), type, message },
      ...prev.slice(0, 4) // Keep last 5
    ]);
  };

  // WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    console.log('Connecting to WebSocket:', wsUrl);
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
      setError(null);
      addOperation('connection', 'Connected to server');
    };

    ws.current.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        console.log('WebSocket message:', msg);

        switch (msg.type) {
          case 'connected':
            setSpreadsheetId(msg.data.spreadsheetId);
            setAgentContext(msg.data.system);
            addOperation('init', 'Received initial data');
            break;

          case 'plan_updated':
            setPlan(msg.data);
            addOperation('plan', 'Plan updated');
            break;

          case 'task_updated':
            // Refresh plan to get latest task statuses
            fetchPlan();
            addOperation('task', `Task ${msg.data.step} updated`);
            break;

          case 'context_updated':
            setAgentContext(msg.data.system);
            addOperation('context', 'Agent context updated');
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('WebSocket connection error');
    };

    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
      addOperation('connection', 'Disconnected from server');

      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        console.log('Attempting to reconnect...');
        window.location.reload();
      }, 3000);
    };

    return () => {
      ws.current?.close();
    };
  }, []);

  // Fetch plan on mount
  useEffect(() => {
    if (connected) {
      fetchPlan();
    }
  }, [connected]);

  // API helpers
  const api = async (endpoint: string, options?: RequestInit) => {
    try {
      const response = await fetch(endpoint, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Request failed');
      }

      return await response.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setError(message);
      addOperation('error', message);
      throw error;
    }
  };

  const fetchPlan = async () => {
    try {
      const planData = await api('/api/plan');
      setPlan(planData);
      addOperation('fetch', 'Loaded plan');
    } catch (error) {
      console.error('Failed to fetch plan:', error);
    }
  };

  const updateTaskStatus = async (step: string, update: any) => {
    try {
      await api(`/api/tasks/${step}`, {
        method: 'PATCH',
        body: JSON.stringify(update),
      });
      // WebSocket will trigger refresh
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const updateContext = async (newContext: string) => {
    try {
      await api('/api/context', {
        method: 'POST',
        body: JSON.stringify({ context: newContext }),
      });
      // WebSocket will trigger update
      addOperation('update', 'Agent context saved');
    } catch (error) {
      console.error('Failed to update context:', error);
    }
  };

  const createPlan = async (title: string, goal: string, phases: any[]) => {
    try {
      await api('/api/plan', {
        method: 'POST',
        body: JSON.stringify({ title, goal, phases }),
      });
      // WebSocket will trigger refresh
      addOperation('create', 'New plan created');
    } catch (error) {
      console.error('Failed to create plan:', error);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>gsheet Demo</h1>
        <div className="header-info">
          <span className={`connection-indicator ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '● Connected' : '○ Disconnected'}
          </span>
          <span className="spreadsheet-id">
            Sheet: {spreadsheetId || 'Loading...'}
          </span>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="main-content">
        <div className="panel panel-left">
          <h2>Agent Context</h2>
          <AgentContext
            context={agentContext}
            onSave={updateContext}
          />
        </div>

        <div className="panel panel-center">
          <h2>Plan & Tasks</h2>
          <TaskList
            plan={plan}
            onTaskUpdate={updateTaskStatus}
            onCreatePlan={createPlan}
            onRefresh={fetchPlan}
          />
        </div>

        <div className="panel panel-right">
          <h2>Status</h2>
          <LiveStatus
            connected={connected}
            spreadsheetId={spreadsheetId}
            operations={operations}
          />
        </div>
      </div>
    </div>
  );
}

// Mount app
const root = createRoot(document.getElementById('root')!);
root.render(<App />);
