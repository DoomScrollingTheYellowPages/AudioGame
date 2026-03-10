// ─────────────────────────────────────────────
// KeyboardDisplay — piano keyboard visualiser
// ─────────────────────────────────────────────
// Subscribes to:  midi:noteOn, midi:noteOff
// DOM:  owns a <canvas> inside the container
// ─────────────────────────────────────────────

const BLACKS = new Set([1, 3, 6, 8, 10]);

function isBlack(n) { return BLACKS.has(n % 12); }

export class KeyboardDisplay {
  /**
   * @param {HTMLElement} container  Parent element to mount into
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {object} [options]
   * @param {number} [options.lowNote=36]   C2
   * @param {number} [options.highNote=96]  C7
   */
  constructor(container, bus, options = {}) {
    this._bus = bus;
    this._low  = options.lowNote  ?? 36;
    this._high = options.highNote ?? 96;

    /** @type {Set<number>} currently held MIDI note numbers */
    this._held = new Set();

    // Build DOM
    this._canvas = document.createElement('canvas');
    this._canvas.style.cssText = 'width:100%;height:100%;';
    container.appendChild(this._canvas);
    this._ctx = this._canvas.getContext('2d');

    // Sizing
    this._resize();
    this._resizeHandler = () => { this._resize(); this._draw(); };
    window.addEventListener('resize', this._resizeHandler);

    // Subscribe
    this._unsubs = [
      bus.on('midi:noteOn',  (d) => { this._held.add(d.note);    this._draw(); }),
      bus.on('midi:noteOff', (d) => { this._held.delete(d.note); this._draw(); }),
    ];

    this._draw();
  }

  destroy() {
    for (const unsub of this._unsubs) unsub();
    window.removeEventListener('resize', this._resizeHandler);
  }

  _resize() {
    this._canvas.width  = this._canvas.offsetWidth  || 300;
    this._canvas.height = this._canvas.offsetHeight || 60;
  }

  _draw() {
    const W   = this._canvas.width;
    const H   = this._canvas.height;
    const ctx = this._ctx;
    const LOW = this._low;
    const HIGH = this._high;

    // Count white keys
    let totalWhites = 0;
    for (let n = LOW; n <= HIGH; n++) { if (!isBlack(n)) totalWhites++; }

    const wW = W / totalWhites;
    const bW = wW * 0.6;
    const bH = H * 0.6;

    ctx.clearRect(0, 0, W, H);

    // ── White keys ──
    let wx = 0;
    for (let n = LOW; n <= HIGH; n++) {
      if (isBlack(n)) continue;
      ctx.fillStyle   = this._held.has(n) ? '#00ff88' : '#e8e8e8';
      ctx.strokeStyle = '#222';
      ctx.lineWidth   = 0.5;
      ctx.fillRect(wx, 0, wW - 1, H);
      ctx.strokeRect(wx, 0, wW - 1, H);
      wx += wW;
    }

    // ── Black keys ──
    wx = 0;
    let prevWhiteX = 0;
    for (let n = LOW; n <= HIGH; n++) {
      if (!isBlack(n)) {
        prevWhiteX = wx;
        wx += wW;
        continue;
      }
      const bx = prevWhiteX + wW - bW / 2;
      ctx.fillStyle = this._held.has(n) ? '#00cc66' : '#111';
      ctx.fillRect(bx, 0, bW, bH);
    }
  }
}
