// ─────────────────────────────────────────────
// SvgExporter — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SvgExporter } from '../../src/notation/SvgExporter.js';
import { SheetRenderer } from '../../src/notation/SheetRenderer.js';
import { MidiToNotation } from '../../src/notation/MidiToNotation.js';

function n(time, note, duration) {
  return { time, note, velocity: 100, duration };
}

describe('SvgExporter', () => {

  it('produces valid SVG string', () => {
    const model = MidiToNotation.convert(
      [n(0, 60, 450), n(500, 64, 450)],
      { bpm: 120, meter: [4, 4] }
    );
    const cmds = SheetRenderer.buildDrawCommands(model);
    const svg = SvgExporter.toSvg(cmds);
    assert.ok(svg.startsWith('<svg'), 'should start with <svg');
    assert.ok(svg.includes('</svg>'), 'should end with </svg>');
    assert.ok(svg.includes('xmlns'), 'should have xmlns attribute');
  });

  it('contains staff lines', () => {
    const model = MidiToNotation.convert(
      [n(0, 60, 450)],
      { bpm: 120, meter: [4, 4] }
    );
    const cmds = SheetRenderer.buildDrawCommands(model);
    const svg = SvgExporter.toSvg(cmds);
    // Staff lines are rendered as <line> elements
    const lineCount = (svg.match(/<line /g) || []).length;
    assert.ok(lineCount >= 5, `expected >= 5 lines, got ${lineCount}`);
  });

  it('contains noteheads as ellipses', () => {
    const model = MidiToNotation.convert(
      [n(0, 60, 450), n(500, 64, 450)],
      { bpm: 120, meter: [4, 4] }
    );
    const cmds = SheetRenderer.buildDrawCommands(model);
    const svg = SvgExporter.toSvg(cmds);
    const ellipseCount = (svg.match(/<ellipse /g) || []).length;
    assert.equal(ellipseCount, 2, 'should have 2 ellipses for 2 notes');
  });

  it('uses black-on-white for print styling', () => {
    const model = MidiToNotation.convert(
      [n(0, 60, 450)],
      { bpm: 120, meter: [4, 4] }
    );
    const cmds = SheetRenderer.buildDrawCommands(model);
    const svg = SvgExporter.toSvg(cmds);
    assert.ok(svg.includes('#ffffff') || svg.includes('white'), 'should have white background');
    assert.ok(svg.includes('#000000') || svg.includes('black'), 'should have black notation');
  });
});
