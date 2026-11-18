import { describe, it, expect } from 'vitest';
import { installAbortSignalAny } from '../src/polyfills.js';

describe('AbortSignal.any polyfill', () => {
  const fake = () => {
    class Sig { constructor() { this.aborted = false; this.reason = undefined; this.l = []; } addEventListener(_t, fn, o) { this.l.push([fn, o]); } fire(reason) { this.aborted = true; this.reason = reason; this.l.forEach(([fn]) => fn()); } }
    class Ctl { constructor() { this.signal = new Sig(); } abort(r) { this.signal.fire(r ?? 'aborted'); } }
    function Signal() {}
    return { Signal, Ctl, Sig };
  };
  it('does nothing when the browser already has it', () => {
    const Signal = { any: () => 1 };
    expect(installAbortSignalAny(Signal, class {})).toBe(false);
  });
  it('adds it, and aborts when any one signal aborts', () => {
    const { Signal, Ctl, Sig } = fake();
    expect(installAbortSignalAny(Signal, Ctl)).toBe(true);
    const a = new Sig();
    const b = new Sig();
    const out = Signal.any([a, b]);
    expect(out.aborted).toBe(false);
    b.fire('stop');
    expect(out.aborted).toBe(true);
    expect(out.reason).toBe('stop');
  });
  it('is already aborted if one input already is', () => {
    const { Signal, Ctl, Sig } = fake();
    installAbortSignalAny(Signal, Ctl);
    const done = new Sig();
    done.fire('already');
    expect(Signal.any([new Sig(), done]).aborted).toBe(true);
  });
});
