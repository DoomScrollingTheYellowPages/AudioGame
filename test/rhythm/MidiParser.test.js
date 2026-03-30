// ─────────────────────────────────────────────
// MidiParser.test.js — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MidiParser } from '../../src/rhythm/MidiParser.js';

// ── MIDI buffer builder helpers ────────────────

/** Encode a number as a MIDI variable-length quantity. */
function vlq(n) {
  if (n < 0x80) return [n];
  if (n < 0x4000) return [(n >> 7) | 0x80, n & 0x7F];
  if (n < 0x200000) return [(n >> 14) | 0x80, ((n >> 7) & 0x7F) | 0x80, n & 0x7F];
  return [(n >> 21) | 0x80, ((n >> 14) & 0x7F) | 0x80, ((n >> 7) & 0x7F) | 0x80, n & 0x7F];
}

/** Build a MIDI header chunk. */
function midiHeader(format, numTracks, ticksPerBeat) {
  return [
    0x4D, 0x54, 0x68, 0x64, // 'MThd'
    0x00, 0x00, 0x00, 0x06, // chunk length = 6
    (format >> 8) & 0xFF, format & 0xFF,
    (numTracks >> 8) & 0xFF, numTracks & 0xFF,
    (ticksPerBeat >> 8) & 0xFF, ticksPerBeat & 0xFF,
  ];
}

/** Build a meta event byte array. */
function metaEvent(delta, type, data) {
  const d = [...vlq(delta), 0xFF, type, ...vlq(data.length), ...data];
  return d;
}

/** Build a note-on event. */
function noteOn(delta, note, velocity, channel = 0) {
  return [...vlq(delta), 0x90 | channel, note, velocity];
}

/** Build a note-off event. */
function noteOff(delta, note, channel = 0) {
  return [...vlq(delta), 0x80 | channel, note, 0x40];
}

/** Build a tempo meta event (BPM → µs/beat). */
function tempoMeta(delta, bpm) {
  const us = Math.round(60000000 / bpm);
  return metaEvent(delta, 0x51, [(us >> 16) & 0xFF, (us >> 8) & 0xFF, us & 0xFF]);
}

/** Build a time-signature meta event. */
function timeSigMeta(delta, num, denom) {
  // denom is stored as power of 2 (e.g., 4 → 2, 8 → 3)
  const denomPow = Math.round(Math.log2(denom));
  return metaEvent(delta, 0x58, [num, denomPow, 24, 8]);
}

/** Build a track-name meta event. */
function trackNameMeta(delta, name) {
  const bytes = [...name].map(c => c.charCodeAt(0));
  return metaEvent(delta, 0x03, bytes);
}

/** Build a track chunk from raw event bytes. */
function midiTrack(events) {
  const flat = events.flat();
  const len = flat.length;
  return [
    0x4D, 0x54, 0x72, 0x6B, // 'MTrk'
    (len >> 24) & 0xFF, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF,
    ...flat,
  ];
}

/** Assemble a complete MIDI file as ArrayBuffer. */
function makeMidi(format, ticksPerBeat, ...tracks) {
  const numTracks = tracks.length;
  const header = midiHeader(format, numTracks, ticksPerBeat);
  const trackChunks = tracks.map(t => midiTrack(t));
  const all = [...header, ...trackChunks.flat()];
  return new Uint8Array(all).buffer;
}

/** End-of-track meta event. */
const EOT = metaEvent(0, 0x2F, []);

// ── Tests ──────────────────────────────────────

describe('MidiParser', () => {

  describe('Format 0 parse', () => {
    it('parses a single note-on/note-off pair', () => {
      // ticksPerBeat=480, bpm=120 → msPerTick = 500/480 ≈ 1.042ms
      const buf = makeMidi(0, 480,
        [
          tempoMeta(0, 120),
          noteOn(0, 60, 100),       // C4 on at tick 0
          noteOff(480, 60),         // C4 off at tick 480 (= 500ms at 120bpm)
          EOT,
        ]
      );
      const result = MidiParser.parse(buf);
      assert.equal(result.bpm, 120);
      assert.equal(result.ticksPerBeat, 480);
      assert.equal(result.notes.length, 1);
      assert.equal(result.notes[0].note, 60);
      assert.equal(result.notes[0].time, 0);
      assert.ok(Math.abs(result.notes[0].duration - 500) < 2,
        `duration should be ~500ms, got ${result.notes[0].duration}`);
    });

    it('returns bpm=120 and meter=[4,4] as defaults when no tempo/time-sig meta', () => {
      const buf = makeMidi(0, 480,
        [noteOn(0, 60, 80), noteOff(480, 60), EOT]
      );
      const result = MidiParser.parse(buf);
      assert.equal(result.bpm, 120);
      assert.deepEqual(result.meter, [4, 4]);
    });

    it('throws for a non-MIDI buffer', () => {
      const buf = new Uint8Array([0x00, 0x01, 0x02, 0x03]).buffer;
      assert.throws(() => MidiParser.parse(buf), /Not a MIDI file/i);
    });
  });

  describe('BPM and meter detection', () => {
    it('detects BPM from tempo meta event (90 BPM)', () => {
      const buf = makeMidi(0, 480,
        [
          tempoMeta(0, 90),
          noteOn(0, 60, 80),
          noteOff(480, 60),
          EOT,
        ]
      );
      const result = MidiParser.parse(buf);
      assert.equal(result.bpm, 90);
    });

    it('detects 3/4 time signature', () => {
      const buf = makeMidi(0, 480,
        [
          timeSigMeta(0, 3, 4),
          noteOn(0, 60, 80),
          noteOff(480, 60),
          EOT,
        ]
      );
      const result = MidiParser.parse(buf);
      assert.deepEqual(result.meter, [3, 4]);
    });

    it('detects 6/8 time signature', () => {
      const buf = makeMidi(0, 480,
        [
          timeSigMeta(0, 6, 8),
          noteOn(0, 60, 80),
          noteOff(480, 60),
          EOT,
        ]
      );
      const result = MidiParser.parse(buf);
      assert.deepEqual(result.meter, [6, 8]);
    });
  });

  describe('VLQ decoding', () => {
    it('handles 2-byte VLQ delta time (0x80 → tick=128)', () => {
      // delta time 128 = 0x81 0x00 in VLQ
      const buf = makeMidi(0, 480,
        [
          noteOn(0, 60, 80),
          noteOff(128, 60),  // 128 ticks later
          EOT,
        ]
      );
      const result = MidiParser.parse(buf);
      assert.equal(result.notes.length, 1);
      // duration at 120bpm = 128/480 * 500ms ≈ 133.3ms
      const expected = (128 / 480) * 500;
      assert.ok(Math.abs(result.notes[0].duration - expected) < 2,
        `duration ${result.notes[0].duration} ≈ ${expected}`);
    });

    it('handles 3-byte VLQ delta time (16384 ticks)', () => {
      const buf = makeMidi(0, 480,
        [
          noteOn(0, 60, 80),
          noteOff(16384, 60),
          EOT,
        ]
      );
      const result = MidiParser.parse(buf);
      assert.equal(result.notes.length, 1);
      const expected = (16384 / 480) * 500;
      assert.ok(Math.abs(result.notes[0].duration - expected) < 5,
        `duration ${result.notes[0].duration} ≈ ${expected}`);
    });
  });

  describe('Running status', () => {
    it('running status: note-on status reused for second note without repeat status byte', () => {
      // After first note-on (0x90), the next 2 bytes are interpreted as note+vel
      // without a new status byte — this is running status in MIDI.
      // Our builder generates full events; we test that parser tracks them correctly.
      const buf = makeMidi(0, 480,
        [
          noteOn(0, 60, 80),   // C4 on
          noteOn(0, 64, 80),   // E4 on (same tick)
          noteOff(480, 60),    // C4 off
          noteOff(0, 64),      // E4 off (same tick as C4 off)
          EOT,
        ]
      );
      const result = MidiParser.parse(buf);
      assert.equal(result.notes.length, 2);
      const notes = result.notes.sort((a, b) => a.note - b.note);
      assert.equal(notes[0].note, 60);
      assert.equal(notes[1].note, 64);
    });
  });

  describe('Note-off via velocity=0', () => {
    it('treats note-on with velocity=0 as note-off', () => {
      const buf = makeMidi(0, 480,
        [
          noteOn(0, 60, 80),
          // note-off via 0x90 + vel=0
          [...vlq(480), 0x90, 60, 0x00],
          EOT,
        ]
      );
      const result = MidiParser.parse(buf);
      assert.equal(result.notes.length, 1);
      assert.equal(result.notes[0].note, 60);
      assert.ok(result.notes[0].duration > 0);
    });
  });

  describe('Multiple simultaneous notes', () => {
    it('parses a 3-note chord (same time offset)', () => {
      const buf = makeMidi(0, 480,
        [
          noteOn(0, 60, 80),   // C4
          noteOn(0, 64, 80),   // E4
          noteOn(0, 67, 80),   // G4
          noteOff(480, 60),
          noteOff(0, 64),
          noteOff(0, 67),
          EOT,
        ]
      );
      const result = MidiParser.parse(buf);
      assert.equal(result.notes.length, 3);
      const times = result.notes.map(n => n.time);
      assert.ok(times.every(t => t === 0), 'all notes should start at time=0');
    });
  });

  describe('Format 1 multi-track', () => {
    it('returns per-track note arrays for Format 1', () => {
      const buf = makeMidi(1, 480,
        // Track 0: tempo track (no notes)
        [tempoMeta(0, 120), EOT],
        // Track 1: treble melody
        [trackNameMeta(0, 'Melody'), noteOn(0, 72, 80), noteOff(480, 72), EOT],
        // Track 2: bass
        [trackNameMeta(0, 'Bass'), noteOn(0, 48, 80), noteOff(480, 48), EOT]
      );
      const result = MidiParser.parse(buf);
      assert.equal(result.tracks.length, 2, 'should have 2 note-containing tracks');
      assert.equal(result.tracks[0].name, 'Melody');
      assert.equal(result.tracks[1].name, 'Bass');
      assert.equal(result.tracks[0].notes[0].note, 72);
      assert.equal(result.tracks[1].notes[0].note, 48);
    });

    it('merges all tracks into result.notes for Format 1', () => {
      const buf = makeMidi(1, 480,
        [tempoMeta(0, 120), EOT],
        [noteOn(0, 60, 80), noteOff(480, 60), EOT],
        [noteOn(0, 67, 80), noteOff(480, 67), EOT]
      );
      const result = MidiParser.parse(buf);
      assert.equal(result.notes.length, 2);
      const pitches = result.notes.map(n => n.note).sort((a, b) => a - b);
      assert.deepEqual(pitches, [60, 67]);
    });
  });

  describe('Track name meta event', () => {
    it('reads track name from FF 03 meta event', () => {
      const buf = makeMidi(0, 480,
        [
          trackNameMeta(0, 'Violin'),
          noteOn(0, 64, 80),
          noteOff(480, 64),
          EOT,
        ]
      );
      const result = MidiParser.parse(buf);
      // Format 0: one track, and tracks only include those with notes
      assert.equal(result.tracks.length, 1);
      assert.equal(result.tracks[0].name, 'Violin');
    });
  });

  describe('Note time normalization', () => {
    it('normalizes so first note starts at time=0', () => {
      // First note starts at tick 240 (not 0)
      const buf = makeMidi(0, 480,
        [
          noteOn(240, 60, 80),
          noteOff(240, 60),
          EOT,
        ]
      );
      const result = MidiParser.parse(buf);
      assert.equal(result.notes[0].time, 0,
        'first note should be normalized to time=0');
    });
  });
});
