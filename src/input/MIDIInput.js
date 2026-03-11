// ─────────────────────────────────────────────
// MIDIInput — Web MIDI device management
// ─────────────────────────────────────────────
// Requests MIDI access, enumerates inputs,
// and forwards parsed messages to the EventBus.
//
// Emits:
//   'midi:state'        { supported, access, error? }
//   'midi:devices'      { inputs: [{id, name}] }
//   'midi:noteOn'       { note, velocity, channel }
//   'midi:noteOff'      { note, channel }
//   'midi:cc'           { cc, value, channel }
//   'midi:raw'          { data: Uint8Array }
// ─────────────────────────────────────────────

export class MIDIInput {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(bus) {
    this._bus = bus;

    /** @type {MIDIAccess | null} */
    this._access = null;
    /** @type {MIDIInput | null} */
    this._activePort = null;
  }

  /**
   * Initialise Web MIDI. Call once at startup.
   */
  async init() {
    if (!navigator.requestMIDIAccess) {
      this._bus.emit('midi:state', { supported: false });
      return;
    }

    try {
      this._access = await navigator.requestMIDIAccess({ sysex: false });
      this._bus.emit('midi:state', { supported: true, access: true });

      this._refreshDevices();
      this._access.onstatechange = () => this._refreshDevices();
    } catch (err) {
      this._bus.emit('midi:state', { supported: true, access: false, error: err.message });
    }
  }

  /**
   * Connect to a specific input by its id.
   * @param {string} id
   */
  connect(id) {
    if (!this._access) return;

    // Disconnect previous
    if (this._activePort) {
      this._activePort.onmidimessage = null;
    }

    this._activePort = this._access.inputs.get(id) ?? null;
    if (this._activePort) {
      this._activePort.onmidimessage = (e) => this._onMessage(e);
    }
  }

  // ── internals ──

  _refreshDevices() {
    if (!this._access) return;
    const inputs = [...this._access.inputs.values()]
      .filter(d => d.state === 'connected')
      .map(d => ({ id: d.id, name: d.name }));

    this._bus.emit('midi:devices', { inputs });

    // If active port disconnected, clear it
    if (this._activePort && this._activePort.state !== 'connected') {
      this._activePort.onmidimessage = null;
      this._activePort = null;
    }

    // Auto-connect first device if nothing is active
    if (inputs.length && !this._activePort) {
      this.connect(inputs[0].id);
    }
  }

  /**
   * Parse raw MIDI bytes and emit typed events.
   * @param {MIDIMessageEvent} event
   */
  _onMessage(event) {
    const data = event.data;
    const status  = data[0];
    const type    = status & 0xf0;
    const channel = (status & 0x0f) + 1;

    if (type === 0x90 && data[2] > 0) {
      this._bus.emit('midi:noteOn', {
        note: data[1],
        velocity: data[2],
        channel,
      });
    } else if (type === 0x80 || (type === 0x90 && data[2] === 0)) {
      this._bus.emit('midi:noteOff', {
        note: data[1],
        channel,
      });
    } else if (type === 0xb0) {
      this._bus.emit('midi:cc', {
        cc: data[1],
        value: data[2],
        channel,
      });
    }

    // Always emit raw so any consumer can handle exotic messages
    this._bus.emit('midi:raw', { data });
  }
}
