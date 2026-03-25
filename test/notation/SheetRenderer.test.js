// ─────────────────────────────────────────────
// SheetRenderer — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SheetRenderer } from '../../src/notation/SheetRenderer.js';
import { MidiToNotation } from '../../src/notation/MidiToNotation.js';

function n(time, note, duration) {
  return { time, note, velocity: 100, duration };
}

describe('SheetRenderer', () => {

  describe('buildDrawCommands', () => {
    it('generates staff line commands', () => {
      const model = MidiToNotation.convert(
        [n(0, 60, 450)],
        { bpm: 120, meter: [4, 4] }
      );
      const cmds = SheetRenderer.buildDrawCommands(model);
      const staffLines = cmds.filter(c => c.type === 'staffLine');
      assert.equal(staffLines.length, 5, 'should draw 5 staff lines');
    });

    it('generates clef command', () => {
      const model = MidiToNotation.convert(
        [n(0, 60, 450)],
        { bpm: 120, meter: [4, 4] }
      );
      const cmds = SheetRenderer.buildDrawCommands(model);
      const clefs = cmds.filter(c => c.type === 'clef');
      assert.equal(clefs.length, 1);
      assert.equal(clefs[0].clef, 'treble');
    });

    it('generates notehead commands for each note', () => {
      const model = MidiToNotation.convert(
        [n(0, 60, 450), n(500, 64, 450)],
        { bpm: 120, meter: [4, 4] }
      );
      const cmds = SheetRenderer.buildDrawCommands(model);
      const noteheads = cmds.filter(c => c.type === 'notehead');
      assert.equal(noteheads.length, 2);
    });

    it('generates stem commands for non-whole notes', () => {
      const model = MidiToNotation.convert(
        [n(0, 60, 450)], // quarter note
        { bpm: 120, meter: [4, 4] }
      );
      const cmds = SheetRenderer.buildDrawCommands(model);
      const stems = cmds.filter(c => c.type === 'stem');
      assert.equal(stems.length, 1);
    });

    it('generates bar line commands between measures', () => {
      const model = MidiToNotation.convert(
        [n(0, 60, 450), n(500, 62, 450), n(1000, 64, 450), n(1500, 65, 450),
         n(2000, 67, 450)],
        { bpm: 120, meter: [4, 4] }
      );
      const cmds = SheetRenderer.buildDrawCommands(model);
      const barLines = cmds.filter(c => c.type === 'barLine');
      assert.ok(barLines.length >= 1, 'should have at least 1 bar line');
    });

    it('generates rest commands', () => {
      const model = MidiToNotation.convert(
        [n(0, 60, 450), n(1500, 64, 450)], // gap at beat 1-2
        { bpm: 120, meter: [4, 4] }
      );
      const cmds = SheetRenderer.buildDrawCommands(model);
      const rests = cmds.filter(c => c.type === 'rest');
      assert.ok(rests.length >= 1, 'should have at least 1 rest');
    });

    it('generates time signature command', () => {
      const model = MidiToNotation.convert(
        [n(0, 60, 450)],
        { bpm: 120, meter: [3, 4] }
      );
      const cmds = SheetRenderer.buildDrawCommands(model);
      const timeSigs = cmds.filter(c => c.type === 'timeSig');
      assert.equal(timeSigs.length, 1);
      assert.deepEqual(timeSigs[0].meter, [3, 4]);
    });
  });
});
