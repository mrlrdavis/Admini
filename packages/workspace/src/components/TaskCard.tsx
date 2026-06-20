// ---------------------------------------------------------------------------
// TaskCard - Collapsible task card with subtask checkboxes and editing
// ---------------------------------------------------------------------------
// Pure presentational component. Renders a task card that can be expanded
// to show subtasks, category tag, and block reason.
// Property 9: Parent checkbox disabled when any subtask.completed === false
// Requirements: 8.1, 8.3, 8.4, 8.5, 8.6

import { useState } from 'react';
import type { CategoryRegistry } from '@admini/shared';
import { getCategoryStyle } from '@admini/shared';
import type { TaskWithSubtasks, Subtask } from './TaskSection';
import '../styles/task-card.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaskCardProps {
  task: TaskWithSubtasks;
  registry: CategoryRegistry;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSubtaskToggle?: (subtaskId: string) => void;
  onSubtaskEdit?: (subtaskId: string, updates: { title?: string; assignee?: string; dueAt?: string; priority?: string }) => void;
  onSubtaskAdd?: (subtask: { title: string; assignee?: string; dueAt?: string; priority?: string }) => void;
  onSubtaskDelete?: (subtaskId: string) => void;
  onDuplicate?: () => void;
  onStatusChange?: (status: string) => void;
  onEdit?: (updates: { title?: string; description?: string; dueAt?: string; priority?: string; assignee?: string; blockReason?: string }) => void;
  onDelete?: () => void;
  /** Staff roster names for assignee auto-suggest */
  staffRoster?: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDueDate(dueAt?: string): string | null {
  if (!dueAt) return null;
  const datePart = dueAt.split('T')[0] ?? dueAt;
  const [y, m, d] = datePart.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isDueDateOverdue(dueAt?: string): boolean {
  if (!dueAt) return false;
  const datePart = dueAt.split('T')[0] ?? dueAt;
  const [y, m, d] = datePart.split('-').map(Number);
  const dueDate = new Date(y!, m! - 1, d!);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskCard({
  task,
  registry,
  isExpanded,
  onToggleExpand,
  onSubtaskToggle,
  onSubtaskEdit,
  onSubtaskAdd,
  onSubtaskDelete,
  onDuplicate,
  onStatusChange,
  onEdit,
  onDelete,
  staffRoster,
}: TaskCardProps) {
  const completedSubtasks = task.subtasks.filter(s => s.completed).length;
  const totalSubtasks = task.subtasks.length;
  const allSubtasksComplete = totalSubtasks > 0 && completedSubtasks === totalSubtasks;
  const hasIncompleteSubtasks = totalSubtasks > 0 && !allSubtasksComplete;

  const categoryStyle = task.category
    ? getCategoryStyle(task.category.id, registry)
    : undefined;

  const dueDateStr = formatDueDate(task.dueAt);
  const overdue = isDueDateOverdue(task.dueAt) && task.status !== 'completed';

  const [editing, setEditing] = useState(false);
  const [eTitle, setETitle] = useState(task.title);
  const [eDesc, setEDesc] = useState(task.description || '');
  const [eDue, setEDue] = useState(task.dueAt ? (task.dueAt.split('T')[0] || '') : '');
  const [ePriority, setEPriority] = useState(task.priority);
  const [eAssignee, setEAssignee] = useState(task.assignee || '');
  const [blockReason, setBlockReason] = useState(task.blockReason || '');
  
  // Subtask editing state
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editSubtaskTitle, setEditSubtaskTitle] = useState('');
  const [editSubtaskAssignee, setEditSubtaskAssignee] = useState('');
  const [editSubtaskDueAt, setEditSubtaskDueAt] = useState('');
  const [editSubtaskPriority, setEditSubtaskPriority] = useState('');
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState('');
  const [newSubtaskDueAt, setNewSubtaskDueAt] = useState('');
  const [newSubtaskPriority, setNewSubtaskPriority] = useState('normal');

  function saveEdit() {
    onEdit?.({ title: eTitle.trim(), description: eDesc.trim(), dueAt: eDue || undefined, priority: ePriority, assignee: eAssignee.trim() || undefined });
    setEditing(false);
  }

  function startEditSubtask(subtask: Subtask) {
    setEditingSubtaskId(subtask.id);
    setEditSubtaskTitle(subtask.title);
    setEditSubtaskAssignee(subtask.assignee || '');
    setEditSubtaskDueAt(subtask.dueAt ? (subtask.dueAt.split('T')[0] || '') : '');
    setEditSubtaskPriority(subtask.priority || 'normal');
  }

  function saveSubtaskEdit(subtaskId: string) {
    if (editSubtaskTitle.trim() && onSubtaskEdit) {
      onSubtaskEdit(subtaskId, { title: editSubtaskTitle.trim(), assignee: editSubtaskAssignee.trim() || undefined, dueAt: editSubtaskDueAt || undefined, priority: editSubtaskPriority || undefined });
    }
    setEditingSubtaskId(null);
    setEditSubtaskTitle('');
    setEditSubtaskAssignee('');
    setEditSubtaskDueAt('');
    setEditSubtaskPriority('');
  }

  function cancelSubtaskEdit() {
    setEditingSubtaskId(null);
    setEditSubtaskTitle('');
    setEditSubtaskAssignee('');
    setEditSubtaskDueAt('');
    setEditSubtaskPriority('');
  }

  function handleAddSubtask() {
    if (newSubtaskTitle.trim() && onSubtaskAdd) {
      onSubtaskAdd({ title: newSubtaskTitle.trim(), assignee: newSubtaskAssignee.trim() || undefined, dueAt: newSubtaskDueAt || undefined, priority: newSubtaskPriority || undefined });
      setNewSubtaskTitle('');
      setNewSubtaskAssignee('');
      setNewSubtaskDueAt('');
      setNewSubtaskPriority('normal');
      setShowAddSubtask(false);
    }
  }

  return (
    <article
      className={`task-card task-card--priority-${task.priority}`}
      aria-label={`Task: ${task.title}`}
    >
      {/* Collapsed header - always visible */}
      <div className="task-card__header" onClick={onToggleExpand}>
        <button
          type="button"
          className={`task-card__expand-btn${isExpanded ? ' task-card__expand-btn--expanded' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse task' : 'Expand task'}
        >
          &#x25B6;
        </button>

        <input
          type="checkbox"
          className="task-card__parent-checkbox"
          checked={task.status === 'completed'}
          disabled={hasIncompleteSubtasks || !onStatusChange}
          onChange={() => onStatusChange?.(task.status === 'completed' ? 'open' : 'completed')}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Mark "${task.title}" as ${task.status === 'completed' ? 'open' : 'completed'}`}
          title={hasIncompleteSubtasks ? 'Complete all subtasks first' : undefined}
        />

        <span className="task-card__title">{task.title}</span>

        <div className="task-card__meta">
          {dueDateStr && (
            <span className={`task-card__due-date${overdue ? ' task-card__due-date--overdue' : ''}`}>
              {dueDateStr}
            </span>
          )}
          {totalSubtasks > 0 && (
            <span className="task-card__progress">
              {completedSubtasks}/{totalSubtasks}
            </span>
          )}
        </div>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className="task-card__body">
          {staffRoster && staffRoster.length > 0 && (
            <datalist id={'assignee-suggestions-' + task.id}>
              {staffRoster.map((name) => <option key={name} value={name} />)}
            </datalist>
          )}

          {/* Blocked reason banner - always visible when blocked */}
          {task.status === 'archived' && (
            <div className="task-card__blocked-banner">
              <span className="task-card__blocked-icon">🚫</span>
              <span className="task-card__blocked-text">
                {task.blockReason || task.description || 'This task is blocked'}
              </span>
            </div>
          )}

          {/* Task description - always visible when expanded */}
          {task.description ? (
            <p className="task-card__description">{task.description}</p>
          ) : (
            <p className="task-card__description task-card__description--empty">No description</p>
          )}

          {/* Subtask checkboxes with edit capability */}
          {totalSubtasks > 0 && (
            <ul className="task-card__subtasks" aria-label="Subtasks">
              {task.subtasks.map((subtask) => (
                <li key={subtask.id} className="task-card__subtask">
                  <input
                    type="checkbox"
                    className="task-card__subtask-checkbox"
                    checked={subtask.completed}
                    disabled={!onSubtaskToggle}
                    onChange={() => onSubtaskToggle?.(subtask.id)}
                    aria-label={`Subtask: ${subtask.title}`}
                  />
                  {editingSubtaskId === subtask.id ? (
                    <div className="task-card__subtask-edit">
                      <input
                        className="task-card__subtask-edit-input"
                        value={editSubtaskTitle}
                        onChange={(e) => setEditSubtaskTitle(e.target.value)}
                        autoFocus
                        placeholder="Title"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveSubtaskEdit(subtask.id);
                          if (e.key === 'Escape') cancelSubtaskEdit();
                        }}
                      />
                      <div className="task-card__subtask-edit-details">
                        <input className="task-card__subtask-edit-input" placeholder="Assignee" value={editSubtaskAssignee} onChange={(e) => setEditSubtaskAssignee(e.target.value)} style={{maxWidth:'120px'}} list={'assignee-suggestions-' + task.id} />
                        <input type="date" className="task-card__subtask-edit-input" value={editSubtaskDueAt} onChange={(e) => setEditSubtaskDueAt(e.target.value)} style={{maxWidth:'140px'}} />
                        <select className="task-card__subtask-edit-input" value={editSubtaskPriority} onChange={(e) => setEditSubtaskPriority(e.target.value)} style={{maxWidth:'100px'}}>
                          <option value="low">Low</option>
                          <option value="normal">Normal</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        className="task-card__subtask-save-btn"
                        onClick={() => saveSubtaskEdit(subtask.id)}
                        aria-label="Save subtask"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        className="task-card__subtask-cancel-btn"
                        onClick={cancelSubtaskEdit}
                        aria-label="Cancel edit"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`task-card__subtask-label${subtask.completed ? ' task-card__subtask-label--completed' : ''}`}
                      onDoubleClick={() => onSubtaskEdit && startEditSubtask(subtask)}
                      title="Double-click to edit"
                    >
                      <span className="task-card__subtask-title-text">{subtask.title}</span>
                      {(subtask.assignee || subtask.dueAt) && (
                        <span className="task-card__subtask-details">
                          {subtask.assignee && <span className="task-card__subtask-detail">Assigned to {subtask.assignee}</span>}
                          {subtask.dueAt && <span className="task-card__subtask-detail">Due {formatDueDate(subtask.dueAt)}</span>}
                        </span>
                      )}
                      {onSubtaskEdit && (
                        <button
                          type="button"
                          className="task-card__subtask-edit-btn"
                          onClick={(e) => { e.stopPropagation(); startEditSubtask(subtask); }}
                          aria-label={`Edit subtask ${subtask.title}`}
                        >
                          ✎
                        </button>
                      )}
                      {onSubtaskDelete && (
                        <button
                          type="button"
                          className="task-card__subtask-delete-btn"
                          onClick={(e) => { e.stopPropagation(); onSubtaskDelete(subtask.id); }}
                          aria-label={`Delete subtask ${subtask.title}`}
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Add subtask form */}
          {onSubtaskAdd && (
            <div className="task-card__add-subtask">
              {showAddSubtask ? (
                <div className="task-card__add-subtask-form">
                  <input
                    className="task-card__add-subtask-input"
                    placeholder="Subtask title..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newSubtaskTitle.trim()) handleAddSubtask();
                      if (e.key === 'Escape') { setShowAddSubtask(false); setNewSubtaskTitle(''); }
                    }}
                  />
                  <div className="task-card__add-subtask-details">
                    <input className="task-card__add-subtask-input" placeholder="Assignee" value={newSubtaskAssignee} onChange={(e) => setNewSubtaskAssignee(e.target.value)} style={{maxWidth:'120px'}} list={'assignee-suggestions-' + task.id} />
                    <input type="date" className="task-card__add-subtask-input" value={newSubtaskDueAt} onChange={(e) => setNewSubtaskDueAt(e.target.value)} style={{maxWidth:'140px'}} />
                  </div>
                  <button
                    type="button"
                    className="task-card__add-subtask-save"
                    onClick={handleAddSubtask}
                    disabled={!newSubtaskTitle.trim()}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    className="task-card__add-subtask-cancel"
                    onClick={() => { setShowAddSubtask(false); setNewSubtaskTitle(''); }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="task-card__add-subtask-btn"
                  onClick={() => setShowAddSubtask(true)}
                >
                  + Add subtask
                </button>
              )}
            </div>
          )}

          {/* Category tag */}
          {categoryStyle && (
            <span
              className="task-card__category-tag"
              style={{
                backgroundColor: `var(${categoryStyle.colorToken}, ${categoryStyle.colorHex})`,
              }}
            >
              {categoryStyle.label}
            </span>
          )}

          {/* Block reason */}
          {task.blockReason && task.status !== 'archived' && (
            <p className="task-card__block-reason">{task.blockReason}</p>
          )}

          {/* Inline edit form */}
          {editing ? (
            <div className="task-card__edit-form">
              <label className="task-card__edit-label">Title
                <input className="task-card__edit-input" value={eTitle} onChange={(e) => setETitle(e.target.value)} />
              </label>
              <label className="task-card__edit-label">Description
                <textarea className="task-card__edit-textarea" value={eDesc} onChange={(e) => setEDesc(e.target.value)} />
              </label>
              <div className="task-card__edit-row">
                <label className="task-card__edit-label">Due date
                  <input type="date" className="task-card__edit-input" value={eDue} onChange={(e) => setEDue(e.target.value)} />
                </label>
                <label className="task-card__edit-label">Priority
                  <select className="task-card__edit-input" value={ePriority} onChange={(e) => setEPriority(e.target.value as typeof ePriority)}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
              </div>
              <label className="task-card__edit-label">Assignee
                <input className="task-card__edit-input" value={eAssignee} onChange={(e) => setEAssignee(e.target.value)} placeholder="Email or name" list={'assignee-suggestions-' + task.id} />

              </label>
              <div className="task-card__actions">
                <button type="button" className="task-card__action-btn task-card__action-btn--primary" onClick={saveEdit}>Save</button>
                <button type="button" className="task-card__action-btn" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="task-card__actions">
              {onEdit && (
                <button type="button" className="task-card__action-btn" onClick={() => setEditing(true)} aria-label={`Edit task "${task.title}"`}>Edit</button>
              )}
              {onDuplicate && (
                <button type="button" className="task-card__action-btn" onClick={onDuplicate} aria-label={`Duplicate task "${task.title}"`}>Duplicate</button>
              )}
              {onDelete && (
                <button type="button" className="task-card__action-btn task-card__action-btn--danger" onClick={onDelete} aria-label={`Delete task "${task.title}"`}>Delete</button>
              )}
              {onStatusChange && (
                <select className="task-card__status-select" value={task.status} onChange={(e) => onStatusChange(e.target.value)} aria-label="Change task status">
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Blocked</option>
                </select>
              )}
              {task.status === 'archived' && (<div style={{display:'flex',gap:'6px',marginTop:'6px',width:'100%'}}><input className="task-card__edit-input" placeholder="Block reason..." value={blockReason} onChange={(e) => setBlockReason(e.target.value)} style={{flex:1}} /><button type="button" className="task-card__action-btn" onClick={() => onEdit?.({ blockReason })} aria-label="Save block reason">Save</button></div>)}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
