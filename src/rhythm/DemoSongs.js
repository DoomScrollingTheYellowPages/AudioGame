// ─────────────────────────────────────────────
// DemoSongs — built-in song data
// ─────────────────────────────────────────────
// Each song is a plain object with bpm and a
// notes array that the SongEngine can consume
// directly. Also provides MIDI file generation.
// ─────────────────────────────────────────────

import { MidiWriter } from './MidiWriter.js';

/** Helper: build notes from a sequence of MIDI note numbers at a given BPM. */
function buildSequence(midiNotes, bpm, beatsPerNote = 1) {
  const msPerBeat = 60000 / bpm;
  return midiNotes.map((note, i) => ({
    time: i * msPerBeat * beatsPerNote,
    note,
    velocity: 100,
    duration: msPerBeat * beatsPerNote,
  }));
}

const SONGS = {
  'c-scale': {
    name: 'C Scale (C3–C4)',
    bpm: 80,
    meter: [4, 4],
    notes: buildSequence(
      // C3=48 up to C4=60, repeated twice
      [...[48, 50, 52, 53, 55, 57, 59, 60], ...[48, 50, 52, 53, 55, 57, 59, 60]],
      80,
    ),
  },

  'g-scale': {
    name: 'G–D Scale (G3–D4)',
    bpm: 90,
    meter: [4, 4],
    notes: buildSequence(
      // Natural notes only: G3 A3 B3 C4 D4 E4 F4 G4 — x2
      [...[55, 57, 59, 60, 62, 64, 65, 67], ...[55, 57, 59, 60, 62, 64, 65, 67]],
      90,
    ),
  },

  'mary-had': {
    name: 'Mary Had a Little Lamb',
    bpm: 100,
    meter: [4, 4],
    notes: buildSequence(
      // E D C D  E E E  D D D  E G G
      // E D C D  E E E E  D D E D C
      [64, 62, 60, 62, 64, 64, 64,
       62, 62, 62,
       64, 67, 67,
       64, 62, 60, 62, 64, 64, 64, 64,
       62, 62, 64, 62, 60],
      100,
    ),
  },

  'ode-to-joy': {
    name: 'Ode to Joy',
    bpm: 108,
    meter: [4, 4],
    notes: buildSequence(
      // Beethoven — first 16 bars melody (natural notes only, key of C)
      // E E F G  G F E D  C C D E  E D D
      // E E F G  G F E D  C C D E  D C C
      [64, 64, 65, 67, 67, 65, 64, 62,
       60, 60, 62, 64, 64, 62, 62,
       64, 64, 65, 67, 67, 65, 64, 62,
       60, 60, 62, 64, 62, 60, 60],
      108,
    ),
  },

  'arpeggios': {
    name: 'C-F-G Arpeggios',
    bpm: 120,
    meter: [4, 4],
    notes: (() => {
      // C major: C E G C', F major: F A C' F', G major: G B D' G'
      const patterns = [
        [60, 64, 67, 72],  // C
        [65, 69, 72, 77],  // F
        [67, 71, 74, 79],  // G
        [60, 64, 67, 72],  // C
      ];
      const msPerBeat = 60000 / 120;
      const notes = [];
      let t = 0;
      for (const pat of patterns) {
        for (const note of pat) {
          notes.push({ time: t, note, velocity: 100, duration: msPerBeat * 0.9 });
          t += msPerBeat * 0.5; // eighth notes
        }
        t += msPerBeat; // rest between chords
      }
      return notes;
    })(),
  },

  'capricho-arabe': {
    name: 'Capricho Árabe (Tárrega)',
    bpm: 72,
    meter: [3, 4],
    notes: (() => {
      // Simplified from Francisco Tárrega's Capricho Árabe (Serenata)
      // Cantabile theme — D natural minor, natural notes only (B instead of Bb)
      // Format: [midiNote, beats]  (1 beat = quarter note at 72 BPM)
      const ms = 60000 / 72;
      const seq = [
        // ── Phrase A1 — descending ──
        [69, 1.5], [67, 0.5], [65, 1],   // A. G | F
        [64, 1.5], [62, 0.5], [60, 1],   // E. D | C
        [62, 1.5], [64, 0.5], [65, 1],   // D. E | F
        [64, 2],   [62, 1],              // E--  | D
        // ── Phrase A2 — descending then rising ──
        [69, 1.5], [67, 0.5], [65, 1],
        [64, 1.5], [62, 0.5], [60, 1],
        [62, 1.5], [64, 0.5], [65, 1],
        [67, 2],   [69, 1],              // G--  | A
        // ── Phrase B — ascent to C5 ──
        [71, 1.5], [72, 0.5], [74, 1],   // B. C5| D5
        [72, 1.5], [71, 0.5], [69, 1],   // C5.B | A
        [67, 1.5], [69, 0.5], [71, 1],   // G. A | B
        [72, 3],                          // C5---
        // ── Phrase C — descent to D4 ──
        [71, 1.5], [69, 0.5], [67, 1],   // B. A | G
        [65, 1.5], [64, 0.5], [62, 1],   // F. E | D
        [64, 1.5], [62, 0.5], [60, 1],   // E. D | C
        [62, 3],                          // D---
      ];
      const notes = [];
      let t = 0;
      for (const [note, beats] of seq) {
        notes.push({ time: t, note, velocity: 90, duration: ms * beats * 0.9 });
        t += ms * beats;
      }
      return notes;
    })(),
  },

  'fur-elise': {
    name: 'Für Elise (Beethoven)',
    bpm: 108,
    meter: [3, 4],
    notes: (() => {
      // Simplified from Beethoven's Für Elise (WoO 59)
      // D# → D, G# → G for natural-notes-only mode
      // Format: [midiNote, beats]  (0.5 beat = eighth note at 108 BPM)
      const ms = 60000 / 108;
      const seq = [
        // ── Main theme ──
        [76, 0.5], [74, 0.5], [76, 0.5], [74, 0.5], [76, 0.5],
        [71, 0.5], [74, 0.5], [72, 0.5],
        [69, 1],   [60, 0.5], [64, 0.5], [69, 0.5], [71, 0.5],
        [64, 0.5], [67, 0.5], [71, 0.5], [72, 1],
        // ── Repeat main theme ──
        [76, 0.5], [74, 0.5], [76, 0.5], [74, 0.5], [76, 0.5],
        [71, 0.5], [74, 0.5], [72, 0.5],
        [69, 1],   [60, 0.5], [64, 0.5], [69, 0.5], [71, 0.5],
        [69, 1.5],
        // ── Section B ──
        [69, 0.5], [64, 0.5], [67, 0.5], [64, 0.5], [60, 0.5], [64, 0.5],
        [62, 1],   [55, 0.5], [59, 0.5], [62, 0.5], [64, 0.5],
        [65, 1],   [60, 0.5], [64, 0.5], [65, 0.5], [67, 0.5],
        [69, 1.5],
        // ── Return to main theme ──
        [76, 0.5], [74, 0.5], [76, 0.5], [74, 0.5], [76, 0.5],
        [71, 0.5], [74, 0.5], [72, 0.5],
        [69, 1],   [60, 0.5], [64, 0.5], [69, 0.5], [71, 0.5],
        [69, 1.5],
      ];
      const notes = [];
      let t = 0;
      for (const [note, beats] of seq) {
        notes.push({ time: t, note, velocity: 90, duration: ms * beats * 0.9 });
        t += ms * beats;
      }
      return notes;
    })(),
  },

  'speed-drill': {
    name: 'Speed Drill (C–G)',
    bpm: 140,
    meter: [4, 4],
    notes: (() => {
      // Fast alternating patterns to challenge timing
      const pattern = [
        60, 62, 64, 65, 67, 65, 64, 62, // C D E F G F E D
        60, 64, 67, 64, 60, 67, 64, 60, // C E G E C G E C
        62, 65, 67, 65, 62, 67, 65, 62, // D F G F D G F D
        60, 62, 64, 65, 67, 72, 67, 60, // C D E F G C' G C
      ];
      const msPerBeat = 60000 / 140;
      return pattern.map((note, i) => ({
        time: i * msPerBeat * 0.5, // eighth notes at 140 BPM
        note,
        velocity: 100,
        duration: msPerBeat * 0.45,
      }));
    })(),
  },
};

export function getSong(id) {
  return SONGS[id] ?? null;
}

export function listSongs() {
  return Object.entries(SONGS).map(([id, s]) => ({ id, name: s.name, bpm: s.bpm }));
}

/**
 * Generate a downloadable .mid Blob for a built-in song.
 */
export function songToMidiBlob(id) {
  const song = SONGS[id];
  if (!song) return null;
  const msPerBeat = 60000 / song.bpm;
  const midiNotes = song.notes.map(n => ({
    note: n.note,
    beats: n.duration / msPerBeat,
  }));
  const buf = MidiWriter.build({ bpm: song.bpm, notes: midiNotes, meter: song.meter });
  return new Blob([buf], { type: 'audio/midi' });
}
