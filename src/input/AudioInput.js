// ─────────────────────────────────────────────
// AudioInput — microphone capture + analysis
// ─────────────────────────────────────────────
// Owns the Web Audio graph:
//   getUserMedia → MediaStreamSource → AnalyserNode
//
// Emits via EventBus:
//   'audio:frame'  { timeDomain: Float32Array, rms: number, peak: number }
//   'audio:state'  { active: boolean, error?: string }
// ─────────────────────────────────────────────

export class AudioInput {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {object} [options]
   * @param {number} [options.fftSize=2048]
   */
  constructor(bus, options = {}) {
    this._bus = bus;
    this._fftSize = options.fftSize ?? 2048;

    /** @type {AudioContext | null} */
    this._ctx = null;
    /** @type {AnalyserNode | null} */
    this._analyser = null;
    /** @type {Float32Array | null} */
    this._timeDomain = null;
    /** @type {MediaStream | null} */
    this._stream = null;

    this._active = false;
    this._rafId = null;
  }

  /** Is the microphone currently active? */
  get active() { return this._active; }

  /** The raw AnalyserNode (for future processors that need it). */
  get analyser() { return this._analyser; }

  /**
   * Request microphone access and start emitting frames.
   */
  async start() {
    if (this._active) return;

    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      this._ctx = new AudioContext();
      const source = this._ctx.createMediaStreamSource(this._stream);

      this._analyser = this._ctx.createAnalyser();
      this._analyser.fftSize = this._fftSize;
      source.connect(this._analyser);

      this._timeDomain = new Float32Array(this._analyser.fftSize);
      this._active = true;

      this._bus.emit('audio:state', { active: true });
      this._tick();
    } catch (err) {
      this._bus.emit('audio:state', { active: false, error: err.message });
    }
  }

  /**
   * Stop capturing and release the microphone.
   */
  stop() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;

    if (this._stream) {
      for (const track of this._stream.getTracks()) track.stop();
      this._stream = null;
    }
    if (this._ctx) {
      this._ctx.close();
      this._ctx = null;
    }

    this._analyser = null;
    this._timeDomain = null;
    this._active = false;

    this._bus.emit('audio:state', { active: false });
  }

  // ── internal render loop ──

  _tick() {
    this._rafId = requestAnimationFrame(() => this._tick());
    if (!this._analyser || !this._timeDomain) return;

    this._analyser.getFloatTimeDomainData(this._timeDomain);

    let sumSq = 0;
    let peak = 0;
    for (let i = 0; i < this._timeDomain.length; i++) {
      const s = this._timeDomain[i];
      sumSq += s * s;
      const abs = s < 0 ? -s : s;
      if (abs > peak) peak = abs;
    }

    this._bus.emit('audio:frame', {
      timeDomain: this._timeDomain,
      rms: Math.sqrt(sumSq / this._timeDomain.length),
      peak,
    });
  }
}
