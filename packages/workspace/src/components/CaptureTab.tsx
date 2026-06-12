// ---------------------------------------------------------------------------
// CaptureTab - Voice/Tap/Notes capture interface for quick captures and notes.
// ---------------------------------------------------------------------------

import { useState, useEffect, useRef, useCallback } from 'react';
import { saveCapture, loadCaptures, deleteCapture, type Capture } from '../services/captureService';
import {
  listMeetingNotes,
  createMeetingNote,
  updateMeetingNote,
  deleteMeetingNote,
  type MeetingNote,
} from '../services/meetingNotesService';
import { SkeletonCard } from '@admini/ui';
import { showToast } from './Toast';
import { unlockBadge } from './BadgesPanel';
import { getClient } from '../services/getClient';
import { generateTaskFromContent, AITaskServiceError } from '../services/aiTaskService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CaptureMode = 'voice' | 'tap' | 'notes';

interface QuickCapture {
  id: string;
  text: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Word Board Categories
// ---------------------------------------------------------------------------

const DEFAULT_TAP_CATEGORIES: Record<string, string[]> = {
  Who: ['Student', 'Teacher', 'Parent', 'Staff', 'Class'],
  What: ['Behavior', 'Academic', 'Social', 'Emotional', 'Physical', 'Other'],
  Urgency: ['Low', 'Normal', 'High', 'Urgent'],
  Where: ['Classroom', 'Hallway', 'Office', 'Cafeteria', 'Library', 'Gym', 'Playground', 'Field'],
};

function loadTapCategories(): Record<string, string[]> {
  try { const s = localStorage.getItem('admini_tap_categories'); if (s) return JSON.parse(s); } catch {}
  return DEFAULT_TAP_CATEGORIES;
}

const WORD_BOARD_CATEGORIES = loadTapCategories();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface CaptureTabProps {
  loading?: boolean;
  userId?: string;
  organizationId?: string;
}

export function CaptureTab({ loading, userId, organizationId }: CaptureTabProps) {
  const [mode, setMode] = useState<CaptureMode>(() => {
    try {
      const saved = localStorage.getItem('admini_capture_mode');
      if (saved === 'tap' || saved === 'notes') {
        localStorage.removeItem('admini_capture_mode');
        return saved;
      }
    } catch {}
    return 'voice';
  });
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [selectedWords, setSelectedWords] = useState<Record<string, string[]>>({});
  const [tapFreeText, setTapFreeText] = useState('');
  const [captures, setCaptures] = useState<QuickCapture[]>([]);
  const [expandedCaptureId, setExpandedCaptureId] = useState<string | null>(null);
  const [editingCaptureId, setEditingCaptureId] = useState<string | null>(null);
  const [editCaptureText, setEditCaptureText] = useState('');
  const [saving, setSaving] = useState(false);

  // Roster integration for Tap mode Students category
  const [roster, setRoster] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('admini_roster');
      if (raw) setRoster(JSON.parse(raw));
    } catch {}
  }, []);



  const [taskSuggestionId, setTaskSuggestionId] = useState<string | null>(null);
  const [lastCaptureText, setLastCaptureText] = useState<string | null>(null);
  const [showTaskSuggestion, setShowTaskSuggestion] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalTitle, setTaskModalTitle] = useState('');
  const [taskModalDesc, setTaskModalDesc] = useState('');
  const [taskModalDue, setTaskModalDue] = useState('');
  const [taskModalPriority, setTaskModalPriority] = useState<'low'|'normal'|'high'|'urgent'>('normal');
  const [taskModalAssignee, setTaskModalAssignee] = useState('');
  const [taskModalSaving, setTaskModalSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Meeting Notes state
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteView, setNoteView] = useState<'list' | 'editor'>('list');
  const [editingNote, setEditingNote] = useState<MeetingNote | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteAttendees, setNoteAttendees] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSearch, setNoteSearch] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted captures on mount
  useEffect(() => {
    if (!organizationId) return;
    loadCaptures(organizationId).then((saved) => {
      setCaptures(saved.map((c) => ({
        id: c.id,
        text: c.text,
        timestamp: new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      })));
    }).catch(() => { /* silent fallback to empty */ });
  }, [organizationId]);

  // Load meeting notes when mode is notes
  const loadNotes = useCallback(async (search?: string) => {
    if (!organizationId) return;
    setNotesLoading(true);
    setNoteError(null);
    try {
      const result = await listMeetingNotes(organizationId, { search, limit: 50 });
      setNotes(result);
    } catch (err: any) {
      setNoteError(err.message || 'Failed to load notes');
    } finally {
      setNotesLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (mode === 'notes' && organizationId) {
      loadNotes();
    }
  }, [mode, organizationId, loadNotes]);

  // Debounced search for notes
  useEffect(() => {
    if (mode !== 'notes') return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      loadNotes(noteSearch || undefined);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [noteSearch, mode, loadNotes]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleMicToggle() {
    if (isRecording) {
      setIsRecording(false);
      return;
    }

    // Use Web Speech API for transcription
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setTranscription('[Speech recognition not supported in this browser]');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let finalText = '';
      for (let i = 0; i < event.results.length; i++) {
        finalText += event.results[i][0].transcript;
      }
      setTranscription(finalText);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    setIsRecording(true);
    setTranscription('');

    // Cleanup: stop after 60s max
    setTimeout(() => {
      recognition.stop();
    }, 60000);
  }

  function handleWordSelect(category: string, word: string) {
    setSelectedWords((prev) => {
      const current = prev[category] || [];
      if (current.includes(word)) {
        return { ...prev, [category]: current.filter(w => w !== word) };
      }
      return { ...prev, [category]: [...current, word] };
    });
  }

  function handleQuickCapture() {
    let text: string;
    if (mode === 'voice') {
      text = transcription;
    } else {
      const wordsText = Object.entries(selectedWords)
      // Summarize tap selections into a natural sentence
      const entries = Object.entries(selectedWords).filter(([, v]) => v.length > 0);
      const freeText = tapFreeText.trim();
      if (entries.length > 0) {
        const parts: string[] = [];
        entries.forEach(([, words]) => {
          if (words.length === 1) {
            parts.push(words[0]!);
          } else {
            parts.push(words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1]);
          }
        });
        text = parts.join('; ');
        if (freeText) text += '. ' + freeText;
      } else {
        text = freeText;
      }
    }

    if (!text) return;

    const capture: QuickCapture = {
      id: Date.now().toString(),
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Optimistic UI update
    setCaptures((prev) => [capture, ...prev]);
    unlockBadge('first-capture');
    setTaskSuggestionId(capture.id);
    setTimeout(() => setTaskSuggestionId(null), 8000);
    setLastCaptureText(text);
    setShowTaskSuggestion(true);
    setTranscription('');
    setSelectedWords({});
    setTapFreeText('');

    // Persist to Supabase if configured
    if (organizationId && userId) {
      setSaving(true);
      saveCapture({ organizationId, userId, text, mode: mode === 'voice' ? 'voice' : 'tap' })
        .then((saved) => {
          setCaptures((prev) => prev.map((c) => c.id === capture.id ? { ...c, id: saved.id } : c));
        })
        .catch(() => { /* keep optimistic entry */ })
        .finally(() => setSaving(false));
    }
  }

  async function handleDeleteCapture(captureId: string, e: React.MouseEvent) {
    e.stopPropagation();
    // Only delete from Supabase if it is a real UUID (not a Date.now() string)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(captureId);
    if (isUuid) {
      try {
        await deleteCapture(captureId);
      } catch {
        // silently fail - still remove from UI
      }
    }
    setCaptures((prev) => prev.filter((c) => c.id !== captureId));
  }

  function handleSaveEditCapture(captureId: string) {
    if (!editCaptureText.trim()) return;
    setCaptures(prev => prev.map(c => c.id === captureId ? { ...c, text: editCaptureText.trim() } : c));
    setEditingCaptureId(null);
    setEditCaptureText('');
  }

  // Meeting Notes Handlers
  function handleNewNote() {
    setEditingNote(null);
    setNoteTitle('');
    setNoteBody('');
    setNoteAttendees('');
    setNoteError(null);
    setNoteView('editor');
  }

  function handleEditNote(note: MeetingNote) {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteBody(note.body);
    setNoteAttendees(note.attendees.join(', '));
    setNoteError(null);
    setNoteView('editor');
  }

  function handleCancelNoteEdit() {
    setNoteView('list');
    setEditingNote(null);
    setNoteTitle('');
    setNoteBody('');
    setNoteAttendees('');
    setNoteError(null);
  }

  function insertFormat(prefix: string, suffix: string) {
    const textarea = document.getElementById('note-body') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = noteBody.substring(start, end);
    const before = noteBody.substring(0, start);
    const after = noteBody.substring(end);
    const formatted = prefix + selected + suffix;
    setNoteBody(before + formatted + after);
    // Restore cursor position after React re-render
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 0);
  }

  async function handleSaveNote() {
    if (!noteTitle.trim()) {
      setNoteError('Title is required');
      return;
    }
    if (!organizationId || !userId) {
      setNoteError('Missing organization or user context');
      return;
    }

    setNoteSaving(true);
    setNoteError(null);
    const attendees = noteAttendees.split(',').map((a) => a.trim()).filter(Boolean);

    try {
      if (editingNote) {
        const updated = await updateMeetingNote(editingNote.id, {
          title: noteTitle.trim(),
          body: noteBody,
          attendees,
        });
        setNotes((prev) => prev.map((n) => n.id === updated.id ? updated : n));
      } else {
        const created = await createMeetingNote({
          organizationId,
          userId,
          title: noteTitle.trim(),
          body: noteBody,
          attendees,
        });
        setNotes((prev) => [created, ...prev]);
        unlockBadge('first-note');
      }
      handleCancelNoteEdit();
      // Show task suggestion from note content
      if (noteBody.trim()) {
        setLastCaptureText(noteTitle + ': ' + noteBody.slice(0, 100));
        setShowTaskSuggestion(true);
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to save note';
      if (msg.includes('policy') || msg.includes('permission') || msg.includes('security')) {
        setNoteError('Unable to save. Please complete onboarding to set up your organization first.');
      } else {
        setNoteError(msg);
      }
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleDeleteNote(noteId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await deleteMeetingNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err: any) {
      setNoteError(err.message || 'Failed to delete note');
    }
  }

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="capture-tab capture-tab--loading" aria-busy="true">
        <SkeletonCard height={60} />
        <SkeletonCard height={48} />
        <SkeletonCard height={200} />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="capture-tab">
      {/* Header */}
      <header className="capture-tab__header">
        <h1 className="capture-tab__title">Capture</h1>
        <p className="capture-tab__subtitle">Quick observations</p>
      </header>

      {/* Mode Toggle */}
      <div className="capture-tab__mode-toggle">
        <button
          type="button"
          className={'capture-tab__mode-btn' + (mode === 'voice' ? ' capture-tab__mode-btn--active' : '')}
          onClick={() => setMode('voice')}
        >
          Voice
        </button>
        <button
          type="button"
          className={'capture-tab__mode-btn' + (mode === 'tap' ? ' capture-tab__mode-btn--active' : '')}
          onClick={() => setMode('tap')}
        >
          Tap
        </button>
        <span
          className={'capture-tab__mode-indicator' + (mode === 'tap' ? ' capture-tab__mode-indicator--tap' : mode === 'notes' ? ' capture-tab__mode-indicator--notes' : '')}
          aria-hidden="true"
        />
      </div>

      {/* Voice Mode */}
      {mode === 'voice' && (
        <section className="capture-tab__voice-mode">
          <div className="capture-tab__mic-area">
            <button
              type="button"
              className={'capture-tab__mic-btn' + (isRecording ? ' capture-tab__mic-btn--recording' : '')}
              onClick={handleMicToggle}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
            <span className="capture-tab__mic-label">
              {isRecording ? 'Listening...' : 'Tap to speak'}
            </span>
          </div>

          {/* Transcription Area */}
          <div className="capture-tab__transcription">
            {transcription ? (
              <p className="capture-tab__transcription-text">{transcription}</p>
            ) : (
              <p className="capture-tab__transcription-placeholder">
                {isRecording ? 'Speak now...' : 'Your transcription will appear here'}
              </p>
            )}
          </div>

          {/* AI Suggestion Card */}
          <div className="capture-tab__ai-suggestion">
            <div className="capture-tab__ai-suggestion-header">
              <svg className="capture-tab__ai-sparkle" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                <path d="M8 0l1.5 5.5L16 8l-6.5 2.5L8 16l-1.5-5.5L0 8l6.5-2.5z" fill="currentColor"/>
              </svg>
              <span className="capture-tab__ai-badge">AI</span>
              <span className="capture-tab__ai-label">Suggestion</span>
              <span className="capture-tab__coming-soon-badge">Coming Soon</span>
            </div>
            <p className="capture-tab__ai-text">
              Start speaking to get AI-powered categorization suggestions.
            </p>
          </div>
        </section>
      )}

      {/* Tap Mode */}
      {mode === 'tap' && (() => {
        const dynamicCategories = roster.length > 0
          ? { ...WORD_BOARD_CATEGORIES, Students: roster.slice(0, 12) }
          : WORD_BOARD_CATEGORIES;
        return (
        <section className="capture-tab__tap-mode">
          <div className="capture-tab__word-board">
            {Object.entries(dynamicCategories).map(([category, words]) => (
              <div key={category} className="capture-tab__category-row">
                <span className="capture-tab__category-label">{category}</span>
                <div className="capture-tab__pills">
                  {words.map((word) => (
                    <button
                      key={word}
                      type="button"
                      className={'capture-tab__pill' + ((selectedWords[category] || []).includes(word) ? ' capture-tab__pill--active' : '')}
                      onClick={() => handleWordSelect(category, word)}
                    >
                      {word}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Free-text input */}
          <textarea
            className="capture-tab__tap-freetext"
            placeholder="Add a note..."
            value={tapFreeText}
            onChange={(e) => setTapFreeText(e.target.value)}
          />

          {/* Selected summary */}
          {Object.values(selectedWords).some(arr => arr.length > 0) && (
            <div className="capture-tab__selection-summary">
              {Object.entries(selectedWords)
                .filter(([, v]) => v.length > 0)
                .map(([k, v]) => (
                  <span key={k} className="capture-tab__selection-tag">
                    {k}: {v.join(', ')}
                  </span>
                ))}
            </div>
          )}
        </section>
        );
      })()}

      {/* Notes Mode */}
      {mode === 'notes' && (
        <section className="capture-tab__notes-mode">
          {noteView === 'list' && (
            <>
              <div className="capture-tab__notes-header">
                <input
                  type="text"
                  className="capture-tab__notes-search"
                  placeholder="Search notes..."
                  value={noteSearch}
                  onChange={(e) => setNoteSearch(e.target.value)}
                  aria-label="Search meeting notes"
                />
                <button
                  type="button"
                  className="capture-tab__new-note-btn"
                  onClick={handleNewNote}
                >
                  New Note
                </button>
              </div>

              {noteError && <p className="capture-tab__note-error">{noteError}</p>}

              {notesLoading ? (
                <>
                  <SkeletonCard height={56} />
                  <SkeletonCard height={56} />
                </>
              ) : notes.length === 0 ? (
                <p className="capture-tab__notes-empty">No meeting notes yet</p>
              ) : (
                <ul className="capture-tab__notes-list">
                  {notes.map((note) => (
                    <li
                      key={note.id}
                      className="capture-tab__note-card"
                      onClick={() => handleEditNote(note)}
                    >
                      <div className="capture-tab__note-info">
                        <span className="capture-tab__note-title">{note.title}</span>
                        <span className="capture-tab__note-meta">
                          {new Date(note.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          {note.attendees.length > 0 && ' \u00b7 ' + note.attendees.length + ' attendees'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="capture-tab__note-delete-btn"
                        onClick={(e) => handleDeleteNote(note.id, e)}
                        aria-label="Delete note"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {noteView === 'editor' && (
            <div className="capture-tab__note-editor">
              <div className="capture-tab__note-editor-field">
                <label className="capture-tab__note-editor-label" htmlFor="note-title">Title</label>
                <input
                  id="note-title"
                  type="text"
                  className="capture-tab__note-editor-input"
                  placeholder="Meeting title..."
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  required
                />
              </div>

              <div className="capture-tab__note-editor-field">
                <label className="capture-tab__note-editor-label" htmlFor="note-body">Body</label>
                <div className="capture-tab__note-toolbar">
                  <button type="button" title="Bold" onClick={() => insertFormat('**', '**')}><strong>B</strong></button>
                  <button type="button" title="Italic" onClick={() => insertFormat('_', '_')}><em>I</em></button>
                  <button type="button" title="Underline" onClick={() => insertFormat('<u>', '</u>')}>U&#x0332;</button>
                  <button type="button" title="Strikethrough" onClick={() => insertFormat('~~', '~~')}>S&#x0336;</button>
                  <span className="capture-tab__toolbar-divider" />
                  <button type="button" title="Heading 1" onClick={() => insertFormat('# ', '')}>H1</button>
                  <button type="button" title="Heading 2" onClick={() => insertFormat('## ', '')}>H2</button>
                  <button type="button" title="Heading 3" onClick={() => insertFormat('### ', '')}>H3</button>
                  <span className="capture-tab__toolbar-divider" />
                  <button type="button" title="Bullet List" onClick={() => insertFormat('- ', '')}>{'\u2022'}</button>
                  <button type="button" title="Numbered List" onClick={() => insertFormat('1. ', '')}>1.</button>
                  <button type="button" title="Checkbox" onClick={() => insertFormat('- [ ] ', '')}>{'\u2610'}</button>
                  <button type="button" title="Checked" onClick={() => insertFormat('- [x] ', '')}>{'\u2611'}</button>
                  <span className="capture-tab__toolbar-divider" />
                  <button type="button" title="Quote" onClick={() => insertFormat('> ', '')}>{'\u201C'}</button>
                  <button type="button" title="Code" onClick={() => insertFormat('`', '`')}>&lt;/&gt;</button>
                  <button type="button" title="Horizontal Rule" onClick={() => insertFormat('\n---\n', '')}>&#x2014;</button>
                </div>
                <textarea
                  id="note-body"
                  className="capture-tab__note-editor-textarea"
                  placeholder="Meeting notes..."
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                />
              </div>

              <div className="capture-tab__note-editor-field">
                <label className="capture-tab__note-editor-label" htmlFor="note-attendees">Attendees (comma-separated)</label>
                <input
                  id="note-attendees"
                  type="text"
                  className="capture-tab__note-editor-input"
                  placeholder="John, Jane, Mike..."
                  value={noteAttendees}
                  onChange={(e) => setNoteAttendees(e.target.value)}
                />
              </div>

              {noteError && <p className="capture-tab__note-error">{noteError}</p>}

              <div className="capture-tab__note-editor-actions">
                <button
                  type="button"
                  className="capture-tab__note-cancel-btn"
                  onClick={handleCancelNoteEdit}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="capture-tab__note-save-btn"
                  onClick={handleSaveNote}
                  disabled={noteSaving || !noteTitle.trim()}
                >
                  {noteSaving ? 'Saving...' : editingNote ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}


      {/* Save Button - only for voice/tap modes */}
      {mode !== 'notes' && (
        <button
          type="button"
          className="capture-tab__save-btn"
          onClick={handleQuickCapture}
        >
          Save Capture
        </button>
      )}

      {/* Task suggestion from capture */}
      {showTaskSuggestion && lastCaptureText && (
        <div className="capture-tab__task-suggestion">
          <p className="capture-tab__task-suggestion-text">Create a task from this capture?</p>
          <div className="capture-tab__task-suggestion-actions">
            <button
              type="button"
              className="capture-tab__task-suggestion-btn"
              onClick={async () => {
                setShowTaskSuggestion(false);
                setAiLoading(true);
                setTaskModalOpen(true);
                try {
                  const suggestion = await generateTaskFromContent(lastCaptureText || '', 'capture');
                  setTaskModalTitle(suggestion.title);
                  setTaskModalDesc(suggestion.description);
                  setTaskModalDue(suggestion.dueDate || '');
                  setTaskModalPriority(suggestion.priority || 'normal');
                  setTaskModalAssignee(suggestion.assignee || '');
                } catch (err) {
                  if (err instanceof AITaskServiceError) {
                    showToast(err.message, { action: { label: 'Create manually', onClick: () => {
                      setTaskModalTitle(lastCaptureText ? lastCaptureText.slice(0, 100) : '');
                      setTaskModalDesc(lastCaptureText && lastCaptureText.length > 100 ? lastCaptureText : '');
                      setTaskModalDue('');
                      setTaskModalPriority('normal');
                      setTaskModalAssignee('');
                    }}});
                  } else {
                    showToast('Failed to generate task suggestions');
                  }
                  setTaskModalTitle(lastCaptureText ? lastCaptureText.slice(0, 100) : '');
                  setTaskModalDesc(lastCaptureText && lastCaptureText.length > 100 ? lastCaptureText : '');
                  setTaskModalDue('');
                  setTaskModalPriority('normal');
                  setTaskModalAssignee('');
                } finally {
                  setAiLoading(false);
                }
              }}
            >
              Create Task
            </button>
            <button
              type="button"
              className="capture-tab__task-suggestion-dismiss"
              onClick={() => setShowTaskSuggestion(false)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Quick Captures List - only for voice/tap modes */}
      {mode !== 'notes' && (
        <section className="capture-tab__captures">
          <h2 className="capture-tab__captures-title">Recent Captures</h2>
          {captures.length === 0 ? (
            <p className="capture-tab__empty">No captures yet</p>
          ) : (
            <ul className="capture-tab__capture-list">
              {captures.map((capture) => {
                const isExpanded = expandedCaptureId === capture.id;
                const isEditing = editingCaptureId === capture.id;
                const isTruncatable = capture.text.length > 80;
                return (
                  <li key={capture.id} className="capture-tab__capture-item" onClick={() => !isEditing && setExpandedCaptureId(isExpanded ? null : capture.id)}>
                    {isEditing ? (
                      <div className="capture-tab__edit-inline" onClick={(e) => e.stopPropagation()}>
                        <textarea
                          className="capture-tab__edit-textarea"
                          value={editCaptureText}
                          onChange={(e) => setEditCaptureText(e.target.value)}
                          rows={3}
                        />
                        <div className="capture-tab__edit-actions">
                          <button type="button" className="capture-tab__edit-save" onClick={() => handleSaveEditCapture(capture.id)}>Save</button>
                          <button type="button" className="capture-tab__edit-cancel" onClick={() => setEditingCaptureId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className={`capture-tab__capture-text${isTruncatable && !isExpanded ? ' capture-tab__capture-text--truncated' : ''}`}>
                          {isTruncatable && !isExpanded ? capture.text.slice(0, 80) + '...' : capture.text}
                        </span>
                        <span className="capture-tab__capture-time">{capture.timestamp}</span>
                        <button type="button" className="capture-tab__capture-edit-btn" onClick={(e) => { e.stopPropagation(); setEditingCaptureId(capture.id); setEditCaptureText(capture.text); }} aria-label="Edit capture">&#x270E;</button>
                        <button type="button" className="capture-tab__note-delete-btn" onClick={(e) => handleDeleteCapture(capture.id, e)} aria-label="Delete capture">&times;</button>
                        {taskSuggestionId === capture.id && (
                          <button
                            type="button"
                            className="capture-tab__task-suggest-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              showToast('Task suggestion: Open Tasks tab to create from "' + capture.text.slice(0, 40) + '..."');
                              setTaskSuggestionId(null);
                            }}
                          >
                            ? Create Task from this
                          </button>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Task Creation Modal */}
      {taskModalOpen && (
        <div className="capture-tab__task-modal-overlay" onClick={() => setTaskModalOpen(false)}>
          <div className="capture-tab__task-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="capture-tab__task-modal-title">Create Task from Capture</h2>
            {aiLoading && <p className="capture-tab__task-modal-loading">Generating AI suggestions...</p>}
            <div className="capture-tab__task-modal-form">
              <label>Title<input type="text" value={taskModalTitle} onChange={(e) => setTaskModalTitle(e.target.value)} className="capture-tab__task-modal-input" /></label>
              <label>Description<textarea value={taskModalDesc} onChange={(e) => setTaskModalDesc(e.target.value)} className="capture-tab__task-modal-textarea" /></label>
              <label>Due Date<input type="date" value={taskModalDue} onChange={(e) => setTaskModalDue(e.target.value)} className="capture-tab__task-modal-input" /></label>
              <label>Priority
                <select value={taskModalPriority} onChange={(e) => setTaskModalPriority(e.target.value as any)} className="capture-tab__task-modal-input">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              <label>Assign To<input type="text" value={taskModalAssignee} onChange={(e) => setTaskModalAssignee(e.target.value)} placeholder="Name or email" className="capture-tab__task-modal-input" /></label>
            </div>
            <div className="capture-tab__task-modal-actions">
              <button type="button" onClick={() => setTaskModalOpen(false)}>Cancel</button>
              <button type="button" disabled={!taskModalTitle.trim() || taskModalSaving} onClick={async () => {
                if (!organizationId || !userId) return;
                setTaskModalSaving(true);
                try {
                  const client = getClient();
                  await client.from("tasks").insert({
                    organization_id: organizationId,
                    created_by: userId,
                    title: taskModalTitle.trim(),
                    description: taskModalDesc.trim() || null,
                    due_at: taskModalDue || null,
                    priority: taskModalPriority,
                    assigned_to: taskModalAssignee.trim() || null,
                    status: "open",
                  });
                  setTaskModalOpen(false);
                  showToast("Task created", { action: { label: "View on Calendar", onClick: () => { localStorage.setItem("admini_tasks_view", "calendar"); window.dispatchEvent(new CustomEvent("admini-navigate", { detail: "tasks" })); } } });
                } catch {
                  showToast("Failed to create task", { action: { label: "Retry", onClick: () => { /* re-trigger save with preserved fields */ document.querySelector<HTMLButtonElement>(".capture-tab__task-modal-actions button:last-child")?.click(); } } });
                } finally {
                  setTaskModalSaving(false);
                }
              }}>{taskModalSaving ? "Creating..." : "Create Task"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
