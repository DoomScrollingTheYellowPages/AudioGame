// ─────────────────────────────────────────────
// PitchDetector — autocorrelation pitch detection
// ─────────────────────────────────────────────
// Shared module used by both the Tuner display
// and the Flashcard game's audio input path.
//
// Subscribes to: audio:frame
// Emits via EventBus:
//   'audio:pitch'  { freq, midiNote, noteName, octave, cents }
//   (only when a clear pitch is detected)
// ─────────────────────────────────────────────

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// ── Autocorrelation pitch detection ──────────

/**
 * Detect fundamental frequency from a time-domain buffer.
 * @param {Float32Array} buf   PCM samples (-1..1)
 * @param {number}       rate  sample rate (Hz)
 * @returns {number|null}      frequency in Hz, or null
 */
export function detectPitch(buf, rate) {
  const n = buf.length;

  // Silence gate
  let sumSq = 0;
  for (let i = 0; i < n; i++) sumSq += buf[i] * buf[i];
  if (sumSq / n < 0.0001) return null;

  // Lag range: 60 Hz – 1100 Hz
  const minLag = Math.floor(rate / 1100);
  const maxLag = Math.min(Math.ceil(rate / 60), n - 2);

  const corr = new Float32Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let s = 0;
    const end = n - lag;
    for (let i = 0; i < end; i++) s += buf[i] * buf[i + lag];
    corr[lag] = s;
  }

  let best = minLag;
  for (let lag = minLag + 1; lag <= maxLag; lag++) {
    if (corr[lag] > corr[best]) best = lag;
  }
  if (corr[best] <= 0) return null;

  // Parabolic interpolation for sub-sample accuracy
  const y0 = corr[best - 1];
  const y1 = corr[best];
  const y2 = corr[best + 1];
  const denom = 2 * (2 * y1 - y0 - y2);
  const refined = denom !== 0 ? best + (y2 - y0) / denom : best;

  return rate / refined;
}

// ── Frequency → note mapping ─────────────────

/**
 * Map a frequency to the closest musical note.
 * @param {number} freq  Hz
 * @returns {{ noteName: string, octave: number, midiNote: number, cents: number }}
 */
export function freqToNote(freq) {
  const midiF    = 69 + 12 * Math.log2(freq / 440);
  const midiNote = Math.round(midiF);
  const cents    = Math.round((midiF - midiNote) * 100);
  const octave   = Math.floor(midiNote / 12) - 1;
  const noteName = NOTE_NAMES[((midiNote % 12) + 12) % 12];
  return { noteName, octave, midiNote, cents };
}

// ── EventBus bridge ──────────────────────────

/**
 * Bridges audio:frame events into audio:pitch events.
 * Applies IIR smoothing and only emits when pitch is
 * stable and within ±20 cents of a note.
 *
 * @param {import('./EventBus.js').EventBus} bus
 * @param {object} [opts]
 * @param {number} [opts.centsThreshold=20]  max deviation to accept
 * @param {number} [opts.stabilityCount=3]   consecutive matching frames required
 * @returns {Function} unsubscribe
 */
export function createPitchBridge(bus, opts = {}) {
  const centsThresh   = opts.centsThreshold ?? 20;
  const stabilityReq  = opts.stabilityCount ?? 3;

  let smoothFreq   = null;
  let lastMidi     = null;
  let stableCount  = 0;
  let emittedMidi  = null;  // avoid double-emit for the same note

  const handler = ({ timeDomain, sampleRate }) => {
    const raw = detectPitch(timeDomain, sampleRate);

    if (!raw) {
      smoothFreq  = null;
      lastMidi    = null;
      stableCount = 0;
      emittedMidi = null;
      return;
    }

    // IIR smoothing
    smoothFreq = smoothFreq === null
      ? raw
      : smoothFreq * 0.75 + raw * 0.25;

    const info = freqToNote(smoothFreq);

    // Track stability — same MIDI note for N consecutive frames
    if (info.midiNote === lastMidi) {
      stableCount++;
    } else {
      lastMidi    = info.midiNote;
      stableCount = 1;
      emittedMidi = null; // new note, allow re-emit
    }

    // Only fire when stable, in-tune, and not already emitted
    if (
      stableCount >= stabilityReq &&
      Math.abs(info.cents) <= centsThresh &&
      info.midiNote !== emittedMidi
    ) {
      emittedMidi = info.midiNote;
      bus.emit('audio:pitch', {
        freq:     smoothFreq,
        midiNote: info.midiNote,
        noteName: info.noteName,
        octave:   info.octave,
        cents:    info.cents,
      });
    }
  };

  return bus.on('audio:frame', handler);
}
