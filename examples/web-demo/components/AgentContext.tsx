import React, { useState, useEffect } from 'react';

interface AgentContextProps {
  context: string;
  onSave: (newContext: string) => Promise<void>;
}

export function AgentContext({ context, onSave }: AgentContextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(context);
  const [isSaving, setIsSaving] = useState(false);

  // Update edit value when context prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(context);
    }
  }, [context, isEditing]);

  const handleEdit = () => {
    setIsEditing(true);
    setEditValue(context);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(context);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save context:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="agent-context">
      {!isEditing ? (
        <>
          <div className="context-view">
            <pre>{context || 'No agent context loaded'}</pre>
          </div>
          <button onClick={handleEdit} className="button button-primary">
            Edit Context
          </button>
        </>
      ) : (
        <>
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="context-editor"
            rows={20}
            disabled={isSaving}
          />
          <div className="context-meta">
            {editValue.length} characters
          </div>
          <div className="button-group">
            <button
              onClick={handleSave}
              className="button button-primary"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              className="button button-secondary"
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
