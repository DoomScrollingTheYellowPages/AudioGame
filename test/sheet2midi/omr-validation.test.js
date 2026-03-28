// ─────────────────────────────────────────────
// omr-validation.test.js — end-to-end OMR
// pipeline validation against ground truth JSON
// fixtures in TestObjects/
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { loadPngGray } from './node-png-loader.js';
import { ImageProcessor } from '../../src/sheet2midi/ImageProcessor.js';
import { SkewCorrector } from '../../src/sheet2midi/SkewCorrector.js';
import { StaffAnalyzer } from '../../src/sheet2midi/StaffAnalyzer.js';
import { ComponentLabeler } from '../../src/sheet2midi/ComponentLabeler.js';
import { SymbolClassifier } from '../../src/sheet2midi/SymbolClassifier.js';
import { PitchMapper } from '../../src/sheet2midi/PitchMapper.js';
import { DurationMapper } from '../../src/sheet2midi/DurationMapper.js';
import { GrammarValidator } from '../../src/sheet2midi/GrammarValidator.js';
import { MockBus } from '../test-helper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../');
const TEST_OBJECTS = resolve(REPO_ROOT, 'TestObjects');

// ── Pipeline runner ────────────────────────────

/**
 * Run the full OMR pipeline on a PNG file in Node.js.
 * Bypasses ImageProcessor.load() (browser-only) and uses the Node PNG decoder.
 * All other pipeline stages are pure JS and run identically to the browser.
 *
 * @param {string} imagePath — absolute path to PNG
 * @param {{ bpm?: number, timeSig?: number[] }} [options]
 * @returns {{ notes: Array, bars: number, totalBeats: number }}
 */
function runPipeline(imagePath, options = {}) {
  const timeSig = options.timeSig ?? [4, 4];

  const bus = new MockBus();
  const imageProcessor = new ImageProcessor(bus);
  const skewCorrector = new SkewCorrector(bus);
  const staffAnalyzer = new StaffAnalyzer(bus);
  const componentLabeler = new ComponentLabeler(bus);
  const symbolClassifier = new SymbolClassifier(bus);
  const pitchMapper = new PitchMapper(bus);
  const durationMapper = new DurationMapper(bus);
  const grammarValidator = new GrammarValidator(bus);

  // Stage 1: Load PNG via Node decoder (replaces ImageProcessor.load)
  let { gray, width, height } = loadPngGray(imagePath);

  // Stage 1.5: Border cropping
  const cropped = imageProcessor.cropBorders(gray, width, height);
  if (cropped.offsetX > 0 || cropped.offsetY > 0) {
    gray = cropped.gray;
    width = cropped.width;
    height = cropped.height;
  }

  // Stage 1.8: Auto-upscale small images
  let wasUpscaled = false;
  if (height < 200) {
    const factor = Math.min(Math.ceil(200 / height), 3);
    const upscaled = _upscaleGray(gray, width, height, factor);
    gray = upscaled.gray;
    width = upscaled.width;
    height = upscaled.height;
    wasUpscaled = true;
  }

  // Stage 2: Binarize
  const binary = imageProcessor.binarize(gray, width, height);

  // Stage 3: Skew correction (skip for upscaled digital images)
  let correctedGray, angle;
  if (wasUpscaled) {
    correctedGray = new Uint8Array(gray);
    angle = 0;
  } else {
    const result = skewCorrector.correct(binary, gray, width, height);
    correctedGray = result.data;
    angle = result.angle;
  }
  const correctedBinary = Math.abs(angle) > 0.002
    ? imageProcessor.binarize(correctedGray, width, height)
    : binary;

  // Stage 4: Staff line detection
  const { groups, staffSpace, lineThickness, staffRows } =
    staffAnalyzer.detect(correctedBinary, width, height);

  if (groups.length === 0) {
    throw new Error('No staff lines detected');
  }

  // Stage 5: Staff line removal + noise cleanup
  let cleaned = staffAnalyzer.removeStaffLines(
    correctedBinary, width, height, staffRows, lineThickness
  );
  cleaned = imageProcessor.medianFilter(cleaned, width, height);
  cleaned = imageProcessor.morphClose(cleaned, width, height,
    Math.ceil(lineThickness / 2) + 1);

  // Stage 6: Connected component labeling
  const { labels, count } = componentLabeler.label(cleaned, width, height);
  const components = componentLabeler.extractFeatures(
    labels, width, height, count, staffSpace
  );

  // Stage 6.5: Split note+stem combos
  const splitComponents = _splitNoteStems(components, correctedBinary, width, height, staffSpace);

  // Stage 7: Symbol classification
  const symbols = symbolClassifier.classify(splitComponents);

  // Stage 7.5: Leftmost clef filtering
  const clefSymbols = symbols.filter(s =>
    s.type === 'clef_treble' || s.type === 'clef_bass'
  );
  if (clefSymbols.length > 1) {
    const leftmostX = Math.min(...clefSymbols.map(s => s.component.centroid.x));
    const leftmostThreshold = leftmostX + staffSpace * 3;
    for (const s of clefSymbols) {
      if (s.component.centroid.x > leftmostThreshold) s.type = 'unknown';
    }
  }

  // Stage 8: Pitch assignment
  const pitchedNotes = pitchMapper.assignPitches(
    symbols, groups, staffSpace, correctedBinary, width
  );

  // Stage 9: Duration assignment
  const notesWithDuration = durationMapper.assignDurations(
    pitchedNotes, symbols, staffSpace
  );
  const rests = durationMapper.detectRests(symbols, groups, staffSpace);

  // Stage 10: Grammar validation
  const { notes: validatedNotes, rests: validatedRests } =
    grammarValidator.validate(notesWithDuration, rests, symbols, staffSpace, timeSig);

  // Compute bar count from grammar validator output
  // Only count barlines that fall between the first and last detected note
  const barlineSymbols = symbols.filter(s => s.type === 'bar_line');
  const noteXPositions = validatedNotes.map(n => n.x);
  const firstNoteX = noteXPositions.length > 0 ? Math.min(...noteXPositions) : 0;
  const lastNoteX = noteXPositions.length > 0 ? Math.max(...noteXPositions) : Infinity;
  const interiorBarlines = barlineSymbols.filter(s =>
    s.component.centroid.x > firstNoteX && s.component.centroid.x < lastNoteX
  ).length;
  const bars = interiorBarlines + 1;
  const totalBeats = bars * timeSig[0];

  // Normalize notes for comparison: { note, name, beats }
  const normalizedNotes = validatedNotes
    .sort((a, b) => a.x - b.x)
    .map(n => ({
      note: n.midiNote,
      name: `${n.noteName}${n.octave}`,
      beats: n.beats
    }));

  return { notes: normalizedNotes, bars, totalBeats };
}

// ── Inline helpers (mirror OMREngine private methods) ─────────────────

function _upscaleGray(gray, width, height, factor) {
  const nw = width * factor;
  const nh = height * factor;
  const out = new Uint8Array(nw * nh);
  for (let y = 0; y < nh; y++) {
    const srcY = y / factor;
    const y0 = Math.floor(srcY);
    const y1 = Math.min(y0 + 1, height - 1);
    const fy = srcY - y0;
    for (let x = 0; x < nw; x++) {
      const srcX = x / factor;
      const x0 = Math.floor(srcX);
      const x1 = Math.min(x0 + 1, width - 1);
      const fx = srcX - x0;
      out[y * nw + x] = Math.round(
        (1 - fx) * (1 - fy) * gray[y0 * width + x0]
        + fx * (1 - fy) * gray[y0 * width + x1]
        + (1 - fx) * fy * gray[y1 * width + x0]
        + fx * fy * gray[y1 * width + x1]
      );
    }
  }
  return { gray: out, width: nw, height: nh };
}

function _splitNoteStems(components, binary, imgWidth, imgHeight, staffSpace) {
  const result = [...components];
  const noteW = Math.round(staffSpace * 1.3);
  const minDensity = 0.45;
  const clefRegionEndX = staffSpace * 5;

  for (const comp of components) {
    if (comp.heightSS < 1.5 || comp.widthSS > 5.0 || comp.widthSS < 0.3) continue;
    if (comp.centroid.x < clefRegionEndX) continue;

    const bb = comp.bbox;
    const rowDensity = [];
    for (let y = bb.y; y < bb.y + bb.height && y < imgHeight; y++) {
      let count = 0;
      for (let x = bb.x; x < bb.x + bb.width && x < imgWidth; x++) {
        if (binary[y * imgWidth + x] === 0) count++;
      }
      rowDensity.push({ y, density: bb.width > 0 ? count / bb.width : 0 });
    }

    const peaks = [];
    let inPeak = false;
    let peakStart = 0;
    let peakMaxDensity = 0;
    let peakMaxRow = 0;

    for (let i = 0; i < rowDensity.length; i++) {
      const d = rowDensity[i].density;
      if (d >= minDensity) {
        if (!inPeak) {
          inPeak = true;
          peakStart = i;
          peakMaxDensity = d;
          peakMaxRow = i;
        } else if (d > peakMaxDensity) {
          peakMaxDensity = d;
          peakMaxRow = i;
        }
      } else if (inPeak) {
        const peakHeight = i - peakStart;
        if (peakHeight >= staffSpace * 0.3 && peakHeight <= staffSpace * 1.8) {
          peaks.push({ y: rowDensity[peakStart].y, height: peakHeight, centerRow: rowDensity[peakMaxRow].y });
        }
        inPeak = false;
      }
    }
    if (inPeak) {
      const peakHeight = rowDensity.length - peakStart;
      if (peakHeight >= staffSpace * 0.3 && peakHeight <= staffSpace * 1.8) {
        peaks.push({ y: rowDensity[peakStart].y, height: peakHeight, centerRow: rowDensity[peakMaxRow].y });
      }
    }

    for (const peak of peaks) {
      const subBbox = { x: bb.x, y: peak.y, width: bb.width, height: peak.height };
      let area = 0;
      let sumX = 0;
      let sumY = 0;
      for (let y = subBbox.y; y < subBbox.y + subBbox.height && y < imgHeight; y++) {
        for (let x = subBbox.x; x < subBbox.x + subBbox.width && x < imgWidth; x++) {
          if (binary[y * imgWidth + x] === 0) { area++; sumX += x; sumY += y; }
        }
      }
      if (area < 5) continue;
      result.push({
        label: comp.label,
        bbox: subBbox,
        centroid: { x: sumX / area, y: sumY / area },
        area,
        fillRatio: area / (subBbox.width * subBbox.height),
        aspectRatio: subBbox.width / subBbox.height,
        holes: 0,
        widthSS: subBbox.width / staffSpace,
        heightSS: subBbox.height / staffSpace,
        _splitFrom: true
      });
    }
  }
  return result;
}

// ── Test fixture loader ────────────────────────

function loadExpected(name) {
  const p = resolve(TEST_OBJECTS, `${name}.expected.json`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

// ── Validation helper ─────────────────────────

/**
 * Run all strict assertions for a fixture.
 * @param {string} name — fixture name without extension (e.g. 'CMajorScale')
 */
function validateFixture(name) {
  const expected = loadExpected(name);
  const imagePath = resolve(TEST_OBJECTS, expected.image);
  const result = runPipeline(imagePath);

  it(`${name}: note count equals ${expected.notes.length}`, () => {
    assert.equal(result.notes.length, expected.notes.length,
      `Got ${result.notes.length} notes: ${result.notes.map(n => n.name).join(', ')}`);
  });

  it(`${name}: notes are in correct pitch order`, () => {
    const got = result.notes.map(n => n.note);
    const exp = expected.notes.map(n => n.note);
    assert.deepEqual(got, exp,
      `Pitch mismatch.\nExpected: ${exp.join(', ')}\nGot:      ${got.join(', ')}`);
  });

  it(`${name}: note names match`, () => {
    const got = result.notes.map(n => n.name);
    const exp = expected.notes.map(n => n.name);
    assert.deepEqual(got, exp,
      `Name mismatch.\nExpected: ${exp.join(', ')}\nGot:      ${got.join(', ')}`);
  });

  it(`${name}: all notes have beats = 1`, () => {
    for (const n of result.notes) {
      assert.equal(n.beats, 1,
        `Note ${n.name} has beats=${n.beats}, expected 1`);
    }
  });

  it(`${name}: bar count equals ${expected.bars}`, () => {
    assert.equal(result.bars, expected.bars,
      `Got ${result.bars} bars, expected ${expected.bars}`);
  });

  it(`${name}: total beats equals ${expected.totalBeats}`, () => {
    const sum = result.notes.reduce((acc, n) => acc + n.beats, 0);
    assert.equal(sum, expected.totalBeats,
      `Sum of beats = ${sum}, expected ${expected.totalBeats}`);
  });
}

// ── Test suites ───────────────────────────────

describe('OMR Validation: CMajorScale', () => {
  validateFixture('CMajorScale');
});

describe('OMR Validation: AMinorScale', () => {
  validateFixture('AMinorScale');
});
