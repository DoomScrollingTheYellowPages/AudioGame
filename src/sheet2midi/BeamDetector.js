// ─────────────────────────────────────────────
// BeamDetector — morphological closing to find
// beam regions before connected-component labeling.
// Beams are thick horizontal/diagonal ink strokes
// spanning multiple staff spaces.
// ─────────────────────────────────────────────

// ── Constants ──────────────────────────────────

const MIN_BEAM_WIDTH_SS = 1.5;   // minimum beam width in staffSpaces
const MIN_BEAM_THICKNESS = 2;    // minimum beam thickness in pixels
const BEAM_FILL_THRESHOLD = 0.6; // minimum fill ratio for a beam region

// ── BeamDetector ──────────────────────────────

export class BeamDetector {
  /**
   * Detect beam regions in a binary image using horizontal run-length analysis.
   * For each row, finds runs of black pixels that are thick enough (vertically)
   * and wide enough (horizontally) to be beams.
   *
   * @param {Uint8Array} binary - 0=foreground, 255=background
   * @param {number} width
   * @param {number} height
   * @param {number} staffSpace
   * @param {import('./SIG.js').SIG} sig - SIG to add beam Inters to
   * @returns {Array<{bbox: {x:number,y:number,width:number,height:number}}>}
   */
  detect(binary, width, height, staffSpace, sig) {
    const minWidth = Math.round(staffSpace * MIN_BEAM_WIDTH_SS);
    const beams = [];

    // Vertical run-length: for each pixel, count how many consecutive
    // black pixels extend downward
    const vRun = new Uint16Array(width * height);
    for (let x = 0; x < width; x++) {
      let run = 0;
      for (let y = height - 1; y >= 0; y--) {
        if (binary[y * width + x] === 0) {
          run++;
        } else {
          run = 0;
        }
        vRun[y * width + x] = run;
      }
    }

    // Track which rows have been claimed by a beam to avoid duplicates
    const claimed = new Uint8Array(width * height);

    // Scan for thick horizontal runs
    for (let y = 0; y < height; y++) {
      let runStart = -1;
      for (let x = 0; x <= width; x++) {
        const thick = x < width && vRun[y * width + x] >= MIN_BEAM_THICKNESS;
        if (thick && !claimed[y * width + x]) {
          if (runStart === -1) runStart = x;
        } else {
          if (runStart !== -1) {
            const runWidth = x - runStart;
            if (runWidth >= minWidth) {
              // Determine beam thickness at this run
              let maxThick = 0;
              for (let rx = runStart; rx < x; rx++) {
                if (vRun[y * width + rx] > maxThick) maxThick = vRun[y * width + rx];
              }
              // Verify fill ratio in the candidate region
              const bh = Math.min(maxThick, height - y);
              let ink = 0;
              const total = runWidth * bh;
              for (let by = y; by < y + bh; by++) {
                for (let bx = runStart; bx < x; bx++) {
                  if (binary[by * width + bx] === 0) ink++;
                }
              }
              if (total > 0 && ink / total >= BEAM_FILL_THRESHOLD) {
                const bbox = { x: runStart, y, width: runWidth, height: bh };
                // Grade based on how beam-like it is (width and thickness)
                const widthScore = Math.min(1.0, runWidth / (staffSpace * 3));
                const thickScore = Math.min(1.0, bh / (staffSpace * 0.5));
                const grade = Math.min(1.0, (widthScore + thickScore) / 2);

                const inter = sig.addInter({
                  type: 'beam',
                  grade,
                  bbox,
                  data: { detectedBy: 'BeamDetector' }
                });
                beams.push({ bbox, interId: inter.id });

                // Mark claimed pixels
                for (let by = y; by < y + bh && by < height; by++) {
                  for (let bx = runStart; bx < x && bx < width; bx++) {
                    claimed[by * width + bx] = 1;
                  }
                }
              }
            }
            runStart = -1;
          }
        }
      }
    }

    return beams;
  }
}
