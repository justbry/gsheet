/**
 * Full Workflow Example
 *
 * This example demonstrates a complete agent workflow including:
 * - Workspace initialization
 * - Task queue management
 * - Persistent memory
 * - Action history logging
 * - Agent lifecycle (pause/resume)
 *
 * This simulates a real-world agent that processes tasks autonomously.
 *
 * Run: bun examples/full-workflow.ts
 */

import {
  SheetAgent,
  AgentPausedError,
  ValidationError,
} from '../src/index';
import type { Task, AgentStatus } from '../src/index';

// Configuration
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || 'your-spreadsheet-id-here';

async function main() {
  console.log('🤖 Starting Full Agent Workflow Example\n');

  const agent = new SheetAgent({
    spreadsheetId: SPREADSHEET_ID,
    agentId: 'workflow-demo-agent',
    defaultFormat: 'object',
    rateLimit: {
      requestsPerMinute: 250,
      retryAttempts: 3,
      backoffMs: 1000,
    },
  });

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: WORKSPACE SETUP
    // ═══════════════════════════════════════════════════════════════════════
    console.log('════════════════════════════════════════════════════════════');
    console.log('PHASE 1: WORKSPACE SETUP');
    console.log('════════════════════════════════════════════════════════════\n');

    // Initialize workspace (creates required sheets if missing)
    console.log('🏗️  Initializing workspace...');
    await agent.initWorkspace({
      agentId: 'workflow-demo-agent',
      preserveExisting: true,
    });

    // Validate workspace
    const validation = await agent.validateWorkspace();
    console.log(`   Workspace valid: ${validation.valid ? '✅' : '❌'}`);
    console.log(`   Sheets found: ${validation.sheetsFound.join(', ')}`);
    if (validation.sheetsMissing.length > 0) {
      console.log(`   Sheets missing: ${validation.sheetsMissing.join(', ')}`);
    }
    console.log();

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2: PERSISTENT MEMORY
    // ═══════════════════════════════════════════════════════════════════════
    console.log('════════════════════════════════════════════════════════════');
    console.log('PHASE 2: PERSISTENT MEMORY');
    console.log('════════════════════════════════════════════════════════════\n');

    // Store configuration in memory
    console.log('💾 Storing data in persistent memory...');

    await agent.remember('last_run', new Date().toISOString(), { tags: 'system' });
    console.log('   ✓ Stored: last_run');

    await agent.remember('config', { maxRetries: 3, timeout: 30000 }, { tags: 'config' });
    console.log('   ✓ Stored: config (object)');

    await agent.remember('processed_count', 0, { tags: 'counter' });
    console.log('   ✓ Stored: processed_count');

    // Store multiple items at once
    await agent.rememberMany([
      { key: 'api_endpoint', value: 'https://api.example.com', tags: 'config' },
      { key: 'batch_size', value: 50, tags: 'config' },
    ]);
    console.log('   ✓ Stored: api_endpoint, batch_size (batch)\n');

    // Recall values
    console.log('📖 Recalling from memory...');
    const lastRun = await agent.recall('last_run');
    console.log(`   last_run: ${lastRun}`);

    const config = await agent.recall('config') as { maxRetries: number; timeout: number };
    console.log(`   config: ${JSON.stringify(config)}`);

    // Recall multiple
    const configValues = await agent.recallMany(['api_endpoint', 'batch_size']);
    console.log(`   Batch recall: ${Object.keys(configValues).length} items retrieved\n`);

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 3: TASK QUEUE
    // ═══════════════════════════════════════════════════════════════════════
    console.log('════════════════════════════════════════════════════════════');
    console.log('PHASE 3: TASK QUEUE');
    console.log('════════════════════════════════════════════════════════════\n');

    // Schedule tasks
    console.log('📋 Scheduling tasks...');

    // Schedule a high-priority task
    await agent.scheduleTask({
      action: 'process_batch',
      params: { batchId: 'batch-001', size: 25 },
      priority: 8, // High priority
      scheduledFor: new Date(), // Run now
    });
    console.log('   ✓ Scheduled: process_batch (priority: 8)');

    // Schedule a low-priority task (for later cancellation demo)
    await agent.scheduleTask({
      action: 'send_notification',
      params: { recipient: 'admin@example.com', type: 'summary' },
      priority: 3, // Low priority
      scheduledFor: new Date(Date.now() + 60000), // Run in 1 minute
    });
    console.log('   ✓ Scheduled: send_notification (priority: 3)');

    // Schedule multiple tasks at once
    await agent.scheduleTasks([
      {
        action: 'validate_data',
        params: { sheet: 'Customers' },
        priority: 5,
      },
      {
        action: 'generate_report',
        params: { type: 'daily' },
        priority: 6,
      },
    ]);
    console.log('   ✓ Scheduled 2 additional tasks (batch)\n');

    // Fetch next task (highest priority, due now)
    console.log('⏳ Fetching next task...');
    const nextTask = await agent.fetchTask();
    if (nextTask) {
      console.log(`   Next task: ${nextTask.action} (priority: ${nextTask.priority})`);
      console.log(`   Params: ${JSON.stringify(nextTask.params)}`);

      // Simulate processing
      console.log('   Processing...');
      await sleep(500);

      // Complete the task
      await agent.completeTask(nextTask.id, { result: 'success', itemsProcessed: 25 });
      console.log('   ✓ Task completed\n');
    } else {
      console.log('   No tasks due\n');
    }

    // Fetch and cancel the low-priority notification task
    console.log('🚫 Cancelling low-priority task...');
    const lowPriorityTask = await agent.fetchTask();
    if (lowPriorityTask && lowPriorityTask.action === 'send_notification') {
      await agent.cancelTask(lowPriorityTask.id);
      console.log(`   ✓ Task ${lowPriorityTask.id} cancelled\n`);
    } else {
      console.log('   No low-priority task found to cancel\n');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 4: ACTION HISTORY
    // ═══════════════════════════════════════════════════════════════════════
    console.log('════════════════════════════════════════════════════════════');
    console.log('PHASE 4: ACTION HISTORY');
    console.log('════════════════════════════════════════════════════════════\n');

    // Log some actions
    console.log('📝 Logging actions...');

    await agent.logAction({
      action: 'data_import',
      input: { source: 'CSV', file: 'customers.csv' },
      output: { rowsImported: 150 },
      status: 'success',
      duration_ms: 2500,
    });
    console.log('   ✓ Logged: data_import (success)');

    await agent.logAction({
      action: 'validation',
      input: { sheet: 'Customers', rules: ['email', 'phone'] },
      output: { errors: 3 },
      status: 'failure',
      duration_ms: 800,
      error: 'Validation failed: 3 records with invalid email format',
    });
    console.log('   ✓ Logged: validation (failure)\n');

    // Fetch history
    console.log('📜 Fetching action history...');

    const allHistory = await agent.fetchHistory({ limit: 10 });
    console.log(`   Total actions: ${allHistory.length}`);

    const successHistory = await agent.fetchHistory({
      status: 'success',
      limit: 5,
    });
    console.log(`   Successful actions: ${successHistory.length}`);

    const recentHistory = await agent.fetchHistory({
      startTime: new Date(Date.now() - 3600000), // Last hour
    });
    console.log(`   Actions in last hour: ${recentHistory.length}\n`);

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 5: AGENT LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════════
    console.log('════════════════════════════════════════════════════════════');
    console.log('PHASE 5: AGENT LIFECYCLE');
    console.log('════════════════════════════════════════════════════════════\n');

    // Get agent status
    console.log('📊 Agent status...');
    let status: AgentStatus = await agent.status();
    printStatus(status);

    // Pause the agent
    console.log('⏸️  Pausing agent...');
    await agent.pause();
    status = await agent.status();
    console.log(`   State: ${status.state}`);
    console.log(`   Paused at: ${status.pausedAt}\n`);

    // Try to do work while paused (will fail)
    console.log('🔒 Attempting operation while paused...');
    try {
      await agent.read({ sheet: 'Sheet1' });
    } catch (error) {
      if (error instanceof AgentPausedError) {
        console.log('   ✓ Operation blocked: Agent is paused\n');
      }
    }

    // Resume the agent
    console.log('▶️  Resuming agent...');
    await agent.resume();
    status = await agent.status();
    console.log(`   State: ${status.state}`);
    console.log(`   Agent is operational\n`);

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 6: CLEANUP
    // ═══════════════════════════════════════════════════════════════════════
    console.log('════════════════════════════════════════════════════════════');
    console.log('PHASE 6: CLEANUP');
    console.log('════════════════════════════════════════════════════════════\n');

    // Clean up memory entries
    console.log('🧹 Cleaning up...');
    await agent.forget('processed_count');
    console.log('   ✓ Removed: processed_count from memory');

    await agent.forgetMany(['api_endpoint', 'batch_size']);
    console.log('   ✓ Removed: api_endpoint, batch_size from memory\n');

    // Final status
    console.log('📊 Final agent status...');
    status = await agent.status();
    printStatus(status);

    console.log('════════════════════════════════════════════════════════════');
    console.log('✅ Full workflow example completed successfully!');
    console.log('════════════════════════════════════════════════════════════\n');
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('❌ Validation Error:', error.message);
      console.error('   Fix:', error.fix);
    } else if (error instanceof AgentPausedError) {
      console.error('❌ Agent is paused. Call agent.resume() to continue.');
    } else {
      throw error;
    }
  }
}

// Helper functions
function printStatus(status: AgentStatus) {
  console.log(`   State: ${status.state}`);
  console.log(`   Created at: ${status.createdAt ?? 'N/A'}`);
  console.log(`   Last action: ${status.lastAction ?? 'N/A'}`);
  console.log(`   Pending tasks: ${status.pendingTasks}`);
  console.log(`   Memory entries: ${status.memoryEntries}`);
  console.log(`   History entries: ${status.historyEntries}\n`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main();
