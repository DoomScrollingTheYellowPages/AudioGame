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
   * @param {number[]} [opts.meter=[4,4]]  — time signature [numerator, denominator]
   * @returns {ArrayBuffer}
   */
  static build({ bpm, notes, velocity = 100, ticksPerBeat = 480, meter = [4, 4], keySig = null }) {
    const usPerBeat = Math.round(60000000 / bpm);
    const track = [];

    // Time signature meta event (delta 0)
    // FF 58 04 nn dd cc bb
    //   nn = numerator, dd = log2(denominator), cc = MIDI clocks/click, bb = 32nds/beat
    const denomPow = Math.log2(meter[1]);
    track.push(0x00, 0xFF, 0x58, 0x04, meter[0], denomPow, 0x18, 0x08);

    // Tempo meta event (delta 0)
    track.push(0x00, 0xFF, 0x51, 0x03);
    track.push((usPerBeat >> 16) & 0xFF);
    track.push((usPerBeat >> 8) & 0xFF);
    track.push(usPerBeat & 0xFF);

    // Key signature meta event (delta 0): FF 59 02 sf mi
    //   sf: signed byte — positive=sharps, negative=flats (two's complement)
    //   mi: 0=major, 1=minor
    if (keySig != null) {
      const sf = ((keySig.sf & 0xFF) + 0x100) & 0xFF; // to unsigned byte
      const mi = keySig.mi ?? 0;
      track.push(0x00, 0xFF, 0x59, 0x02, sf, mi);
    }

    // Note events — supports optional startBeat for rest gaps
    let currentTick = 0;
    for (const n of notes) {
      const ticks = Math.round(n.beats * ticksPerBeat);
      // Compute delta before note on (rest gap)
      let deltaOn = 0;
      if (n.startBeat !== undefined) {
        const targetTick = Math.round(n.startBeat * ticksPerBeat);
        deltaOn = Math.max(0, targetTick - currentTick);
      }
      // Note On (delta = rest gap, or 0 if no startBeat)
      track.push(...MidiWriter._vlq(deltaOn), 0x90, n.note, velocity);
      // Note Off (delta = note duration ticks)
      track.push(...MidiWriter._vlq(ticks), 0x80, n.note, 0x00);
      currentTick += deltaOn + ticks;
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

  /**
   * Build a Format 1 multi-track .mid ArrayBuffer.
   * Each element of `tracks` becomes one MTrk chunk.
   * Tempo and time signature meta events are written in track 0.
   * @param {object} opts
   * @param {number} opts.bpm
   * @param {Array<Array<{note: number, beats: number, startBeat?: number}>>} opts.tracks
   * @param {number} [opts.velocity=100]
   * @param {number} [opts.ticksPerBeat=480]
   * @param {number[]} [opts.meter=[4,4]]
   * @returns {ArrayBuffer}
   */
  static buildMultiTrack({ bpm, tracks, velocity = 100, ticksPerBeat = 480, meter = [4, 4], keySig = null }) {
    const usPerBeat = Math.round(60000000 / bpm);
    const denomPow = Math.log2(meter[1]);

    const trackChunks = tracks.map((notes, trackIndex) => {
      const track = [];

      // Time signature + tempo + key sig meta events go in the first track only
      if (trackIndex === 0) {
        track.push(0x00, 0xFF, 0x58, 0x04, meter[0], denomPow, 0x18, 0x08);
        track.push(0x00, 0xFF, 0x51, 0x03);
        track.push((usPerBeat >> 16) & 0xFF, (usPerBeat >> 8) & 0xFF, usPerBeat & 0xFF);
        if (keySig != null) {
          const sf = ((keySig.sf & 0xFF) + 0x100) & 0xFF;
          const mi = keySig.mi ?? 0;
          track.push(0x00, 0xFF, 0x59, 0x02, sf, mi);
        }
      }

      // Note events
      let currentTick = 0;
      for (const n of notes) {
        const ticks = Math.round(n.beats * ticksPerBeat);
        let deltaOn = 0;
        if (n.startBeat !== undefined) {
          const targetTick = Math.round(n.startBeat * ticksPerBeat);
          deltaOn = Math.max(0, targetTick - currentTick);
        }
        track.push(...MidiWriter._vlq(deltaOn), 0x90, n.note, velocity);
        track.push(...MidiWriter._vlq(ticks), 0x80, n.note, 0x00);
        currentTick += deltaOn + ticks;
      }

      // End of track
      track.push(0x00, 0xFF, 0x2F, 0x00);
      return track;
    });

    // MThd (14 bytes) + N × (MTrk header 8 bytes + track data)
    const headerSize = 14;
    const totalSize = headerSize + trackChunks.reduce((acc, t) => acc + 8 + t.length, 0);
    const buf = new ArrayBuffer(totalSize);
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);

    bytes.set([0x4D, 0x54, 0x68, 0x64], 0); // MThd
    view.setUint32(4, 6);
    view.setUint16(8, 1);               // format 1
    view.setUint16(10, tracks.length);
    view.setUint16(12, ticksPerBeat);

    let offset = headerSize;
    for (const track of trackChunks) {
      bytes.set([0x4D, 0x54, 0x72, 0x6B], offset); // MTrk
      view.setUint32(offset + 4, track.length);
      bytes.set(track, offset + 8);
      offset += 8 + track.length;
    }

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
