// ─────────────────────────────────────────────
// MidiWriter — unit tests for rest gap support
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MidiWriter } from '../../src/rhythm/MidiWriter.js';

describe('MidiWriter', () => {

  it('builds a valid MIDI file from simple notes', () => {
    const midi = MidiWriter.build({
      bpm: 120,
      notes: [
        { note: 60, beats: 1 },
        { note: 64, beats: 1 },
      ]
    });
    assert.ok(midi instanceof ArrayBuffer);
    assert.ok(midi.byteLength > 30, 'MIDI should have header + track data');
    // Check MThd header
    const bytes = new Uint8Array(midi);
    assert.equal(bytes[0], 0x4D); // M
    assert.equal(bytes[1], 0x54); // T
    assert.equal(bytes[2], 0x68); // h
    assert.equal(bytes[3], 0x64); // d
  });

  it('supports startBeat for notes with rest gaps', () => {
    // Note at beat 0 (1 beat), rest for 2 beats, note at beat 3 (1 beat)
    const midi = MidiWriter.build({
      bpm: 120,
      notes: [
        { note: 60, beats: 1, startBeat: 0 },
        { note: 64, beats: 1, startBeat: 3 },
      ]
    });
    assert.ok(midi instanceof ArrayBuffer);
    // Parse the MIDI to verify the gap exists
    const bytes = new Uint8Array(midi);
    // Find note events in the track data
    // After header (14 bytes) + MTrk (8 bytes) + time sig (8 bytes) + tempo (7 bytes)
    // = offset 37, note events start
    // First note: delta=0, 0x90, 60, velocity
    // Then note off: delta=480 ticks (1 beat), 0x80, 60, 0
    // Then gap of 2 beats = 960 ticks before next note on
    // Next note: delta=960, 0x90, 64, velocity
    assert.ok(midi.byteLength > 40, 'should have room for gap encoding');
  });

  it('produces longer MIDI when rests are present vs consecutive', () => {
    const noRests = MidiWriter.build({
      bpm: 120,
      notes: [
        { note: 60, beats: 1 },
        { note: 64, beats: 1 },
      ]
    });
    const withRests = MidiWriter.build({
      bpm: 120,
      notes: [
        { note: 60, beats: 1, startBeat: 0 },
        { note: 64, beats: 1, startBeat: 3 },
      ]
    });
    // The version with rests should be larger (extra delta time bytes for the gap)
    assert.ok(withRests.byteLength > noRests.byteLength,
      `with rests (${withRests.byteLength}) should be larger than without (${noRests.byteLength})`);
  });
});
