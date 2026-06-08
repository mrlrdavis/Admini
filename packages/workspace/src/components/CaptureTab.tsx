// ---------------------------------------------------------------------------
// CaptureTab - Voice/Tap capture interface for quick observations and notes.
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { saveCapture, loadCaptures, type Capture } from '../services/captureService';
import { SkeletonCard } from '@admini/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CaptureMode = 'voice' | 'tap';

interface QuickCapture {
  id: string;
  text: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Word Board Categories
// ---------------------------------------------------------------------------

const WORD_BOARD_CATEGORIES = {
  Who: ['Student', 'Teacher', 'Parent', 'Staff', 'Group', 'Class'],
  What: ['Behavior', 'Academic', 'Social', 'Emotional', 'Physical', 'Other'],
  Urgency: ['Low', 'Normal', 'High', 'Urgent'],
  Domain: ['Classroom', 'Playground', 'Office', 'Hallway', 'Library', 'Gym'],
  Where: ['Room 101', 'Room 102', 'Main Hall', 'Field', 'Cafeteria', 'Lab'],
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface CaptureTabProps {
  loading?: boolean;
  userId?: string;
  organizationId?: string;
}

export function CaptureTab({ loading, userId, organizationId }: CaptureTabProps) {
  const [mode, setMode] = useState<CaptureMode>('voice');
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [selectedWords, setSelectedWords] = useState<Record<string, string>>({});
  const [captures, setCaptures] = useState<QuickCapture[]>([]);
  const [saving, setSaving] = useState(false);

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

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleMicToggle() {
    setIsRecording((prev) => !prev);
    if (!isRecording) {
      // Simulate transcription start (UI shell only)
      setTranscription('');
    }
  }

  function handleWordSelect(category: string, word: string) {
    setSelectedWords((prev) => ({
      ...prev,
      [category]: prev[category] === word ? '' : word,
    }));
  }

  function handleQuickCapture() {
    const text = mode === 'voice'
      ? transcription
      : Object.entries(selectedWords)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`)
          .join(' \u00b7 ');

    if (!text) return;

    const capture: QuickCapture = {
      id: Date.now().toString(),
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Optimistic UI update
    setCaptures((prev) => [capture, ...prev]);
    setTranscription('');
    setSelectedWords({});

    // Persist to Supabase if configured
    if (organizationId && userId) {
      setSaving(true);
      saveCapture({ organizationId, userId, text, mode })
        .then((saved) => {
          setCaptures((prev) => prev.map((c) => c.id === capture.id ? { ...c, id: saved.id } : c));
        })
        .catch(() => { /* keep optimistic entry */ })
        .finally(() => setSaving(false));
    }
  }

  // -------------------------------------------------------------------------
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
          className={`capture-tab__mode-btn ${mode === 'voice' ? 'capture-tab__mode-btn--active' : ''}`}
          onClick={() => setMode('voice')}
        >
          Voice
        </button>
        <button
          type="button"
          className={`capture-tab__mode-btn ${mode === 'tap' ? 'capture-tab__mode-btn--active' : ''}`}
          onClick={() => setMode('tap')}
        >
          Tap
        </button>
        <span
          className={`capture-tab__mode-indicator ${mode === 'tap' ? 'capture-tab__mode-indicator--tap' : ''}`}
          aria-hidden="true"
        />
      </div>

      {/* Voice Mode */}
      {mode === 'voice' && (
        <section className="capture-tab__voice-mode">
          <div className="capture-tab__mic-area">
            <button
              type="button"
              className={`capture-tab__mic-btn ${isRecording ? 'capture-tab__mic-btn--recording' : ''}`}
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
            </div>
            <p className="capture-tab__ai-text">
              Start speaking to get AI-powered categorization suggestions.
            </p>
          </div>
        </section>
      )}

      {/* Tap Mode */}
      {mode === 'tap' && (
        <section className="capture-tab__tap-mode">
          <div className="capture-tab__word-board">
            {Object.entries(WORD_BOARD_CATEGORIES).map(([category, words]) => (
              <div key={category} className="capture-tab__category-row">
                <span className="capture-tab__category-label">{category}</span>
                <div className="capture-tab__pills">
                  {words.map((word) => (
                    <button
                      key={word}
                      type="button"
                      className={`capture-tab__pill ${selectedWords[category] === word ? 'capture-tab__pill--active' : ''}`}
                      onClick={() => handleWordSelect(category, word)}
                    >
                      {word}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Selected summary */}
          {Object.values(selectedWords).some(Boolean) && (
            <div className="capture-tab__selection-summary">
              {Object.entries(selectedWords)
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <span key={k} className="capture-tab__selection-tag">
                    {k}: {v}
                  </span>
                ))}
            </div>
          )}
        </section>
      )}

      {/* Save Button */}
      <button
        type="button"
        className="capture-tab__save-btn"
        onClick={handleQuickCapture}
      >
        Save Capture
      </button>

      {/* Quick Captures List */}
      <section className="capture-tab__captures">
        <h2 className="capture-tab__captures-title">Recent Captures</h2>
        {captures.length === 0 ? (
          <p className="capture-tab__empty">No captures yet</p>
        ) : (
          <ul className="capture-tab__capture-list">
            {captures.map((capture) => (
              <li key={capture.id} className="capture-tab__capture-item">
                <span className="capture-tab__capture-text">{capture.text}</span>
                <span className="capture-tab__capture-time">{capture.timestamp}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
