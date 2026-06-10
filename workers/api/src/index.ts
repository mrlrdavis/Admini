import { getConnector, type RosterLookupInput } from '@admini/integrations';
import { scrubSentryText } from '@admini/privacy';
import { createClientId, nowIso, type ApiResult, type Capture, type IntegrationProvider, type Task } from '@admini/shared';

type WorkerEnv = {
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  RESEND_API_KEY?: string;
  FROM_EMAIL?: string;
};

type WorkerContext = ExecutionContext;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: WorkerContext): Promise<Response> {
    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      const url = new URL(request.url);

      if (request.method === 'GET' && url.pathname === '/api/health') {
        return json({ ok: true, data: { status: 'ok', service: 'admini-api' } });
      }

      if (request.method === 'POST' && url.pathname === '/api/sync/captures') {
        const body = await readJson<{ capture: Omit<Capture, 'organizationId' | 'createdBy' | 'status'> }>(request);
        const capture: Capture = { ...body.capture, organizationId: 'org_from_auth', createdBy: 'profile_from_auth', status: 'synced' };
        return json({ ok: true, data: { capture } });
      }

      if (request.method === 'POST' && url.pathname === '/api/sync/tasks') {
        const body = await readJson<{ task: Omit<Task, 'organizationId' | 'createdBy'> }>(request);
        const task: Task = { ...body.task, organizationId: 'org_from_auth', createdBy: 'profile_from_auth' };
        return json({ ok: true, data: { task } });
      }

      if (request.method === 'POST' && url.pathname === '/api/ai/task-suggestions') {
        const body = await readJson<{ redactedText: string; tokenCount: number }>(request);
        const task = { id: createClientId('task'), title: body.redactedText.slice(0, 72) || 'Review captured note', description: 'Generated from redacted capture text.', priority: body.tokenCount > 0 ? 'high' : 'normal', status: 'open', createdAt: nowIso(), updatedAt: nowIso() };
        return json({ ok: true, data: { tasks: [task] } });
      }

      if (request.method === 'GET' && url.pathname === '/api/integrations/status') {
        return json({ ok: true, data: { connections: [mockConnection('email'), mockConnection('calendar'), mockConnection('google_classroom')] } });
      }

      const authorizeMatch = url.pathname.match(/^\/api\/integrations\/(google_classroom|email|calendar)\/authorize$/);
      if (request.method === 'GET' && authorizeMatch) {
        const provider = authorizeMatch[1] as IntegrationProvider;
        const mode = url.searchParams.get('mode') || 'oauth';
        const returnTo = url.searchParams.get('returnTo') || '/';
        return Response.redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}integration=${provider}&mode=${mode}&status=connected`, 302);
      }

      const integrationMatch = url.pathname.match(/^\/api\/integrations\/(google_classroom|email|calendar)\/([a-z_]+)$/);
      if (request.method === 'POST' && integrationMatch) {
        const provider = integrationMatch[1] as IntegrationProvider;
        const tool = integrationMatch[2];
        const connector = getConnector(provider);
        const body = await readJson<{ input?: unknown }>(request);
        if (tool === 'health') return json({ ok: true, data: await connector.health() });
        if (tool === 'lookup_roster') return json({ ok: true, data: await connector.lookupRoster((body.input ?? {}) as RosterLookupInput) });
        if (tool === 'lookup_courses') return json({ ok: true, data: await connector.lookupCourses((body.input ?? {}) as { query?: string }) });
        if (tool === 'lookup_attendance') { return json({ ok: true, data: await connector.lookupAttendance((body.input ?? {}) as { externalStudentId: string; date: string }) }); }
      }

            // Send invitation email
      if (request.method === 'POST' && url.pathname === '/api/invitations/send-email') {
        const body = await readJson<{ email: string; inviterName: string; schoolName: string; role: string; token: string }>(request);
        const inviteUrl = `https://pdadmini.com?invitation_token=${encodeURIComponent(body.token)}`;
        if (env.RESEND_API_KEY) {
          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: env.FROM_EMAIL || 'Admini <noreply@pdadmini.com>', to: body.email, subject: `${body.inviterName} invited you to join ${body.schoolName} on Admini`, html: `<div style="font-family:system-ui,sans-serif;max-width:500px;margin:0 auto;padding:32px"><h1 style="color:#2D3436;font-size:24px">You're invited!</h1><p style="color:#636E72;font-size:16px;line-height:1.6"><strong>${body.inviterName}</strong> has invited you to join <strong>${body.schoolName}</strong> on Admini as a <strong>${body.role}</strong>.</p><a href="${inviteUrl}" style="display:inline-block;margin-top:16px;padding:14px 28px;background:#6B8E6B;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px">Accept Invitation</a><p style="margin-top:24px;color:#999;font-size:12px">This invitation expires in 7 days.</p></div>` }),
          });
          if (!emailRes.ok) {
            const cloned = emailRes.clone();
            const errText = await cloned.text().catch(() => '');
            let errBody = errText || emailRes.statusText;
            try { const j = JSON.parse(errText); errBody = j.message || j.error || errText; } catch {}
            return json({ ok: false, error: { code: 'email_failed', message: 'Resend ' + emailRes.status + ': ' + errBody } }, 500);
          }
          return json({ ok: true, data: { sent: true, to: body.email } });
        }
        return json({ ok: true, data: { sent: false, manualInviteUrl: inviteUrl, message: 'No email service configured.' } });
      }

      return json({ ok: false, error: { code: 'not_found', message: 'Route not found' } }, 404);
    } catch (error) {
      ctx.waitUntil(reportWorkerError(error, env));
      return json({ ok: false, error: { code: 'internal_error', message: 'Unexpected API error' } }, 500);
    }
  }
};

function mockConnection(provider: IntegrationProvider) {
  return { id: `integration_${provider}`, organizationId: 'org_from_auth', provider, status: 'mock' as const, createdAt: nowIso(), updatedAt: nowIso() };
}

async function readJson<T>(request: Request): Promise<T> { return request.json() as Promise<T>; }

function json<T>(payload: ApiResult<T>, status = payload.ok ? 200 : 400): Response {
  return Response.json(payload, { status, headers: corsHeaders });
}

async function reportWorkerError(error: unknown, env: WorkerEnv): Promise<void> {
  if (!env.SENTRY_DSN) return;
  const message = error instanceof Error ? error.message : String(error);
  const endpoint = sentryStoreEndpoint(env.SENTRY_DSN);
  if (!endpoint) return;
  const event = { event_id: crypto.randomUUID().replaceAll('-', ''), message: scrubSentryText(message), level: 'error', platform: 'javascript', environment: env.SENTRY_ENVIRONMENT ?? 'preview', release: 'admini-worker@0.1.0', timestamp: new Date().toISOString() };
  await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) }).catch(() => undefined);
}

function sentryStoreEndpoint(dsn: string): string | null {
  try {
    const parsed = new URL(dsn);
    const publicKey = parsed.username;
    const projectId = parsed.pathname.replace(/^\//, '');
    if (!publicKey || !projectId) return null;
    parsed.username = '';
    parsed.password = '';
    parsed.pathname = `/api/${projectId}/store/`;
    parsed.search = `sentry_key=${encodeURIComponent(publicKey)}`;
    return parsed.toString();
  } catch { return null; }
}