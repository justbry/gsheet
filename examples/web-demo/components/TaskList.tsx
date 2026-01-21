import React, { useState } from 'react';
import type { Plan, PlanTask, TaskStatus, PhaseInput } from '../../../src/types';

interface TaskListProps {
  plan: Plan | null;
  onTaskUpdate: (step: string, update: any) => Promise<void>;
  onCreatePlan: (title: string, goal: string, phases: PhaseInput[]) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function TaskList({ plan, onTaskUpdate, onCreatePlan, onRefresh }: TaskListProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    goal: '',
    phases: [{ name: '', steps: [''] }]
  });

  const handleCreatePlan = async () => {
    try {
      await onCreatePlan(formData.title, formData.goal, formData.phases);
      setShowCreateForm(false);
      setFormData({
        title: '',
        goal: '',
        phases: [{ name: '', steps: [''] }]
      });
    } catch (error) {
      console.error('Failed to create plan:', error);
    }
  };

  const addPhase = () => {
    setFormData({
      ...formData,
      phases: [...formData.phases, { name: '', steps: [''] }]
    });
  };

  const addStep = (phaseIndex: number) => {
    const newPhases = [...formData.phases];
    newPhases[phaseIndex]!.steps.push('');
    setFormData({ ...formData, phases: newPhases });
  };

  const updatePhaseName = (phaseIndex: number, name: string) => {
    const newPhases = [...formData.phases];
    newPhases[phaseIndex]!.name = name;
    setFormData({ ...formData, phases: newPhases });
  };

  const updateStep = (phaseIndex: number, stepIndex: number, value: string) => {
    const newPhases = [...formData.phases];
    newPhases[phaseIndex]!.steps[stepIndex] = value;
    setFormData({ ...formData, phases: newPhases });
  };

  if (!plan && !showCreateForm) {
    return (
      <div className="task-list">
        <div className="empty-state">
          <p>No plan loaded</p>
          <button onClick={() => setShowCreateForm(true)} className="button button-primary">
            Create New Plan
          </button>
        </div>
      </div>
    );
  }

  if (showCreateForm) {
    return (
      <div className="task-list">
        <div className="create-plan-form">
          <h3>Create New Plan</h3>

          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Plan title"
            />
          </div>

          <div className="form-group">
            <label>Goal</label>
            <textarea
              value={formData.goal}
              onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
              placeholder="What is the goal of this plan?"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Phases</label>
            {formData.phases.map((phase, phaseIndex) => (
              <div key={phaseIndex} className="phase-form">
                <input
                  type="text"
                  value={phase.name}
                  onChange={(e) => updatePhaseName(phaseIndex, e.target.value)}
                  placeholder={`Phase ${phaseIndex + 1} name`}
                  className="phase-name-input"
                />
                {phase.steps.map((step, stepIndex) => (
                  <input
                    key={stepIndex}
                    type="text"
                    value={step}
                    onChange={(e) => updateStep(phaseIndex, stepIndex, e.target.value)}
                    placeholder={`Step ${phaseIndex + 1}.${stepIndex + 1}`}
                    className="step-input"
                  />
                ))}
                <button
                  onClick={() => addStep(phaseIndex)}
                  className="button button-small"
                >
                  + Add Step
                </button>
              </div>
            ))}
            <button onClick={addPhase} className="button button-secondary">
              + Add Phase
            </button>
          </div>

          <div className="button-group">
            <button onClick={handleCreatePlan} className="button button-primary">
              Create Plan
            </button>
            <button onClick={() => setShowCreateForm(false)} className="button button-secondary">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="task-list">
      <div className="plan-header">
        <div>
          <h3>{plan!.title}</h3>
          <p className="plan-goal">{plan!.goal}</p>
        </div>
        <div className="plan-actions">
          <button onClick={onRefresh} className="button button-small">
            Refresh
          </button>
          <button onClick={() => setShowCreateForm(true)} className="button button-small">
            New Plan
          </button>
        </div>
      </div>

      {plan!.questions && plan!.questions.length > 0 && (
        <div className="plan-questions">
          <h4>Questions</h4>
          <ul>
            {plan!.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="phases">
        {plan!.phases.map((phase) => (
          <div key={phase.number} className="phase">
            <h4 className="phase-header">
              Phase {phase.number}: {phase.name}
              <span className="phase-progress">
                {phase.tasks.filter(t => t.status === 'done').length}/{phase.tasks.length}
              </span>
            </h4>
            <div className="tasks">
              {phase.tasks.map((task) => (
                <TaskItem
                  key={task.step}
                  task={task}
                  onUpdate={onTaskUpdate}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {plan!.notes && (
        <div className="plan-notes">
          <h4>Notes</h4>
          <pre>{plan!.notes}</pre>
        </div>
      )}
    </div>
  );
}

interface TaskItemProps {
  task: PlanTask;
  onUpdate: (step: string, update: any) => Promise<void>;
}

function TaskItem({ task, onUpdate }: TaskItemProps) {
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState('');

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'todo': return '☐';
      case 'doing': return '◐';
      case 'done': return '☑';
      case 'blocked': return '⊘';
      case 'review': return '⚠';
    }
  };

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (newStatus === 'blocked' || newStatus === 'review') {
      setShowReason(true);
    } else {
      await onUpdate(task.step, { status: newStatus });
    }
  };

  const handleReasonSubmit = async (status: 'blocked' | 'review') => {
    if (reason.trim()) {
      if (status === 'blocked') {
        await onUpdate(task.step, { status: 'blocked', reason });
      } else {
        await onUpdate(task.step, { status: 'review', note: reason });
      }
      setShowReason(false);
      setReason('');
    }
  };

  return (
    <div className={`task-item task-${task.status}`}>
      <div className="task-main">
        <span className="task-icon">{getStatusIcon(task.status)}</span>
        <span className="task-step">{task.step}</span>
        <span className="task-title">{task.title}</span>
      </div>

      {task.status === 'blocked' && task.blockedReason && (
        <div className="task-detail blocked-reason">
          Blocked: {task.blockedReason}
        </div>
      )}

      {task.status === 'review' && task.reviewNote && (
        <div className="task-detail review-note">
          Review: {task.reviewNote}
        </div>
      )}

      {task.completedDate && (
        <div className="task-detail completed-date">
          Completed: {task.completedDate}
        </div>
      )}

      {showReason ? (
        <div className="task-reason-form">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason..."
            className="reason-input"
          />
          <div className="button-group-inline">
            <button
              onClick={() => handleReasonSubmit(task.status === 'blocked' ? 'blocked' : 'review')}
              className="button button-small"
            >
              Submit
            </button>
            <button
              onClick={() => {
                setShowReason(false);
                setReason('');
              }}
              className="button button-small"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="task-actions">
          {task.status === 'todo' && (
            <button
              onClick={() => handleStatusChange('doing')}
              className="button button-small button-primary"
            >
              Start
            </button>
          )}
          {task.status === 'doing' && (
            <>
              <button
                onClick={() => handleStatusChange('done')}
                className="button button-small button-success"
              >
                Complete
              </button>
              <button
                onClick={() => handleStatusChange('blocked')}
                className="button button-small button-danger"
              >
                Block
              </button>
              <button
                onClick={() => handleStatusChange('review')}
                className="button button-small button-warning"
              >
                Review
              </button>
            </>
          )}
          {(task.status === 'blocked' || task.status === 'review') && (
            <button
              onClick={() => handleStatusChange('doing')}
              className="button button-small"
            >
              Resume
            </button>
          )}
        </div>
      )}
    </div>
  );
}
