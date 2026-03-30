// ─────────────────────────────────────────────
// GrammarValidator — musical rule enforcement
// and error correction for OMR output
// ─────────────────────────────────────────────

import { SymbolType } from './SymbolClassifier.js';

// ── Constants ──────────────────────────────────

const DEFAULT_TIME_SIG = [4, 4];
const BEATS_TOLERANCE = 0.01; // rounding tolerance for beat sums

// ── GrammarValidator ───────────────────────────

export class GrammarValidator {
  /**
   * @param {EventBus} bus
   */
  constructor(bus) {
    this._bus = bus;
  }

  /**
   * Run all validation rules on detected notes.
   * @param {Array<{midiNote: number, beats: number, x: number, symbol: object}>} notes
   * @param {Array<{x: number, beats: number}>} rests
   * @param {Array<{component: ComponentFeatures, type: string}>} allSymbols
   * @param {number} staffSpace
   * @param {number[]} [timeSig] - [numerator, denominator]
   * @returns {{notes: Array, corrections: Array<string>}}
   */
  validate(notes, rests, allSymbols, staffSpace, timeSig = DEFAULT_TIME_SIG) {
    const corrections = [];

    // Deduplicate notes: remove spatially adjacent notes with the same pitch.
    // Keeps the note with the larger component area (better detection quality).
    const dedupedNotes = this._deduplicateNotes(notes, staffSpace);

    // Merge notes and rests into a time-ordered sequence
    const events = [
      ...dedupedNotes.map(n => ({ ...n, isRest: false })),
      ...rests.map(r => ({ ...r, isRest: true, midiNote: -1 }))
    ];
    events.sort((a, b) => a.x - b.x);

    // Find bar lines to segment into measures
    const barLines = allSymbols
      .filter(s => s.type === SymbolType.BAR_LINE)
      .map(s => s.component.centroid.x)
      .sort((a, b) => a - b);

    // Rule 1: Measure completeness
    const measures = this._segmentMeasures(events, barLines);
    const beatsPerMeasure = timeSig[0] * (4 / timeSig[1]);

    for (let i = 0; i < measures.length; i++) {
      const measure = measures[i];
      const totalBeats = measure.reduce((sum, e) => sum + e.beats, 0);

      if (Math.abs(totalBeats - beatsPerMeasure) > BEATS_TOLERANCE) {
        const diff = beatsPerMeasure - totalBeats;
        if (diff > 0 && diff <= 0.5) {
          // Small deficit — might be a missed dot
          corrections.push(
            `Measure ${i + 1}: ${totalBeats} beats (expected ${beatsPerMeasure}), possible missed augmentation dot`
          );
        } else if (diff < 0 && diff >= -0.5) {
          // Small surplus — might be an extra dot
          corrections.push(
            `Measure ${i + 1}: ${totalBeats} beats (expected ${beatsPerMeasure}), possible extra augmentation dot`
          );
        } else {
          corrections.push(
            `Measure ${i + 1}: ${totalBeats} beats (expected ${beatsPerMeasure}), duration mismatch`
          );
        }
      }
    }

    // Rule 2: Pitch quantization (already enforced in PitchMapper)

    // Rule 3: Beam group validity
    this._validateBeamGroups(allSymbols, staffSpace, corrections);

    // Rule 5: Temporal ordering (notes should be left-to-right)
    const noteEvents = events.filter(e => !e.isRest);
    for (let i = 1; i < noteEvents.length; i++) {
      if (noteEvents[i].x < noteEvents[i - 1].x - staffSpace * 0.5) {
        corrections.push(
          `Note at x=${Math.round(noteEvents[i].x)} appears out of temporal order`
        );
      }
    }

    // Rule 5b: Detect chords (vertically aligned noteheads)
    const chords = this._detectChords(noteEvents, staffSpace);

    this._bus.emit('omr:validated', { corrections, chords });

    return {
      notes: events.filter(e => !e.isRest),
      rests: events.filter(e => e.isRest),
      corrections,
      chords
    };
  }

  /**
   * Segment events into measures based on bar line positions.
   * @param {Array} events
   * @param {number[]} barLines - x positions
   * @returns {Array<Array>}
   */
  _segmentMeasures(events, barLines) {
    if (barLines.length === 0) return [events];

    const measures = [];
    let currentMeasure = [];
    let barIdx = 0;

    for (const e of events) {
      if (barIdx < barLines.length && e.x > barLines[barIdx]) {
        if (currentMeasure.length > 0) {
          measures.push(currentMeasure);
        }
        currentMeasure = [];
        barIdx++;
      }
      currentMeasure.push(e);
    }
    if (currentMeasure.length > 0) {
      measures.push(currentMeasure);
    }

    return measures;
  }

  /**
   * Validate beam groups follow standard conventions.
   * @param {Array} allSymbols
   * @param {number} staffSpace
   * @param {Array<string>} corrections
   */
  _validateBeamGroups(allSymbols, staffSpace, corrections) {
    const beams = allSymbols.filter(s => s.type === SymbolType.BEAM);
    // Beams should connect at least 2 stems
    for (const beam of beams) {
      const beamLeft = beam.component.bbox.x;
      const beamRight = beam.component.bbox.x + beam.component.bbox.width;
      const beamWidth = beamRight - beamLeft;
      if (beamWidth < staffSpace * 1.0) {
        corrections.push(
          `Suspicious beam at x=${Math.round(beamLeft)}: too narrow (${Math.round(beamWidth)}px)`
        );
      }
    }
  }

  /**
   * Detect chords (multiple noteheads at the same x-position).
   * @param {Array} notes
   * @param {number} staffSpace
   * @returns {Array<Array>} groups of simultaneous notes
   */
  _detectChords(notes, staffSpace) {
    const threshold = staffSpace * 0.8; // max x-distance for "same beat"
    const chords = [];
    let i = 0;

    while (i < notes.length) {
      const group = [notes[i]];
      let j = i + 1;
      while (j < notes.length && Math.abs(notes[j].x - notes[i].x) < threshold) {
        group.push(notes[j]);
        j++;
      }
      if (group.length > 1) {
        chords.push(group);
      }
      i = j;
    }

    return chords;
  }

  /**
   * Validate and auto-correct in one step. Runs validate, then autoCorrect,
   * and emits omr:correction events for any changes made.
   * @param {Array} notes
   * @param {Array} rests
   * @param {Array} allSymbols
   * @param {number} staffSpace
   * @param {number[]} [timeSig]
   * @returns {{notes: Array, rests: Array, corrections: Array<string>, chords: Array}}
   */
  validateAndCorrect(notes, rests, allSymbols, staffSpace, timeSig = DEFAULT_TIME_SIG) {
    const result = this.validate(notes, rests, allSymbols, staffSpace, timeSig);
    const beatsPerMeasure = timeSig[0] * (4 / timeSig[1]);

    // Segment into measures for auto-correction
    const barLines = allSymbols
      .filter(s => s.type === SymbolType.BAR_LINE)
      .map(s => s.component.centroid.x)
      .sort((a, b) => a - b);

    const allEvents = [
      ...result.notes.map(n => ({ ...n, isRest: false })),
      ...result.rests.map(r => ({ ...r, isRest: true }))
    ];
    allEvents.sort((a, b) => a.x - b.x);

    const measures = this._segmentMeasures(allEvents, barLines);

    // Track original beats for comparison
    const originalBeats = new Map();
    for (const m of measures) {
      for (const e of m) originalBeats.set(e, e.beats);
    }

    const corrected = this.autoCorrect(measures, beatsPerMeasure);

    // Emit correction events for any changed notes
    for (const e of corrected) {
      const orig = originalBeats.get(e);
      if (orig !== undefined && orig !== e.beats) {
        this._bus.emit('omr:correction', {
          x: e.x,
          originalBeats: orig,
          correctedBeats: e.beats,
          midiNote: e.midiNote
        });
      }
    }

    return {
      notes: corrected.filter(e => !e.isRest),
      rests: corrected.filter(e => e.isRest),
      corrections: result.corrections,
      chords: result.chords
    };
  }

  /**
   * Attempt automatic correction of measure beat counts.
   * @param {Array} measures - arrays of events per measure
   * @param {number} beatsPerMeasure
   * @returns {Array} corrected events
   */
  autoCorrect(measures, beatsPerMeasure) {
    const corrected = [];

    for (const measure of measures) {
      const totalBeats = measure.reduce((sum, e) => sum + e.beats, 0);

      if (Math.abs(totalBeats - beatsPerMeasure) < BEATS_TOLERANCE) {
        corrected.push(...measure);
        continue;
      }

      // Strategy: If exactly one note off, try adjusting the lowest-confidence note
      if (measure.length > 0) {
        const sorted = [...measure].sort((a, b) =>
          (a.symbol?.confidence ?? 1) - (b.symbol?.confidence ?? 1)
        );

        const weakest = sorted[0];
        const othersBeats = totalBeats - weakest.beats;
        const neededBeats = beatsPerMeasure - othersBeats;

        // Only auto-correct to valid note durations
        const validDurations = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
        const closest = validDurations.reduce((best, d) =>
          Math.abs(d - neededBeats) < Math.abs(best - neededBeats) ? d : best
        );

        if (Math.abs(closest - neededBeats) < BEATS_TOLERANCE) {
          weakest.beats = closest;
        }
      }

      corrected.push(...measure);
    }

    return corrected;
  }

  /**
   * Remove spatially adjacent duplicate notes (same pitch, within 1 staffSpace).
   * Keeps the note with the larger component area; if equal, keeps the first.
   * @param {Array} notes
   * @param {number} staffSpace
   * @returns {Array}
   */
  _deduplicateNotes(notes, staffSpace) {
    if (notes.length <= 1) return notes;
    // Same-pitch dedup window: 1× staffSpace. Split arcs from whole-note staff-line
    // removal land at nearly the same x-centroid, so 1× staffSpace is sufficient.
    const threshold = staffSpace * 1;
    const keep = new Array(notes.length).fill(true);

    for (let i = 0; i < notes.length; i++) {
      if (!keep[i]) continue;
      for (let j = i + 1; j < notes.length; j++) {
        if (!keep[j]) continue;
        const dx = Math.abs(notes[j].x - notes[i].x);
        if (dx >= threshold) continue;

        // Match on same MIDI note OR same staffPos (staffPos catches arcs whose
        // MIDI note drifted by ±1 semitone from key-sig adjustment or centroid jitter).
        const sameMidi = notes[j].midiNote === notes[i].midiNote;
        const samePos  = notes[j].staffPos !== undefined
          && notes[j].staffPos === notes[i].staffPos;
        if (!sameMidi && !samePos) continue;

        // Duplicate: keep the one with larger area
        const areaI = notes[i].symbol?.component?.area ?? 0;
        const areaJ = notes[j].symbol?.component?.area ?? 0;
        if (areaJ > areaI) {
          keep[i] = false;
          console.log(`[OMR] Dedup: dropped note at x=${Math.round(notes[i].x)} midi=${notes[i].midiNote} (area=${areaI}) in favor of x=${Math.round(notes[j].x)} (area=${areaJ})`);
          break;
        } else {
          keep[j] = false;
          console.log(`[OMR] Dedup: dropped note at x=${Math.round(notes[j].x)} midi=${notes[j].midiNote} (area=${areaJ}) in favor of x=${Math.round(notes[i].x)} (area=${areaI})`);
        }
      }
    }

    return notes.filter((_, idx) => keep[idx]);
  }
}
