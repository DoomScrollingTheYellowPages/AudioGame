// ─────────────────────────────────────────────
// CCDisplay — MIDI CC bar visualiser
// ─────────────────────────────────────────────
// Subscribes to:  midi:cc
// DOM:  builds CC bar elements dynamically
//       inside the provided container
// ─────────────────────────────────────────────

export class CCDisplay {
  /**
   * @param {HTMLElement} container  Parent element (the .cc-grid div)
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(container, bus) {
    this._bus = bus;
    this._container = container;

    /** @type {Map<number, {fill: HTMLElement, val: HTMLElement}>} */
    this._bars = new Map();

    this._unsubs = [
      bus.on('midi:cc', (d) => this._update(d)),
    ];
  }

  destroy() {
    for (const unsub of this._unsubs) unsub();
  }

  /**
   * @param {{ cc: number, value: number, channel: number }} data
   */
  _update(data) {
    const bar = this._getOrCreate(data.cc);
    bar.fill.style.width = `${(data.value / 127) * 100}%`;
    bar.val.textContent  = data.value;
  }

  _getOrCreate(num) {
    if (this._bars.has(num)) return this._bars.get(num);

    const wrap = document.createElement('div');
    wrap.className = 'cc-bar-wrap';

    const label = document.createElement('div');
    label.className = 'cc-label';

    const numSpan = document.createElement('span');
    numSpan.textContent = `CC${num}`;

    const valSpan = document.createElement('span');
    valSpan.className = 'cc-val';
    valSpan.textContent = '0';

    label.append(numSpan, valSpan);

    const track = document.createElement('div');
    track.className = 'cc-track';

    const fill = document.createElement('div');
    fill.className = 'cc-fill';
    fill.style.width = '0%';
    track.appendChild(fill);

    wrap.append(label, track);
    this._container.appendChild(wrap);

    const entry = { fill, val: valSpan };
    this._bars.set(num, entry);
    return entry;
  }
}
