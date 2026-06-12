import { useState, useEffect } from 'react';
import { saveCapture } from '../services/captureService';
import { showToast } from './Toast';
import { sendEmail } from '../services/googleIntegrationService';
import { unlockBadge } from './BadgesPanel';
import { generateTaskFromContent, AITaskServiceError } from '../services/aiTaskService';

// Types
interface Observation {
  id: string;
  observeeType: 'student' | 'staff';
  name: string;
  category: string;
  subject?: string;
  classPeriod?: string;
  teachingStandard?: string;
  note: string;
  observer: string;
  timestamp: string;
  createdAt: string;
}

const STUDENT_CATEGORIES = ['Behavior', 'Academic', 'Social', 'Emotional', 'Physical', 'Attendance'];
const STAFF_CATEGORIES = ['Instruction', 'Classroom Management', 'Engagement', 'Differentiation', 'Assessment', 'Professionalism'];
const CLASS_PERIODS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

export interface ObservationsTabProps {
  userId?: string;
  organizationId?: string;
  userName?: string;
  userRole?: string;
}

export function ObservationsTab({ userId, organizationId, userName, userRole }: ObservationsTabProps) {
  // Role guard - only admin/principal can use observations
  const canAccess = userRole === 'admin' || userRole === 'principal';

  const [roster, setRoster] = useState<{ name: string; type: 'student' | 'staff'; grade?: string }[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [observeeType, setObserveeType] = useState<'student' | 'staff'>('student');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [classPeriod, setClassPeriod] = useState<string[]>([]);
  const [teachingStandard, setTeachingStandard] = useState('');
  const [note, setNote] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'student' | 'staff'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Timer mode state
  const [timerMode, setTimerMode] = useState(false);
  const [timerEntries, setTimerEntries] = useState<{ id: string; text: string; time: string }[]>([]);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [currentEntry, setCurrentEntry] = useState('');
  const [timerElapsed, setTimerElapsed] = useState(0);

  // Load data
  useEffect(() => {
    try {
      const rosterRaw = localStorage.getItem('admini_roster_full');
      if (rosterRaw) setRoster(JSON.parse(rosterRaw));
      else {
        // Fallback to old roster format
        const oldRoster = localStorage.getItem('admini_roster');
        if (oldRoster) {
          const names = JSON.parse(oldRoster) as string[];
          setRoster(names.map(n => ({ name: n, type: 'student' as const })));
        }
      }
      const obsRaw = localStorage.getItem('admini_observations_v2');
      if (obsRaw) setObservations(JSON.parse(obsRaw));
    } catch {}
  }, []);

  // Timer elapsed update
  useEffect(() => {
    if (!timerMode || !timerStart) return;
    const interval = setInterval(() => {
      setTimerElapsed(Date.now() - timerStart.getTime());
    }, 1000);
    return () => clearInterval(interval);
  }, [timerMode, timerStart]);

  function saveObservations(obs: Observation[]) {
    setObservations(obs);
    localStorage.setItem('admini_observations_v2', JSON.stringify(obs));
  }



  function resetForm() {
    setName('');
    setCategory([]);
    setSubject('');
    setClassPeriod([]);
    setTeachingStandard('');
    setNote('');
    setEditingId(null);
  }

  function formatElapsed(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
  }

  function handleAddTimerEntry() {
    if (!currentEntry.trim()) return;
    const elapsed = timerStart ? formatElapsed(Date.now() - timerStart.getTime()) : '00:00';
    setTimerEntries(prev => [...prev, {
      id: Date.now().toString(),
      text: currentEntry.trim(),
      time: elapsed,
    }]);
    setCurrentEntry('');
  }

  function handleEndObservation() {
    // Combine all timer entries into a single observation note with timestamps
    const timeline = timerEntries.map(e => '[' + e.time + '] ' + e.text).join('\n');
    const fullNote = timeline;
    
    // Save as a regular observation with the timeline as the note
    const obs: Observation = {
      id: Date.now().toString(),
      observeeType,
      name: name.trim() || 'Unnamed',
      category: category.length > 0 ? category.join(', ') : 'General',
      subject: observeeType === 'staff' ? subject : undefined,
      classPeriod: observeeType === 'staff' && classPeriod.length > 0 ? classPeriod.join(', ') : undefined,
      teachingStandard: observeeType === 'staff' ? teachingStandard : undefined,
      note: fullNote,
      observer: userName || 'Unknown',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
    };

    saveObservations([obs, ...observations]);
    if (organizationId && userId) {
      const text = '[LiveObs/' + observeeType + '] ' + obs.name + ' (' + obs.category + '): ' + timerEntries.length + ' entries over ' + formatElapsed(Date.now() - (timerStart?.getTime() || 0));
      saveCapture({ organizationId, userId, text, mode: 'tap' }).catch(() => {});
    }
    unlockBadge('first-observation');
    showToast('Live observation saved: ' + timerEntries.length + ' entries');
    
    setTimerMode(false);
    setTimerEntries([]);
    setTimerStart(null);
    resetForm();
  }

  function handleSave() {
    if (!name.trim() || !note.trim()) return;

    const obs: Observation = {
      id: editingId || Date.now().toString(),
      observeeType,
      name: name.trim(),
      category: category.length > 0 ? category.join(', ') : 'General',
      subject: observeeType === 'staff' ? subject : undefined,
      classPeriod: observeeType === 'staff' && classPeriod.length > 0 ? classPeriod.join(', ') : undefined,
      teachingStandard: observeeType === 'staff' ? teachingStandard : undefined,
      note: note.trim(),
      observer: userName || 'Unknown',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: editingId ? observations.find(o => o.id === editingId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
    };

    let updated: Observation[];
    if (editingId) {
      updated = observations.map(o => o.id === editingId ? obs : o);
    } else {
      updated = [obs, ...observations];
    }
    saveObservations(updated);

    // Persist to Supabase
    if (organizationId && userId && !editingId) {
      const text = '[Observation/' + observeeType + '] ' + obs.name + ' (' + obs.category + '): ' + obs.note;
      saveCapture({ organizationId, userId, text, mode: 'tap' }).catch(() => {});
    }

    showToast(editingId ? 'Observation updated' : 'Observation saved for ' + name);
    if (!editingId) unlockBadge('first-observation');
    resetForm();
  }

  function handleEdit(obs: Observation) {
    setEditingId(obs.id);
    setObserveeType(obs.observeeType);
    setName(obs.name);
    setCategory(obs.category ? obs.category.split(', ') : []);
    setSubject(obs.subject || '');
    setClassPeriod(obs.classPeriod ? obs.classPeriod.split(', ') : []);
    setTeachingStandard(obs.teachingStandard || '');
    setNote(obs.note);
  }

  function handleDelete(id: string) {
    saveObservations(observations.filter(o => o.id !== id));
    showToast('Observation deleted');
  }

  function handleDownload(obs: Observation) {
    const content = [
      'OBSERVATION REPORT',
      '==================',
      '',
      'Type: ' + obs.observeeType.charAt(0).toUpperCase() + obs.observeeType.slice(1),
      'Name: ' + obs.name,
      'Category: ' + obs.category,
      obs.subject ? 'Subject: ' + obs.subject : '',
      obs.classPeriod ? 'Class Period: ' + obs.classPeriod : '',
      obs.teachingStandard ? 'Teaching Standard: ' + obs.teachingStandard : '',
      '',
      'Observation:',
      obs.note,
      '',
      'Observer: ' + obs.observer,
      'Date: ' + new Date(obs.createdAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      'Time: ' + obs.timestamp,
    ].filter(Boolean).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'observation-' + obs.name.replace(/\s+/g, '-').toLowerCase() + '-' + new Date(obs.createdAt).toISOString().split('T')[0] + '.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleShare(obs: Observation) {
    const subject = 'Observation: ' + obs.name + ' (' + obs.category + ')';
    const html = '<h2>Classroom Observation</h2><p><strong>Student:</strong> ' + obs.name + '</p><p><strong>Category:</strong> ' + obs.category + '</p>' + (obs.subject ? '<p><strong>Subject:</strong> ' + obs.subject + '</p>' : '') + '<p><strong>Notes:</strong> ' + obs.note + '</p><p><strong>Observer:</strong> ' + obs.observer + '</p><p><em>' + new Date(obs.createdAt).toLocaleDateString() + '</em></p>';
    const recipient = prompt('Send observation via email to:');
    if (recipient && recipient.includes('@')) {
      const sent = await sendEmail(recipient, subject, html);
      showToast(sent ? 'Observation shared via email' : 'Failed to send email');
    } else if (recipient) {
      showToast('Please enter a valid email address');
    }
  }

  const filteredObservations = filterType === 'all'
    ? observations
    : observations.filter(o => o.observeeType === filterType);

  const categories = observeeType === 'staff' ? STAFF_CATEGORIES : STUDENT_CATEGORIES;
  const rosterFiltered = roster.filter(r => r.type === observeeType);

  if (!canAccess) {
    return (
      <div className="observations-tab">
        <header className="observations-tab__header">
          <h1 className="observations-tab__title">Observations</h1>
        </header>
        <div className="observations-tab__restricted">
          <p>Observations are restricted to Admin and Principal roles.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="observations-tab">
      <header className="observations-tab__header">
        <h1 className="observations-tab__title">Observations</h1>
        <p className="observations-tab__subtitle">Classroom and staff observations</p>
      </header>

      {/* Roster (managed in Admin tab) */}
      <section className="observations-tab__roster">
        <div className="observations-tab__roster-header">
          <span className="observations-tab__roster-count">
            {roster.length > 0 ? roster.filter(r => r.type === 'student').length + ' students, ' + roster.filter(r => r.type === 'staff').length + ' staff' : 'No roster available'}
          </span>
        </div>
        {roster.length === 0 && <p className="observations-tab__roster-hint">Upload your roster from the Admin tab or connect Google Classroom to populate students and staff here.</p>}
      </section>

      {/* Observee Type Toggle */}
      <div className="observations-tab__type-toggle">
        <button type="button" className={'observations-tab__type-btn' + (observeeType === 'student' ? ' observations-tab__type-btn--active' : '')} onClick={() => { setObserveeType('student'); setName(''); setCategory([]); }}>Student</button>
        <button type="button" className={'observations-tab__type-btn' + (observeeType === 'staff' ? ' observations-tab__type-btn--active' : '')} onClick={() => { setObserveeType('staff'); setName(''); setCategory([]); }}>Staff</button>
      </div>

      {/* Timer Mode UI */}
      {timerMode && (
        <div className="observations-tab__timer-mode">
          <div className="observations-tab__timer-header">
            <span className="observations-tab__timer-clock">
              {formatElapsed(timerElapsed)}
            </span>
            <span className="observations-tab__timer-label">Live Observation: {name || 'Unknown'}</span>
          </div>
          
          <div className="observations-tab__timer-input">
            <input
              type="text"
              className="observations-tab__input"
              placeholder="What are you observing right now?"
              value={currentEntry}
              onChange={(e) => setCurrentEntry(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && currentEntry.trim()) handleAddTimerEntry(); }}
            />
            <button type="button" className="observations-tab__timer-add-btn" onClick={handleAddTimerEntry} disabled={!currentEntry.trim()}>
              Add
            </button>
          </div>

          <ul className="observations-tab__timer-entries">
            {timerEntries.map((entry) => (
              <li key={entry.id} className="observations-tab__timer-entry">
                <span className="observations-tab__timer-entry-time">{entry.time}</span>
                <span className="observations-tab__timer-entry-text">{entry.text}</span>
              </li>
            ))}
          </ul>

          <div className="observations-tab__timer-actions">
            <button type="button" className="observations-tab__save-btn" onClick={handleEndObservation}>
              End Observation
            </button>
            <button type="button" className="observations-tab__cancel-btn" onClick={() => { setTimerMode(false); setTimerEntries([]); setTimerStart(null); }}>
              Cancel
            </button>
          </div>

          {/* AI Summary Placeholder */}
          {timerEntries.length >= 3 && (
            <div className="observations-tab__ai-summary">
              <span className="observations-tab__ai-badge">AI Summary</span>
              <span className="observations-tab__coming-soon">Coming Soon</span>
              <p>AI will summarize glows, grows, and suggestions based on your {timerEntries.length} observations.</p>
            </div>
          )}
        </div>
      )}

      {/* Observation Form */}
      {!timerMode && (
        <section className="observations-tab__form">
          <div className="observations-tab__form-group">
            <label className="observations-tab__form-label">{observeeType === 'staff' ? 'Teacher/Staff' : 'Student'}</label>
            {rosterFiltered.length > 0 ? (
              <select className="observations-tab__select" value={name} onChange={(e) => setName(e.target.value)}>
                <option value="">Select {observeeType}...</option>
                {rosterFiltered.map((r) => <option key={r.name} value={r.name}>{r.name}{r.grade ? ' (Grade ' + r.grade + ')' : ''}</option>)}
              </select>
            ) : (
              <input type="text" className="observations-tab__input" placeholder={observeeType + ' name...'} value={name} onChange={(e) => setName(e.target.value)} />
            )}
          </div>

          <div className="observations-tab__form-group">
            <label className="observations-tab__form-label">Category</label>
            <div className="observations-tab__categories">
              {categories.map((cat) => (
                <button key={cat} type="button" className={'observations-tab__category-pill' + (category.includes(cat) ? ' observations-tab__category-pill--active' : '')} onClick={() => setCategory(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}>{cat}</button>
              ))}
            </div>
          </div>

          {observeeType === 'staff' && (
            <>
              <div className="observations-tab__form-group">
                <label className="observations-tab__form-label">Subject</label>
                <input type="text" className="observations-tab__input" placeholder="e.g., Math, ELA, Science..." value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="observations-tab__form-group">
                <label className="observations-tab__form-label">Class Period</label>
                <div className="observations-tab__categories">
                  {CLASS_PERIODS.map((p) => (
                    <button key={p} type="button" className={'observations-tab__category-pill' + (classPeriod.includes(p) ? ' observations-tab__category-pill--active' : '')} onClick={() => setClassPeriod(prev => prev.includes(p) ? prev.filter(c => c !== p) : [...prev, p])}>{p}</button>
                  ))}
                </div>
              </div>
              <div className="observations-tab__form-group">
                <label className="observations-tab__form-label">Teaching Standard</label>
                <input type="text" className="observations-tab__input" placeholder="e.g., ISTE 1.3, Danielson 3a..." value={teachingStandard} onChange={(e) => setTeachingStandard(e.target.value)} />
              </div>
            </>
          )}

          <div className="observations-tab__form-group">
            <label className="observations-tab__form-label">Observation Notes</label>
            <textarea className="observations-tab__textarea" placeholder="What did you observe?" value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
          </div>

          <div className="observations-tab__form-actions">
            {editingId && <button type="button" className="observations-tab__cancel-btn" onClick={resetForm}>Cancel</button>}
            <button type="button" className="observations-tab__save-btn" disabled={!name.trim() || !note.trim()} onClick={handleSave}>
              {editingId ? 'Update Observation' : 'Save Observation'}
            </button>
          </div>

          {/* Start Live Observation button */}
          {name.trim() && (
            <button type="button" className="observations-tab__timer-start-btn" onClick={() => { setTimerMode(true); setTimerStart(new Date()); setTimerEntries([]); setTimerElapsed(0); }}>
              Start Live Observation
            </button>
          )}
        </section>
      )}

      {/* Filter */}
      <div className="observations-tab__filter">
        <button type="button" className={'observations-tab__filter-btn' + (filterType === 'all' ? ' observations-tab__filter-btn--active' : '')} onClick={() => setFilterType('all')}>All</button>
        <button type="button" className={'observations-tab__filter-btn' + (filterType === 'student' ? ' observations-tab__filter-btn--active' : '')} onClick={() => setFilterType('student')}>Students</button>
        <button type="button" className={'observations-tab__filter-btn' + (filterType === 'staff' ? ' observations-tab__filter-btn--active' : '')} onClick={() => setFilterType('staff')}>Staff</button>
      </div>

      {/* Observations List */}
      <section className="observations-tab__list">
        <h2 className="observations-tab__list-title">Recent Observations ({filteredObservations.length})</h2>
        {filteredObservations.length === 0 ? (
          <p className="observations-tab__empty">No observations yet</p>
        ) : (
          <ul className="observations-tab__observation-list">
            {filteredObservations.slice(0, 25).map((obs) => (
              <li key={obs.id} className="observations-tab__observation-card">
                <div className="observations-tab__observation-header">
                  <strong className="observations-tab__student-name">{obs.name}</strong>
                  <span className="observations-tab__type-badge">{obs.observeeType}</span>
                  <span className="observations-tab__category-badge">{obs.category}</span>
                </div>
                {obs.subject && <span className="observations-tab__detail">Subject: {obs.subject}</span>}
                {obs.classPeriod && <span className="observations-tab__detail">Period: {obs.classPeriod}</span>}
                {obs.teachingStandard && <span className="observations-tab__detail">Standard: {obs.teachingStandard}</span>}
                <p className="observations-tab__observation-note">{obs.note}</p>
                <div className="observations-tab__observation-meta">
                  <span>{obs.observer} &middot; {new Date(obs.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at {obs.timestamp}</span>
                </div>
                <div className="observations-tab__observation-actions">
                  <button type="button" onClick={() => handleEdit(obs)}>Edit</button>
                  <button type="button" onClick={() => handleShare(obs)}>Share</button>
                  <button type="button" onClick={() => handleDownload(obs)}>Download</button>
                  <button type="button" onClick={async () => {
                    showToast("Generating task from observation...");
                    try {
                      const obsContent = `[${obs.observeeType}] ${obs.name} (${obs.category}): ${obs.note}`;
                      const suggestion = await generateTaskFromContent(obsContent, 'observation');
                      showToast("Suggested task: " + suggestion.title, { action: { label: "View", onClick: () => {} } });
                    } catch (err) {
                      if (err instanceof AITaskServiceError) {
                        showToast(err.message, { action: { label: "Create manually", onClick: () => {} } });
                      } else {
                        showToast("Failed to generate task from observation");
                      }
                    }
                  }}>Create Task</button>
                  <button type="button" className="observations-tab__delete-btn" onClick={() => handleDelete(obs.id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
