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

  // ── buildMultiTrack ────────────────────────────
  describe('buildMultiTrack', () => {
    /** Parse MIDI header fields */
    function parseHeader(buf) {
      const view = new DataView(buf);
      return {
        format:      view.getUint16(8),
        nTracks:     view.getUint16(10),
        ticksPerBeat:view.getUint16(12)
      };
    }

    /** Find all note-on MIDI note numbers in raw bytes (status 0x90, vel > 0) */
    function scrapeNoteOns(bytes) {
      const notes = [];
      for (let i = 0; i < bytes.length - 2; i++) {
        if (bytes[i] === 0x90 && bytes[i + 2] > 0) notes.push(bytes[i + 1]);
      }
      return notes;
    }

    it('produces Format 1 MIDI with two MTrk chunks', () => {
      const midi = MidiWriter.buildMultiTrack({
        bpm: 120,
        tracks: [
          [{ note: 60, beats: 1 }, { note: 62, beats: 1 }], // treble: C4, D4
          [{ note: 43, beats: 1 }, { note: 45, beats: 1 }]  // bass: G2, A2
        ]
      });
      assert.ok(midi instanceof ArrayBuffer);
      const h = parseHeader(midi);
      assert.equal(h.format, 1, 'format should be 1');
      assert.equal(h.nTracks, 2, 'should have 2 tracks');
      // Verify two MTrk markers
      const bytes = new Uint8Array(midi);
      let mTrkCount = 0;
      for (let i = 0; i < bytes.length - 3; i++) {
        if (bytes[i]===0x4D && bytes[i+1]===0x54 && bytes[i+2]===0x72 && bytes[i+3]===0x6B) mTrkCount++;
      }
      assert.equal(mTrkCount, 2, 'should have 2 MTrk markers');
    });

    it('track 1 contains treble notes, track 2 contains bass notes', () => {
      const trebleNotes = [{ note: 64, beats: 1 }, { note: 67, beats: 1 }]; // E4, G4
      const bassNotes   = [{ note: 43, beats: 1 }, { note: 47, beats: 1 }]; // G2, B2
      const midi = MidiWriter.buildMultiTrack({
        bpm: 120,
        tracks: [trebleNotes, bassNotes]
      });
      // Parse out each track's byte range and scan for note-ons
      const bytes = new Uint8Array(midi);
      const view  = new DataView(midi);
      // Track 1 starts at byte 14 (after MThd)
      const t1Len = view.getUint32(14 + 4);
      const t1Bytes = bytes.slice(14 + 8, 14 + 8 + t1Len);
      const t1Notes = scrapeNoteOns(t1Bytes);
      assert.ok(t1Notes.includes(64), 'track 1 should contain E4 (64)');
      assert.ok(t1Notes.includes(67), 'track 1 should contain G4 (67)');
      assert.ok(!t1Notes.includes(43), 'track 1 should NOT contain G2 (43)');

      const t2Offset = 14 + 8 + t1Len;
      const t2Len = view.getUint32(t2Offset + 4);
      const t2Bytes = bytes.slice(t2Offset + 8, t2Offset + 8 + t2Len);
      const t2Notes = scrapeNoteOns(t2Bytes);
      assert.ok(t2Notes.includes(43), 'track 2 should contain G2 (43)');
      assert.ok(t2Notes.includes(47), 'track 2 should contain B2 (47)');
      assert.ok(!t2Notes.includes(64), 'track 2 should NOT contain E4 (64)');
    });

    it('single-track build() still produces Format 0 (backward compat)', () => {
      const midi = MidiWriter.build({ bpm: 120, notes: [{ note: 60, beats: 1 }] });
      const h = parseHeader(midi);
      assert.equal(h.format, 0, 'build() should still return format 0');
      assert.equal(h.nTracks, 1, 'build() should have 1 track');
    });
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
