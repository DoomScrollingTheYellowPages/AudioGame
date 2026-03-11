// ─────────────────────────────────────────────
// MidiParser — parse Standard MIDI Files
// ─────────────────────────────────────────────
// Reads an ArrayBuffer (from fetch) and returns
// an array of note events with real-time offsets.
// Supports Format 0 and Format 1.
//
// Returns:
//   { bpm, ticksPerBeat, meter, notes, tracks }
//   notes  — all tracks merged (legacy)
//   tracks — [{ name, notes }] one entry per track with note data
// ─────────────────────────────────────────────

export class MidiParser {
  /**
   * Parse a .mid ArrayBuffer.
   * @param {ArrayBuffer} buffer
   * @returns {{ bpm: number, ticksPerBeat: number, meter: number[],
   *             notes: Array, tracks: Array<{name: string, notes: Array}> }}
   */
  static parse(buffer) {
    const view = new DataView(buffer);
    let pos = 0;

    // ── Header chunk ──
    const headerId = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
    if (headerId !== 'MThd') throw new Error('Not a MIDI file');
    pos = 8; // skip 'MThd' + length(4)
    const format = view.getUint16(pos); pos += 2;
    const numTracks = view.getUint16(pos); pos += 2;
    const ticksPerBeat = view.getUint16(pos); pos += 2;

    // ── Parse all tracks ──
    let bpm = 120;
    let meter = [4, 4];
    const trackData = []; // [{ name, events[] }]

    for (let t = 0; t < numTracks; t++) {
      const trackId = String.fromCharCode(
        view.getUint8(pos), view.getUint8(pos + 1),
        view.getUint8(pos + 2), view.getUint8(pos + 3),
      );
      pos += 4;
      if (trackId !== 'MTrk') throw new Error('Expected MTrk');
      const trackLen = view.getUint32(pos); pos += 4;
      const trackEnd = pos + trackLen;

      let tick = 0;
      let runningStatus = 0;
      let trackName = `Track ${t + 1}`;
      const events = [];

      while (pos < trackEnd) {
        // Variable-length delta time
        let delta = 0;
        let byte;
        do {
          byte = view.getUint8(pos++);
          delta = (delta << 7) | (byte & 0x7F);
        } while (byte & 0x80);
        tick += delta;

        let statusByte = view.getUint8(pos);
        if (statusByte & 0x80) {
          runningStatus = statusByte;
          pos++;
        } else {
          statusByte = runningStatus;
        }

        const type = statusByte & 0xF0;
        const channel = statusByte & 0x0F;

        if (statusByte === 0xFF) {
          // Meta event
          const metaType = view.getUint8(pos++);
          let metaLen = 0;
          do {
            byte = view.getUint8(pos++);
            metaLen = (metaLen << 7) | (byte & 0x7F);
          } while (byte & 0x80);

          if (metaType === 0x51 && metaLen === 3) {
            // Tempo
            const usPerBeat =
              (view.getUint8(pos) << 16) |
              (view.getUint8(pos + 1) << 8) |
              view.getUint8(pos + 2);
            bpm = Math.round(60000000 / usPerBeat);
          } else if (metaType === 0x58 && metaLen === 4) {
            // Time signature
            const num = view.getUint8(pos);
            const denomPow = view.getUint8(pos + 1);
            meter = [num, Math.pow(2, denomPow)];
          } else if (metaType === 0x03 && metaLen > 0) {
            // Track name
            const chars = [];
            for (let i = 0; i < metaLen; i++) chars.push(view.getUint8(pos + i));
            const name = chars.map(b => String.fromCharCode(b)).join('').replace(/\0/g, '').trim();
            if (name) trackName = name;
          }
          pos += metaLen;
        } else if (type === 0x90 || type === 0x80) {
          // Note On / Note Off
          const note = view.getUint8(pos++);
          const velocity = view.getUint8(pos++);
          const isOn = type === 0x90 && velocity > 0;
          events.push({ tick, note, velocity: isOn ? velocity : 0, isOn, channel });
        } else if (type === 0xA0 || type === 0xB0 || type === 0xE0) {
          pos += 2;
        } else if (type === 0xC0 || type === 0xD0) {
          pos += 1;
        } else if (type === 0xF0 || type === 0xF7) {
          let sysLen = 0;
          do {
            byte = view.getUint8(pos++);
            sysLen = (sysLen << 7) | (byte & 0x7F);
          } while (byte & 0x80);
          pos += sysLen;
        }
      }

      pos = trackEnd;
      trackData.push({ name: trackName, events });
    }

    // ── Convert ticks → ms and pair noteOn/Off ──
    const msPerTick = (60000 / bpm) / ticksPerBeat;

    function eventsToNotes(evts) {
      const sorted = [...evts].sort((a, b) => a.tick - b.tick);
      const pending = new Map();
      const notes = [];
      for (const evt of sorted) {
        const timeMs = evt.tick * msPerTick;
        const key = `${evt.note}-${evt.channel}`;
        if (evt.isOn) {
          pending.set(key, { time: timeMs, note: evt.note, velocity: evt.velocity });
        } else {
          const on = pending.get(key);
          if (on) {
            notes.push({ time: on.time, note: on.note, velocity: on.velocity, duration: timeMs - on.time });
            pending.delete(key);
          }
        }
      }
      return notes;
    }

    function normalizeNotes(notes) {
      if (notes.length === 0) return notes;
      const minTime = Math.min(...notes.map(n => n.time));
      if (minTime > 0) for (const n of notes) n.time -= minTime;
      return notes;
    }

    // ── Per-track notes (only tracks that contain notes) ──
    const tracks = trackData
      .map(t => ({ name: t.name, notes: normalizeNotes(eventsToNotes(t.events)) }))
      .filter(t => t.notes.length > 0);

    // ── Merged notes (all tracks) ──
    const allEvents = trackData.flatMap(t => t.events);
    const notes = normalizeNotes(eventsToNotes(allEvents));

    return { bpm, ticksPerBeat, meter, notes, tracks };
  }
}
