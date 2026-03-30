// ─────────────────────────────────────────────
// LedgerDetector — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LedgerDetector } from '../../src/sheet2midi/LedgerDetector.js';
import { SIG } from '../../src/sheet2midi/SIG.js';

/**
 * Create a synthetic binary image with a staff (5 lines) and optional ledger lines.
 * 0 = foreground (ink), 255 = background (white).
 * @param {number} width
 * @param {number} height
 * @param {number[]} staffLineYs - y positions of the 5 staff lines
 * @param {number} lineThickness
 * @param {{y: number, startX: number, endX: number}[]} ledgers - ledger line positions
 */
function makeStaffWithLedgers(width, height, staffLineYs, lineThickness, ledgers = []) {
  const img = new Uint8Array(width * height).fill(255);
  // Draw staff lines
  for (const sy of staffLineYs) {
    for (let t = 0; t < lineThickness; t++) {
      const y = sy + t;
      if (y >= height) continue;
      for (let x = 0; x < width; x++) {
        img[y * width + x] = 0;
      }
    }
  }
  // Draw ledger lines
  for (const led of ledgers) {
    for (let t = 0; t < lineThickness; t++) {
      const y = led.y + t;
      if (y >= height) continue;
      for (let x = led.startX; x < led.endX && x < width; x++) {
        img[y * width + x] = 0;
      }
    }
  }
  return img;
}

describe('LedgerDetector', () => {
  const staffSpace = 10;
  const lineThickness = 2;
  // Staff lines at y = 20, 30, 40, 50, 60
  const staffLines = [20, 30, 40, 50, 60];
  const staffGroup = staffLines;

  it('detects a ledger line above the staff', () => {
    const width = 80;
    const height = 90;
    // Ledger line at y=10 (one staffSpace above top line)
    const binary = makeStaffWithLedgers(width, height, staffLines, lineThickness, [
      { y: 10, startX: 30, endX: 55 }
    ]);
    const detector = new LedgerDetector();
    const sig = new SIG();

    const ledgers = detector.detect(binary, width, height, [staffGroup], staffSpace, lineThickness, sig);

    assert.ok(ledgers.length >= 1, 'should detect at least one ledger line');
  });

  it('detects a ledger line below the staff', () => {
    const width = 80;
    const height = 90;
    // Ledger line at y=70 (one staffSpace below bottom line)
    const binary = makeStaffWithLedgers(width, height, staffLines, lineThickness, [
      { y: 70, startX: 30, endX: 55 }
    ]);
    const detector = new LedgerDetector();
    const sig = new SIG();

    const ledgers = detector.detect(binary, width, height, [staffGroup], staffSpace, lineThickness, sig);

    assert.ok(ledgers.length >= 1, 'should detect ledger below staff');
  });

  it('creates ledger Inters in the SIG', () => {
    const width = 80;
    const height = 90;
    const binary = makeStaffWithLedgers(width, height, staffLines, lineThickness, [
      { y: 10, startX: 30, endX: 55 }
    ]);
    const detector = new LedgerDetector();
    const sig = new SIG();

    detector.detect(binary, width, height, [staffGroup], staffSpace, lineThickness, sig);

    const ledgerInters = sig.getIntersByType('ledger');
    assert.ok(ledgerInters.length >= 1, 'SIG should have ledger Inters');
    assert.ok(ledgerInters[0].grade > 0);
  });

  it('ignores the staff lines themselves', () => {
    const width = 80;
    const height = 90;
    // No ledger lines — just the staff
    const binary = makeStaffWithLedgers(width, height, staffLines, lineThickness, []);
    const detector = new LedgerDetector();
    const sig = new SIG();

    const ledgers = detector.detect(binary, width, height, [staffGroup], staffSpace, lineThickness, sig);

    assert.equal(ledgers.length, 0, 'should not detect staff lines as ledgers');
  });

  it('returns ledger bounding boxes', () => {
    const width = 80;
    const height = 90;
    const binary = makeStaffWithLedgers(width, height, staffLines, lineThickness, [
      { y: 10, startX: 30, endX: 55 }
    ]);
    const detector = new LedgerDetector();
    const sig = new SIG();

    const ledgers = detector.detect(binary, width, height, [staffGroup], staffSpace, lineThickness, sig);

    assert.ok(ledgers.length >= 1);
    const l = ledgers[0];
    assert.ok(l.bbox, 'ledger should have bbox');
    assert.ok(l.bbox.width >= 15, 'ledger should have reasonable width');
  });

  it('rejects strokes that are too short', () => {
    const width = 80;
    const height = 90;
    // Very short stroke — only 3px wide
    const binary = makeStaffWithLedgers(width, height, staffLines, lineThickness, [
      { y: 10, startX: 30, endX: 33 }
    ]);
    const detector = new LedgerDetector();
    const sig = new SIG();

    const ledgers = detector.detect(binary, width, height, [staffGroup], staffSpace, lineThickness, sig);

    assert.equal(ledgers.length, 0, 'very short strokes should be rejected');
  });
});
