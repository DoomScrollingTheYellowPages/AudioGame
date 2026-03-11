// ─────────────────────────────────────────────
// Tuner — real-time note/pitch detection display
// ─────────────────────────────────────────────
// Subscribes to: audio:frame
// Uses shared PitchDetector for autocorrelation,
// maps it to a musical note, and shows a cents-deviation meter.
// ─────────────────────────────────────────────

import { detectPitch, freqToNote } from '../core/PitchDetector.js';

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
    const { noteName: name, octave, cents } = freqToNote(freq);
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
