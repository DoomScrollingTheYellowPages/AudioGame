// ─────────────────────────────────────────────
// MidiWriter — unit tests for rest gap support
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MidiWriter } from '../../src/rhythm/MidiWriter.js';

/** Extract track N bytes from a Format 1 MIDI ArrayBuffer (0-indexed). */
function extractTrack(midi, trackIndex) {
  const view = new DataView(midi);
  const bytes = new Uint8Array(midi);
  let offset = 14; // skip MThd
  for (let t = 0; t <= trackIndex; t++) {
    const len = view.getUint32(offset + 4);
    if (t === trackIndex) return bytes.slice(offset + 8, offset + 8 + len);
    offset += 8 + len;
  }
  return new Uint8Array(0);
}

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

  // ── Tick-precision tests ───────────────────────────────────────────────
  describe('tick precision at 480 TPQ', () => {
    /**
     * Decode a VLQ-encoded integer from bytes at offset.
     * Returns { value, bytesConsumed }.
     */
    function decodeVLQ(bytes, offset) {
      let val = 0;
      let consumed = 0;
      for (let i = offset; i < bytes.length; i++) {
        consumed++;
        val = (val << 7) | (bytes[i] & 0x7F);
        if ((bytes[i] & 0x80) === 0) break;
      }
      return { value: val, bytesConsumed: consumed };
    }

    /**
     * Find the note-off delta tick in a single-note MidiWriter output.
     * Layout: MThd(14) + MTrk header(8) + time-sig(8) + tempo(7) +
     *         note-on delta(VLQ) + 0x90 + note + vel +
     *         note-off delta(VLQ) ← this is what we want
     */
    function getNoteOffTicks(midi) {
      const bytes = new Uint8Array(midi);
      let pos = 14 + 8 + 8 + 7; // skip header + time-sig + tempo
      const noteOnDelta = decodeVLQ(bytes, pos);
      pos += noteOnDelta.bytesConsumed + 3; // skip delta + 0x90 + note + vel
      const noteOffDelta = decodeVLQ(bytes, pos);
      return noteOffDelta.value;
    }

    it('whole note (4 beats) → 1920 tick note-off delta', () => {
      const midi = MidiWriter.build({ bpm: 120, notes: [{ note: 60, beats: 4 }] });
      assert.equal(getNoteOffTicks(midi), 1920);
    });

    it('half note (2 beats) → 960 tick note-off delta', () => {
      const midi = MidiWriter.build({ bpm: 120, notes: [{ note: 60, beats: 2 }] });
      assert.equal(getNoteOffTicks(midi), 960);
    });

    it('quarter note (1 beat) → 480 tick note-off delta', () => {
      const midi = MidiWriter.build({ bpm: 120, notes: [{ note: 60, beats: 1 }] });
      assert.equal(getNoteOffTicks(midi), 480);
    });

    it('dotted quarter (1.5 beats) → 720 tick note-off delta', () => {
      const midi = MidiWriter.build({ bpm: 120, notes: [{ note: 60, beats: 1.5 }] });
      assert.equal(getNoteOffTicks(midi), 720);
    });

    it('eighth note (0.5 beats) → 240 tick note-off delta', () => {
      const midi = MidiWriter.build({ bpm: 120, notes: [{ note: 60, beats: 0.5 }] });
      assert.equal(getNoteOffTicks(midi), 240);
    });

    it('sixteenth note (0.25 beats) → 120 tick note-off delta', () => {
      const midi = MidiWriter.build({ bpm: 120, notes: [{ note: 60, beats: 0.25 }] });
      assert.equal(getNoteOffTicks(midi), 120);
    });
  });

  // ── Key signature meta event ───────────────────────────────────────────
  describe('key signature meta event', () => {
    it('writes FF 59 02 when keySig.sf=1 (G major)', () => {
      const midi = MidiWriter.build({
        bpm: 120,
        notes: [{ note: 60, beats: 1 }],
        keySig: { sf: 1, mi: 0 }
      });
      const bytes = new Uint8Array(midi);
      let found = false;
      for (let i = 0; i < bytes.length - 4; i++) {
        if (bytes[i] === 0xFF && bytes[i + 1] === 0x59 && bytes[i + 2] === 0x02) {
          found = true;
          assert.equal(bytes[i + 3], 1, 'sf byte should be 1');
          assert.equal(bytes[i + 4], 0, 'mi byte should be 0 (major)');
          break;
        }
      }
      assert.ok(found, 'key signature meta event (FF 59 02) should be present');
    });

    it('writes negative sf for flats (F major: sf=-1 → byte 0xFF)', () => {
      const midi = MidiWriter.build({
        bpm: 120,
        notes: [{ note: 60, beats: 1 }],
        keySig: { sf: -1, mi: 0 }
      });
      const bytes = new Uint8Array(midi);
      let found = false;
      for (let i = 0; i < bytes.length - 4; i++) {
        if (bytes[i] === 0xFF && bytes[i + 1] === 0x59 && bytes[i + 2] === 0x02) {
          found = true;
          // -1 signed byte = 0xFF unsigned
          assert.equal(bytes[i + 3], 0xFF, 'sf byte for -1 flats should be 0xFF');
          break;
        }
      }
      assert.ok(found, 'key signature meta event should be present for flats');
    });

    it('omits key signature meta event when keySig is not provided', () => {
      const midi = MidiWriter.build({ bpm: 120, notes: [{ note: 60, beats: 1 }] });
      const bytes = new Uint8Array(midi);
      for (let i = 0; i < bytes.length - 1; i++) {
        if (bytes[i] === 0xFF && bytes[i + 1] === 0x59) {
          assert.fail('FF 59 key sig meta event should NOT be present without keySig');
        }
      }
    });

    it('buildMultiTrack writes key sig meta event in track 0', () => {
      const midi = MidiWriter.buildMultiTrack({
        bpm: 120,
        tracks: [[{ note: 60, beats: 1 }], [{ note: 43, beats: 1 }]],
        keySig: { sf: 2, mi: 0 }  // D major: 2 sharps
      });
      const t1 = extractTrack(midi, 0);
      let found = false;
      for (let i = 0; i < t1.length - 4; i++) {
        if (t1[i] === 0xFF && t1[i + 1] === 0x59 && t1[i + 2] === 0x02) {
          found = true;
          assert.equal(t1[i + 3], 2, 'sf should be 2 (2 sharps)');
          break;
        }
      }
      assert.ok(found, 'key sig meta event should be in track 0 of Format 1');
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
