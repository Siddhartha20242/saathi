// Chrome's Prompt API status for the local model. Needs no Firebase code, so it can answer straight away.

/** Chrome's Prompt API status for the local model. */
export async function deviceStatus() {
  try {
    if (typeof LanguageModel === 'undefined') return 'unsupported';
    return await LanguageModel.availability(); // 'available' | 'downloadable' | 'downloading' | 'unavailable'
  } catch {
    return 'unsupported';
  }
}

export async function localAvailable() {
  return (await deviceStatus()) === 'available';
}
