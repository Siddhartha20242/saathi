// Older Android WebViews (Chrome 113 and earlier) lack AbortSignal.any, which the Firebase AI SDK uses for every
// model call. Without it every call fails with "AbortSignal.any is not a function". Found by running the app on an
// Android 14 emulator; many older phones keep an old WebView.
export function installAbortSignalAny(Signal = globalThis.AbortSignal, Controller = globalThis.AbortController) {
  if (!Signal || typeof Signal.any === 'function') return false;
  Signal.any = (signals) => {
    const controller = new Controller();
    const list = Array.from(signals ?? []);
    const early = list.find((s) => s.aborted);
    if (early) {
      controller.abort(early.reason);
      return controller.signal;
    }
    for (const s of list) {
      s.addEventListener('abort', () => controller.abort(s.reason), { once: true, signal: controller.signal });
    }
    return controller.signal;
  };
  return true;
}

installAbortSignalAny();
