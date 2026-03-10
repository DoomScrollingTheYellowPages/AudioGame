// ─────────────────────────────────────────────
// Shared utilities
// ─────────────────────────────────────────────

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

/**
 * Convert a MIDI note number (0-127) to a human-readable name.
 * @param {number} n  MIDI note number
 * @returns {string}  e.g. "C4", "F#5"
 */
export function noteName(n) {
  return NOTE_NAMES[n % 12] + Math.floor(n / 12 - 1);
}

/**
 * Timestamp string for the message log (mm:ss.ms).
 * @returns {string}
 */
export function timestamp() {
  const d = new Date();
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${mm}:${ss}.${ms}`;
}
