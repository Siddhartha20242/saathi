/**
 * The SDK reports 'on_device' or 'in_cloud' (lowercase; the docs show uppercase).
 * Normalise to ON_DEVICE / IN_CLOUD. If it is missing, only the ONLY_* modes are certain.
 */
export function normaliseSource(raw, mode) {
  const s = String(raw ?? '').toUpperCase();
  if (s === 'ON_DEVICE' || s === 'IN_CLOUD') return s;
  if (mode === 'ONLY_ON_DEVICE') return 'ON_DEVICE';
  if (mode === 'ONLY_IN_CLOUD') return 'IN_CLOUD';
  return 'UNKNOWN';
}
