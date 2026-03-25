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

// ── Key Signature Lookup ──────────────────────
// Maps number of sharps/flats to the affected pitch classes.
// Order follows the circle of fifths.
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

// Max horizontal distance (in staffSpaces) from clef to consider
// a symbol as part of the key signature
const KEY_SIG_REGION = 6.0;
// Max distance (in staffSpaces) for an inline accidental to its note
const ACCIDENTAL_ATTACH_DISTANCE = 1.5;

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
   * Detect key signature for a staff by counting accidentals before the first note.
   * Returns a Set of affected pitch class names (e.g., {'F', 'C'} for D major).
   * @param {Array<{component: ComponentFeatures, type: string}>} symbols
   * @param {number[]} staffGroup - 5 staff line y-positions
   * @param {number} staffSpace
   * @returns {{sharps: Set<string>, flats: Set<string>}}
   */
  detectKeySignature(symbols, staffGroup, staffSpace) {
    const topLine = staffGroup[0];
    const bottomLine = staffGroup[4];
    const margin = staffSpace * 2;

    // Find the leftmost clef's right edge to define the key sig search region
    let clefRightX = 0;
    for (const s of symbols) {
      if (s.type === SymbolType.CLEF_TREBLE || s.type === SymbolType.CLEF_BASS) {
        const cy = s.component.centroid.y;
        if (cy >= topLine - margin && cy <= bottomLine + margin) {
          const rightEdge = s.component.bbox.x + s.component.bbox.width;
          if (rightEdge > clefRightX) clefRightX = rightEdge;
        }
      }
    }

    // Find first note x-position on this staff
    const noteTypes = new Set([
      SymbolType.FILLED_NOTEHEAD, SymbolType.OPEN_NOTEHEAD, SymbolType.WHOLE_NOTE
    ]);
    let firstNoteX = Infinity;
    for (const s of symbols) {
      if (!noteTypes.has(s.type)) continue;
      const cy = s.component.centroid.y;
      if (cy >= topLine - margin && cy <= bottomLine + margin) {
        if (s.component.centroid.x < firstNoteX) {
          firstNoteX = s.component.centroid.x;
        }
      }
    }

    // Count sharps and flats between the clef and first note
    const keySigEndX = Math.min(
      clefRightX + staffSpace * KEY_SIG_REGION,
      firstNoteX
    );

    let sharpCount = 0;
    let flatCount = 0;

    for (const s of symbols) {
      if (s.type !== SymbolType.SHARP && s.type !== SymbolType.FLAT) continue;
      const cx = s.component.centroid.x;
      const cy = s.component.centroid.y;
      if (cy < topLine - margin || cy > bottomLine + margin) continue;
      if (cx >= clefRightX && cx <= keySigEndX) {
        if (s.type === SymbolType.SHARP) sharpCount++;
        else flatCount++;
      }
    }

    // Build affected pitch class sets from circle-of-fifths order
    const sharps = new Set();
    const flats = new Set();
    for (let i = 0; i < Math.min(sharpCount, 7); i++) sharps.add(SHARP_ORDER[i]);
    for (let i = 0; i < Math.min(flatCount, 7); i++) flats.add(FLAT_ORDER[i]);

    if (sharps.size > 0 || flats.size > 0) {
      console.log(`[OMR] Key signature: ${sharpCount} sharps ${[...sharps].join(',')} | ${flatCount} flats ${[...flats].join(',')}`);
    }

    return { sharps, flats };
  }

  /**
   * Find inline accidentals and pair them with the nearest subsequent note.
   * Returns a map from note symbol → accidental modifier (+1 sharp, -1 flat, 0 natural).
   * @param {Array<{component: ComponentFeatures, type: string}>} symbols
   * @param {Array<{symbol: object, midiNote: number}>} notes
   * @param {number} staffSpace
   * @returns {Map<object, number>} symbol → semitone offset
   */
  pairInlineAccidentals(symbols, notes, staffSpace) {
    const accidentalMap = new Map();
    const maxDist = staffSpace * ACCIDENTAL_ATTACH_DISTANCE;

    // Collect accidental symbols sorted left to right
    const accidentals = symbols.filter(s =>
      s.type === SymbolType.SHARP ||
      s.type === SymbolType.FLAT ||
      s.type === SymbolType.NATURAL
    ).sort((a, b) => a.component.centroid.x - b.component.centroid.x);

    for (const acc of accidentals) {
      const ax = acc.component.centroid.x;
      const ay = acc.component.centroid.y;

      // Find nearest note to the right and within vertical range
      let bestNote = null;
      let bestDist = Infinity;

      for (const n of notes) {
        const nx = n.symbol.component.centroid.x;
        const ny = n.symbol.component.centroid.y;
        // Accidental must be to the left of the note
        if (nx <= ax) continue;
        const dx = nx - ax;
        const dy = Math.abs(ny - ay);
        if (dx > maxDist * 2 || dy > maxDist) continue;
        if (dx < bestDist) {
          bestDist = dx;
          bestNote = n;
        }
      }

      if (bestNote) {
        let offset = 0;
        if (acc.type === SymbolType.SHARP) offset = 1;
        else if (acc.type === SymbolType.FLAT) offset = -1;
        // NATURAL offset = 0 (cancels key sig)
        accidentalMap.set(bestNote.symbol, offset);
      }
    }

    return accidentalMap;
  }

  /**
   * Apply key signature and inline accidentals to modify MIDI note values.
   * @param {Array<{symbol: object, noteName: string, midiNote: number}>} notes
   * @param {{sharps: Set<string>, flats: Set<string>}} keySig
   * @param {Map<object, number>} inlineAccidentals
   * @returns {Array} notes with adjusted midiNote values
   */
  applyAccidentals(notes, keySig, inlineAccidentals) {
    for (const n of notes) {
      const inlineOffset = inlineAccidentals.get(n.symbol);

      if (inlineOffset !== undefined) {
        // Inline accidental overrides key signature
        n.midiNote += inlineOffset;
        if (inlineOffset === 1) n.noteName += '#';
        else if (inlineOffset === -1) n.noteName += 'b';
        // natural (0) cancels key sig — no semitone change
      } else if (keySig.sharps.has(n.noteName)) {
        n.midiNote += 1;
        n.noteName += '#';
      } else if (keySig.flats.has(n.noteName)) {
        n.midiNote -= 1;
        n.noteName += 'b';
      }
    }
    return notes;
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

    // Detect key signature per staff group and apply accidentals
    const mergedKeySig = { sharps: new Set(), flats: new Set() };
    for (const group of staffGroups) {
      const ks = this.detectKeySignature(symbols, group, staffSpace);
      for (const s of ks.sharps) mergedKeySig.sharps.add(s);
      for (const f of ks.flats) mergedKeySig.flats.add(f);
    }

    // Pair inline accidentals with their notes
    const inlineAccidentals = this.pairInlineAccidentals(symbols, notes, staffSpace);

    // Apply all accidentals (key sig + inline overrides)
    this.applyAccidentals(notes, mergedKeySig, inlineAccidentals);

    if (inlineAccidentals.size > 0 || mergedKeySig.sharps.size > 0 || mergedKeySig.flats.size > 0) {
      console.log(`[OMR] Applied ${inlineAccidentals.size} inline accidentals, key sig: ${mergedKeySig.sharps.size} sharps, ${mergedKeySig.flats.size} flats`);
    }

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
