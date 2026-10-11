import { describe, it, expect } from 'vitest';
import { classifyGeminiError, buildRebuildInstructions, MODELS_TO_TRY } from '../../src/shared/geminiSpec';

describe('classifyGeminiError', () => {
  it('unwraps a nested invalid-key payload and never retries it', () => {
    const e = { status: 400, message: JSON.stringify({ error: { code: 400, status: 'INVALID_ARGUMENT', message: 'API key not valid.' } }) };
    const c = classifyGeminiError(e);
    expect(c).toMatchObject({ status: 401, retryable: false, tryNextModel: false });
  });
  it.each([401, 403])('maps %i to a non-retryable 403', (status) => {
    expect(classifyGeminiError({ status, message: 'x' })).toMatchObject({ status: 403, retryable: false });
  });
  it('falls back to the next model on 404', () => {
    expect(classifyGeminiError({ status: 404, message: 'x' }).tryNextModel).toBe(true);
  });
  it('retries rate limits', () => {
    expect(classifyGeminiError({ status: 429, message: 'x' })).toMatchObject({ status: 429, retryable: true });
  });
  it('does not retry other 400s', () => {
    expect(classifyGeminiError({ status: 400, message: 'bad payload' })).toMatchObject({ status: 400, retryable: false });
  });
  it('treats network errors / 5xx as transient', () => {
    expect(classifyGeminiError({ message: 'fetch failed' }).retryable).toBe(true);
    expect(classifyGeminiError({ status: 503, message: 'x' }).retryable).toBe(true);
  });
});

describe('prompt spec', () => {
  it('embeds the user prompt and has a fallback model', () => {
    expect(buildRebuildInstructions('two boardrooms')).toContain('two boardrooms');
    expect(MODELS_TO_TRY.length).toBeGreaterThan(1);
  });
});
