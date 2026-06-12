// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AI_TASK_TIMEOUT_MS = 15_000; // 15 second timeout
const AI_ENDPOINT_PATH = '/api/ai/generate-task';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskSource = 'capture' | 'note' | 'observation';

export interface AISuggestedTask {
  title: string;
  description: string;
  assignee?: string;
  dueDate?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  source: TaskSource;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export interface AISuggestedTaskSet {
  tasks: AISuggestedTask[];
  multiple: true;
}

export type AITaskResult = AISuggestedTask | AISuggestedTaskSet;

export function isMultipleResult(r: AITaskResult): r is AISuggestedTaskSet {
  return 'multiple' in r && r.multiple === true;
}

export async function generateTasksFromContent(
  content: string,
  source: TaskSource,
): Promise<AITaskResult> {
  const apiBase = getApiBase();
  if (!apiBase) throw new AITaskServiceError('AI service is not configured.', 'NOT_CONFIGURED');
  if (!content.trim()) throw new AITaskServiceError('Content cannot be empty.', 'EMPTY_CONTENT');
  try {
    const response = await fetchWithTimeout(
      `${apiBase}${AI_ENDPOINT_PATH}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, source }) },
      AI_TASK_TIMEOUT_MS,
    );
    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new AITaskServiceError(`AI service error (HTTP ${response.status}). ${errBody}`, 'API_ERROR');
    }
    const data = await response.json();
    if (data && data.multiple && Array.isArray(data.tasks)) {
      return { tasks: data.tasks.map((t: any) => ({ title: t.title || '', description: t.description || '', priority: t.priority, source, confidence: t.confidence || 0.8 })), multiple: true };
    }
    if (data && typeof data.title === 'string' && data.title.trim()) {
      return { title: data.title, description: data.description || '', priority: data.priority, source, confidence: data.confidence || 0.5 };
    }
    throw new AITaskServiceError('Invalid AI response.', 'INVALID_RESPONSE');
  } catch (err) {
    if (err instanceof AITaskServiceError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') throw new AITaskServiceError('AI timed out.', 'TIMEOUT');
    throw new AITaskServiceError(err instanceof Error ? err.message : 'Failed.', 'UNKNOWN');
  }
}

export class AITaskServiceError extends Error {
  public readonly code: string;

  constructor(message: string, code = 'AI_TASK_ERROR') {
    super(message);
    this.name = 'AITaskServiceError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getApiBase(): string {
  return (
    (typeof import.meta !== 'undefined' &&
      (import.meta as any).env?.VITE_CLOUDFLARE_API_BASE_URL) ||
    ''
  );
}

/**
 * Fetch with an AbortController-based timeout.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

/**
 * Generate a task suggestion from content using the AI Cloudflare Worker.
 *
 * AI Task Creation Lifecycle:
 *  - Sends content to AI endpoint with a 15-second timeout
 *  - On success: returns AISuggestedTask with pre-filled fields
 *  - On timeout: throws AITaskServiceError with TIMEOUT code
 *  - On error: throws AITaskServiceError with descriptive message
 *
 * The caller can catch errors and fall back to manual task creation.
 */
export async function generateTaskFromContent(
  content: string,
  source: TaskSource,
): Promise<AISuggestedTask> {
  const apiBase = getApiBase();
  if (!apiBase) {
    throw new AITaskServiceError(
      'AI service is not configured. Please check your environment settings.',
      'NOT_CONFIGURED',
    );
  }

  if (!content.trim()) {
    throw new AITaskServiceError(
      'Content cannot be empty when generating a task.',
      'EMPTY_CONTENT',
    );
  }

  try {
    const response = await fetchWithTimeout(
      `${apiBase}${AI_ENDPOINT_PATH}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, source }),
      },
      AI_TASK_TIMEOUT_MS,
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new AITaskServiceError(
        `AI service returned an error (HTTP ${response.status}). ${errorBody || 'Please try again.'}`,
        'API_ERROR',
      );
    }

    const data = await response.json();

    // Validate the response shape
    if (!data || typeof data.title !== 'string' || !data.title.trim()) {
      throw new AITaskServiceError(
        'AI service returned an invalid response. Please try creating the task manually.',
        'INVALID_RESPONSE',
      );
    }

    return {
      title: data.title,
      description: data.description || '',
      assignee: data.assignee || undefined,
      dueDate: data.dueDate || undefined,
      priority: data.priority || undefined,
      source,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
    };
  } catch (err) {
    // Re-throw our own errors
    if (err instanceof AITaskServiceError) {
      throw err;
    }

    // Handle timeout (AbortError)
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AITaskServiceError(
        'AI task generation timed out. Please try again or create the task manually.',
        'TIMEOUT',
      );
    }

    // Handle network errors
    if (err instanceof TypeError && err.message.includes('fetch')) {
      throw new AITaskServiceError(
        'Could not reach the AI service. Please check your connection and try again.',
        'NETWORK_ERROR',
      );
    }

    // Generic fallback
    throw new AITaskServiceError(
      err instanceof Error
        ? `AI task generation failed: ${err.message}`
        : 'Could not generate task. Please try creating it manually.',
      'UNKNOWN_ERROR',
    );
  }
}