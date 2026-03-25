// ─────────────────────────────────────────────
// PitchMapper — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PitchMapper } from '../../src/sheet2midi/PitchMapper.js';
import { SymbolType } from '../../src/sheet2midi/SymbolClassifier.js';
import { MockBus } from '../test-helper.js';

describe('PitchMapper', () => {

  // ── positionToPitch ────────────────────────
  describe('positionToPitch', () => {
    it('maps treble staff bottom line (pos 0) to E4 MIDI 64', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const result = pm.positionToPitch(0, 'treble');
      assert.equal(result.noteName, 'E');
      assert.equal(result.octave, 4);
      assert.equal(result.midiNote, 64);
    });

    it('maps treble pos 2 to G4 MIDI 67', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const result = pm.positionToPitch(2, 'treble');
      assert.equal(result.noteName, 'G');
      assert.equal(result.octave, 4);
      assert.equal(result.midiNote, 67);
    });

    it('maps treble pos 4 to B4 MIDI 71', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const result = pm.positionToPitch(4, 'treble');
      assert.equal(result.noteName, 'B');
      assert.equal(result.midiNote, 71);
    });

    it('maps treble pos 5 to C5 MIDI 72', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const result = pm.positionToPitch(5, 'treble');
      assert.equal(result.noteName, 'C');
      assert.equal(result.octave, 5);
      assert.equal(result.midiNote, 72);
    });

    it('maps bass staff bottom line (pos 0) to G2 MIDI 43', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const result = pm.positionToPitch(0, 'bass');
      assert.equal(result.noteName, 'G');
      assert.equal(result.octave, 2);
      assert.equal(result.midiNote, 43);
    });

    it('maps bass pos 6 to F3 MIDI 53', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const result = pm.positionToPitch(6, 'bass');
      assert.equal(result.noteName, 'F');
      assert.equal(result.octave, 3);
      assert.equal(result.midiNote, 53);
    });

    it('handles negative staff positions (below bottom line)', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const result = pm.positionToPitch(-1, 'treble');
      assert.equal(result.noteName, 'D');
      assert.equal(result.octave, 4);
      assert.equal(result.midiNote, 62);
    });
  });

  // ── quantizePosition ───────────────────────
  describe('quantizePosition', () => {
    it('returns 0 for a note on the bottom line', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const staffGroup = [100, 110, 120, 130, 140]; // bottom = 140
      const pos = pm.quantizePosition(140, staffGroup, 10);
      assert.equal(pos, 0);
    });

    it('returns 8 for a note on the top line', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const staffGroup = [100, 110, 120, 130, 140];
      const pos = pm.quantizePosition(100, staffGroup, 10);
      assert.equal(pos, 8);
    });

    it('returns 1 for a note in the first space', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const staffGroup = [100, 110, 120, 130, 140];
      const pos = pm.quantizePosition(135, staffGroup, 10);
      assert.equal(pos, 1);
    });
  });

  // ── detectClef ─────────────────────────────
  describe('detectClef', () => {
    it('detects treble clef from symbols', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const staffGroup = [100, 110, 120, 130, 140];
      const symbols = [{
        type: SymbolType.CLEF_TREBLE,
        component: { centroid: { x: 20, y: 120 } }
      }];
      assert.equal(pm.detectClef(symbols, staffGroup), 'treble');
    });

    it('detects bass clef from symbols', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const staffGroup = [100, 110, 120, 130, 140];
      const symbols = [{
        type: SymbolType.CLEF_BASS,
        component: { centroid: { x: 20, y: 120 } }
      }];
      assert.equal(pm.detectClef(symbols, staffGroup), 'bass');
    });

    it('defaults to treble when no clef found', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const staffGroup = [100, 110, 120, 130, 140];
      assert.equal(pm.detectClef([], staffGroup), 'treble');
    });
  });

  // ── detectKeySignature ─────────────────────
  describe('detectKeySignature', () => {
    it('detects 2 sharps (D major: F#, C#)', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const staffGroup = [100, 110, 120, 130, 140];
      const staffSpace = 10;
      const symbols = [
        { type: SymbolType.CLEF_TREBLE, component: { centroid: { x: 20, y: 120 }, bbox: { x: 10, width: 20 } } },
        { type: SymbolType.SHARP, component: { centroid: { x: 35, y: 115 }, bbox: { x: 33, width: 5 } } },
        { type: SymbolType.SHARP, component: { centroid: { x: 45, y: 110 }, bbox: { x: 43, width: 5 } } },
        { type: SymbolType.FILLED_NOTEHEAD, component: { centroid: { x: 100, y: 130 }, bbox: { x: 95, width: 10 } } }
      ];
      const ks = pm.detectKeySignature(symbols, staffGroup, staffSpace);
      assert.equal(ks.sharps.size, 2);
      assert.ok(ks.sharps.has('F'));
      assert.ok(ks.sharps.has('C'));
      assert.equal(ks.flats.size, 0);
    });

    it('detects 3 flats (Eb major: Bb, Eb, Ab)', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const staffGroup = [100, 110, 120, 130, 140];
      const staffSpace = 10;
      const symbols = [
        { type: SymbolType.CLEF_TREBLE, component: { centroid: { x: 20, y: 120 }, bbox: { x: 10, width: 20 } } },
        { type: SymbolType.FLAT, component: { centroid: { x: 35, y: 115 }, bbox: { x: 33, width: 5 } } },
        { type: SymbolType.FLAT, component: { centroid: { x: 40, y: 110 }, bbox: { x: 38, width: 5 } } },
        { type: SymbolType.FLAT, component: { centroid: { x: 50, y: 120 }, bbox: { x: 48, width: 5 } } },
        { type: SymbolType.FILLED_NOTEHEAD, component: { centroid: { x: 100, y: 130 }, bbox: { x: 95, width: 10 } } }
      ];
      const ks = pm.detectKeySignature(symbols, staffGroup, staffSpace);
      assert.equal(ks.flats.size, 3);
      assert.ok(ks.flats.has('B'));
      assert.ok(ks.flats.has('E'));
      assert.ok(ks.flats.has('A'));
    });
  });

  // ── applyAccidentals ───────────────────────
  describe('applyAccidentals', () => {
    it('applies key signature sharps', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const sym = {};
      const notes = [
        { symbol: sym, noteName: 'F', midiNote: 65 },
        { symbol: sym, noteName: 'C', midiNote: 60 }
      ];
      const keySig = { sharps: new Set(['F', 'C']), flats: new Set() };
      pm.applyAccidentals(notes, keySig, new Map());
      assert.equal(notes[0].midiNote, 66);
      assert.equal(notes[0].noteName, 'F#');
      assert.equal(notes[1].midiNote, 61);
      assert.equal(notes[1].noteName, 'C#');
    });

    it('inline accidental overrides key signature', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const sym = {};
      const notes = [{ symbol: sym, noteName: 'F', midiNote: 65 }];
      const keySig = { sharps: new Set(['F']), flats: new Set() };
      const inlineMap = new Map([[sym, 0]]); // natural cancels the sharp
      pm.applyAccidentals(notes, keySig, inlineMap);
      assert.equal(notes[0].midiNote, 65); // unchanged
      assert.equal(notes[0].noteName, 'F'); // no sharp appended
    });
  });
});
