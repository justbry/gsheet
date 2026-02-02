import React from 'react';

interface Operation {
  timestamp: Date;
  type: string;
  message: string;
}

interface LiveStatusProps {
  connected: boolean;
  spreadsheetId: string;
  operations: Operation[];
}

export function LiveStatus({ connected, spreadsheetId, operations }: LiveStatusProps) {
  return (
    <div className="live-status">
      <div className="status-section">
        <h3>Connection</h3>
        <div className="status-row">
          <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></span>
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      <div className="status-section">
        <h3>Spreadsheet</h3>
        <div className="spreadsheet-info">
          <code>{spreadsheetId || 'Not connected'}</code>
          {spreadsheetId && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="link-button"
            >
              Open in Google Sheets ↗
            </a>
          )}
        </div>
      </div>

      <div className="status-section">
        <h3>Recent Operations</h3>
        <div className="operations-log">
          {operations.length === 0 ? (
            <div className="empty-state">No operations yet</div>
          ) : (
            operations.map((op, index) => (
              <div key={index} className="operation-entry">
                <span className="operation-time">
                  {op.timestamp.toLocaleTimeString()}
                </span>
                <span className="operation-type">[{op.type}]</span>
                <span className="operation-message">{op.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
