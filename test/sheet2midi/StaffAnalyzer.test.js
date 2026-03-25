// ─────────────────────────────────────────────
// StaffAnalyzer — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StaffAnalyzer } from '../../src/sheet2midi/StaffAnalyzer.js';
import { MockBus, createGrayImage, drawHorizontalLines } from '../test-helper.js';

describe('StaffAnalyzer', () => {

  // ── horizontalProjection ───────────────────
  describe('horizontalProjection', () => {
    it('counts black pixels per row', () => {
      const bus = new MockBus();
      const sa = new StaffAnalyzer(bus);
      const w = 10, h = 5;
      const bin = new Uint8Array(w * h).fill(255);
      // Row 2: all black
      for (let x = 0; x < w; x++) bin[2 * w + x] = 0;
      const profile = sa.horizontalProjection(bin, w, h);
      assert.equal(profile[2], 10);
      assert.equal(profile[0], 0);
    });

    it('returns correct length', () => {
      const bus = new MockBus();
      const sa = new StaffAnalyzer(bus);
      const w = 20, h = 30;
      const bin = new Uint8Array(w * h).fill(255);
      const profile = sa.horizontalProjection(bin, w, h);
      assert.equal(profile.length, h);
    });
  });

  // ── detectStaffRows ────────────────────────
  describe('detectStaffRows', () => {
    it('detects rows exceeding threshold', () => {
      const bus = new MockBus();
      const sa = new StaffAnalyzer(bus);
      const w = 100;
      const profile = new Uint32Array(50).fill(0);
      // Set 5 rows with high count (>30% of width = 30)
      profile[10] = 80;
      profile[20] = 80;
      profile[30] = 80;
      profile[40] = 80;
      profile[45] = 80;
      const rows = sa.detectStaffRows(profile, w);
      assert.equal(rows.length, 5);
      assert.deepEqual(rows, [10, 20, 30, 40, 45]);
    });

    it('returns empty for all-white image', () => {
      const bus = new MockBus();
      const sa = new StaffAnalyzer(bus);
      const profile = new Uint32Array(100).fill(5);
      const rows = sa.detectStaffRows(profile, 100);
      assert.equal(rows.length, 0);
    });

    it('takes peak within a thick line', () => {
      const bus = new MockBus();
      const sa = new StaffAnalyzer(bus);
      const w = 100;
      const profile = new Uint32Array(30).fill(0);
      // A thick line across rows 10-12, peak at 11
      profile[10] = 50;
      profile[11] = 80;
      profile[12] = 50;
      const rows = sa.detectStaffRows(profile, w);
      assert.equal(rows.length, 1);
      assert.equal(rows[0], 11);
    });
  });

  // ── groupStaffLines ────────────────────────
  describe('groupStaffLines', () => {
    it('groups 5 evenly spaced lines into one staff', () => {
      const bus = new MockBus();
      const sa = new StaffAnalyzer(bus);
      const rows = [100, 110, 120, 130, 140]; // spacing = 10
      const { groups, staffSpace } = sa.groupStaffLines(rows);
      assert.equal(groups.length, 1);
      assert.deepEqual(groups[0], rows);
      assert.equal(staffSpace, 10);
    });

    it('groups 10 lines into two staves with a gap', () => {
      const bus = new MockBus();
      const sa = new StaffAnalyzer(bus);
      // Two staves: lines at 100-140 and 200-240, gap of 60
      const rows = [100, 110, 120, 130, 140, 200, 210, 220, 230, 240];
      const { groups } = sa.groupStaffLines(rows);
      assert.equal(groups.length, 2);
      assert.deepEqual(groups[0], [100, 110, 120, 130, 140]);
      assert.deepEqual(groups[1], [200, 210, 220, 230, 240]);
    });

    it('returns empty for fewer than 5 lines', () => {
      const bus = new MockBus();
      const sa = new StaffAnalyzer(bus);
      const rows = [100, 110, 120];
      const { groups } = sa.groupStaffLines(rows);
      assert.equal(groups.length, 0);
    });
  });

  // ── estimateLineThickness ──────────────────
  describe('estimateLineThickness', () => {
    it('returns 2 for empty staff rows', () => {
      const bus = new MockBus();
      const sa = new StaffAnalyzer(bus);
      const thickness = sa.estimateLineThickness(new Uint8Array(100), 10, []);
      assert.equal(thickness, 2);
    });

    it('estimates thickness from binary image', () => {
      const bus = new MockBus();
      const sa = new StaffAnalyzer(bus);
      const w = 100, h = 50;
      const bin = new Uint8Array(w * h).fill(255);
      // Draw a 3-pixel thick line at row 25
      drawHorizontalLines(bin, w, h, [24], 3);
      const thickness = sa.estimateLineThickness(bin, w, [25]);
      assert.ok(thickness >= 2 && thickness <= 4, `thickness ${thickness}`);
    });
  });

  // ── detect (full pipeline) ─────────────────
  describe('detect', () => {
    it('detects a single 5-line staff in a synthetic image', () => {
      const bus = new MockBus();
      const sa = new StaffAnalyzer(bus);
      const w = 200, h = 100;
      const bin = new Uint8Array(w * h).fill(255);
      // Draw 5 staff lines with spacing of 10px
      drawHorizontalLines(bin, w, h, [30, 40, 50, 60, 70], 2);
      const result = sa.detect(bin, w, h);
      assert.equal(result.groups.length, 1);
      assert.equal(result.groups[0].length, 5);
      assert.ok(result.staffSpace > 0);
      assert.ok(result.lineThickness > 0);
      // Verify bus event
      assert.equal(bus.getEvents('omr:staffs').length, 1);
    });
  });

  // ── removeStaffLines ───────────────────────
  describe('removeStaffLines', () => {
    it('removes staff lines from binary image', () => {
      const bus = new MockBus();
      const sa = new StaffAnalyzer(bus);
      const w = 100, h = 50;
      const bin = new Uint8Array(w * h).fill(255);
      drawHorizontalLines(bin, w, h, [20], 2);
      // Count black pixels before
      let blackBefore = 0;
      for (const v of bin) if (v === 0) blackBefore++;
      const out = sa.removeStaffLines(bin, w, h, [20], 2);
      let blackAfter = 0;
      for (const v of out) if (v === 0) blackAfter++;
      assert.ok(blackAfter < blackBefore, 'should have fewer black pixels after removal');
    });
  });
});
