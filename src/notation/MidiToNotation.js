// ─────────────────────────────────────────────
// MidiToNotation — convert MIDI note arrays
// into a structured notation model suitable
// for rendering as sheet music
// ─────────────────────────────────────────────

// ── Constants ──────────────────────────────────

const DIATONIC_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const DIATONIC_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

// Valid beat durations for quantization (in beats)
const BEAT_GRID = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

const DURATION_NAMES = {
  0.25: 'sixteenth',
  0.5: 'eighth',
  0.75: 'dotted_eighth',
  1: 'quarter',
  1.5: 'dotted_quarter',
  2: 'half',
  3: 'dotted_half',
  4: 'whole',
};

// Treble: bottom line = E4 (MIDI 64). Bass: bottom line = G2 (MIDI 43).
const TREBLE_BASE_DIATONIC = 4 * 7 + 2; // E4 = 30
const BASS_BASE_DIATONIC = 2 * 7 + 4;   // G2 = 18

// ── MidiToNotation ───────────────────────────

export class MidiToNotation {
  /**
   * Convert a MIDI note array to a notation model.
   * @param {Array<{time: number, note: number, velocity: number, duration: number}>} notes
   * @param {object} opts
   * @param {number} opts.bpm
   * @param {number[]} [opts.meter=[4,4]]
   * @returns {{measures: Array, clef: string, meter: number[], bpm: number}}
   */
  static convert(notes, opts = {}) {
    const bpm = opts.bpm ?? 120;
    const meter = opts.meter ?? [4, 4];

    if (notes.length === 0) {
      return { measures: [], clef: 'treble', meter, bpm };
    }

    const msPerBeat = 60000 / bpm;
    const beatsPerMeasure = meter[0] * (4 / meter[1]);

    // Determine clef from note range
    const avgMidi = notes.reduce((s, n) => s + n.note, 0) / notes.length;
    const clef = avgMidi < 55 ? 'bass' : 'treble';

    // Convert notes to beat-based events
    const beatEvents = [];
    for (const n of notes) {
      const startBeat = n.time / msPerBeat;
      const rawBeats = n.duration / msPerBeat;
      const beats = MidiToNotation._quantizeDuration(rawBeats);
      const { noteName, octave, staffPos } = MidiToNotation._midiToPitch(n.note, clef);

      beatEvents.push({
        startBeat,
        beats,
        durationType: DURATION_NAMES[beats] || 'quarter',
        midiNote: n.note,
        noteName,
        octave,
        staffPos,
        velocity: n.velocity,
        isRest: false,
      });
    }

    // Sort by start time
    beatEvents.sort((a, b) => a.startBeat - b.startBeat);

    // Insert rests for gaps
    const withRests = MidiToNotation._insertRests(beatEvents);

    // Segment into measures
    const measures = MidiToNotation._segmentMeasures(withRests, beatsPerMeasure);

    return { measures, clef, meter, bpm };
  }

  /**
   * Quantize a raw beat duration to the nearest valid grid value.
   * @param {number} rawBeats
   * @returns {number}
   */
  static _quantizeDuration(rawBeats) {
    let best = 1;
    let bestDiff = Infinity;
    for (const g of BEAT_GRID) {
      const diff = Math.abs(rawBeats - g);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = g;
      }
    }
    return best;
  }

  /**
   * Convert MIDI note number to pitch info.
   * @param {number} midi
   * @param {string} clef
   * @returns {{noteName: string, octave: number, staffPos: number}}
   */
  static _midiToPitch(midi, clef) {
    const octave = Math.floor(midi / 12) - 1;
    const semitone = midi % 12;

    // Find closest diatonic note
    let bestDeg = 0;
    let bestDist = Infinity;
    for (let i = 0; i < 7; i++) {
      const dist = Math.abs(semitone - DIATONIC_SEMITONES[i]);
      if (dist < bestDist) {
        bestDist = dist;
        bestDeg = i;
      }
    }

    const noteName = DIATONIC_NAMES[bestDeg];
    const absDiatonic = octave * 7 + bestDeg;
    const baseDiatonic = clef === 'treble' ? TREBLE_BASE_DIATONIC : BASS_BASE_DIATONIC;
    const staffPos = absDiatonic - baseDiatonic;

    return { noteName, octave, staffPos };
  }

  /**
   * Insert rest events for gaps between notes.
   * @param {Array} events — sorted by startBeat
   * @returns {Array}
   */
  static _insertRests(events) {
    if (events.length === 0) return [];

    const result = [];
    let currentBeat = 0;

    for (const e of events) {
      const gap = e.startBeat - currentBeat;
      if (gap >= 0.25) {
        // Insert rest(s) to fill the gap
        const restBeats = MidiToNotation._quantizeDuration(gap);
        result.push({
          startBeat: currentBeat,
          beats: restBeats,
          durationType: DURATION_NAMES[restBeats] || 'quarter',
          midiNote: -1,
          noteName: '',
          octave: 0,
          staffPos: 0,
          velocity: 0,
          isRest: true,
        });
      }
      result.push(e);
      currentBeat = e.startBeat + e.beats;
    }

    return result;
  }

  /**
   * Segment events into measures.
   * @param {Array} events
   * @param {number} beatsPerMeasure
   * @returns {Array<{measureNum: number, events: Array}>}
   */
  static _segmentMeasures(events, beatsPerMeasure) {
    const measures = [];
    let currentMeasure = { measureNum: 1, events: [] };
    let measureStart = 0;

    for (const e of events) {
      const measureIdx = Math.floor(e.startBeat / beatsPerMeasure);
      const targetMeasure = measureIdx + 1;

      while (currentMeasure.measureNum < targetMeasure) {
        if (currentMeasure.events.length > 0) {
          measures.push(currentMeasure);
        }
        measureStart += beatsPerMeasure;
        currentMeasure = { measureNum: currentMeasure.measureNum + 1, events: [] };
      }

      currentMeasure.events.push(e);
    }

    if (currentMeasure.events.length > 0) {
      measures.push(currentMeasure);
    }

    return measures;
  }
}
