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
  detectClef(symbols, staffGroup, binary = null, imgWidth = 0, staffSpace = 0) {
    // Primary: NCC template matching — finds the clef regardless of what nearby
    // objects the symbol classifier may have mislabelled.
    if (binary && staffSpace > 0) {
      const nccResult = this._detectClefByNCC(binary, imgWidth, staffGroup, staffSpace);
      if (nccResult) {
        console.log(`[OMR] Clef detected by NCC: ${nccResult.clef} (treble=${nccResult.trebleScore.toFixed(3)} bass=${nccResult.bassScore.toFixed(3)})`);
        this._bus.emit('omr:clef-detected', {
          clef: nccResult.clef,
          method: 'ncc',
          trebleNCC: nccResult.trebleScore,
          bassNCC: nccResult.bassScore
        });
        return nccResult.clef;
      }
    }
    // Fallback: symbol-label-based heuristics (less reliable, retained for edge cases)
    {
    const topLine = staffGroup[0];
    const bottomLine = staffGroup[4];
    const staffHeight = bottomLine - topLine;
    const staffCenter = (topLine + bottomLine) / 2;

    // Find the first note's x-position to define the clef search region
    const noteTypes = new Set([
      SymbolType.FILLED_NOTEHEAD, SymbolType.OPEN_NOTEHEAD, SymbolType.WHOLE_NOTE
    ]);
    let firstNoteX = Infinity;
    for (const s of symbols) {
      if (!noteTypes.has(s.type)) continue;
      const cy = s.component.centroid.y;
      if (cy >= topLine - staffHeight && cy <= bottomLine + staffHeight) {
        if (s.component.centroid.x < firstNoteX) firstNoteX = s.component.centroid.x;
      }
    }

    // Look for explicitly classified clef symbols in the leftmost portion
    const clefCandidates = [];
    for (const s of symbols) {
      if (s.type !== SymbolType.CLEF_TREBLE && s.type !== SymbolType.CLEF_BASS) continue;
      const cy = s.component.centroid.y;
      const cx = s.component.centroid.x;
      // Must be within vertical range of this staff and to the left of first note
      if (cy >= topLine - staffHeight * 0.5 && cy <= bottomLine + staffHeight * 0.5
          && cx < firstNoteX) {
        clefCandidates.push(s);
      }
    }

    if (clefCandidates.length > 0) {
      // If we have explicit treble, use it
      const treble = clefCandidates.find(s => s.type === SymbolType.CLEF_TREBLE);
      if (treble) {
        this._bus.emit('omr:clef-detected', { clef: 'treble', method: 'symbol' });
        return 'treble';
      }

      // If classified as bass, double-check using positional heuristics
      const bass = clefCandidates.find(s => s.type === SymbolType.CLEF_BASS);
      if (bass) {
        const compHeight = bass.component.bbox.height;
        const compCenterY = bass.component.centroid.y;
        if (compHeight >= staffHeight * 0.6) {
          console.log(`[OMR] Clef reclassification: bass→treble (height ${compHeight} >= 60% of staff ${staffHeight})`);
          this._bus.emit('omr:clef-detected', { clef: 'treble', method: 'symbol-reclassified' });
          return 'treble';
        }
        if (compCenterY >= staffCenter - staffHeight * 0.1) {
          console.log(`[OMR] Clef reclassification: bass→treble (centroid ${compCenterY.toFixed(0)} at/below staff center ${staffCenter.toFixed(0)})`);
          this._bus.emit('omr:clef-detected', { clef: 'treble', method: 'symbol-reclassified' });
          return 'treble';
        }
        this._bus.emit('omr:clef-detected', { clef: 'bass', method: 'symbol' });
        return 'bass';
      }
    }

    // Fallback: look for any large component in the left portion of the staff
    // that could be a clef but wasn't classified as one
    let bestClefCandidate = null;
    let bestClefX = Infinity;
    for (const s of symbols) {
      const c = s.component;
      const cy = c.centroid.y;
      const cx = c.centroid.x;
      if (cx >= firstNoteX) continue;
      if (cy < topLine - staffHeight * 0.5 || cy > bottomLine + staffHeight * 0.5) continue;
      if (c.heightSS < 2.0 || c.widthSS < 0.5) continue;
      if (cx < bestClefX) {
        bestClefX = cx;
        bestClefCandidate = c;
      }
    }

    if (bestClefCandidate) {
      const compHeight = bestClefCandidate.bbox.height;
      if (compHeight >= staffHeight * 0.5) {
        console.log(`[OMR] Clef inferred as treble from large left component (height ${compHeight}, staff ${staffHeight})`);
        this._bus.emit('omr:clef-detected', { clef: 'treble', method: 'size-heuristic' });
        return 'treble';
      }
    }

    // Default to bass for single-staff scores
    console.log(`[OMR] Clef defaulting to bass (no clef symbol found)`);
    this._bus.emit('omr:clef-detected', { clef: 'bass', method: 'default' });
    return 'bass';
    } // end fallback block
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
   * Detect grand staff pairs (treble+bass) from staff groups using a cascade:
   *   1. Brace symbol detection (primary — most reliable)
   *   2. Gap threshold < 8×staffSpace (secondary)
   *   3. First-two-staves fallback (tertiary — only when exactly 2 staves)
   *
   * @param {number[][]} staffGroups
   * @param {number} staffSpace
   * @param {Array<{type: string, component: object}>} [symbols]
   * @returns {Map<number[], 'treble'|'bass'>} clef map per group
   */
  _buildClefMap(staffGroups, staffSpace, symbols = []) {
    const clefMap = new Map();
    const used = new Set();

    // ── Primary: brace detection ───────────────────────────────────────────
    const braceSymbols = symbols.filter(s => s.type === SymbolType.BRACE);

    if (braceSymbols.length > 0) {
      for (let i = 0; i < staffGroups.length - 1; i++) {
        if (used.has(i)) continue;
        const upper = staffGroups[i];
        const lower = staffGroups[i + 1];
        const combinedTop    = upper[0];
        const combinedBottom = lower[4];
        const combinedHeight = combinedBottom - combinedTop;

        // Look for a brace that spans ≥ 80% of the combined staff height
        const matchingBrace = braceSymbols.find(b => {
          const by0 = b.component.bbox.y;
          const by1 = b.component.bbox.y + b.component.bbox.height;
          const overlap = Math.min(by1, combinedBottom) - Math.max(by0, combinedTop);
          return overlap >= combinedHeight * 0.8;
        });

        if (matchingBrace) {
          clefMap.set(upper, 'treble');
          clefMap.set(lower, 'bass');
          used.add(i);
          used.add(i + 1);
          this._lastPairingMethod = 'brace';
          console.log(`[OMR] Grand staff pair (brace): groups ${i} & ${i+1}`);
        }
      }
    }

    // ── Secondary: gap threshold ───────────────────────────────────────────
    if (clefMap.size === 0) {
      for (let i = 0; i < staffGroups.length - 1; i++) {
        if (used.has(i)) continue;
        const gapBetween = staffGroups[i + 1][0] - staffGroups[i][4];
        if (gapBetween < staffSpace * 8 && gapBetween > 0) {
          clefMap.set(staffGroups[i], 'treble');
          clefMap.set(staffGroups[i + 1], 'bass');
          used.add(i);
          used.add(i + 1);
          this._lastPairingMethod = 'gap';
          console.log(`[OMR] Grand staff pair (gap=${gapBetween.toFixed(0)}px): groups ${i} & ${i+1}`);
        }
      }
    }

    // ── Tertiary: first-two fallback ───────────────────────────────────────
    if (clefMap.size === 0 && staffGroups.length === 2) {
      clefMap.set(staffGroups[0], 'treble');
      clefMap.set(staffGroups[1], 'bass');
      this._lastPairingMethod = 'fallback';
      console.log(`[OMR] Grand staff pair (fallback): first two staves paired`);
    }

    // Log summary
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
      const cx = s.component.centroid.x;
      const cy = s.component.centroid.y;
      if (cy < topLine - margin || cy > bottomLine + margin) continue;
      if (cx < clefRightX || cx > keySigEndX) continue;

      const c = s.component;
      const isSharp = s.type === SymbolType.SHARP
        // Fallback: key sig sharps at small staff sizes may have hSS < 1.2 and be
        // misclassified as FILLED_NOTEHEAD. Detect them using raw shape features:
        // sharps are narrow (aspectRatio < 0.7), moderately tall, mid fill.
        || (c.heightSS >= 0.6 && c.heightSS <= 3.0
          && c.widthSS >= 0.3 && c.widthSS <= 1.5
          && c.aspectRatio >= 0.15 && c.aspectRatio < 0.7
          && c.fillRatio >= 0.15 && c.fillRatio <= 0.65);
      const isFlat = s.type === SymbolType.FLAT
        || (c.heightSS >= 0.9 && c.heightSS <= 3.5
          && c.widthSS >= 0.2 && c.widthSS <= 1.2
          && c.aspectRatio >= 0.1 && c.aspectRatio < 0.55
          && c.fillRatio >= 0.2 && c.fillRatio <= 0.65);

      if (isSharp) sharpCount++;
      else if (isFlat) flatCount++;
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
   * @param {'treble'|'bass'|null} [clefOverride] - force a specific clef for all staves
   * @returns {Array<{symbol: object, staffPos: number, noteName: string, octave: number, midiNote: number, clef: string}>}
   */
  assignPitches(symbols, staffGroups, staffSpace, binary, imgWidth, clefOverride = null) {
    const noteTypes = new Set([
      SymbolType.FILLED_NOTEHEAD,
      SymbolType.OPEN_NOTEHEAD,
      SymbolType.WHOLE_NOTE
    ]);

    // Build clef map using grand staff pair detection (cascade: brace → gap → fallback)
    const clefMap = this._buildClefMap(staffGroups, staffSpace, symbols);

    // Grand staff inter-staff zone: pre-identify middle C noteheads BEFORE the main
    // assignment loop, so they are not incorrectly claimed by the bass staff's margin.
    // Any filled notehead between the two staves (outside ledger reach of both) is C4.
    const interStaffSymbols = new Set();
    if (this._lastPairingMethod && staffGroups.length >= 2) {
      let trebleGroup = null, bassGroup = null;
      for (const [g, c] of clefMap) {
        if (c === 'treble') trebleGroup = g;
        else if (c === 'bass') bassGroup = g;
      }
      if (trebleGroup && bassGroup) {
        const trebleBottom = trebleGroup[4]; // lowest treble line (highest y)
        const bassTop = bassGroup[0];        // highest bass line (lowest y)
        const interMin = trebleBottom + staffSpace * 2.0;
        const interMax = bassTop - staffSpace * 2.0;
        if (interMin < interMax) {
          for (const s of symbols) {
            if (!noteTypes.has(s.type)) continue;
            if (staffSpace > 0 && s.component.centroid.x < staffSpace * 4) continue;
            const cy = s.component.centroid.y;
            if (cy >= interMin && cy <= interMax) {
              interStaffSymbols.add(s);
            }
          }
        }
      }
    }

    const notes = [];

    for (const s of symbols) {
      if (!noteTypes.has(s.type)) continue;

      // Skip noteheads in the clef region — bass clef dots and treble clef body
      // can look like filled noteheads but are never valid notes
      if (staffSpace > 0 && s.component.centroid.x < staffSpace * 4) continue;

      // Inter-staff zone noteheads are handled separately as middle C (C4)
      if (interStaffSymbols.has(s)) continue;

      // Find which staff group this note belongs to
      const group = this._findStaffGroup(s.component.centroid.y, staffGroups, staffSpace);
      if (!group) continue;

      // Use override if provided, else positional grand-staff clef, else NCC+symbol detection
      const clef = clefOverride ?? (clefMap.get(group) ?? this.detectClef(symbols, group, binary, imgWidth, staffSpace));
      const staffPos = this.quantizePosition(s.component.centroid.y, group, staffSpace);
      const { noteName, octave, midiNote } = this.positionToPitch(staffPos, clef);

      notes.push({
        symbol: s,
        staffPos,
        noteName,
        octave,
        midiNote,
        clef,
        x: s.component.centroid.x
      });
    }

    // Assign inter-staff symbols as middle C (C4, staffPos=-2 treble)
    for (const s of interStaffSymbols) {
      const { noteName, octave, midiNote } = this.positionToPitch(-2, 'treble');
      notes.push({
        symbol: s,
        staffPos: -2,
        noteName,
        octave,
        midiNote,
        clef: 'treble',
        x: s.component.centroid.x
      });
      const c = s.component;
      console.log(`[OMR] Note: ${noteName}${octave}(${midiNote}) staffPos=-2 clef=treble [inter-staff C4] x=${Math.round(c.centroid.x)} y=${Math.round(c.centroid.y)}`);
    }

    // Sort by x-position (left to right)
    notes.sort((a, b) => a.x - b.x);

    // Debug: log all assigned notes
    for (const n of notes) {
      const c = n.symbol.component;
      const src = c._splitFrom ? 'SPLIT' : 'orig';
      const wss = c.widthSS != null ? c.widthSS.toFixed(2) : '?';
      const hss = c.heightSS != null ? c.heightSS.toFixed(2) : '?';
      console.log(`[OMR] Note: ${n.noteName}${n.octave}(${n.midiNote}) staffPos=${n.staffPos} clef=${n.clef} x=${Math.round(n.x)} y=${Math.round(c.centroid.y)} bbox=${c.bbox.x},${c.bbox.y} ${c.bbox.width}x${c.bbox.height} wSS=${wss} hSS=${hss} [${src}]`);
    }

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
  // ── NCC-based clef detection ────────────────────────────────────────────────

  /**
   * Detect the clef for a staff group by running NCC against procedurally generated
   * treble and bass clef templates. Scans only horizontally (x: 0 → 7×staffSpace)
   * with templates vertically aligned to the staff — far more reliable than relying
   * on symbol classification labels.
   *
   * @param {Uint8Array} binary   — 0=ink, 255=bg
   * @param {number}     imgWidth
   * @param {number[]}   staffGroup — 5 staff line y-positions
   * @param {number}     staffSpace
   * @returns {'treble'|'bass'|null}  null = no confident match
   */
  _detectClefByNCC(binary, imgWidth, staffGroup, staffSpace) {
    const topLine    = staffGroup[0];
    const bottomLine = staffGroup[4];
    const ss = staffSpace;

    const trebleTpl = this._makeTrebleTemplate(ss);
    const bassTpl   = this._makeBassTemplate(ss);

    // Treble template y0: template top sits 0.9 ss above the staff top line
    const trebleY0 = Math.round(topLine - ss * 0.9);
    // Bass template y0: template top sits 0.5 ss above the staff top line
    const bassY0   = Math.round(topLine - ss * 0.5);

    // Search x = 0 … 7×ss (clef is always at the very left of the staff)
    const xMax = Math.round(ss * 7);

    const trebleScore = this._nccScanX(binary, imgWidth, trebleTpl, 0, xMax, trebleY0);
    const bassScore   = this._nccScanX(binary, imgWidth, bassTpl,   0, xMax, bassY0);

    console.log(`[OMR] Clef NCC: treble=${trebleScore.toFixed(3)} bass=${bassScore.toFixed(3)}`);

    const THRESHOLD = 0.25;
    if (trebleScore < THRESHOLD && bassScore < THRESHOLD) return null;
    return { clef: trebleScore >= bassScore ? 'treble' : 'bass', trebleScore, bassScore };
  }

  /**
   * Scan horizontally for the best NCC match of a template at a fixed y0.
   * @param {Uint8Array} binary
   * @param {number}     imgWidth
   * @param {{data:Uint8Array, w:number, h:number}} tpl
   * @param {number}     x0
   * @param {number}     x1
   * @param {number}     y0  — desired template top (clamped to image bounds)
   * @returns {number}   best NCC score in [0,1]
   */
  _nccScanX(binary, imgWidth, tpl, x0, x1, y0) {
    const { data, w, h } = tpl;
    const N   = w * h;
    const imgH = Math.floor(binary.length / imgWidth);

    const sy = Math.max(0, Math.min(imgH - h, y0));

    // Template mean + std (constant per call)
    let tSum = 0;
    for (let i = 0; i < N; i++) tSum += data[i];
    const tMean = tSum / N;
    let tVar = 0;
    for (let i = 0; i < N; i++) { const d = data[i] - tMean; tVar += d * d; }
    const tStd = Math.sqrt(tVar);
    if (tStd < 1e-6) return 0;

    let best = -1;
    const xEnd = Math.min(x1, imgWidth - w);
    for (let sx = x0; sx <= xEnd; sx++) {
      // Patch mean
      let pSum = 0;
      for (let ty = 0; ty < h; ty++) {
        const row = (sy + ty) * imgWidth;
        for (let tx = 0; tx < w; tx++) pSum += binary[row + sx + tx];
      }
      const pMean = pSum / N;

      // NCC
      let num = 0, pVar = 0;
      for (let ty = 0; ty < h; ty++) {
        const row = (sy + ty) * imgWidth;
        for (let tx = 0; tx < w; tx++) {
          const pv = binary[row + sx + tx] - pMean;
          const tv = data[ty * w + tx] - tMean;
          num  += pv * tv;
          pVar += pv * pv;
        }
      }
      const pStd = Math.sqrt(pVar);
      if (pStd < 1e-6) continue;
      const score = num / (pStd * tStd);
      if (score > best) best = score;
    }
    return Math.max(0, best);
  }

  /**
   * Generate a treble clef (G clef) template scaled to staffSpace.
   * Template coords: y increases downward, y=0 at top.
   * Staff bottom line sits at template y = 4.9×ss; G line at 3.9×ss.
   * @param {number} ss — staffSpace in pixels
   * @returns {{data:Uint8Array, w:number, h:number}}
   */
  _makeTrebleTemplate(ss) {
    const w = Math.round(ss * 1.6);
    const h = Math.round(ss * 5.5);
    const data = new Uint8Array(w * h).fill(255);

    const stemX  = Math.round(w * 0.42);
    const stroke = Math.max(1, Math.round(ss * 0.09));

    // 1. Vertical stem (full height)
    for (let y = 0; y < h; y++)
      for (let dx = -stroke; dx <= stroke; dx++) {
        const px = stemX + dx;
        if (px >= 0 && px < w) data[y * w + px] = 0;
      }

    // 2. Ring (loop) around the G line (2nd from bottom = 3.9×ss from template top)
    const loopCY = Math.round(ss * 3.9);
    const oRX = Math.round(ss * 0.55), oRY = Math.round(ss * 0.72);
    const iRX = Math.round(ss * 0.28), iRY = Math.round(ss * 0.48);
    for (let y = Math.max(0, loopCY - oRY - 1); y < Math.min(h, loopCY + oRY + 2); y++)
      for (let x = 0; x < w; x++) {
        const dx = x - stemX, dy = y - loopCY;
        const outer = (dx*dx)/(oRX*oRX) + (dy*dy)/(oRY*oRY);
        const inner = (dx*dx)/(iRX*iRX) + (dy*dy)/(iRY*iRY);
        if (outer <= 1.0 && inner > 1.0) data[y * w + x] = 0;
      }

    // 3. Spiral curl (filled circle below staff bottom line)
    const sCY = Math.round(ss * 5.2);
    const sR  = Math.round(ss * 0.35);
    for (let y = Math.max(0, sCY - sR - 1); y < Math.min(h, sCY + sR + 2); y++)
      for (let x = 0; x < w; x++) {
        const dx = x - stemX, dy = y - sCY;
        if (dx*dx + dy*dy <= sR*sR) data[y * w + x] = 0;
      }

    return { data, w, h };
  }

  /**
   * Generate a bass clef (F clef) template scaled to staffSpace.
   * Template coords: y=0 at top. Template top sits 0.5×ss above the staff top line.
   * F line (4th from bottom = 2nd from top) is at template y ≈ 1.5×ss.
   * @param {number} ss — staffSpace in pixels
   * @returns {{data:Uint8Array, w:number, h:number}}
   */
  _makeBassTemplate(ss) {
    const w = Math.round(ss * 2.4);
    const h = Math.round(ss * 2.2);
    const data = new Uint8Array(w * h).fill(255);

    const stroke = Math.max(1, Math.round(ss * 0.10));

    // C-curve body (arc opening right, centred at ~52% height)
    const arcCX = Math.round(ss * 0.35);
    const arcCY = Math.round(h  * 0.52);
    const arcR  = Math.round(ss * 0.70);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = x - arcCX, dy = y - arcCY;
        const r = Math.sqrt(dx*dx + dy*dy);
        if (r >= arcR - stroke && r <= arcR + stroke) {
          // Skip the right-facing gap (±25° around angle=0)
          const angle = Math.atan2(dy, dx);
          if (Math.abs(angle) > Math.PI * 0.22) data[y * w + x] = 0;
        }
      }

    // Two dots (F line ± half a space)
    const dotX  = Math.round(ss * 1.65);
    const dotR  = Math.max(2, Math.round(ss * 0.16));
    const dot1Y = Math.round(ss * 0.90);
    const dot2Y = Math.round(ss * 1.50);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const d1 = (x-dotX)**2 + (y-dot1Y)**2;
        const d2 = (x-dotX)**2 + (y-dot2Y)**2;
        if (d1 <= dotR*dotR || d2 <= dotR*dotR) data[y * w + x] = 0;
      }

    return { data, w, h };
  }

  _findStaffGroup(y, staffGroups, staffSpace) {
    const margin = staffSpace * 2; // allow notes 2 spaces above/below staff (ledger lines)
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
