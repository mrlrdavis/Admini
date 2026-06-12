// ---------------------------------------------------------------------------
// NotesTab - Meeting notes with structured fields
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { listMeetingNotes, createMeetingNote, updateMeetingNote, deleteMeetingNote, type MeetingNote } from '../services/meetingNotesService';
import { showToast } from './Toast';
import { generateTasksFromContent, isMultipleResult, AITaskServiceError } from '../services/aiTaskService';
import { getClient } from '../services/getClient';
import type { AISuggestedTask } from '../services/aiTaskService';

const MEETING_TYPES = [
  'Observation Pre-Conference',
  'Observation Post-Conference',
  'Staff Meeting',
  'Teacher Meeting',
  'Parent Meeting',
  'Student Meeting',
  'Disciplinary Incident Notes',
] as const;

export interface NotesTabProps {
  userId?: string;
  organizationId?: string;
  onTabChange?: (tabId: string) => void;
}

export function NotesTab({ userId, organizationId, onTabChange }: NotesTabProps) {
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<MeetingNote | null>(null);

  // Form state
  const [formType, setFormType] = useState<string>(MEETING_TYPES[0]);
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formAttendees, setFormAttendees] = useState('');
  const [formContent, setFormContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [taskModal, setTaskModal] = useState<null | { tasks: { title: string; description: string; priority: string; assignee: string; selected: boolean }[] }>(null);
  const [creatingTasks, setCreatingTasks] = useState(false);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  useEffect(() => {
    if (organizationId) {
      listMeetingNotes(organizationId).then(setNotes).catch(() => {}).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [organizationId]);

  function resetForm() {
    setFormType(MEETING_TYPES[0]);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormAttendees('');
    setFormContent('');
    setEditingNote(null);
  }

  function handleEdit(note: MeetingNote) {
    setFormType(note.title?.split(' - ')[0] || MEETING_TYPES[0]);
    setFormDate(note.createdAt || new Date().toISOString().split('T')[0]);
    setFormAttendees(note.attendees?.join(', ') || '');
    setFormContent(note.body || '');
    setEditingNote(note);
    setShowForm(true);
  }

  async function handleSave() {
    if (!formContent.trim() || !organizationId || !userId) return;
    setSaving(true);
    try {
      const payload = {
        organizationId,
        userId,
        title: formType + ' - ' + (formDate ? new Date(formDate + 'T12:00:00').toLocaleDateString() : new Date().toLocaleDateString()),
        body: formContent.trim(),
        attendees: formAttendees ? formAttendees.split(',').map((s: string) => s.trim()) : [],
      };
      if (editingNote) {
        const updated = await updateMeetingNote(editingNote.id, { title: formType + ' - ' + (formDate ? new Date(formDate + 'T12:00:00').toLocaleDateString() : ''), body: formContent.trim(), attendees: formAttendees ? formAttendees.split(',').map((s: string) => s.trim()) : [] });
        setNotes(prev => prev.map(n => n.id === editingNote.id ? updated : n));
      } else {
        const created = await createMeetingNote({ organizationId: organizationId!, userId: userId!, title: formType + ' - ' + (formDate ? new Date(formDate + 'T12:00:00').toLocaleDateString() : new Date().toLocaleDateString()), body: formContent.trim(), attendees: formAttendees ? formAttendees.split(',').map((s: string) => s.trim()) : [] });
        setNotes(prev => [created, ...prev]);
      }
      setShowForm(false);
      resetForm();
      showToast(editingNote ? 'Note updated' : 'Note created');
    } catch {
      showToast('Failed to save note');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(noteId: string) {
    if (!confirm('Delete this note?')) return;
    try {
      await deleteMeetingNote(noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
      showToast('Note deleted');
    } catch {
      showToast('Failed to delete');
    }
  }

  async function handleImportNotes() {
    if (!importFile || !organizationId || !userId) return;
    showToast('Importing notes...');
    try {
      const text = await importFile.text();
      const lines = text.split('\n').filter(l => l.trim());
      let imported = 0;
      for (const line of lines) {
        const body = line.trim();
        if (body) {
          await createMeetingNote({
            organizationId,
            userId,
            title: 'Imported Note - ' + new Date().toLocaleDateString(),
            body,
            attendees: []
          });
          imported++;
        }
      }
      showToast(imported + ' note(s) imported');
      setShowImport(false);
      setImportFile(null);
      // Refresh notes list
      const updated = await listMeetingNotes(organizationId);
      setNotes(updated);
    } catch {
      showToast('Failed to import notes');
    }
  }

  if (loading) return <div className="notes-tab notes-tab--loading"><p>Loading notes...</p></div>;


  async function openTaskModalFromNote(note: MeetingNote) {
    showToast('Analyzing note for tasks...');
    try {
      const result = await generateTasksFromContent(note.body || '', 'note');
      const list = isMultipleResult(result) ? result.tasks : [result];
      setTaskModal({ tasks: list.map(t => ({ title: t.title, description: t.description || '', priority: t.priority || 'normal', assignee: '', selected: true })) });
    } catch (err) {
      const msg = err instanceof AITaskServiceError ? err.message : 'Could not analyze note';
      // Fallback: open modal with a single manual task seeded from the note
      setTaskModal({ tasks: [{ title: (note.body || note.title || '').slice(0, 80), description: note.body || '', priority: 'normal', assignee: '', selected: true }] });
      showToast(msg + ' - review manually');
    }
  }

  async function createSelectedTasks() {
    if (!taskModal) return;
    const selected = taskModal.tasks.filter(t => t.selected && t.title.trim());
    if (selected.length === 0) { setTaskModal(null); return; }
    setCreatingTasks(true);
    try {
      const client = getClient();
      for (const t of selected) {
        const payload: Record<string, unknown> = { title: t.title.trim(), description: t.description || null, priority: t.priority, status: 'open', assigned_to: t.assignee.trim() || null };
        if (userId) payload.created_by = userId;
        if (organizationId) payload.organization_id = organizationId;
        await client.from('tasks').insert(payload);
      }
      showToast(selected.length + (selected.length === 1 ? ' task created' : ' tasks created'), { action: { label: 'View tasks', onClick: () => onTabChange?.('tasks') } });
      setTaskModal(null);
    } catch {
      showToast('Failed to create tasks');
    } finally {
      setCreatingTasks(false);
    }
  }

  return (
    <div className="notes-tab">
      <header className="notes-tab__header">
        <h1 className="notes-tab__title">Notes</h1>
        <button type="button" className="notes-tab__import-btn" onClick={() => setShowImport(v => !v)}>
          Import Notes
        </button>
      </header>

      {showImport && (
        <div className="notes-tab__import-section">
          <p>Upload a .txt or .csv file with one note per line</p>
          <input type="file" accept=".txt,.csv" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
          <div className="notes-tab__import-actions">
            <button type="button" onClick={handleImportNotes} disabled={!importFile}>Import</button>
            <button type="button" onClick={() => { setShowImport(false); setImportFile(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Note Form */}
      {showForm && (
        <div className="notes-tab__form">
          <div className="notes-tab__form-fields">
            <label className="notes-tab__field">
              <span>Meeting Type</span>
              <select value={formType} onChange={e => setFormType(e.target.value)}>
                {MEETING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="notes-tab__field">
              <span>Date</span>
              <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
            </label>
            <label className="notes-tab__field">
              <span>Attendees</span>
              <input type="text" value={formAttendees} onChange={e => setFormAttendees(e.target.value)} placeholder="Names, separated by commas" />
            </label>
          </div>
          <div className="notes-tab__field notes-tab__field--full">
            <span className="notes-tab__field-label">Notes</span>
            <div className="notes-tab__toolbar">
              <button type="button" onClick={() => setFormContent(prev => prev + "**bold**")}>B</button>
              <button type="button" onClick={() => setFormContent(prev => prev + "*italic*")}><em>I</em></button>
              <button type="button" onClick={() => setFormContent(prev => prev + "\n- ")}>List</button>
              <button type="button" onClick={() => setFormContent(prev => prev + "\n[ ] ")}>Task</button>
              <button type="button" onClick={() => setFormContent(prev => prev + "\n---\n")}>Line</button>
            </div>
            <textarea value={formContent} onChange={e => setFormContent(e.target.value)} placeholder="Meeting notes..." rows={10} className="notes-tab__editor" />
            <div className="notes-tab__file-upload">
              <label className="notes-tab__file-upload-btn">
                Attach Files
                <input type="file" multiple style={{display:'none'}} onChange={(e) => { if (e.target.files) setAttachedFiles(prev => [...prev, ...Array.from(e.target.files!)]); }} />
              </label>
              {attachedFiles.length > 0 && (
                <ul className="notes-tab__file-list">
                  {attachedFiles.map((f, i) => (
                    <li key={i} className="notes-tab__file-item">
                      <span>{f.name}</span>
                      <button type="button" onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))} aria-label={'Remove ' + f.name}>X</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="notes-tab__form-actions">
            <button type="button" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</button>
            <button type="button" disabled={!formContent.trim() || saving} onClick={handleSave}>{saving ? 'Saving...' : editingNote ? 'Update' : 'Save Note'}</button>
          </div>
        </div>
      )}

      {/* Notes List */}
      {!showForm && (
        <section className="notes-tab__list">
          {notes.length === 0 ? (
            <p className="notes-tab__empty">No notes yet. Click + to create your first note.</p>
          ) : (
            <ul className="notes-tab__note-list">
              {notes.map(note => (
                <li key={note.id} className="notes-tab__note-card">
                  <div className="notes-tab__note-header">
                    <span className="notes-tab__note-type">{note.title?.split(' - ')[0] || 'Note'}</span>
                    <span className="notes-tab__note-date">{note.createdAt ? new Date(note.createdAt).toLocaleDateString() : ''}</span>
                  </div>
                  {note.attendees?.join(', ') && <span className="notes-tab__note-attendees">Attendees: {note.attendees?.join(', ')}</span>}
                  <p className="notes-tab__note-content">{note.body?.slice(0, 200)}{(note.body?.length || 0) > 200 ? '...' : ''}</p>
                  <div className="notes-tab__note-actions">
                    <button type="button" onClick={() => handleEdit(note)}>Edit</button>
                    <button type="button" onClick={() => openTaskModalFromNote(note)}>Create Task from Note</button>
                    <button type="button" onClick={() => handleDelete(note.id)}>Delete</button>
                  </div>
                  <span className="notes-tab__note-timestamp">Created {new Date(note.createdAt || '').toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* FAB */}
      {!showForm && (
        <button type="button" className="notes-tab__fab" onClick={() => { resetForm(); setShowForm(true); }} aria-label="New Note">+</button>
      )}
      {taskModal && (
        <div className="notes-tab__modal-overlay" onClick={() => setTaskModal(null)}>
          <div className="notes-tab__modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="notes-tab__modal-title">Review suggested tasks</h2>
            <p className="notes-tab__modal-sub">{taskModal.tasks.length} found. Edit, deselect, or create.</p>
            <div className="notes-tab__modal-list">
              {taskModal.tasks.map((t, idx) => (
                <div key={idx} className="notes-tab__modal-task">
                  <input type="checkbox" checked={t.selected} onChange={(e) => setTaskModal(m => m && ({ tasks: m.tasks.map((x, i) => i === idx ? { ...x, selected: e.target.checked } : x) }))} />
                  <div className="notes-tab__modal-fields">
                    <input className="notes-tab__modal-input" value={t.title} placeholder="Task title" onChange={(e) => setTaskModal(m => m && ({ tasks: m.tasks.map((x, i) => i === idx ? { ...x, title: e.target.value } : x) }))} />
                    <textarea className="notes-tab__modal-textarea" value={t.description} placeholder="Description" onChange={(e) => setTaskModal(m => m && ({ tasks: m.tasks.map((x, i) => i === idx ? { ...x, description: e.target.value } : x) }))} />
                    <div className="notes-tab__modal-row">
                      <select value={t.priority} onChange={(e) => setTaskModal(m => m && ({ tasks: m.tasks.map((x, i) => i === idx ? { ...x, priority: e.target.value } : x) }))}>
                        <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
                      </select>
                      <input className="notes-tab__modal-input" value={t.assignee} placeholder="Assignee" onChange={(e) => setTaskModal(m => m && ({ tasks: m.tasks.map((x, i) => i === idx ? { ...x, assignee: e.target.value } : x) }))} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="notes-tab__modal-actions">
              <button type="button" className="notes-tab__modal-cancel" onClick={() => setTaskModal(null)}>Cancel</button>
              <button type="button" className="notes-tab__modal-create" onClick={createSelectedTasks} disabled={creatingTasks}>{creatingTasks ? 'Creating...' : 'Create tasks'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}