// ─────────────────────────────────────────────
// ImageProcessor — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ImageProcessor } from '../../src/sheet2midi/ImageProcessor.js';
import { MockBus, createGrayImage } from '../test-helper.js';

describe('ImageProcessor', () => {

  // ── Otsu Threshold ─────────────────────────
  describe('otsuThreshold', () => {
    it('finds a threshold separating a bimodal image', () => {
      const bus = new MockBus();
      const ip = new ImageProcessor(bus);
      // Create a clearly bimodal distribution: 500 pixels near 50, 500 near 200
      const gray = new Uint8Array(1000);
      for (let i = 0; i < 500; i++) gray[i] = 50;
      for (let i = 500; i < 1000; i++) gray[i] = 200;
      const t = ip.otsuThreshold(gray);
      // Otsu should separate the two clusters — threshold between 50 and 200
      assert.ok(t >= 50 && t <= 200, `threshold ${t} should be between 50-200`);
      // Verify it actually works: pixels at 50 should be black, at 200 should be white
      const bin = ip.binarizeOtsu(gray);
      assert.equal(bin[0], 0, 'dark pixel should be black');
      assert.equal(bin[999], 255, 'light pixel should be white');
    });

    it('returns low threshold for mostly-black image', () => {
      const bus = new MockBus();
      const ip = new ImageProcessor(bus);
      const gray = new Uint8Array(1000).fill(10);
      // Add a few white pixels
      for (let i = 0; i < 10; i++) gray[i] = 250;
      const t = ip.otsuThreshold(gray);
      assert.ok(t < 200, `threshold ${t} should be below 200`);
    });
  });

  // ── Binarize (Otsu) ───────────────────────
  describe('binarize', () => {
    it('produces only 0 and 255 values', () => {
      const bus = new MockBus();
      const ip = new ImageProcessor(bus);
      const gray = new Uint8Array(100);
      for (let i = 0; i < 100; i++) gray[i] = i * 2.5;
      const bin = ip.binarize(gray);
      for (let i = 0; i < bin.length; i++) {
        assert.ok(bin[i] === 0 || bin[i] === 255, `pixel ${i} is ${bin[i]}`);
      }
    });

    it('preserves input array length', () => {
      const bus = new MockBus();
      const ip = new ImageProcessor(bus);
      const gray = createGrayImage(10, 10, 128);
      const bin = ip.binarize(gray);
      assert.equal(bin.length, gray.length);
    });
  });

  // ── Median Filter ──────────────────────────
  describe('medianFilter', () => {
    it('removes salt-and-pepper noise', () => {
      const bus = new MockBus();
      const ip = new ImageProcessor(bus);
      const w = 10, h = 10;
      const gray = createGrayImage(w, h, 128);
      // Add a single noisy pixel
      gray[5 * w + 5] = 255;
      const filtered = ip.medianFilter(gray, w, h);
      // The noisy pixel should be smoothed toward 128
      assert.ok(filtered[5 * w + 5] < 200, `noisy pixel was ${filtered[5 * w + 5]}`);
    });

    it('preserves image dimensions', () => {
      const bus = new MockBus();
      const ip = new ImageProcessor(bus);
      const w = 20, h = 15;
      const gray = createGrayImage(w, h);
      const filtered = ip.medianFilter(gray, w, h);
      assert.equal(filtered.length, w * h);
    });

    it('preserves border pixels unchanged', () => {
      const bus = new MockBus();
      const ip = new ImageProcessor(bus);
      const w = 5, h = 5;
      const gray = createGrayImage(w, h, 100);
      gray[0] = 50; // top-left corner
      const filtered = ip.medianFilter(gray, w, h);
      assert.equal(filtered[0], 50);
    });
  });

  // ── Border Cropping ────────────────────────
  describe('cropBorders', () => {
    it('returns original image if content fills entire area', () => {
      const bus = new MockBus();
      const ip = new ImageProcessor(bus);
      const w = 64, h = 64;
      // All black — every cell has content
      const gray = createGrayImage(w, h, 0);
      const result = ip.cropBorders(gray, w, h);
      assert.equal(result.width, w);
      assert.equal(result.height, h);
      assert.equal(result.offsetX, 0);
      assert.equal(result.offsetY, 0);
    });

    it('trims white borders around a centered black block', () => {
      const bus = new MockBus();
      const ip = new ImageProcessor(bus);
      const w = 128, h = 128;
      const gray = createGrayImage(w, h, 255); // all white
      // Draw a black block in the center
      for (let y = 40; y < 88; y++) {
        for (let x = 40; x < 88; x++) {
          gray[y * w + x] = 0;
        }
      }
      const result = ip.cropBorders(gray, w, h);
      assert.ok(result.width < w, `cropped width ${result.width} should be < ${w}`);
      assert.ok(result.height < h, `cropped height ${result.height} should be < ${h}`);
      assert.ok(result.offsetX > 0, 'should have positive x offset');
      assert.ok(result.offsetY > 0, 'should have positive y offset');
    });
  });

  // ── binarizeOtsu ────────────────────────────
  describe('binarizeOtsu', () => {
    it('converts gray image to binary with only 0 and 255', () => {
      const bus = new MockBus();
      const ip = new ImageProcessor(bus);
      const gray = new Uint8Array(200);
      for (let i = 0; i < 200; i++) gray[i] = i % 256;
      const bin = ip.binarizeOtsu(gray);
      assert.equal(bin.length, 200);
      for (const v of bin) assert.ok(v === 0 || v === 255);
    });
  });

  // ── Auto binarize (selects Otsu vs Sauvola) ─
  describe('binarize (auto-select)', () => {
    it('uses Otsu for uniform illumination', () => {
      const bus = new MockBus();
      const ip = new ImageProcessor(bus);
      const w = 20, h = 20;
      // Uniform image — all quadrant means are ~128
      const gray = createGrayImage(w, h, 128);
      const bin = ip.binarize(gray, w, h);
      assert.equal(bin.length, w * h);
      for (const v of bin) assert.ok(v === 0 || v === 255);
    });

    it('uses Sauvola for uneven illumination', () => {
      const bus = new MockBus();
      const ip = new ImageProcessor(bus);
      const w = 40, h = 40;
      const gray = createGrayImage(w, h, 50);
      // Make top-right quadrant much brighter (>30 diff from others)
      for (let y = 0; y < 20; y++) {
        for (let x = 20; x < 40; x++) {
          gray[y * w + x] = 200;
        }
      }
      const bin = ip.binarize(gray, w, h);
      assert.equal(bin.length, w * h);
      for (const v of bin) assert.ok(v === 0 || v === 255);
    });
  });

  // ── Morphological Close ────────────────────
  describe('morphClose', () => {
    it('fills small gaps in binary image', () => {
      const bus = new MockBus();
      const ip = new ImageProcessor(bus);
      const w = 10, h = 10;
      // Create binary image with a black region and a 1-pixel white gap
      const bin = new Uint8Array(w * h).fill(255);
      for (let x = 0; x < w; x++) {
        bin[3 * w + x] = 0; // row 3 black
        // row 4 white (gap)
        bin[5 * w + x] = 0; // row 5 black
      }
      const closed = ip.morphClose(bin, w, h, 1);
      // The gap at row 4 should be filled (dilate then erode)
      assert.equal(closed[4 * w + 5], 0, 'gap should be filled');
    });

    it('preserves image dimensions', () => {
      const bus = new MockBus();
      const ip = new ImageProcessor(bus);
      const w = 15, h = 15;
      const bin = new Uint8Array(w * h).fill(255);
      const closed = ip.morphClose(bin, w, h, 1);
      assert.equal(closed.length, w * h);
    });
  });

  // ── Integral Images ────────────────────────
  describe('buildIntegralImages', () => {
    it('builds correct integral image for small input', () => {
      const bus = new MockBus();
      const ip = new ImageProcessor(bus);
      // 3x3 image all value 1 — no padding, same dimensions
      const gray = new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1, 1]);
      const { integral, integralSq } = ip.buildIntegralImages(gray, 3, 3);
      // Bottom-right corner (index 8) should be sum of all 9 pixels = 9
      assert.equal(integral[8], 9);
      assert.equal(integralSq[8], 9); // 1^2 * 9
      // Top-left corner (index 0) should be first pixel = 1
      assert.equal(integral[0], 1);
    });
  });

  // ── Sauvola Binarization ───────────────────
  describe('binarizeSauvola', () => {
    it('produces only 0 and 255 values', () => {
      const bus = new MockBus();
      const ip = new ImageProcessor(bus);
      const w = 30, h = 30;
      const gray = createGrayImage(w, h, 128);
      // Add some variation
      for (let i = 0; i < gray.length; i++) gray[i] = (i * 7) % 256;
      const bin = ip.binarizeSauvola(gray, w, h);
      for (let i = 0; i < bin.length; i++) {
        assert.ok(bin[i] === 0 || bin[i] === 255, `pixel ${i} is ${bin[i]}`);
      }
    });

    it('preserves image dimensions', () => {
      const bus = new MockBus();
      const ip = new ImageProcessor(bus);
      const w = 20, h = 20;
      const gray = createGrayImage(w, h);
      const bin = ip.binarizeSauvola(gray, w, h);
      assert.equal(bin.length, w * h);
    });
  });
});
