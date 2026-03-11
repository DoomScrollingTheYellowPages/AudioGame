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
    notes: buildSequence(
      // C3=48 up to C4=60, repeated twice
      [...[48, 50, 52, 53, 55, 57, 59, 60], ...[48, 50, 52, 53, 55, 57, 59, 60]],
      80,
    ),
  },

  'g-scale': {
    name: 'G–D Scale (G3–D4)',
    bpm: 90,
    notes: buildSequence(
      // Natural notes only: G3 A3 B3 C4 D4 E4 F4 G4 — x2
      [...[55, 57, 59, 60, 62, 64, 65, 67], ...[55, 57, 59, 60, 62, 64, 65, 67]],
      90,
    ),
  },

  'mary-had': {
    name: 'Mary Had a Little Lamb',
    bpm: 100,
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

  'speed-drill': {
    name: 'Speed Drill (C–G)',
    bpm: 140,
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
  const buf = MidiWriter.build({ bpm: song.bpm, notes: midiNotes });
  return new Blob([buf], { type: 'audio/midi' });
}
