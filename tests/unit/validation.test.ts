import { describe, it, expect } from 'vitest';
import {
  validateDigitizeInput,
  validatePromptInput,
  MAX_BASE64_CHARS,
  MAX_PROMPT_CHARS,
} from '../../src/shared/validation';

describe('validateDigitizeInput', () => {
  it('accepts a valid PNG payload and defaults the mime type', () => {
    const r = validateDigitizeInput({ base64Data: 'iVBORw0KGgo=' });
    expect(r).toEqual({ ok: true, value: { base64Data: 'iVBORw0KGgo=', mimeType: 'image/png' } });
  });
  it('normalises mime type case', () => {
    const r = validateDigitizeInput({ base64Data: 'AAAA', mimeType: 'IMAGE/JPEG' });
    expect(r.ok && r.value.mimeType).toBe('image/jpeg');
  });
  it.each([undefined, null, {}, { base64Data: '' }, { base64Data: 42 }])('rejects missing/non-string data %#', (body) => {
    expect(validateDigitizeInput(body).ok).toBe(false);
  });
  it('rejects non-base64 characters (e.g. data-URI prefix or injection)', () => {
    expect(validateDigitizeInput({ base64Data: 'data:image/png;base64,AAAA' }).ok).toBe(false);
    expect(validateDigitizeInput({ base64Data: 'AAAA<script>' }).ok).toBe(false);
  });
  it('rejects disallowed mime types (svg can carry script, pdf is rasterised client-side)', () => {
    expect(validateDigitizeInput({ base64Data: 'AAAA', mimeType: 'image/svg+xml' }).ok).toBe(false);
    expect(validateDigitizeInput({ base64Data: 'AAAA', mimeType: 'application/pdf' }).ok).toBe(false);
  });
  it('rejects oversized payloads', () => {
    expect(validateDigitizeInput({ base64Data: 'A'.repeat(MAX_BASE64_CHARS + 1) }).ok).toBe(false);
  });
});

describe('validatePromptInput', () => {
  it('accepts a normal prompt', () => {
    expect(validatePromptInput({ prompt: 'open-plan floor with 2 meeting rooms' }).ok).toBe(true);
  });
  it.each([undefined, {}, { prompt: '' }, { prompt: '   ' }, { prompt: 123 }, { prompt: ['a'] }])('rejects empty/non-string %#', (body) => {
    expect(validatePromptInput(body).ok).toBe(false);
  });
  it('rejects over-long prompts', () => {
    expect(validatePromptInput({ prompt: 'x'.repeat(MAX_PROMPT_CHARS + 1) }).ok).toBe(false);
  });
});
