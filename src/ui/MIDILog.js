// ─────────────────────────────────────────────
// MIDILog — scrolling MIDI message log
// ─────────────────────────────────────────────
// Subscribes to:  midi:noteOn, midi:noteOff, midi:cc, midi:raw
// DOM:  appends log entries to the container
// ─────────────────────────────────────────────

import { noteName, timestamp } from '../core/utils.js';

export class MIDILog {
  /**
   * @param {HTMLElement} container  The .log-wrap element
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {object} [options]
   * @param {number} [options.maxEntries=120]
   */
  constructor(container, bus, options = {}) {
    this._bus = bus;
    this._container = container;
    this._max = options.maxEntries ?? 120;

    this._unsubs = [
      bus.on('midi:noteOn',  (d) => this._log('note-on',
        `${noteName(d.note)} (${d.note})  vel ${d.velocity}  ch${d.channel}`)),
      bus.on('midi:noteOff', (d) => this._log('note-off',
        `${noteName(d.note)} (${d.note})  ch${d.channel}`)),
      bus.on('midi:cc',      (d) => this._log('cc',
        `CC${d.cc}  =  ${d.value}  ch${d.channel}`)),
    ];
  }

  destroy() {
    for (const unsub of this._unsubs) unsub();
  }

  /**
   * @param {string} type   CSS class suffix: 'note-on' | 'note-off' | 'cc' | 'other'
   * @param {string} body   Human-readable message
   */
  _log(type, body) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';

    const time = document.createElement('span');
    time.className = 'log-time';
    time.textContent = timestamp();

    const typeEl = document.createElement('span');
    typeEl.className = `log-type ${type}`;
    typeEl.textContent = type.replace('-', ' ').toUpperCase();

    const bodyEl = document.createElement('span');
    bodyEl.className = 'log-body';
    bodyEl.textContent = body;

    entry.append(time, typeEl, bodyEl);
    this._container.prepend(entry);

    // Trim old entries
    while (this._container.children.length > this._max) {
      this._container.removeChild(this._container.lastChild);
    }
  }
}
