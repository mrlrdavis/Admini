// ---------------------------------------------------------------------------
// NotesTab - Meeting notes with structured fields
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { listMeetingNotes, createMeetingNote, updateMeetingNote, deleteMeetingNote, type MeetingNote } from '../services/meetingNotesService';
import { showToast } from './Toast';

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
}

export function NotesTab({ userId, organizationId }: NotesTabProps) {
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
    setFormType((note as any).meetingType || MEETING_TYPES[0]);
    setFormDate(note.date || new Date().toISOString().split('T')[0]);
    setFormAttendees((note as any).attendees || '');
    setFormContent(note.content || '');
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
        title: formType + ' - ' + new Date(formDate).toLocaleDateString(),
        content: formContent.trim(),
        date: formDate,
        meetingType: formType,
        attendees: formAttendees,
      };
      if (editingNote) {
        const updated = await updateMeetingNote(editingNote.id, payload);
        setNotes(prev => prev.map(n => n.id === editingNote.id ? updated : n));
      } else {
        const created = await createMeetingNote(payload as any);
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

  if (loading) return <div className="notes-tab notes-tab--loading"><p>Loading notes...</p></div>;

  return (
    <div className="notes-tab">
      <header className="notes-tab__header">
        <h1 className="notes-tab__title">Notes</h1>
      </header>

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
          <label className="notes-tab__field notes-tab__field--full">
            <span>Notes</span>
            <textarea value={formContent} onChange={e => setFormContent(e.target.value)} placeholder="Meeting notes..." rows={8} />
          </label>
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
                    <span className="notes-tab__note-type">{(note as any).meetingType || 'Note'}</span>
                    <span className="notes-tab__note-date">{note.date ? new Date(note.date).toLocaleDateString() : ''}</span>
                  </div>
                  {(note as any).attendees && <span className="notes-tab__note-attendees">Attendees: {(note as any).attendees}</span>}
                  <p className="notes-tab__note-content">{note.content?.slice(0, 200)}{(note.content?.length || 0) > 200 ? '...' : ''}</p>
                  <div className="notes-tab__note-actions">
                    <button type="button" onClick={() => handleEdit(note)}>Edit</button>
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
    </div>
  );
}