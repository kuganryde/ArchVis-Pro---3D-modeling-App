import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

process.env.NODE_ENV = 'production';
process.env.API_RATE_LIMIT = '1000';
process.env.AI_RATE_LIMIT = '50';
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
  fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('house brief endpoints', () => {
  it('rejects an empty or oversized request before calling Gemini (own key)', async () => {
    const key = { 'x-gemini-api-key': 'AIza-not-real' };
    expect((await post('/api/house-brief', { prompt: '   ' }, key)).status).toBe(400);
    expect((await post('/api/house-brief', {}, key)).status).toBe(400);
    const long = await post('/api/house-brief', { prompt: 'a'.repeat(4001) }, key);
    expect(long.status).toBe(400);
    expect((await long.json()).error).toMatch(/too long/i);
  });

  it('never uses the platform key anonymously: without a key it needs hosted auth', async () => {
    const res = await post('/api/house-brief', { prompt: 'modern 3 bedroom home' });
    // Hosted AI is not configured in this test environment, so it refuses rather than proxying.
    expect([401, 503]).toContain(res.status);
  });

  it('the hosted route requires sign-in', async () => {
    const res = await post('/api/ai/house-brief', { workspaceId: 'w', prompt: 'modern home' });
    expect([401, 503]).toContain(res.status);
  });
});
