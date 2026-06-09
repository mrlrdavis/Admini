import {
  type Recommendation,
  type RecommendationContext,
  type RecommendationProvider,
  type RecommendationSource,
  type TaskPriority,
  createClientId,
  nowIso,
} from '@admini/shared';

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

interface ActionPattern {
  /** Lower-cased phrase to match */
  phrase: string;
  /** Confidence boost for this pattern (added to base confidence) */
  confidenceBoost: number;
  /** Suggested priority when this pattern fires */
  suggestedPriority: TaskPriority;
}

/**
 * Ordered list of action phrases – more specific / higher-signal phrases first.
 * Confidence values are in [0.0, 1.0]; the base value is 0.5 and each pattern
 * can boost it further.
 */
const ACTION_PATTERNS: ActionPattern[] = [
  { phrase: 'action item',  confidenceBoost: 0.40, suggestedPriority: 'high'   },
  { phrase: 'dont forget',  confidenceBoost: 0.35, suggestedPriority: 'high'   },
  { phrase: 'reminder',     confidenceBoost: 0.30, suggestedPriority: 'normal' },
  { phrase: 'follow up',    confidenceBoost: 0.25, suggestedPriority: 'normal' },
  { phrase: 'todo',         confidenceBoost: 0.25, suggestedPriority: 'normal' },
  { phrase: 'need to',      confidenceBoost: 0.20, suggestedPriority: 'normal' },
  { phrase: 'should',       confidenceBoost: 0.10, suggestedPriority: 'low'    },
];

const BASE_CONFIDENCE = 0.5;
const MAX_TITLE_LENGTH = 200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Split text into sentences using common sentence-ending punctuation.
 */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Extract a clean task title from a sentence that matched an action pattern.
 * Strategy: strip the matched phrase prefix and its leading punctuation/whitespace,
 * then take up to MAX_TITLE_LENGTH chars.  Falls back to the whole sentence
 * (truncated) when stripping yields nothing useful.
 */
function extractTitle(sentence: string, matchedPhrase: string): string {
  const lower = sentence.toLowerCase();
  const idx = lower.indexOf(matchedPhrase);

  let candidate = sentence;

  if (idx !== -1) {
    // Take everything after the matched phrase
    const after = sentence.slice(idx + matchedPhrase.length).trim();
    if (after.length >= 3) {
      // Capitalise first letter
      candidate = after.charAt(0).toUpperCase() + after.slice(1);
    }
  }

  // Strip trailing punctuation
  candidate = candidate.replace(/[.!?,;:]+$/, '').trim();

  // Enforce max length
  if (candidate.length > MAX_TITLE_LENGTH) {
    candidate = candidate.slice(0, MAX_TITLE_LENGTH).trim();
  }

  // Fall back to the original sentence (trimmed) if extraction was empty
  if (candidate.length === 0) {
    candidate = sentence.replace(/[.!?,;:]+$/, '').trim().slice(0, MAX_TITLE_LENGTH);
  }

  return candidate;
}

/**
 * Compute a confidence score clamped to [0.0, 1.0].
 */
function computeConfidence(boost: number): number {
  return Math.min(1.0, Math.max(0.0, BASE_CONFIDENCE + boost));
}

/**
 * Find the first matching pattern in a lower-cased sentence.
 * Returns the matched pattern or null.
 */
function findPattern(lowerSentence: string): ActionPattern | null {
  for (const pattern of ACTION_PATTERNS) {
    if (lowerSentence.includes(pattern.phrase)) {
      return pattern;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// RuleBasedProvider
// ---------------------------------------------------------------------------

export class RuleBasedProvider implements RecommendationProvider {
  async generateRecommendations(context: RecommendationContext): Promise<Recommendation[]> {
    const results: Recommendation[] = [];

    // --- Scan recent captures ---
    for (const capture of context.recentCaptures) {
      if (results.length >= context.maxResults) break;

      const text = capture.redactedText ?? '';
      const sentences = splitIntoSentences(text);

      for (const sentence of sentences) {
        if (results.length >= context.maxResults) break;

        const pattern = findPattern(sentence.toLowerCase());
        if (!pattern) continue;

        const title = extractTitle(sentence, pattern.phrase);
        if (!title) continue;

        results.push({
          id: createClientId('rec'),
          title,
          sourceType: 'capture' as RecommendationSource,
          sourceId: capture.id,
          sourceExcerpt: sentence.slice(0, 200),
          confidence: computeConfidence(pattern.confidenceBoost),
          suggestedPriority: pattern.suggestedPriority,
          createdAt: nowIso(),
        });
      }
    }

    // --- Scan recent meeting notes ---
    for (const note of context.recentMeetingNotes) {
      if (results.length >= context.maxResults) break;

      // Scan both title and body
      const combinedText = [note.title, note.body].filter(Boolean).join('. ');
      const sentences = splitIntoSentences(combinedText);

      for (const sentence of sentences) {
        if (results.length >= context.maxResults) break;

        const pattern = findPattern(sentence.toLowerCase());
        if (!pattern) continue;

        const title = extractTitle(sentence, pattern.phrase);
        if (!title) continue;

        results.push({
          id: createClientId('rec'),
          title,
          sourceType: 'meeting_note' as RecommendationSource,
          sourceId: note.id,
          sourceExcerpt: sentence.slice(0, 200),
          confidence: computeConfidence(pattern.confidenceBoost),
          suggestedPriority: pattern.suggestedPriority,
          createdAt: nowIso(),
        });
      }
    }

    return results;
  }
}

export const ruleBasedProvider = new RuleBasedProvider();
