// ---------------------------------------------------------------------------
// RecommendationsWidget - Displays task recommendation cards on the Dashboard
// ---------------------------------------------------------------------------
// Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 8.1, 8.3

import { useState, useEffect, useCallback } from 'react';
import type { Recommendation } from '@admini/shared';
import { recommendationEngine } from '../services/recommendationEngine';
import { getAppPreferences } from '../services/appPreferencesStorage';
import { getClient } from '../services/getClient';
import { showToast } from './Toast';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RecommendationsWidgetProps {
  userId: string;
  organizationId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Maps source type to a human-readable badge label. */
function sourceTypeBadge(sourceType: Recommendation['sourceType']): string {
  switch (sourceType) {
    case 'capture': return 'Capture';
    case 'meeting_note': return 'Meeting Note';
    case 'calendar_event': return 'Calendar';
    case 'pulse': return 'Pulse';
    default: return 'Source';
  }
}

/** Maps confidence (0-1) to a visual label. */
function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.5) return 'Medium';
  return 'Low';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecommendationsWidget({ userId, organizationId }: RecommendationsWidgetProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Fetch preferences + recommendations on mount
  // -------------------------------------------------------------------------

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await recommendationEngine.getRecommendations(userId, organizationId);
      setRecommendations(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load suggestions');
    } finally {
      setLoading(false);
    }
  }, [userId, organizationId]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Check preference first
      const prefs = await getAppPreferences();
      if (cancelled) return;

      setEnabled(prefs.taskRecommendationsEnabled);

      if (!prefs.taskRecommendationsEnabled) {
        setLoading(false);
        return;
      }

      await fetchRecommendations();
    }

    init();
    return () => { cancelled = true; };
  }, [fetchRecommendations]);

  // -------------------------------------------------------------------------
  // Accept handler - creates task from recommendation
  // -------------------------------------------------------------------------

  const handleAccept = useCallback(async (recommendation: Recommendation) => {
    setAcceptingId(recommendation.id);
    try {
      const client = getClient();
      const insertPayload: Record<string, unknown> = {
        title: recommendation.title,
        priority: recommendation.suggestedPriority,
        status: 'open',
        created_by: userId,
        organization_id: organizationId,
      };

      const { error: insertError } = await client
        .from('tasks')
        .insert(insertPayload)
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message || 'Failed to create task');
      }

      // Mark handled in the engine
      await recommendationEngine.markHandled(recommendation.id, 'accepted');

      // Remove card from display
      setRecommendations(prev => prev.filter(r => r.id !== recommendation.id));

      showToast(`Task "${recommendation.title}" created`);
    } catch (err) {
      // Requirement 4.4: show error, keep card visible
      showToast(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setAcceptingId(null);
    }
  }, [userId, organizationId]);

  // -------------------------------------------------------------------------
  // Dismiss handler - removes recommendation
  // -------------------------------------------------------------------------

  const handleDismiss = useCallback(async (recommendation: Recommendation) => {
    setDismissingId(recommendation.id);
    try {
      await recommendationEngine.markHandled(recommendation.id, 'dismissed');

      // Remove card with fade (CSS class handles animation)
      setRecommendations(prev => prev.filter(r => r.id !== recommendation.id));
    } catch {
      // Non-critical - card stays visible on error
    } finally {
      setDismissingId(null);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Don't render if preference is disabled (Requirement 3.4)
  // -------------------------------------------------------------------------

  if (enabled === false) {
    return null;
  }

  // Still checking preferences
  if (enabled === null) {
    return null;
  }

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <section className="recommendations-widget" aria-busy="true">
        <header className="recommendations-widget__header">
          <h2>Suggested Tasks</h2>
        </header>
        <div className="recommendations-widget__loading">
          <p>Loading suggestions...</p>
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // Error state (Requirement 8.1)
  // -------------------------------------------------------------------------

  if (error) {
    return (
      <section className="recommendations-widget" role="alert">
        <header className="recommendations-widget__header">
          <h2>Suggested Tasks</h2>
        </header>
        <div className="recommendations-widget__error">
          <p>{error}</p>
          <button
            type="button"
            className="recommendations-widget__retry-btn"
            onClick={fetchRecommendations}
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // Empty state (Requirement 3.3)
  // -------------------------------------------------------------------------

  if (recommendations.length === 0) {
    return (
      <section className="recommendations-widget">
        <header className="recommendations-widget__header">
          <h2>Suggested Tasks</h2>
        </header>
        <div className="recommendations-widget__empty">
          <p>Start capturing notes to get task suggestions</p>
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // Render recommendation cards (Requirement 3.2)
  // -------------------------------------------------------------------------

  return (
    <section className="recommendations-widget">
      <header className="recommendations-widget__header">
        <h2>Suggested Tasks</h2>
      </header>
      <ul className="recommendations-widget__list">
        {recommendations.map(rec => (
          <li
            key={rec.id}
            className={`recommendations-widget__card${dismissingId === rec.id ? ' recommendations-widget__card--dismissing' : ''}`}
          >
            <div className="recommendations-widget__card-content">
              <h3 className="recommendations-widget__card-title">{rec.title}</h3>
              <p className="recommendations-widget__card-excerpt">{rec.sourceExcerpt}</p>
              <div className="recommendations-widget__card-meta">
                <span className="recommendations-widget__badge">{sourceTypeBadge(rec.sourceType)}</span>
                <span className={`recommendations-widget__confidence recommendations-widget__confidence--${confidenceLabel(rec.confidence).toLowerCase()}`}>
                  {confidenceLabel(rec.confidence)} confidence
                </span>
              </div>
            </div>
            <div className="recommendations-widget__card-actions">
              <button
                type="button"
                className="recommendations-widget__accept-btn"
                onClick={() => handleAccept(rec)}
                disabled={acceptingId === rec.id}
                aria-label={`Accept recommendation: ${rec.title}`}
              >
                {acceptingId === rec.id ? 'Creating...' : 'Accept'}
              </button>
              <button
                type="button"
                className="recommendations-widget__dismiss-btn"
                onClick={() => handleDismiss(rec)}
                disabled={dismissingId === rec.id}
                aria-label={`Dismiss recommendation: ${rec.title}`}
              >
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
