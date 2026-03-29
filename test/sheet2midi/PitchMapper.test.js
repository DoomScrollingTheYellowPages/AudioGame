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

    it('detects bass clef from symbols (centroid in upper staff region)', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const staffGroup = [100, 110, 120, 130, 140]; // staffHeight=40, staffCenter=120
      // Bass clef centroid should be in the upper third of the staff (< staffCenter - 10%)
      // placing it at y=105 (upper portion, not at center)
      const symbols = [{
        type: SymbolType.CLEF_BASS,
        component: {
          centroid: { x: 20, y: 105 },
          bbox: { x: 10, y: 100, width: 20, height: 20 } // height=20 < 60% of staffHeight=40
        }
      }];
      assert.equal(pm.detectClef(symbols, staffGroup), 'bass');
    });

    it('defaults to bass when no clef found (single-staff fallback)', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const staffGroup = [100, 110, 120, 130, 140];
      assert.equal(pm.detectClef([], staffGroup), 'bass');
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

  // ── Ledger line notes via assignPitches ─────
  describe('ledger line notes', () => {
    it('assigns correct pitch to middle C (one ledger line below treble staff)', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const staffGroup = [100, 110, 120, 130, 140]; // staffSpace = 10
      const staffSpace = 10;
      // Middle C is 1 ledger line below treble staff = staffPos -2
      // y = bottomLine + 1 staffSpace = 140 + 10 = 150
      const symbols = [
        { type: SymbolType.CLEF_TREBLE, component: { centroid: { x: 20, y: 120 }, bbox: { x: 10, width: 20 } } },
        { type: SymbolType.FILLED_NOTEHEAD, component: { centroid: { x: 100, y: 150 }, bbox: { x: 95, width: 10 } } }
      ];
      const notes = pm.assignPitches(symbols, [staffGroup], staffSpace);
      assert.equal(notes.length, 1);
      assert.equal(notes[0].noteName, 'C');
      assert.equal(notes[0].midiNote, 60); // C4 = MIDI 60
    });

    it('assigns correct pitch to A5 (one ledger line above treble staff)', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const staffGroup = [100, 110, 120, 130, 140];
      const staffSpace = 10;
      // A5: staffPos = 10 (one ledger line above top line)
      // y = topLine - 1 staffSpace = 100 - 10 = 90
      const symbols = [
        { type: SymbolType.CLEF_TREBLE, component: { centroid: { x: 20, y: 120 }, bbox: { x: 10, width: 20 } } },
        { type: SymbolType.FILLED_NOTEHEAD, component: { centroid: { x: 100, y: 90 }, bbox: { x: 95, width: 10 } } }
      ];
      const notes = pm.assignPitches(symbols, [staffGroup], staffSpace);
      assert.equal(notes.length, 1);
      assert.equal(notes[0].noteName, 'A');
      assert.equal(notes[0].octave, 5);
      assert.equal(notes[0].midiNote, 81); // A5
    });

    it('assigns correct pitch to C6 (two ledger lines above treble staff)', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const staffGroup = [100, 110, 120, 130, 140];
      const staffSpace = 10;
      // C6: absDiatonic=42, baseDiatonic=30, staffPos=12, y = 140 - 12*5 = 80
      const symbols = [
        { type: SymbolType.CLEF_TREBLE, component: { centroid: { x: 20, y: 120 }, bbox: { x: 10, width: 20 } } },
        { type: SymbolType.FILLED_NOTEHEAD, component: { centroid: { x: 100, y: 80 }, bbox: { x: 95, width: 10 } } }
      ];
      const notes = pm.assignPitches(symbols, [staffGroup], staffSpace);
      assert.equal(notes.length, 1);
      assert.equal(notes[0].noteName, 'C');
      assert.equal(notes[0].octave, 6);
      assert.equal(notes[0].midiNote, 84); // C6
    });
  });

  // ── detectLedgerLines ──────────────────────
  describe('detectLedgerLines', () => {
    it('detects ledger line below staff', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const w = 100, h = 200;
      const bin = new Uint8Array(w * h).fill(255);
      const staffGroup = [100, 110, 120, 130, 140];
      const staffSpace = 10;
      // Draw a ledger line at y=150 (one staffSpace below bottom)
      for (let x = 40; x < 60; x++) bin[150 * w + x] = 0;
      const count = pm.detectLedgerLines(bin, w, { x: 50, y: 152 }, staffGroup, staffSpace);
      assert.equal(count, 1);
    });

    it('returns 0 when note is on the staff', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const w = 100, h = 200;
      const bin = new Uint8Array(w * h).fill(255);
      const staffGroup = [100, 110, 120, 130, 140];
      const count = pm.detectLedgerLines(bin, w, { x: 50, y: 120 }, staffGroup, 10);
      assert.equal(count, 0);
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

  // ── assignPitches with key signature (integration) ────────────────────
  describe('assignPitches key signature integration', () => {
    // Staff: 5 lines, staffSpace=10. Bottom line y=140, top y=100.
    // Clef at x=20 (bbox x=10, width=20 → rightEdge=30).
    // Note at x=100 (firstNoteX=100). Key sig region: x=30..100.
    // F4 is at staffPos=1 → y = 140 - 1*(10/2) = 135.
    // C4 is at staffPos=-2 → y = 140 - (-2)*5 = 150.
    const staffGroup = [100, 110, 120, 130, 140];
    const staffSpace = 10;

    function clef() {
      return { type: SymbolType.CLEF_TREBLE, component: { centroid: { x: 20, y: 120 }, bbox: { x: 10, width: 20 } } };
    }
    function sharp(x) {
      return { type: SymbolType.SHARP, component: { centroid: { x, y: 115 }, bbox: { x: x - 3, width: 5 } } };
    }
    function note(y) {
      return { type: SymbolType.FILLED_NOTEHEAD, component: { centroid: { x: 100, y }, bbox: { x: 95, width: 10 } } };
    }
    function naturalAcc(x, y) {
      return { type: SymbolType.NATURAL, component: { centroid: { x, y }, bbox: { x: x - 3, width: 5 } } };
    }

    it('G major (1 sharp): F4 note is returned as F# (MIDI 66)', () => {
      // G major key sig: 1 sharp → F#
      // Without key sig wiring, F4 would be MIDI 65. With it: 66.
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const symbols = [clef(), sharp(40), note(135)];
      const notes = pm.assignPitches(symbols, [staffGroup], staffSpace);
      assert.equal(notes.length, 1);
      assert.equal(notes[0].midiNote, 66, 'F4 should become F#4 in G major');
    });

    it('D major (2 sharps): F4 and C4 both raised by 1 semitone', () => {
      // D major: F# and C# (SHARP_ORDER: F then C)
      // F4 = MIDI 65 → 66; C4 below staff (y=150, staffPos=-2) = MIDI 60 → 61
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const symbols = [clef(), sharp(40), sharp(50), note(135), note(150)];
      const notes = pm.assignPitches(symbols, [staffGroup], staffSpace);
      assert.equal(notes.length, 2);
      const f = notes.find(n => n.noteName.startsWith('F'));
      const c = notes.find(n => n.noteName.startsWith('C'));
      assert.ok(f, 'should have an F note');
      assert.ok(c, 'should have a C note');
      assert.equal(f.midiNote, 66, 'F should be raised to F#');
      assert.equal(c.midiNote, 61, 'C should be raised to C#');
    });

    it('NATURAL inline accidental cancels key signature sharp', () => {
      // G major key sig (1 sharp: F#) but the F note has a NATURAL inline accidental
      // The F note at x=100, y=135; NATURAL sign at x=90, y=135 (just before it)
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const symbols = [clef(), sharp(40), naturalAcc(90, 135), note(135)];
      const notes = pm.assignPitches(symbols, [staffGroup], staffSpace);
      assert.equal(notes.length, 1);
      assert.equal(notes[0].midiNote, 65, 'NATURAL should cancel key sig → F natural (65)');
    });
  });

  // ── _buildClefMap (grand staff pairing cascade) ──────────────────────
  describe('_buildClefMap', () => {
    const SS = 12; // staffSpace in pixels

    /** Build a staff group: 5 lines starting at topY, separated by SS px */
    function makeGroup(topY) {
      return [topY, topY + SS, topY + 2*SS, topY + 3*SS, topY + 4*SS];
    }

    /** Build a brace symbol spanning from y0 to y1 at x=10 */
    function makeBrace(y0, y1) {
      const height = y1 - y0;
      const width = 7;
      return {
        type: SymbolType.BRACE,
        component: {
          bbox: { x: 5, y: y0, width, height },
          centroid: { x: 8, y: (y0 + y1) / 2 },
          heightSS: height / SS,
          widthSS: width / SS
        }
      };
    }

    it('pairs two staves via brace detection (primary path)', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const upper = makeGroup(10);   // lines y=10..58
      const lower = makeGroup(100);  // lines y=100..148
      // Brace spans y=10..148 (100% of combined staff height)
      const brace = makeBrace(10, 148);
      const clefMap = pm._buildClefMap([upper, lower], SS, [brace]);
      assert.equal(clefMap.get(upper), 'treble', 'upper staff should be treble');
      assert.equal(clefMap.get(lower), 'bass',   'lower staff should be bass');
    });

    it('records detection method as "brace" on the clefMap', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const upper = makeGroup(10);
      const lower = makeGroup(100);
      const brace = makeBrace(10, 148);
      const clefMap = pm._buildClefMap([upper, lower], SS, [brace]);
      assert.equal(clefMap.get(upper), 'treble');
      assert.equal(clefMap.get(lower), 'bass');
      // Method should be stored so callers can distinguish brace vs gap pairing
      assert.equal(pm._lastPairingMethod, 'brace');
    });

    it('pairs via gap threshold when no brace is present (secondary path)', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const upper = makeGroup(10);
      // Gap = lower[0] - upper[4] = 80 - 58 = 22px = ~1.8ss (< 8ss threshold)
      const lower = makeGroup(80);
      const clefMap = pm._buildClefMap([upper, lower], SS, []);
      assert.equal(clefMap.get(upper), 'treble');
      assert.equal(clefMap.get(lower), 'bass');
      assert.equal(pm._lastPairingMethod, 'gap');
    });

    it('pairs first two staves as fallback when gap is large and no brace (tertiary)', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const upper = makeGroup(10);
      // Gap = 500 - 58 = 442px >> 8×SS=96, so gap threshold won't fire
      const lower = makeGroup(500);
      const clefMap = pm._buildClefMap([upper, lower], SS, []);
      assert.equal(clefMap.get(upper), 'treble');
      assert.equal(clefMap.get(lower), 'bass');
      assert.equal(pm._lastPairingMethod, 'fallback');
    });

    it('does not pair a single staff', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const solo = makeGroup(10);
      const clefMap = pm._buildClefMap([solo], SS, []);
      assert.equal(clefMap.size, 0, 'single staff should not be paired');
    });

    it('brace present → gap method is skipped (close staves but brace wins)', () => {
      const bus = new MockBus();
      const pm = new PitchMapper(bus);
      const upper = makeGroup(10);
      const lower = makeGroup(70);
      // Add a brace — even though staves are close enough for gap threshold,
      // brace should be the recorded method
      const brace = makeBrace(10, 118);
      const clefMap = pm._buildClefMap([upper, lower], SS, [brace]);
      assert.equal(clefMap.get(upper), 'treble');
      assert.equal(clefMap.get(lower), 'bass');
      assert.equal(pm._lastPairingMethod, 'brace');
    });
  });
});
