import type { ApiResult, Capture, IntegrationConnection, IntegrationProvider, Task } from '@admini/shared';

export type AdminiApiClientOptions = {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
};

export type CaptureInput = Pick<Capture, 'id' | 'source' | 'mode' | 'redactedText' | 'tokenCount' | 'createdAt'>;
export type TaskInput = Pick<Task, 'id' | 'title' | 'description' | 'priority' | 'status' | 'dueAt' | 'createdAt' | 'updatedAt'>;

export class AdminiApiClient {
  private readonly baseUrl: string;
  private readonly getAccessToken: () => Promise<string | null>;

  constructor(options: AdminiApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.getAccessToken = options.getAccessToken;
  }

  async health(): Promise<ApiResult<{ status: 'ok'; service: string }>> {
    return this.request('/api/health', { method: 'GET', auth: false });
  }

  async syncCapture(capture: CaptureInput): Promise<ApiResult<{ capture: Capture }>> {
    return this.request('/api/sync/captures', {
      method: 'POST',
      body: { capture }
    });
  }

  async syncTask(task: TaskInput): Promise<ApiResult<{ task: Task }>> {
    return this.request('/api/sync/tasks', {
      method: 'POST',
      body: { task }
    });
  }

  async suggestTasks(input: { redactedText: string; tokenCount: number }): Promise<ApiResult<{ tasks: TaskInput[] }>> {
    return this.request('/api/ai/task-suggestions', {
      method: 'POST',
      body: input
    });
  }

  async integrationStatus(): Promise<ApiResult<{ connections: IntegrationConnection[] }>> {
    return this.request('/api/integrations/status', { method: 'GET' });
  }

  async callIntegration(provider: IntegrationProvider, tool: string, input: unknown): Promise<ApiResult<unknown>> {
    return this.request(`/api/integrations/${provider}/${tool}`, {
      method: 'POST',
      body: { input }
    });
  }

  private async request<T>(path: string, init: { method: 'GET' | 'POST'; body?: unknown; auth?: boolean }): Promise<ApiResult<T>> {
    const headers = new Headers({ Accept: 'application/json' });
    if (init.body) headers.set('Content-Type', 'application/json');

    if (init.auth !== false) {
      const token = await this.getAccessToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: init.method,
      headers,
      body: init.body ? JSON.stringify(init.body) : undefined
    });

    const payload = (await response.json().catch(() => null)) as ApiResult<T> | null;
    if (payload) return payload;

    return {
      ok: false,
      error: { code: 'invalid_response', message: `Unexpected API response: ${response.status}` }
    };
  }
}
