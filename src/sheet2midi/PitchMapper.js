// ─────────────────────────────────────────────
// PitchMapper — map notehead y-position to
// pitch name and MIDI number using staff
// position and clef context
// ─────────────────────────────────────────────

import { SymbolType } from './SymbolClassifier.js';

// ── Constants ──────────────────────────────────

// Diatonic scale in MIDI semitones from C: C=0, D=2, E=4, F=5, G=7, A=9, B=11
const DIATONIC_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const DIATONIC_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// Treble clef: bottom line = E4 (MIDI 64), diatonic index in octave 4 = 2 (E)
// Bass clef: bottom line = G2 (MIDI 43), diatonic index in octave 2 = 4 (G)
// We use absolute diatonic position: C0=0, D0=1, ..., B0=6, C1=7, ...
const TREBLE_BASE_DIATONIC = 4 * 7 + 2; // E4 = diatonic pos 30
const BASS_BASE_DIATONIC = 2 * 7 + 4;   // G2 = diatonic pos 18

// ── PitchMapper ────────────────────────────────

export class PitchMapper {
  /**
   * @param {EventBus} bus
   */
  constructor(bus) {
    this._bus = bus;
  }

  /**
   * Determine the clef for a staff group by checking for clef symbols.
   * @param {Array<{component: ComponentFeatures, type: string}>} symbols
   * @param {number[]} staffGroup - 5 staff line y-positions
   * @returns {'treble'|'bass'}
   */
  detectClef(symbols, staffGroup) {
    const topLine = staffGroup[0];
    const bottomLine = staffGroup[4];

    // Look for clef symbols in the leftmost portion of this staff
    for (const s of symbols) {
      if (s.type === SymbolType.CLEF_TREBLE) {
        if (s.component.centroid.y >= topLine - 20 && s.component.centroid.y <= bottomLine + 20) {
          return 'treble';
        }
      }
      if (s.type === SymbolType.CLEF_BASS) {
        if (s.component.centroid.y >= topLine - 20 && s.component.centroid.y <= bottomLine + 20) {
          return 'bass';
        }
      }
    }
    // Default to treble for single-staff scores
    return 'treble';
  }

  /**
   * Quantize a y-position to the nearest staff position (line or space).
   * @param {number} y - notehead centroid y
   * @param {number[]} staffGroup - 5 staff line y-positions
   * @param {number} staffSpace - pixels between adjacent staff lines
   * @returns {number} staff position (0 = bottom line, +1 per diatonic step up)
   */
  quantizePosition(y, staffGroup, staffSpace) {
    const bottomLine = staffGroup[4]; // bottom line (highest y)
    const halfSpace = staffSpace / 2;

    // Position in half-space units from bottom line
    const rawPos = (bottomLine - y) / halfSpace;

    // Snap to nearest integer
    return Math.round(rawPos);
  }

  /**
   * Convert a staff position to pitch name and MIDI number.
   * @param {number} staffPos - 0 = bottom staff line
   * @param {'treble'|'bass'} clef
   * @returns {{noteName: string, octave: number, midiNote: number}}
   */
  positionToPitch(staffPos, clef) {
    const baseDiatonic = clef === 'treble'
      ? TREBLE_BASE_DIATONIC
      : BASS_BASE_DIATONIC;

    // Absolute diatonic position (C0=0, D0=1, ..., B0=6, C1=7, ...)
    const absDiatonic = baseDiatonic + staffPos;
    const octave = Math.floor(absDiatonic / 7);
    const degree = ((absDiatonic % 7) + 7) % 7; // 0=C, 1=D, ..., 6=B

    const noteName = DIATONIC_NAMES[degree];
    const midiNote = (octave + 1) * 12 + DIATONIC_SEMITONES[degree];

    return { noteName, octave, midiNote };
  }

  /**
   * Detect ledger lines near a notehead above or below the staff.
   * @param {Uint8Array} binary
   * @param {number} width
   * @param {{x: number, y: number}} centroid
   * @param {number[]} staffGroup
   * @param {number} staffSpace
   * @returns {number} number of ledger lines
   */
  detectLedgerLines(binary, width, centroid, staffGroup, staffSpace) {
    const topLine = staffGroup[0];
    const bottomLine = staffGroup[4];
    const halfSpace = staffSpace / 2;
    let ledgerCount = 0;

    if (centroid.y < topLine) {
      // Above staff — check for horizontal runs above the top line
      for (let y = topLine - staffSpace; y >= centroid.y - halfSpace; y -= staffSpace) {
        if (this._hasHorizontalRun(binary, width, Math.round(y), centroid.x, staffSpace)) {
          ledgerCount++;
        }
      }
    } else if (centroid.y > bottomLine) {
      // Below staff — check for horizontal runs below the bottom line
      for (let y = bottomLine + staffSpace; y <= centroid.y + halfSpace; y += staffSpace) {
        if (this._hasHorizontalRun(binary, width, Math.round(y), centroid.x, staffSpace)) {
          ledgerCount++;
        }
      }
    }

    return ledgerCount;
  }

  /**
   * Check for a short horizontal run of black pixels near a position.
   * @param {Uint8Array} binary
   * @param {number} width
   * @param {number} y
   * @param {number} centerX
   * @param {number} staffSpace
   * @returns {boolean}
   */
  _hasHorizontalRun(binary, width, y, centerX, staffSpace) {
    const searchWidth = Math.round(staffSpace * 1.5);
    const startX = Math.max(0, Math.round(centerX - searchWidth / 2));
    const endX = Math.min(width - 1, Math.round(centerX + searchWidth / 2));
    let runLen = 0;
    const threshold = staffSpace * 0.5;

    for (let x = startX; x <= endX; x++) {
      if (binary[y * width + x] === 0) {
        runLen++;
      } else {
        if (runLen >= threshold) return true;
        runLen = 0;
      }
    }
    return runLen >= threshold;
  }

  /**
   * Detect grand staff pairs (treble+bass) from staff groups.
   * Two consecutive groups whose gap is smaller than 3× staffSpace
   * are considered a grand staff pair.
   * @param {number[][]} staffGroups
   * @param {number} staffSpace
   * @returns {Map<number[], 'treble'|'bass'>} clef map per group
   */
  _buildClefMap(staffGroups, staffSpace) {
    const clefMap = new Map();
    const used = new Set();

    for (let i = 0; i < staffGroups.length - 1; i++) {
      if (used.has(i)) continue;
      const gapBetween = staffGroups[i + 1][0] - staffGroups[i][4];
      // Grand staff pair: gap between bottom of upper and top of lower
      // is typically 1.5–3× staffSpace
      if (gapBetween < staffSpace * 8 && gapBetween > 0) {
        clefMap.set(staffGroups[i], 'treble');
        clefMap.set(staffGroups[i + 1], 'bass');
        used.add(i);
        used.add(i + 1);
      }
    }

    // Log grand staff detection
    console.log(`[OMR] PitchMapper: ${staffGroups.length} staff groups, ${clefMap.size} assigned via grand staff pairs`);
    for (let i = 0; i < staffGroups.length; i++) {
      const g = staffGroups[i];
      const clef = clefMap.get(g) || '?';
      const gap = i < staffGroups.length - 1
        ? staffGroups[i + 1][0] - g[4]
        : '-';
      console.log(`[OMR]   group ${i}: y=${g[0]}..${g[4]} clef=${clef} gapToNext=${gap} (${typeof gap === 'number' ? (gap/staffSpace).toFixed(1) + 'ss' : '-'})`);
    }

    return clefMap;
  }

  /**
   * Assign pitch to all detected noteheads.
   * @param {Array<{component: ComponentFeatures, type: string}>} symbols
   * @param {number[][]} staffGroups - arrays of 5 staff line y-positions
   * @param {number} staffSpace
   * @param {Uint8Array} [binary] - for ledger line detection
   * @param {number} [imgWidth]
   * @returns {Array<{symbol: object, staffPos: number, noteName: string, octave: number, midiNote: number, clef: string}>}
   */
  assignPitches(symbols, staffGroups, staffSpace, binary, imgWidth) {
    const noteTypes = new Set([
      SymbolType.FILLED_NOTEHEAD,
      SymbolType.OPEN_NOTEHEAD,
      SymbolType.WHOLE_NOTE
    ]);

    // Build clef map using grand staff pair detection
    const clefMap = this._buildClefMap(staffGroups, staffSpace);

    const notes = [];

    for (const s of symbols) {
      if (!noteTypes.has(s.type)) continue;

      // Find which staff group this note belongs to
      const group = this._findStaffGroup(s.component.centroid.y, staffGroups, staffSpace);
      if (!group) continue;

      // Use positional clef from grand staff pairs, fall back to symbol detection
      const clef = clefMap.get(group) ?? this.detectClef(symbols, group);
      const staffPos = this.quantizePosition(s.component.centroid.y, group, staffSpace);
      const { noteName, octave, midiNote } = this.positionToPitch(staffPos, clef);

      notes.push({
        symbol: s,
        staffPos,
        noteName,
        octave,
        midiNote,
        clef
      });
    }

    // Sort by x-position (left to right)
    notes.sort((a, b) => a.symbol.component.centroid.x - b.symbol.component.centroid.x);

    this._bus.emit('omr:notes', { notes });
    return notes;
  }

  /**
   * Find which staff group a y-position belongs to.
   * @param {number} y
   * @param {number[][]} staffGroups
   * @param {number} staffSpace
   * @returns {number[]|null}
   */
  _findStaffGroup(y, staffGroups, staffSpace) {
    const margin = staffSpace * 3; // allow notes above/below staff
    let bestGroup = null;
    let bestDist = Infinity;

    for (const group of staffGroups) {
      const top = group[0] - margin;
      const bottom = group[4] + margin;
      if (y >= top && y <= bottom) {
        const center = (group[0] + group[4]) / 2;
        const dist = Math.abs(y - center);
        if (dist < bestDist) {
          bestDist = dist;
          bestGroup = group;
        }
      }
    }
    return bestGroup;
  }
}
