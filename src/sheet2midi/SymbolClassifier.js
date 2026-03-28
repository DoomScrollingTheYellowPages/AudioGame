// ─────────────────────────────────────────────
// SymbolClassifier — heuristic + NCC template
// matching for classifying music notation symbols
// ─────────────────────────────────────────────

// ── Symbol Types ───────────────────────────────

export const SymbolType = {
  FILLED_NOTEHEAD: 'filled_notehead',
  OPEN_NOTEHEAD: 'open_notehead',
  WHOLE_NOTE: 'whole_note',
  STEM: 'stem',
  BEAM: 'beam',
  BAR_LINE: 'bar_line',
  DOT: 'dot',
  REST_QUARTER: 'rest_quarter',
  REST_HALF: 'rest_half',
  REST_WHOLE: 'rest_whole',
  REST_EIGHTH: 'rest_eighth',
  FLAG_EIGHTH: 'flag_eighth',
  FLAG_SIXTEENTH: 'flag_sixteenth',
  CLEF_TREBLE: 'clef_treble',
  CLEF_BASS: 'clef_bass',
  TIME_SIG: 'time_sig',
  SHARP: 'sharp',
  FLAT: 'flat',
  NATURAL: 'natural',
  UNKNOWN: 'unknown'
};

// ── Classification Rules ───────────────────────

const RULES = [
  // ── Tiny symbols (check first to avoid confusion) ──
  {
    type: SymbolType.DOT,
    test: (c) => c.aspectRatio > 0.7 && c.aspectRatio < 1.4
      && c.fillRatio > 0.7
      && c.widthSS > 0.15 && c.widthSS < 0.5
      && c.heightSS > 0.15 && c.heightSS < 0.5
  },
  // ── Clefs (check early — tall, distinctive shapes) ──
  {
    type: SymbolType.CLEF_TREBLE,
    test: (c) => c.heightSS >= 3.0
      && c.widthSS >= 0.8 && c.widthSS <= 3.5
      && c.aspectRatio >= 0.15 && c.aspectRatio <= 0.65
      && c.fillRatio >= 0.15 && c.fillRatio <= 0.65
      && c.holes >= 1   // treble clef loop creates an enclosed white region
  },
  {
    type: SymbolType.CLEF_BASS,
    test: (c) => c.heightSS >= 1.5 && c.heightSS <= 3.5
      && c.widthSS >= 0.8 && c.widthSS <= 3.0
      && c.aspectRatio >= 0.6 && c.aspectRatio <= 1.5
      && c.fillRatio >= 0.3
  },
  // ── Tall thin symbols ──
  {
    type: SymbolType.BAR_LINE,
    test: (c) => c.aspectRatio >= 0.01 && c.aspectRatio <= 0.18
      && c.fillRatio > 0.75
      && c.widthSS >= 0.05 && c.widthSS <= 0.35
      && c.heightSS >= 3.5
  },
  {
    type: SymbolType.STEM,
    test: (c) => c.aspectRatio >= 0.03 && c.aspectRatio <= 0.3
      && c.fillRatio > 0.7
      && c.widthSS >= 0.05 && c.widthSS <= 0.4
      && c.heightSS >= 2.0
  },
  // ── Wide symbols ──
  {
    type: SymbolType.BEAM,
    test: (c) => c.aspectRatio > 2.5
      && c.fillRatio > 0.6
      && c.heightSS >= 0.2 && c.heightSS <= 0.7
      && c.widthSS > 1.5
  },
  // ── Noteheads ──
  {
    type: SymbolType.FILLED_NOTEHEAD,
    test: (c) => c.aspectRatio >= 0.7 && c.aspectRatio <= 2.5
      && c.fillRatio > 0.55
      && c.widthSS >= 0.4 && c.widthSS <= 2.0
      && c.heightSS >= 0.3 && c.heightSS <= 1.8
      && c.holes === 0
  },
  {
    type: SymbolType.OPEN_NOTEHEAD,
    test: (c) => c.aspectRatio >= 0.7 && c.aspectRatio <= 2.0
      && c.fillRatio >= 0.25 && c.fillRatio <= 0.75
      && c.widthSS >= 0.4 && c.widthSS <= 2.0
      && c.heightSS >= 0.3 && c.heightSS <= 1.8
      && c.holes >= 1
  },
  {
    type: SymbolType.WHOLE_NOTE,
    test: (c) => c.aspectRatio >= 1.1 && c.aspectRatio <= 2.2
      && c.fillRatio >= 0.25 && c.fillRatio <= 0.65
      && c.widthSS >= 0.9 && c.widthSS <= 2.0
      && c.heightSS >= 0.6 && c.heightSS <= 1.5
      && c.holes >= 1
  },
  // ── Rests & flags ──
  {
    type: SymbolType.REST_QUARTER,
    test: (c) => c.aspectRatio >= 0.25 && c.aspectRatio <= 0.85
      && c.fillRatio >= 0.35 && c.fillRatio <= 0.75
      && c.widthSS >= 0.5 && c.widthSS <= 1.5
      && c.heightSS >= 2.0 && c.heightSS <= 4.0
  },
  {
    type: SymbolType.FLAG_EIGHTH,
    test: (c) => c.aspectRatio >= 0.4 && c.aspectRatio <= 1.2
      && c.fillRatio >= 0.3 && c.fillRatio <= 0.7
      && c.widthSS >= 0.4 && c.widthSS <= 1.2
      && c.heightSS >= 1.0 && c.heightSS <= 2.5
  },
  // ── Accidentals ──────────────────────────────
  // Sharp: tall vertical strokes with horizontal cross-bars, narrow-ish
  {
    type: SymbolType.SHARP,
    test: (c) => c.heightSS >= 1.2 && c.heightSS <= 3.0
      && c.widthSS >= 0.4 && c.widthSS <= 1.5
      && c.aspectRatio >= 0.2 && c.aspectRatio <= 0.8
      && c.fillRatio >= 0.2 && c.fillRatio <= 0.6
  },
  // Flat: tall stem with a round belly at the bottom, narrow
  {
    type: SymbolType.FLAT,
    test: (c) => c.heightSS >= 1.5 && c.heightSS <= 3.5
      && c.widthSS >= 0.3 && c.widthSS <= 1.2
      && c.aspectRatio >= 0.15 && c.aspectRatio <= 0.6
      && c.fillRatio >= 0.25 && c.fillRatio <= 0.6
  },
  // Natural: similar to sharp but typically narrower with offset cross-bars
  {
    type: SymbolType.NATURAL,
    test: (c) => c.heightSS >= 1.2 && c.heightSS <= 3.0
      && c.widthSS >= 0.3 && c.widthSS <= 1.0
      && c.aspectRatio >= 0.15 && c.aspectRatio <= 0.5
      && c.fillRatio >= 0.15 && c.fillRatio <= 0.5
  }
];

// ── SymbolClassifier ───────────────────────────

export class SymbolClassifier {
  /**
   * @param {EventBus} bus
   */
  constructor(bus) {
    this._bus = bus;
  }

  /**
   * Classify a single component using heuristic rules.
   * @param {ComponentFeatures} component
   * @returns {string} SymbolType value
   */
  classifyHeuristic(component) {
    for (const rule of RULES) {
      if (rule.test(component)) return rule.type;
    }
    return SymbolType.UNKNOWN;
  }

  /**
   * Classify all components.
   * @param {ComponentFeatures[]} components
   * @returns {Array<{component: ComponentFeatures, type: string, confidence: number}>}
   */
  classify(components) {
    const results = [];
    for (const c of components) {
      const type = this.classifyHeuristic(c);
      // Confidence based on how well it matches center of expected ranges
      const confidence = type !== SymbolType.UNKNOWN ? this._computeConfidence(c, type) : 0;
      results.push({ component: c, type, confidence });

      // Debug: log clef candidates and large components that might be clefs
      if (type === SymbolType.CLEF_TREBLE || type === SymbolType.CLEF_BASS
        || (c.heightSS >= 2.5 && c.widthSS >= 0.8 && c.widthSS <= 4.0
            && c.aspectRatio < 1.0)) {
        console.log(`[OMR] Clef candidate: type=${type} hSS=${c.heightSS.toFixed(2)} wSS=${c.widthSS.toFixed(2)} ar=${c.aspectRatio.toFixed(3)} fill=${c.fillRatio.toFixed(3)} holes=${c.holes} bbox=${c.bbox.x},${c.bbox.y} ${c.bbox.width}x${c.bbox.height}`);
      }
    }

    this._bus.emit('omr:symbols', { symbols: results });
    return results;
  }

  /**
   * Compute confidence score for a classification.
   * @param {ComponentFeatures} c
   * @param {string} type
   * @returns {number} 0–1
   */
  _computeConfidence(c, type) {
    // Simple confidence: how close to expected center values
    const expected = EXPECTED_CENTERS[type];
    if (!expected) return 0.5;

    let score = 1.0;
    if (expected.aspectRatio) {
      const diff = Math.abs(c.aspectRatio - expected.aspectRatio) / expected.aspectRatio;
      score *= Math.max(0, 1 - diff);
    }
    if (expected.fillRatio) {
      const diff = Math.abs(c.fillRatio - expected.fillRatio) / expected.fillRatio;
      score *= Math.max(0, 1 - diff);
    }
    return Math.max(0.1, score);
  }

  /**
   * Normalized Cross-Correlation template matching.
   * @param {Uint8Array} binary - full image
   * @param {number} imgWidth
   * @param {Uint8Array} template - template image
   * @param {number} tplWidth
   * @param {number} tplHeight
   * @param {{x: number, y: number, width: number, height: number}} searchRegion
   * @returns {{x: number, y: number, score: number}}
   */
  nccMatch(binary, imgWidth, template, tplWidth, tplHeight, searchRegion) {
    // Compute template mean
    let tplSum = 0;
    const tplSize = tplWidth * tplHeight;
    for (let i = 0; i < tplSize; i++) tplSum += template[i];
    const tplMean = tplSum / tplSize;

    // Precompute template deviation
    let tplVar = 0;
    for (let i = 0; i < tplSize; i++) {
      const d = template[i] - tplMean;
      tplVar += d * d;
    }
    const tplStd = Math.sqrt(tplVar);
    if (tplStd < 1) return { x: searchRegion.x, y: searchRegion.y, score: 0 };

    let bestScore = -1;
    let bestX = searchRegion.x;
    let bestY = searchRegion.y;

    const endX = searchRegion.x + searchRegion.width - tplWidth;
    const endY = searchRegion.y + searchRegion.height - tplHeight;

    for (let sy = searchRegion.y; sy <= endY; sy++) {
      for (let sx = searchRegion.x; sx <= endX; sx++) {
        // Compute patch mean
        let patchSum = 0;
        for (let ty = 0; ty < tplHeight; ty++) {
          for (let tx = 0; tx < tplWidth; tx++) {
            patchSum += binary[(sy + ty) * imgWidth + (sx + tx)];
          }
        }
        const patchMean = patchSum / tplSize;

        // Compute NCC
        let num = 0;
        let patchVar = 0;
        for (let ty = 0; ty < tplHeight; ty++) {
          for (let tx = 0; tx < tplWidth; tx++) {
            const pv = binary[(sy + ty) * imgWidth + (sx + tx)] - patchMean;
            const tv = template[ty * tplWidth + tx] - tplMean;
            num += pv * tv;
            patchVar += pv * pv;
          }
        }
        const patchStd = Math.sqrt(patchVar);
        if (patchStd < 1) continue;

        const score = num / (patchStd * tplStd);
        if (score > bestScore) {
          bestScore = score;
          bestX = sx;
          bestY = sy;
        }
      }
    }

    return { x: bestX, y: bestY, score: bestScore };
  }

  /**
   * Generate a procedural notehead template at the given staff space size.
   * @param {number} staffSpace
   * @returns {{data: Uint8Array, width: number, height: number}}
   */
  generateNoteheadTemplate(staffSpace) {
    const w = Math.round(staffSpace * 1.4);
    const h = Math.round(staffSpace);
    const data = new Uint8Array(w * h).fill(255);

    // Draw filled ellipse
    const cx = w / 2;
    const cy = h / 2;
    const rx = w / 2 - 1;
    const ry = h / 2 - 1;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1.0) {
          data[y * w + x] = 0;
        }
      }
    }

    return { data, width: w, height: h };
  }

  /**
   * Apply distance transform to separate touching noteheads.
   * Returns local maxima positions within a binary blob.
   * @param {Uint8Array} binary
   * @param {number} width
   * @param {number} height
   * @param {{x: number, y: number, width: number, height: number}} bbox
   * @returns {Array<{x: number, y: number}>} centers of separated noteheads
   */
  distanceTransformCenters(binary, width, bbox) {
    const w = bbox.width;
    const h = bbox.height;
    const dt = new Float64Array(w * h);

    // Initialize: Infinity for foreground, 0 for background.
    // Treat bbox boundary pixels as background so edge foreground
    // pixels get low DT values, making true blob centers stand out.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const imgIdx = (bbox.y + y) * width + (bbox.x + x);
        const isBorder = (y === 0 || y === h - 1 || x === 0 || x === w - 1);
        dt[y * w + x] = (!isBorder && binary[imgIdx] === 0) ? Infinity : 0;
      }
    }

    // Forward pass
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (dt[idx] === 0) continue;
        let minDist = dt[idx];
        if (x > 0) minDist = Math.min(minDist, dt[idx - 1] + 1);
        if (y > 0) minDist = Math.min(minDist, dt[idx - w] + 1);
        dt[idx] = minDist;
      }
    }

    // Backward pass
    for (let y = h - 1; y >= 0; y--) {
      for (let x = w - 1; x >= 0; x--) {
        const idx = y * w + x;
        if (dt[idx] === 0) continue;
        if (x < w - 1) dt[idx] = Math.min(dt[idx], dt[idx + 1] + 1);
        if (y < h - 1) dt[idx] = Math.min(dt[idx], dt[idx + w] + 1);
      }
    }

    // Find local maxima
    const centers = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const v = dt[idx];
        if (v < 2) continue;
        // Check 8-neighborhood
        if (v >= dt[idx - 1] && v >= dt[idx + 1]
          && v >= dt[idx - w] && v >= dt[idx + w]
          && v >= dt[idx - w - 1] && v >= dt[idx - w + 1]
          && v >= dt[idx + w - 1] && v >= dt[idx + w + 1]) {
          centers.push({ x: bbox.x + x, y: bbox.y + y });
        }
      }
    }

    return centers;
  }
}

// ── Expected Center Values ─────────────────────

const EXPECTED_CENTERS = {
  [SymbolType.FILLED_NOTEHEAD]: { aspectRatio: 1.35, fillRatio: 0.8 },
  [SymbolType.OPEN_NOTEHEAD]: { aspectRatio: 1.35, fillRatio: 0.5 },
  [SymbolType.WHOLE_NOTE]: { aspectRatio: 1.5, fillRatio: 0.4 },
  [SymbolType.STEM]: { aspectRatio: 0.12, fillRatio: 0.9 },
  [SymbolType.BEAM]: { aspectRatio: 5.0, fillRatio: 0.8 },
  [SymbolType.BAR_LINE]: { aspectRatio: 0.08, fillRatio: 0.9 },
  [SymbolType.DOT]: { aspectRatio: 1.0, fillRatio: 0.85 },
  [SymbolType.REST_QUARTER]: { aspectRatio: 0.5, fillRatio: 0.5 },
  [SymbolType.SHARP]: { aspectRatio: 0.45, fillRatio: 0.4 },
  [SymbolType.FLAT]: { aspectRatio: 0.35, fillRatio: 0.4 },
  [SymbolType.NATURAL]: { aspectRatio: 0.3, fillRatio: 0.35 },
};
