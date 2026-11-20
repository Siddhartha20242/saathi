import { describe, it, expect } from 'vitest';
import { plainError } from '../src/plainError.js';

describe('plainError', () => {
  it('explains the free limit', () => {
    expect(plainError(new Error('AI: Error fetching ...: [429 ] You exceeded your current quota'))).toMatch(/free limit/);
  });
  it('explains an App Check failure without the words App Check or a URL', () => {
    const t = plainError(new Error('AI: Error fetching from https://firebasevertexai.googleapis.com/v1beta/...: [401 ] Firebase App Check token is invalid.'));
    expect(t).toMatch(/confirm this device/);
    expect(t).not.toMatch(/https?:|App Check/);
  });
  it('explains a refused write, no internet and a timeout', () => {
    expect(plainError({ code: 'permission-denied', message: 'Missing or insufficient permissions.' })).toMatch(/family code/);
    expect(plainError(new TypeError('Failed to fetch'))).toMatch(/internet/);
    expect(plainError(new Error('timed out'))).toMatch(/too long/);
  });
  it('has a calm default and never throws', () => {
    expect(plainError(new Error('weird internal state'))).toMatch(/Something went wrong/);
    expect(plainError(undefined)).toMatch(/Something went wrong/);
    expect(plainError('text only')).toMatch(/Something went wrong/);
  });
  it('never shows a stack, a URL or a code', () => {
    for (const e of [new Error('x at foo (https://a.b/c.js:1:2)'), { code: 'auth/network-request-failed' }, 'boom']) {
      expect(plainError(e)).not.toMatch(/https?:|\bat \w|auth\//);
    }
  });
});
