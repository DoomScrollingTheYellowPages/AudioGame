// ─────────────────────────────────────────────
// LedgerDetector — scan for short horizontal
// strokes beyond staff extremes at staffSpace
// intervals. Runs before CCL to provide priority
// labels for ledger-line components.
// ─────────────────────────────────────────────

// ── Constants ──────────────────────────────────

const MIN_LEDGER_WIDTH_SS = 0.8;  // minimum ledger width in staffSpaces
const MAX_LEDGER_WIDTH_SS = 3.5;  // maximum ledger width in staffSpaces
const MAX_LEDGER_DISTANCE_SS = 5; // how far beyond staff to scan (in staffSpaces)
const LEDGER_FILL_THRESHOLD = 0.15; // minimum fill ratio for a ledger candidate

// ── LedgerDetector ────────────────────────────

export class LedgerDetector {
  /**
   * Detect ledger lines in zones beyond staff extremes.
   *
   * @param {Uint8Array} binary - 0=foreground, 255=background
   * @param {number} width
   * @param {number} height
   * @param {number[][]} groups - array of staff groups, each an array of 5 y-positions
   * @param {number} staffSpace
   * @param {number} lineThickness
   * @param {import('./SIG.js').SIG} sig
   * @returns {Array<{bbox: {x:number,y:number,width:number,height:number}}>}
   */
  detect(binary, width, height, groups, staffSpace, lineThickness, sig) {
    const minWidth = Math.round(staffSpace * MIN_LEDGER_WIDTH_SS);
    const maxWidth = Math.round(staffSpace * MAX_LEDGER_WIDTH_SS);
    const maxDist = Math.round(staffSpace * MAX_LEDGER_DISTANCE_SS);
    const tolerance = Math.max(2, Math.round(staffSpace * 0.3));
    const ledgers = [];

    for (const group of groups) {
      const topLine = Math.min(...group);
      const bottomLine = Math.max(...group);

      // Scan zones above and below staff at staffSpace intervals
      const candidateYs = [];

      // Above staff
      for (let d = 1; d <= MAX_LEDGER_DISTANCE_SS; d++) {
        const y = topLine - d * staffSpace;
        if (y >= 0) candidateYs.push(y);
      }
      // Below staff
      for (let d = 1; d <= MAX_LEDGER_DISTANCE_SS; d++) {
        const y = bottomLine + d * staffSpace;
        if (y < height) candidateYs.push(y);
      }

      for (const targetY of candidateYs) {
        // Scan a band around the target Y for horizontal runs of ink
        const bandTop = Math.max(0, targetY - tolerance);
        const bandBottom = Math.min(height - 1, targetY + lineThickness + tolerance);

        // Find horizontal runs of black pixels within this band
        const runs = this._findHorizontalRuns(binary, width, bandTop, bandBottom);

        for (const run of runs) {
          if (run.width < minWidth || run.width > maxWidth) continue;

          // Check fill ratio
          let ink = 0;
          const runH = bandBottom - bandTop + 1;
          for (let y = bandTop; y <= bandBottom; y++) {
            for (let x = run.startX; x < run.startX + run.width && x < width; x++) {
              if (binary[y * width + x] === 0) ink++;
            }
          }
          const total = run.width * runH;
          if (total === 0 || ink / total < LEDGER_FILL_THRESHOLD) continue;

          const bbox = { x: run.startX, y: bandTop, width: run.width, height: runH };
          const grade = Math.min(1.0, 0.5 + (run.width / staffSpace) * 0.15);

          const inter = sig.addInter({
            type: 'ledger',
            grade,
            bbox,
            data: { detectedBy: 'LedgerDetector', targetY }
          });
          ledgers.push({ bbox, interId: inter.id });
        }
      }
    }

    return ledgers;
  }

  /**
   * Find horizontal runs of black pixels in a band of rows.
   * Merges vertically-adjacent runs into single wider strokes.
   * @param {Uint8Array} binary
   * @param {number} width
   * @param {number} bandTop
   * @param {number} bandBottom
   * @returns {Array<{startX: number, width: number}>}
   */
  _findHorizontalRuns(binary, width, bandTop, bandBottom) {
    // Project all rows in the band into a single horizontal profile
    const profile = new Uint16Array(width);
    const rowCount = bandBottom - bandTop + 1;
    for (let y = bandTop; y <= bandBottom; y++) {
      for (let x = 0; x < width; x++) {
        if (binary[y * width + x] === 0) profile[x]++;
      }
    }

    // Find contiguous runs where at least half the rows have ink
    const threshold = Math.max(1, Math.floor(rowCount * 0.3));
    const runs = [];
    let runStart = -1;

    for (let x = 0; x <= width; x++) {
      if (x < width && profile[x] >= threshold) {
        if (runStart === -1) runStart = x;
      } else {
        if (runStart !== -1) {
          runs.push({ startX: runStart, width: x - runStart });
          runStart = -1;
        }
      }
    }

    return runs;
  }
}
