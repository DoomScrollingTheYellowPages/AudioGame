// ─────────────────────────────────────────────
// Oscilloscope — waveform display
// ─────────────────────────────────────────────
// Subscribes to:  audio:frame, audio:state
// DOM:  owns a <canvas> inside the container
// ─────────────────────────────────────────────

export class Oscilloscope {
  /**
   * @param {HTMLElement} container  Parent element to mount into
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(container, bus) {
    this._bus = bus;
    this._container = container;

    // Build DOM
    this._canvas = document.createElement('canvas');
    this._canvas.style.cssText = 'width:100%;flex:1;min-height:0;border-radius:3px;background:#0a0a0a;';
    this._container.appendChild(this._canvas);

    this._ctx = this._canvas.getContext('2d');

    // Metadata row
    this._meta = document.createElement('div');
    this._meta.className = 'audio-meta';
    this._meta.innerHTML = 'RMS: <span id="rms-val">\u2014</span>&nbsp; Peak: <span id="peak-val">\u2014</span>';
    this._container.appendChild(this._meta);
    this._rmsEl  = this._meta.querySelector('#rms-val');
    this._peakEl = this._meta.querySelector('#peak-val');

    // Sizing
    this._resize();
    this._resizeHandler = () => this._resize();
    window.addEventListener('resize', this._resizeHandler);

    // Subscribe
    this._unsubs = [
      bus.on('audio:frame', (d) => this._draw(d)),
    ];

    // Draw idle state
    this._drawIdle();
  }

  destroy() {
    for (const unsub of this._unsubs) unsub();
    window.removeEventListener('resize', this._resizeHandler);
  }

  _resize() {
    this._canvas.width  = this._canvas.offsetWidth  || 300;
    this._canvas.height = this._canvas.offsetHeight || 150;
  }

  _drawIdle() {
    const { width: W, height: H } = this._canvas;
    this._ctx.clearRect(0, 0, W, H);
    this._ctx.strokeStyle = '#1a1a1a';
    this._ctx.lineWidth = 1;
    this._ctx.beginPath();
    this._ctx.moveTo(0, H / 2);
    this._ctx.lineTo(W, H / 2);
    this._ctx.stroke();
  }

  /**
   * @param {{ timeDomain: Float32Array, rms: number, peak: number }} data
   */
  _draw(data) {
    const { timeDomain, rms, peak } = data;
    const W = this._canvas.width;
    const H = this._canvas.height;
    const ctx = this._ctx;

    this._rmsEl.textContent  = rms.toFixed(4);
    this._peakEl.textContent = peak.toFixed(4);

    ctx.clearRect(0, 0, W, H);

    // Centre line
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();

    // Find rising zero-crossing for stable display
    let start = 0;
    for (let i = 1; i < timeDomain.length - 1; i++) {
      if (timeDomain[i - 1] < 0 && timeDomain[i] >= 0) { start = i; break; }
    }

    const drawLen = Math.floor(timeDomain.length * 0.5);
    const sliceW  = W / drawLen;

    ctx.beginPath();
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth   = 1.5;
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur  = 4;

    for (let i = 0; i < drawLen; i++) {
      const x = i * sliceW;
      const y = H / 2 - timeDomain[start + i] * (H / 2) * 0.9;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}
