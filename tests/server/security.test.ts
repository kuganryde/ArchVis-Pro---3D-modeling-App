import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

// Rate limits are set low and env fixed BEFORE the app module loads.
process.env.NODE_ENV = 'production';
process.env.API_RATE_LIMIT = '1000';
process.env.AI_RATE_LIMIT = '3';
delete process.env.GEMINI_API_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

let server: Server;
let base: string;

beforeAll(async () => {
  const { createApp } = await import('../../serverApp');
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise((r) => server.close(() => r(undefined))));

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

describe('security headers', () => {
  it('sets CSP, nosniff, frame protection and hides x-powered-by', async () => {
    const res = await fetch(base + '/api/health');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-powered-by')).toBeNull();
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    const csp = res.headers.get('content-security-policy') || '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp.match(/script-src[^;]*/)?.[0]).not.toContain("'unsafe-inline'");
  });
});

describe('API behaviour', () => {
  it('returns JSON 404 for unknown API routes', async () => {
    const res = await fetch(base + '/api/nope');
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBeTruthy();
  });
  it('returns 400 JSON (not an HTML stack trace) for malformed JSON', async () => {
    const res = await post('/api/rebuild-from-prompt', '{bad json', { 'x-gemini-api-key': 'k' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Malformed request body.' });
  });
  it('rejects oversized bodies on normal routes with 413', async () => {
    const res = await post('/api/rebuild-from-prompt', { prompt: 'x'.repeat(200_000) }, { 'x-gemini-api-key': 'k' });
    expect(res.status).toBe(413);
  });
  it('validates input before ever calling Gemini (BYOK)', async () => {
    expect((await post('/api/rebuild-from-prompt', { prompt: '' }, { 'x-gemini-api-key': 'k' })).status).toBe(400);
    expect((await post('/api/digitize-blueprint', { base64Data: 'AAAA', mimeType: 'image/svg+xml' }, { 'x-gemini-api-key': 'k' })).status).toBe(400);
  });
  it('never uses the platform key anonymously: no BYOK header => hosted path, 503 when unconfigured', async () => {
    const res = await post('/api/rebuild-from-prompt', { prompt: 'an office' });
    expect(res.status).toBe(503);
  });
  it('rate-limits the AI routes per client', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await post('/api/ai/rebuild', { prompt: 'x' })).status);
    expect(statuses).toContain(429);
  });
});
