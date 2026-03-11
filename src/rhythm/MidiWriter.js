// ─────────────────────────────────────────────
// MidiWriter — generate simple MIDI files
// ─────────────────────────────────────────────
// Creates a Format 0 single-track MIDI file from
// an array of { note, duration_beats } at a given BPM.
// ─────────────────────────────────────────────

export class MidiWriter {
  /**
   * Build a .mid ArrayBuffer from a simple note sequence.
   * @param {object} opts
   * @param {number} opts.bpm
   * @param {Array<{note: number, beats: number}>} opts.notes
   * @param {number} [opts.velocity=100]
   * @param {number} [opts.ticksPerBeat=480]
   * @returns {ArrayBuffer}
   */
  static build({ bpm, notes, velocity = 100, ticksPerBeat = 480 }) {
    const usPerBeat = Math.round(60000000 / bpm);
    const track = [];

    // Tempo meta event (delta 0)
    track.push(0x00, 0xFF, 0x51, 0x03);
    track.push((usPerBeat >> 16) & 0xFF);
    track.push((usPerBeat >> 8) & 0xFF);
    track.push(usPerBeat & 0xFF);

    // Note events
    for (const { note, beats } of notes) {
      const ticks = Math.round(beats * ticksPerBeat);
      // Note On (delta 0)
      track.push(0x00, 0x90, note, velocity);
      // Note Off (delta = ticks)
      track.push(...MidiWriter._vlq(ticks), 0x80, note, 0x00);
    }

    // End of track
    track.push(0x00, 0xFF, 0x2F, 0x00);

    // Assemble file
    const headerSize = 14;
    const trackChunkSize = 8 + track.length;
    const buf = new ArrayBuffer(headerSize + trackChunkSize);
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);

    // MThd
    bytes.set([0x4D, 0x54, 0x68, 0x64], 0);
    view.setUint32(4, 6);                  // header data length
    view.setUint16(8, 0);                  // format 0
    view.setUint16(10, 1);                 // 1 track
    view.setUint16(12, ticksPerBeat);

    // MTrk
    bytes.set([0x4D, 0x54, 0x72, 0x6B], headerSize);
    view.setUint32(headerSize + 4, track.length);
    bytes.set(track, headerSize + 8);

    return buf;
  }

  static _vlq(val) {
    if (val === 0) return [0];
    const result = [];
    result.unshift(val & 0x7F);
    val >>= 7;
    while (val > 0) {
      result.unshift((val & 0x7F) | 0x80);
      val >>= 7;
    }
    return result;
  }
}
