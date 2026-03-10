// ─────────────────────────────────────────────
// Tuner — real-time note/pitch detection display
// ─────────────────────────────────────────────
// Subscribes to: audio:frame
// Uses autocorrelation to detect fundamental frequency,
// maps it to a musical note, and shows a cents-deviation meter.
// ─────────────────────────────────────────────

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// ── Pitch detection ──────────────────────────

/**
 * Autocorrelation-based fundamental frequency detection.
 * Returns Hz, or null if signal is too quiet / undetectable.
 *
 * @param {Float32Array} buf      time-domain PCM samples (-1..1)
 * @param {number}       rate     sample rate in Hz
 * @returns {number|null}
 */
function detectPitch(buf, rate) {
  const n = buf.length;

  // Silence gate — skip computation when there's no real signal
  let sumSq = 0;
  for (let i = 0; i < n; i++) sumSq += buf[i] * buf[i];
  if (sumSq / n < 0.0001) return null; // RMS < 0.01

  // Lag range corresponding to 60 Hz – 1100 Hz
  const minLag = Math.floor(rate / 1100); // ~40  at 44100
  const maxLag = Math.min(Math.ceil(rate / 60), n - 2); // ~735 at 44100

  // Compute autocorrelation for every lag in the range (+1 extra for interp)
  const corr = new Float32Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let s = 0;
    const end = n - lag;
    for (let i = 0; i < end; i++) s += buf[i] * buf[i + lag];
    corr[lag] = s;
  }

  // Find the lag with the highest correlation
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

// ── Note mapping ─────────────────────────────

/**
 * Convert a frequency to note name, octave, and cents deviation.
 * @param {number} freq Hz
 * @returns {{ name: string, octave: number, cents: number }}
 */
function freqToNote(freq) {
  const midiF  = 69 + 12 * Math.log2(freq / 440);
  const midi   = Math.round(midiF);
  const cents  = Math.round((midiF - midi) * 100);
  const octave = Math.floor(midi / 12) - 1;
  const name   = NOTE_NAMES[((midi % 12) + 12) % 12];
  return { name, octave, cents };
}

// ── Tuner component ──────────────────────────

export class Tuner {
  /**
   * @param {HTMLElement}                              container
   * @param {import('../core/EventBus.js').EventBus}  bus
   */
  constructor(container, bus) {
    this._bus = bus;
    this._smoothFreq = null; // IIR-smoothed pitch

    // ── Build DOM ──
    this._root = document.createElement('div');
    this._root.className = 'tuner';
    this._root.innerHTML = `
      <div class="tuner-row">
        <span class="tuner-note" aria-label="detected note">—</span>
        <div class="tuner-meter-area">
          <span class="tuner-acc">♭</span>
          <div class="tuner-track">
            <div class="tuner-center-mark"></div>
            <div class="tuner-needle"></div>
          </div>
          <span class="tuner-acc">♯</span>
        </div>
        <span class="tuner-freq">— Hz</span>
      </div>
      <div class="tuner-cents">—</div>
    `;
    container.appendChild(this._root);

    this._noteEl   = this._root.querySelector('.tuner-note');
    this._needleEl = this._root.querySelector('.tuner-needle');
    this._freqEl   = this._root.querySelector('.tuner-freq');
    this._centsEl  = this._root.querySelector('.tuner-cents');

    this._unsubs = [
      bus.on('audio:frame', d => this._onFrame(d)),
    ];
  }

  destroy() {
    for (const u of this._unsubs) u();
    this._root.remove();
  }

  // ── internal ─────────────────────────────

  _onFrame({ timeDomain, sampleRate }) {
    const raw = detectPitch(timeDomain, sampleRate);

    if (!raw) {
      this._smoothFreq = null;
      this._noteEl.textContent  = '—';
      this._noteEl.style.color  = '#444';
      this._freqEl.textContent  = '— Hz';
      this._centsEl.textContent = '—';
      this._centsEl.style.color = '#333';
      this._needleEl.style.left       = '50%';
      this._needleEl.style.background = '#2a2a2a';
      return;
    }

    // IIR smoothing — damps jitter without significant lag
    this._smoothFreq = this._smoothFreq === null
      ? raw
      : this._smoothFreq * 0.75 + raw * 0.25;

    const freq = this._smoothFreq;
    const { name, octave, cents } = freqToNote(freq);
    const inTune = Math.abs(cents) <= 8;
    const color  = inTune ? '#00ff88' : '#ffaa00';

    this._noteEl.textContent  = `${name}${octave}`;
    this._noteEl.style.color  = color;
    this._freqEl.textContent  = `${freq.toFixed(1)} Hz`;
    this._centsEl.textContent = cents >= 0 ? `+${cents}¢` : `${cents}¢`;
    this._centsEl.style.color = color;

    // Map cents –50..+50  →  left 5%..95%
    const pct = Math.max(5, Math.min(95, 50 + cents));
    this._needleEl.style.left       = `${pct}%`;
    this._needleEl.style.background = color;
  }
}
