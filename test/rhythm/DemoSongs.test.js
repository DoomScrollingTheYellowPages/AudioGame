// ─────────────────────────────────────────────
// DemoSongs.test.js — verify all built-in songs
// are well-formed and accessible
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSong, listSongs } from '../../src/rhythm/DemoSongs.js';

describe('DemoSongs: listSongs', () => {
  it('returns at least 12 songs', () => {
    const songs = listSongs();
    assert.ok(songs.length >= 12, `Expected ≥12 songs, got ${songs.length}`);
  });

  it('every song has id, name, bpm', () => {
    for (const s of listSongs()) {
      assert.ok(s.id, `Song missing id`);
      assert.ok(s.name, `Song ${s.id} missing name`);
      assert.ok(typeof s.bpm === 'number' && s.bpm > 0, `Song ${s.id} has invalid bpm`);
    }
  });
});

describe('DemoSongs: getSong', () => {
  it('returns null for unknown id', () => {
    assert.equal(getSong('nonexistent'), null);
  });

  const EXPECTED_SONGS = [
    'c-scale', 'g-scale', 'mary-had', 'ode-to-joy',
    'arpeggios', 'capricho-arabe', 'fur-elise', 'speed-drill',
    'twinkle', 'chromatic-scale', 'happy-birthday', 'jingle-bells', 'greensleeves'
  ];

  for (const id of EXPECTED_SONGS) {
    it(`'${id}' is a valid song`, () => {
      const song = getSong(id);
      assert.ok(song, `Song '${id}' not found`);
      assert.ok(typeof song.bpm === 'number' && song.bpm > 0);
      assert.ok(Array.isArray(song.notes) && song.notes.length > 0,
        `Song '${id}' has no notes`);
      for (const n of song.notes) {
        assert.ok(typeof n.time === 'number' && n.time >= 0, `Note has invalid time`);
        assert.ok(typeof n.note === 'number' && n.note >= 21 && n.note <= 108,
          `Song '${id}' has out-of-range MIDI note ${n.note}`);
        assert.ok(typeof n.duration === 'number' && n.duration > 0, `Note has invalid duration`);
      }
    });
  }

  it('chromatic-scale has all 12 pitch classes', () => {
    const song = getSong('chromatic-scale');
    const pitchClasses = new Set(song.notes.map(n => n.note % 12));
    assert.equal(pitchClasses.size, 12,
      `Expected 12 pitch classes, got ${pitchClasses.size}`);
  });

  it('chromatic-scale notes span exactly one octave (C4–C5)', () => {
    const song = getSong('chromatic-scale');
    const notes = song.notes.map(n => n.note);
    assert.equal(Math.min(...notes), 60, 'Lowest note should be C4 (60)');
    assert.equal(Math.max(...notes), 72, 'Highest note should be C5 (72)');
  });

  it('notes are evenly timed for buildSequence songs', () => {
    const song = getSong('twinkle');
    const msPerBeat = 60000 / song.bpm;
    // All notes should be 1 beat apart
    for (let i = 1; i < song.notes.length; i++) {
      const gap = song.notes[i].time - song.notes[i - 1].time;
      assert.ok(Math.abs(gap - msPerBeat) < 1, `Note ${i} has unexpected gap ${gap}ms`);
    }
  });
});
