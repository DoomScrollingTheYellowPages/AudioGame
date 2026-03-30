// ─────────────────────────────────────────────
// BeamDetector — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BeamDetector } from '../../src/sheet2midi/BeamDetector.js';
import { SIG } from '../../src/sheet2midi/SIG.js';

/**
 * Create a small synthetic binary image with a horizontal beam-like stripe.
 * 0 = foreground (ink), 255 = background (white)
 */
function makeBeamImage(width, height, beamY, beamThickness, beamStartX, beamEndX) {
  const img = new Uint8Array(width * height).fill(255);
  for (let y = beamY; y < beamY + beamThickness && y < height; y++) {
    for (let x = beamStartX; x < beamEndX && x < width; x++) {
      img[y * width + x] = 0;
    }
  }
  return img;
}

describe('BeamDetector', () => {
  const staffSpace = 10;

  it('detects a horizontal beam region', () => {
    // Beam: thick horizontal stripe at y=20, spanning x=10..60
    const width = 80;
    const height = 60;
    const binary = makeBeamImage(width, height, 20, 4, 10, 60);
    const detector = new BeamDetector();
    const sig = new SIG();

    const beams = detector.detect(binary, width, height, staffSpace, sig);

    assert.ok(beams.length >= 1, 'should detect at least one beam');
    // Beam Inter should be in the SIG
    const beamInters = sig.getIntersByType('beam');
    assert.ok(beamInters.length >= 1, 'SIG should have beam Inters');
  });

  it('returns beam bounding boxes', () => {
    const width = 80;
    const height = 60;
    const binary = makeBeamImage(width, height, 20, 4, 10, 60);
    const detector = new BeamDetector();
    const sig = new SIG();

    const beams = detector.detect(binary, width, height, staffSpace, sig);

    assert.ok(beams.length >= 1);
    const b = beams[0];
    assert.ok(b.bbox, 'beam should have bbox');
    assert.ok(b.bbox.width > 20, 'beam should be wide');
    assert.ok(b.bbox.height <= 10, 'beam should be thin');
  });

  it('ignores thin staff lines (only detects thick beams)', () => {
    const width = 80;
    const height = 60;
    // Staff line: only 1px thick
    const binary = makeBeamImage(width, height, 20, 1, 0, 80);
    const detector = new BeamDetector();
    const sig = new SIG();

    const beams = detector.detect(binary, width, height, staffSpace, sig);

    assert.equal(beams.length, 0, 'thin lines should not be detected as beams');
  });

  it('ignores very short horizontal strokes', () => {
    const width = 80;
    const height = 60;
    // Short stroke: only 5px wide (< 1 staffSpace)
    const binary = makeBeamImage(width, height, 20, 4, 10, 15);
    const detector = new BeamDetector();
    const sig = new SIG();

    const beams = detector.detect(binary, width, height, staffSpace, sig);

    assert.equal(beams.length, 0, 'short strokes should not be beams');
  });

  it('creates beam Inters with positive grades', () => {
    const width = 80;
    const height = 60;
    const binary = makeBeamImage(width, height, 20, 4, 10, 60);
    const detector = new BeamDetector();
    const sig = new SIG();

    detector.detect(binary, width, height, staffSpace, sig);

    const beamInters = sig.getIntersByType('beam');
    assert.ok(beamInters.length >= 1);
    assert.ok(beamInters[0].grade > 0, 'beam grade should be positive');
    assert.ok(beamInters[0].grade <= 1.0, 'beam grade should be <= 1.0');
  });
});
