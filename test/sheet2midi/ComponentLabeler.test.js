// ─────────────────────────────────────────────
// ComponentLabeler — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ComponentLabeler } from '../../src/sheet2midi/ComponentLabeler.js';
import { MockBus, createGrayImage, drawRect } from '../test-helper.js';

describe('ComponentLabeler', () => {

  // ── label ──────────────────────────────────
  describe('label', () => {
    it('labels a single connected component', () => {
      const bus = new MockBus();
      const cl = new ComponentLabeler(bus);
      const w = 10, h = 10;
      const bin = new Uint8Array(w * h).fill(255);
      // Draw a 3x3 black block
      drawRect(bin, w, 3, 3, 3, 3, 0);
      const { labels, count } = cl.label(bin, w, h);
      assert.equal(count, 1);
      // Check that the block pixels share the same label
      const l = labels[3 * w + 3];
      assert.ok(l > 0);
      assert.equal(labels[3 * w + 4], l);
      assert.equal(labels[4 * w + 3], l);
    });

    it('labels two separate components', () => {
      const bus = new MockBus();
      const cl = new ComponentLabeler(bus);
      const w = 20, h = 10;
      const bin = new Uint8Array(w * h).fill(255);
      // Two separate blocks
      drawRect(bin, w, 1, 1, 3, 3, 0);
      drawRect(bin, w, 10, 1, 3, 3, 0);
      const { count } = cl.label(bin, w, h);
      assert.equal(count, 2);
    });

    it('returns 0 for all-white image', () => {
      const bus = new MockBus();
      const cl = new ComponentLabeler(bus);
      const w = 10, h = 10;
      const bin = new Uint8Array(w * h).fill(255);
      const { count } = cl.label(bin, w, h);
      assert.equal(count, 0);
    });

    it('merges diagonally connected pixels (8-connectivity)', () => {
      const bus = new MockBus();
      const cl = new ComponentLabeler(bus);
      const w = 10, h = 10;
      const bin = new Uint8Array(w * h).fill(255);
      // Diagonal: (2,2) and (3,3)
      bin[2 * w + 2] = 0;
      bin[3 * w + 3] = 0;
      const { count } = cl.label(bin, w, h);
      assert.equal(count, 1, 'diagonal pixels should be one component');
    });
  });

  // ── extractFeatures ────────────────────────
  describe('extractFeatures', () => {
    it('extracts correct bbox and centroid for a rectangle', () => {
      const bus = new MockBus();
      const cl = new ComponentLabeler(bus);
      const w = 20, h = 20;
      const bin = new Uint8Array(w * h).fill(255);
      drawRect(bin, w, 5, 5, 6, 4, 0); // 6 wide, 4 tall at (5,5)
      const { labels, count } = cl.label(bin, w, h);
      const features = cl.extractFeatures(labels, w, h, count, 10);
      assert.equal(features.length, 1);
      const f = features[0];
      assert.equal(f.bbox.x, 5);
      assert.equal(f.bbox.y, 5);
      assert.equal(f.bbox.width, 6);
      assert.equal(f.bbox.height, 4);
      assert.equal(f.area, 24); // 6*4
      assert.ok(Math.abs(f.centroid.x - 7.5) < 0.1, `centroid.x = ${f.centroid.x}`);
      assert.ok(Math.abs(f.centroid.y - 6.5) < 0.1, `centroid.y = ${f.centroid.y}`);
      assert.ok(Math.abs(f.fillRatio - 1.0) < 0.01);
      assert.ok(Math.abs(f.aspectRatio - 1.5) < 0.01);
    });

    it('filters out tiny components', () => {
      const bus = new MockBus();
      const cl = new ComponentLabeler(bus);
      const w = 50, h = 50;
      const bin = new Uint8Array(w * h).fill(255);
      // One normal component and one tiny single pixel
      drawRect(bin, w, 10, 10, 8, 8, 0);
      bin[1 * w + 1] = 0;
      const { labels, count } = cl.label(bin, w, h);
      // With staffSpace=20, minSize=2.0px so single pixel is filtered
      const features = cl.extractFeatures(labels, w, h, count, 20);
      assert.equal(features.length, 1);
    });

    it('computes widthSS and heightSS relative to staffSpace', () => {
      const bus = new MockBus();
      const cl = new ComponentLabeler(bus);
      const w = 30, h = 30;
      const bin = new Uint8Array(w * h).fill(255);
      drawRect(bin, w, 5, 5, 10, 20, 0);
      const { labels, count } = cl.label(bin, w, h);
      const staffSpace = 10;
      const features = cl.extractFeatures(labels, w, h, count, staffSpace);
      assert.equal(features.length, 1);
      assert.ok(Math.abs(features[0].widthSS - 1.0) < 0.01);
      assert.ok(Math.abs(features[0].heightSS - 2.0) < 0.01);
    });
  });

  // ── splitComponent ──────────────────────────
  describe('splitComponent', () => {
    it('splits a component into sub-features given center points', () => {
      const bus = new MockBus();
      const cl = new ComponentLabeler(bus);
      const w = 40, h = 20;
      const bin = new Uint8Array(w * h).fill(255);
      // Two 10x10 blobs connected by a thin bridge
      drawRect(bin, w, 2, 5, 10, 10, 0);  // blob 1: x=2..11, y=5..14
      drawRect(bin, w, 20, 5, 10, 10, 0); // blob 2: x=20..29, y=5..14
      // Bridge
      drawRect(bin, w, 12, 9, 8, 2, 0);   // x=12..19, y=9..10
      const { labels, count } = cl.label(bin, w, h);
      const features = cl.extractFeatures(labels, w, h, count, 10);
      // Should be 1 merged component
      assert.equal(features.length, 1);
      // Split using two center points
      const centers = [{ x: 7, y: 10 }, { x: 25, y: 10 }];
      const splits = cl.splitComponent(features[0], centers, labels, w, 10);
      assert.equal(splits.length, 2);
      // Each split should have correct centroids near the given centers
      const sorted = splits.sort((a, b) => a.centroid.x - b.centroid.x);
      assert.ok(sorted[0].centroid.x < 15, `first split centroid.x=${sorted[0].centroid.x}`);
      assert.ok(sorted[1].centroid.x > 15, `second split centroid.x=${sorted[1].centroid.x}`);
      assert.ok(sorted[0].area > 0);
      assert.ok(sorted[1].area > 0);
    });
  });

  // ── hole counting ──────────────────────────
  describe('hole counting', () => {
    it('detects a hole in a ring shape', () => {
      const bus = new MockBus();
      const cl = new ComponentLabeler(bus);
      const w = 20, h = 20;
      const bin = new Uint8Array(w * h).fill(255);
      // Draw outer rectangle
      drawRect(bin, w, 3, 3, 14, 14, 0);
      // Carve out inner hole (white)
      drawRect(bin, w, 6, 6, 8, 8, 255);
      const { labels, count } = cl.label(bin, w, h);
      const features = cl.extractFeatures(labels, w, h, count, 5);
      assert.ok(features.length >= 1);
      const ring = features[0];
      assert.ok(ring.holes >= 1, `expected at least 1 hole, got ${ring.holes}`);
    });

    it('detects 0 holes in a solid rectangle', () => {
      const bus = new MockBus();
      const cl = new ComponentLabeler(bus);
      const w = 20, h = 20;
      const bin = new Uint8Array(w * h).fill(255);
      drawRect(bin, w, 5, 5, 10, 10, 0);
      const { labels, count } = cl.label(bin, w, h);
      const features = cl.extractFeatures(labels, w, h, count, 5);
      assert.equal(features[0].holes, 0);
    });
  });
});
