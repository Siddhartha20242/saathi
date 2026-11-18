import { describe, it, expect } from 'vitest';
import { pickCloudModel, DEFAULT_CLOUD_MODEL } from '../src/firebase.js';

describe('pickCloudModel', () => {
  it('accepts Gemini 3 model names from Remote Config', () => {
    expect(pickCloudModel('gemini-3.5-flash-lite')).toBe('gemini-3.5-flash-lite');
    expect(pickCloudModel(' gemini-3-flash ')).toBe('gemini-3-flash');
  });
  it('falls back to the default for empty, old or odd values', () => {
    for (const v of ['', undefined, null, 'gemini-2.5-flash', 'gemini-1.5-pro', 'gpt-4', 'gemini-3', 'gemini-3.5-flash lite; drop', 'x'.repeat(100)]) {
      expect(pickCloudModel(v), String(v)).toBe(DEFAULT_CLOUD_MODEL);
    }
  });
});
