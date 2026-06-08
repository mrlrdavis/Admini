import { useState, useEffect } from 'react';
import { saveCapture } from '../services/captureService';
import { showToast } from './Toast';

interface Observation {
  id: string;
  student: string;
  category: string;
  note: string;
  observer: string;
  timestamp: string;
  createdAt: string;
}

const CATEGORIES = ['Behavior', 'Academic', 'Social', 'Emotional', 'Physical', 'Attendance', 'General'];

export interface ObservationsTabProps {
  userId?: string;
  organizationId?: string;
  userName?: string;
}

export function ObservationsTab({ userId, organizationId, userName }: ObservationsTabProps) {
  const [roster, setRoster] = useState<string[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [student, setStudent] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [filter, setFilter] = useState<'all' | string>('all');
  const [rosterFile, setRosterFile] = useState<File | null>(null);

  // Load roster and observations from localStorage
  useEffect(() => {
    try {
      const rosterRaw = localStorage.getItem('admini_roster');
      if (rosterRaw) setRoster(JSON.parse(rosterRaw));
      const obsRaw = localStorage.getItem('admini_observations');
      if (obsRaw) setObservations(JSON.parse(obsRaw));
    } catch {}
  }, []);

  function handleRosterUpload(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      const names = lines.slice(1).map(l => l.split(',')[0]?.trim()).filter((n): n is string => Boolean(n));
      setRoster(names);
      localStorage.setItem('admini_roster', JSON.stringify(names));
      showToast('Roster uploaded: ' + names.length + ' students');
    };
    reader.readAsText(file);
  }

  function handleSaveObservation() {
    if (!student.trim() || !note.trim()) return;

    const obs: Observation = {
      id: Date.now().toString(),
      student: student.trim(),
      category: category || 'General',
      note: note.trim(),
      observer: userName || 'Unknown',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
    };

    const updated = [obs, ...observations];
    setObservations(updated);
    localStorage.setItem('admini_observations', JSON.stringify(updated));

    // Persist to Supabase as a capture
    if (organizationId && userId) {
      const text = '[Observation] ' + obs.student + ' (' + obs.category + '): ' + obs.note;
      saveCapture({ organizationId, userId, text, mode: 'tap' }).catch(() => {});
    }

    showToast('Observation saved for ' + student);
    setStudent('');
    setCategory('');
    setNote('');
  }

  function handleDeleteObservation(id: string) {
    const updated = observations.filter(o => o.id !== id);
    setObservations(updated);
    localStorage.setItem('admini_observations', JSON.stringify(updated));
  }

  const filteredObservations = filter === 'all'
    ? observations
    : observations.filter(o => o.student === filter);

  return (
    <div className="observations-tab">
      <header className="observations-tab__header">
        <h1 className="observations-tab__title">Observations</h1>
        <p className="observations-tab__subtitle">Track student and staff observations</p>
      </header>

      {/* Roster Upload */}
      <section className="observations-tab__roster">
        <div className="observations-tab__roster-header">
          <span className="observations-tab__roster-count">
            {roster.length > 0 ? roster.length + ' students loaded' : 'No roster uploaded'}
          </span>
          <label className="observations-tab__upload-btn">
            Upload Roster (CSV)
            <input
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleRosterUpload(file);
              }}
            />
          </label>
        </div>
      </section>

      {/* New Observation Form */}
      <section className="observations-tab__form">
        <div className="observations-tab__form-group">
          <label className="observations-tab__form-label">Student</label>
          {roster.length > 0 ? (
            <select
              className="observations-tab__select"
              value={student}
              onChange={(e) => setStudent(e.target.value)}
            >
              <option value="">Select student...</option>
              {roster.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              className="observations-tab__input"
              placeholder="Student name..."
              value={student}
              onChange={(e) => setStudent(e.target.value)}
            />
          )}
        </div>

        <div className="observations-tab__form-group">
          <label className="observations-tab__form-label">Category</label>
          <div className="observations-tab__categories">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={'observations-tab__category-pill' + (category === cat ? ' observations-tab__category-pill--active' : '')}
                onClick={() => setCategory(category === cat ? '' : cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="observations-tab__form-group">
          <label className="observations-tab__form-label">Observation</label>
          <textarea
            className="observations-tab__textarea"
            placeholder="What did you observe?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
        </div>

        <button
          type="button"
          className="observations-tab__save-btn"
          disabled={!student.trim() || !note.trim()}
          onClick={handleSaveObservation}
        >
          Save Observation
        </button>
      </section>

      {/* Filter by student */}
      {roster.length > 0 && observations.length > 0 && (
        <div className="observations-tab__filter">
          <select
            className="observations-tab__select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Students</option>
            {roster.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Observations List */}
      <section className="observations-tab__list">
        <h2 className="observations-tab__list-title">Recent Observations</h2>
        {filteredObservations.length === 0 ? (
          <p className="observations-tab__empty">No observations yet</p>
        ) : (
          <ul className="observations-tab__observation-list">
            {filteredObservations.slice(0, 20).map((obs) => (
              <li key={obs.id} className="observations-tab__observation-card">
                <div className="observations-tab__observation-header">
                  <strong className="observations-tab__student-name">{obs.student}</strong>
                  <span className="observations-tab__category-badge">{obs.category}</span>
                  <button
                    type="button"
                    className="observations-tab__delete-btn"
                    onClick={() => handleDeleteObservation(obs.id)}
                    aria-label="Delete observation"
                  >
                    &times;
                  </button>
                </div>
                <p className="observations-tab__observation-note">{obs.note}</p>
                <div className="observations-tab__observation-meta">
                  <span>{obs.observer}</span>
                  <span>{new Date(obs.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at {obs.timestamp}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
