// ─────────────────────────────────────────────
// StaffAnalyzer — staff line detection via
// horizontal projection and RLE, plus smart
// staff line removal preserving noteheads/stems
// ─────────────────────────────────────────────

// ── Constants ──────────────────────────────────

const MIN_STAFF_LINE_RATIO = 0.3; // min fraction of width for a staff line
const STAFF_LINES_PER_GROUP = 5;

// ── StaffAnalyzer ──────────────────────────────

export class StaffAnalyzer {
  /**
   * @param {EventBus} bus
   */
  constructor(bus) {
    this._bus = bus;
  }

  /**
   * Compute horizontal projection profile (count of black pixels per row).
   * @param {Uint8Array} binary - 0=foreground, 255=background
   * @param {number} width
   * @param {number} height
   * @returns {Uint32Array} counts per row
   */
  horizontalProjection(binary, width, height) {
    const profile = new Uint32Array(height);
    for (let y = 0; y < height; y++) {
      let count = 0;
      const offset = y * width;
      for (let x = 0; x < width; x++) {
        if (binary[offset + x] === 0) count++;
      }
      profile[y] = count;
    }
    return profile;
  }

  /**
   * Detect staff line candidate rows from the projection profile.
   * Staff lines have high black-pixel counts relative to the image width.
   * @param {Uint32Array} profile
   * @param {number} width
   * @returns {number[]} row indices of staff line peaks
   */
  detectStaffRows(profile, width) {
    const threshold = width * MIN_STAFF_LINE_RATIO;
    const peaks = [];

    // Find rows exceeding threshold, then take local peaks
    let inPeak = false;
    let peakStart = 0;
    let peakMax = 0;
    let peakMaxRow = 0;

    for (let y = 0; y < profile.length; y++) {
      if (profile[y] >= threshold) {
        if (!inPeak) {
          inPeak = true;
          peakStart = y;
          peakMax = profile[y];
          peakMaxRow = y;
        } else if (profile[y] > peakMax) {
          peakMax = profile[y];
          peakMaxRow = y;
        }
      } else {
        if (inPeak) {
          peaks.push(peakMaxRow);
          inPeak = false;
        }
      }
    }
    if (inPeak) peaks.push(peakMaxRow);

    return peaks;
  }

  /**
   * Estimate staff line thickness using RLE on peak rows.
   * @param {Uint8Array} binary
   * @param {number} width
   * @param {number[]} staffRows
   * @returns {number} average thickness in pixels
   */
  estimateLineThickness(binary, width, staffRows) {
    if (staffRows.length === 0) return 2;

    const thicknesses = [];
    for (const row of staffRows) {
      // Check vertical run lengths at multiple x positions
      for (let x = Math.floor(width * 0.2); x < width * 0.8; x += Math.floor(width / 20)) {
        let runLen = 0;
        for (let dy = -5; dy <= 5; dy++) {
          const y = row + dy;
          if (y >= 0 && binary[y * width + x] === 0) {
            runLen++;
          } else if (runLen > 0) {
            break;
          }
        }
        if (runLen > 0) thicknesses.push(runLen);
      }
    }

    if (thicknesses.length === 0) return 2;
    thicknesses.sort((a, b) => a - b);
    return thicknesses[Math.floor(thicknesses.length / 2)]; // median
  }

  /**
   * Group staff line rows into staff systems (groups of 5).
   * Uses consistent inter-line spacing to identify groups.
   * @param {number[]} rows - sorted staff line row indices
   * @returns {{groups: number[][], staffSpace: number}}
   */
  groupStaffLines(rows) {
    if (rows.length < STAFF_LINES_PER_GROUP) {
      return { groups: [], staffSpace: 0 };
    }

    // Compute all consecutive gaps
    const gaps = [];
    for (let i = 1; i < rows.length; i++) {
      gaps.push(rows[i] - rows[i - 1]);
    }

    // Find the most common small gap (intra-staff spacing)
    const sortedGaps = [...gaps].sort((a, b) => a - b);
    const medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)];

    // Staff space is the median small gap
    const staffSpace = medianGap;

    // Group lines: consecutive lines with gaps close to staffSpace
    const groups = [];
    let currentGroup = [rows[0]];

    for (let i = 1; i < rows.length; i++) {
      const gap = rows[i] - rows[i - 1];
      // If gap is within 50% of expected staff space, same group
      if (gap < staffSpace * 1.8) {
        currentGroup.push(rows[i]);
      } else {
        if (currentGroup.length === STAFF_LINES_PER_GROUP) {
          groups.push(currentGroup);
        }
        currentGroup = [rows[i]];
      }
    }
    if (currentGroup.length === STAFF_LINES_PER_GROUP) {
      groups.push(currentGroup);
    }

    return { groups, staffSpace };
  }

  /**
   * Full staff detection pipeline.
   * @param {Uint8Array} binary
   * @param {number} width
   * @param {number} height
   * @returns {{groups: number[][], staffSpace: number, lineThickness: number, staffRows: number[]}}
   */
  detect(binary, width, height) {
    const profile = this.horizontalProjection(binary, width, height);
    const staffRows = this.detectStaffRows(profile, width);
    const lineThickness = this.estimateLineThickness(binary, width, staffRows);
    const { groups, staffSpace } = this.groupStaffLines(staffRows);

    this._bus.emit('omr:staffs', {
      groups,
      staffSpace,
      lineThickness,
      staffRows
    });

    return { groups, staffSpace, lineThickness, staffRows };
  }

  /**
   * Smart staff line removal using vertical connectivity analysis.
   * Preserves pixels that are part of noteheads or stems intersecting staff lines.
   * @param {Uint8Array} binary
   * @param {number} width
   * @param {number} height
   * @param {number[]} staffRows - all staff line row indices
   * @param {number} lineThickness
   * @returns {Uint8Array} binary image with staff lines removed
   */
  removeStaffLines(binary, width, height, staffRows, lineThickness) {
    const out = new Uint8Array(binary);
    const halfThick = Math.ceil(lineThickness / 2) + 1;

    for (const row of staffRows) {
      for (let x = 0; x < width; x++) {
        // Check if this pixel is part of a vertical structure (notehead/stem)
        let aboveBlack = 0;
        let belowBlack = 0;

        // Count consecutive black pixels above the staff line region
        for (let dy = halfThick + 1; dy < halfThick + lineThickness + 3; dy++) {
          const y = row - dy;
          if (y >= 0 && binary[y * width + x] === 0) {
            aboveBlack++;
          } else {
            break;
          }
        }

        // Count consecutive black pixels below the staff line region
        for (let dy = halfThick + 1; dy < halfThick + lineThickness + 3; dy++) {
          const y = row + dy;
          if (y < height && binary[y * width + x] === 0) {
            belowBlack++;
          } else {
            break;
          }
        }

        // If substantial vertical connectivity both above AND below,
        // this is part of a stem or notehead — keep it
        const verticalThreshold = lineThickness;
        if (aboveBlack >= verticalThreshold && belowBlack >= verticalThreshold) {
          continue; // preserve this pixel
        }

        // Otherwise, remove staff line pixels in this column
        for (let dy = -halfThick; dy <= halfThick; dy++) {
          const y = row + dy;
          if (y >= 0 && y < height) {
            // Only remove if the pixel is black and part of a horizontal run
            if (out[y * width + x] === 0) {
              out[y * width + x] = 255;
            }
          }
        }
      }
    }

    return out;
  }
}
