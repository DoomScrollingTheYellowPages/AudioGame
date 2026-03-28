// ─────────────────────────────────────────────
// DurationMapper — determine note durations from
// notehead type, stem presence, beams, flags,
// and augmentation dots
// ─────────────────────────────────────────────

import { SymbolType } from './SymbolClassifier.js';

// ── Constants ──────────────────────────────────

const STEM_ATTACH_DISTANCE = 1.5; // max staff spaces between notehead and stem
const BEAM_ATTACH_DISTANCE = 0.8; // max staff spaces between stem tip and beam
const DOT_ATTACH_DISTANCE = 1.0;  // max staff spaces to the right of notehead
const FLAG_ATTACH_DISTANCE = 1.2; // max staff spaces from stem tip

// ── DurationMapper ─────────────────────────────

export class DurationMapper {
  /**
   * @param {EventBus} bus
   */
  constructor(bus) {
    this._bus = bus;
  }

  /**
   * Assign durations to all detected notes.
   * @param {Array<{symbol: object, staffPos: number, noteName: string, octave: number, midiNote: number}>} notes
   * @param {Array<{component: ComponentFeatures, type: string}>} allSymbols
   * @param {number} staffSpace
   * @returns {Array<{...note, beats: number, durationType: string}>}
   */
  assignDurations(notes, allSymbols, staffSpace) {
    const stems = allSymbols.filter(s => s.type === SymbolType.STEM);
    const beams = allSymbols.filter(s => s.type === SymbolType.BEAM);
    const dots = allSymbols.filter(s => s.type === SymbolType.DOT);
    const flags = allSymbols.filter(s =>
      s.type === SymbolType.FLAG_EIGHTH || s.type === SymbolType.FLAG_SIXTEENTH
    );

    const result = [];

    for (const note of notes) {
      const noteX = note.symbol.component.centroid.x;
      const noteY = note.symbol.component.centroid.y;
      const noteType = note.symbol.type;

      // Determine base duration from notehead type
      let beats;
      let durationType;

      if (noteType === SymbolType.WHOLE_NOTE) {
        beats = 4;
        durationType = 'whole';
      } else if (noteType === SymbolType.OPEN_NOTEHEAD) {
        // Open notehead: half note if stem present
        const hasStem = this._findAttachedStem(noteX, noteY, stems, staffSpace);
        if (hasStem) {
          beats = 2;
          durationType = 'half';
        } else {
          beats = 4;
          durationType = 'whole';
        }
      } else {
        // Filled notehead: quarter by default
        const stem = this._findAttachedStem(noteX, noteY, stems, staffSpace);
        if (stem) {
          // Check for beams or flags at the stem tip
          const stemTipY = this._getStemTip(stem, noteY);
          const beamCount = this._countAttachedBeams(stem, stemTipY, beams, staffSpace);
          const flagCount = this._countAttachedFlags(stem, stemTipY, flags, staffSpace);

          const subdivisions = Math.max(beamCount, flagCount);
          if (subdivisions >= 2) {
            beats = 0.25;
            durationType = 'sixteenth';
          } else if (subdivisions >= 1) {
            beats = 0.5;
            durationType = 'eighth';
          } else {
            beats = 1;
            durationType = 'quarter';
          }
        } else {
          beats = 1;
          durationType = 'quarter';
        }
      }

      // Check for augmentation dot
      const hasDot = this._findDot(noteX, noteY, dots, staffSpace);
      if (hasDot) {
        beats *= 1.5;
        durationType = 'dotted_' + durationType;
      }

      result.push({ ...note, beats, durationType });
    }

    return result;
  }

  /**
   * Find a stem attached to a notehead.
   * @param {number} noteX
   * @param {number} noteY
   * @param {Array<{component: ComponentFeatures, type: string}>} stems
   * @param {number} staffSpace
   * @returns {object|null}
   */
  _findAttachedStem(noteX, noteY, stems, staffSpace) {
    const maxDist = staffSpace * STEM_ATTACH_DISTANCE;
    let best = null;
    let bestDist = Infinity;

    for (const stem of stems) {
      const sc = stem.component;
      // Stem should be close horizontally to the notehead
      const dx = Math.abs(sc.centroid.x - noteX);
      if (dx > maxDist) continue;

      // Stem should overlap vertically with the notehead
      const stemTop = sc.bbox.y;
      const stemBottom = sc.bbox.y + sc.bbox.height;
      const vertOverlap = noteY >= stemTop - maxDist && noteY <= stemBottom + maxDist;
      if (!vertOverlap) continue;

      const dist = dx;
      if (dist < bestDist) {
        bestDist = dist;
        best = stem;
      }
    }

    return best;
  }

  /**
   * Get the tip (far end from notehead) of a stem.
   * @param {object} stem
   * @param {number} noteY
   * @returns {number} y-coordinate of stem tip
   */
  _getStemTip(stem, noteY) {
    const stemTop = stem.component.bbox.y;
    const stemBottom = stem.component.bbox.y + stem.component.bbox.height;
    // Tip is the end farther from the notehead
    return Math.abs(noteY - stemTop) > Math.abs(noteY - stemBottom)
      ? stemTop : stemBottom;
  }

  /**
   * Count beams attached to a stem tip.
   * @param {object} stem
   * @param {number} stemTipY
   * @param {Array<{component: ComponentFeatures, type: string}>} beams
   * @param {number} staffSpace
   * @returns {number}
   */
  _countAttachedBeams(stem, stemTipY, beams, staffSpace) {
    const maxDist = staffSpace * BEAM_ATTACH_DISTANCE;
    let count = 0;

    for (const beam of beams) {
      const bc = beam.component;
      // Beam should be horizontally near the stem
      const stemX = stem.component.centroid.x;
      if (stemX < bc.bbox.x - maxDist || stemX > bc.bbox.x + bc.bbox.width + maxDist) {
        continue;
      }
      // Beam should be vertically near the stem tip
      const beamY = bc.centroid.y;
      if (Math.abs(beamY - stemTipY) <= maxDist) {
        count++;
      }
    }

    return count;
  }

  /**
   * Count flags attached to a stem tip.
   * @param {object} stem
   * @param {number} stemTipY
   * @param {Array<{component: ComponentFeatures, type: string}>} flags
   * @param {number} staffSpace
   * @returns {number}
   */
  _countAttachedFlags(stem, stemTipY, flags, staffSpace) {
    const maxDist = staffSpace * FLAG_ATTACH_DISTANCE;
    let count = 0;

    for (const flag of flags) {
      const fc = flag.component;
      const dx = Math.abs(fc.centroid.x - stem.component.centroid.x);
      const dy = Math.abs(fc.centroid.y - stemTipY);
      if (dx <= maxDist && dy <= maxDist) {
        count++;
      }
    }

    return count;
  }

  /**
   * Find an augmentation dot to the right of a notehead.
   * @param {number} noteX
   * @param {number} noteY
   * @param {Array<{component: ComponentFeatures, type: string}>} dots
   * @param {number} staffSpace
   * @returns {boolean}
   */
  _findDot(noteX, noteY, dots, staffSpace) {
    const maxDist = staffSpace * DOT_ATTACH_DISTANCE;

    for (const dot of dots) {
      const dc = dot.component;
      // Dot must be to the right of the notehead
      if (dc.centroid.x <= noteX) continue;
      const dx = dc.centroid.x - noteX;
      const dy = Math.abs(dc.centroid.y - noteY);
      if (dx <= maxDist * 2 && dy <= maxDist) {
        return true;
      }
    }
    return false;
  }

  /**
   * Detect rests and assign their durations.
   * @param {Array<{component: ComponentFeatures, type: string}>} symbols
   * @param {number[][]} staffGroups
   * @param {number} staffSpace
   * @returns {Array<{x: number, beats: number, durationType: string, staffGroupIndex: number}>}
   */
  detectRests(symbols, staffGroups, staffSpace) {
    const rests = [];

    for (const s of symbols) {
      let beats = 0;
      let durationType = '';

      switch (s.type) {
        case SymbolType.REST_WHOLE:
          beats = 4;
          durationType = 'whole_rest';
          break;
        case SymbolType.REST_HALF:
          beats = 2;
          durationType = 'half_rest';
          break;
        case SymbolType.REST_QUARTER:
          beats = 1;
          durationType = 'quarter_rest';
          break;
        case SymbolType.REST_EIGHTH:
          beats = 0.5;
          durationType = 'eighth_rest';
          break;
        default:
          continue;
      }

      // Find which staff group this rest belongs to
      let groupIndex = 0;
      for (let i = 0; i < staffGroups.length; i++) {
        const g = staffGroups[i];
        if (s.component.centroid.y >= g[0] && s.component.centroid.y <= g[4]) {
          groupIndex = i;
          break;
        }
      }

      rests.push({
        x: s.component.centroid.x,
        beats,
        durationType,
        staffGroupIndex: groupIndex
      });
    }

    return rests;
  }
}
