// ─────────────────────────────────────────────
// OMREngine — orchestrates the full OMR pipeline
// from image loading through MIDI generation
// ─────────────────────────────────────────────

import { ImageProcessor } from './ImageProcessor.js';
import { SkewCorrector } from './SkewCorrector.js';
import { StaffAnalyzer } from './StaffAnalyzer.js';
import { ComponentLabeler } from './ComponentLabeler.js';
import { SymbolClassifier } from './SymbolClassifier.js';
import { PitchMapper } from './PitchMapper.js';
import { DurationMapper } from './DurationMapper.js';
import { GrammarValidator } from './GrammarValidator.js';
import { MidiWriter } from '../rhythm/MidiWriter.js';

// ── OMREngine ──────────────────────────────────

export class OMREngine {
  /**
   * @param {EventBus} bus
   */
  constructor(bus) {
    this._bus = bus;
    this._imageProcessor = new ImageProcessor(bus);
    this._skewCorrector = new SkewCorrector(bus);
    this._staffAnalyzer = new StaffAnalyzer(bus);
    this._componentLabeler = new ComponentLabeler(bus);
    this._symbolClassifier = new SymbolClassifier(bus);
    this._pitchMapper = new PitchMapper(bus);
    this._durationMapper = new DurationMapper(bus);
    this._grammarValidator = new GrammarValidator(bus);
  }

  /**
   * Run the full OMR pipeline on an image file.
   * @param {File|Blob} file
   * @param {object} [options]
   * @param {number} [options.bpm=120]
   * @param {number[]} [options.timeSig=[4,4]]
   * @returns {Promise<{midi: ArrayBuffer, notes: Array, corrections: Array<string>}>}
   */
  async process(file, options = {}) {
    const bpm = options.bpm ?? 120;
    const timeSig = options.timeSig ?? [4, 4];

    // Stage 1: Load image
    this._bus.emit('omr:progress', { stage: 1, name: 'Loading image' });
    let { gray, width, height } = await this._imageProcessor.load(file);

    // Stage 1.5: Preprocessing — median filter + border cropping
    gray = this._imageProcessor.medianFilter(gray, width, height);
    const cropped = this._imageProcessor.cropBorders(gray, width, height);
    if (cropped.offsetX > 0 || cropped.offsetY > 0) {
      console.log(`[OMR] Cropped borders: offset=(${cropped.offsetX},${cropped.offsetY}) size=${cropped.width}×${cropped.height} (was ${width}×${height})`);
      gray = cropped.gray;
      width = cropped.width;
      height = cropped.height;
    }

    // Stage 2: Binarization
    this._bus.emit('omr:progress', { stage: 2, name: 'Binarizing' });
    const binary = this._imageProcessor.binarize(gray, width, height);
    this._bus.emit('omr:preprocessed', { width, height });

    // Stage 3: Skew correction
    this._bus.emit('omr:progress', { stage: 3, name: 'Correcting skew' });
    const { data: correctedGray, angle } = this._skewCorrector.correct(
      binary, gray, width, height
    );
    // Re-binarize corrected image if it was rotated
    const correctedBinary = Math.abs(angle) > 0.002
      ? this._imageProcessor.binarize(correctedGray, width, height)
      : binary;

    // Stage 4: Staff line detection
    this._bus.emit('omr:progress', { stage: 4, name: 'Detecting staff lines' });
    const { groups, staffSpace, lineThickness, staffRows } =
      this._staffAnalyzer.detect(correctedBinary, width, height);

    console.log(`[OMR] Stage 4: ${groups.length} staff groups, staffSpace=${staffSpace}, lineThick=${lineThickness}, staffRows=${staffRows.length}`);

    if (groups.length === 0) {
      throw new Error('No staff lines detected. Ensure the image contains printed sheet music.');
    }

    // Stage 5: Staff line removal
    this._bus.emit('omr:progress', { stage: 5, name: 'Removing staff lines' });
    let cleaned = this._staffAnalyzer.removeStaffLines(
      correctedBinary, width, height, staffRows, lineThickness
    );

    // Morphological repair
    cleaned = this._imageProcessor.morphClose(cleaned, width, height,
      Math.ceil(lineThickness / 2) + 1);

    // Stage 6: Connected component labeling
    this._bus.emit('omr:progress', { stage: 6, name: 'Segmenting symbols' });
    const { labels, count } = this._componentLabeler.label(cleaned, width, height);
    const components = this._componentLabeler.extractFeatures(
      labels, width, height, count, staffSpace
    );
    console.log(`[OMR] Stage 6: ${count} raw labels, ${components.length} components after filtering`);

    // Stage 6.5: Split note+stem combos — extract noteheads from tall components
    const splitComponents = this._splitNoteStems(components, correctedBinary, width, height, staffSpace);
    console.log(`[OMR] Stage 6.5: ${splitComponents.length} components after note+stem splitting (added ${splitComponents.length - components.length})`);

    // Stage 7: Symbol classification
    this._bus.emit('omr:progress', { stage: 7, name: 'Classifying symbols' });
    const symbols = this._symbolClassifier.classify(splitComponents);
    const typeCounts = {};
    for (const s of symbols) typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;
    console.log(`[OMR] Stage 7: ${symbols.length} symbols`, JSON.stringify(typeCounts));

    // Log a sample of components that were classified as unknown to understand what's being missed
    const unknowns = symbols.filter(s => s.type === 'unknown');
    if (unknowns.length > 0) {
      const sample = unknowns.slice(0, 15).map(s => {
        const c = s.component;
        return `wSS=${c.widthSS.toFixed(2)} hSS=${c.heightSS.toFixed(2)} ar=${c.aspectRatio.toFixed(2)} fill=${c.fillRatio.toFixed(2)} holes=${c.holes} area=${c.area} bbox=${c.bbox.width}x${c.bbox.height}`;
      });
      console.log(`[OMR] ${unknowns.length} unknowns, sample:\n` + sample.join('\n'));
    }

    // Stage 8: Pitch assignment
    this._bus.emit('omr:progress', { stage: 8, name: 'Assigning pitches' });
    const pitchedNotes = this._pitchMapper.assignPitches(
      symbols, groups, staffSpace, correctedBinary, width
    );
    console.log(`[OMR] Stage 8: ${pitchedNotes.length} pitched notes`);

    // Stage 9: Duration assignment
    this._bus.emit('omr:progress', { stage: 9, name: 'Assigning durations' });
    const notesWithDuration = this._durationMapper.assignDurations(
      pitchedNotes, symbols, staffSpace
    );
    const rests = this._durationMapper.detectRests(symbols, groups, staffSpace);
    console.log(`[OMR] Stage 9: ${notesWithDuration.length} notes with duration, ${rests.length} rests`);

    // Stage 10: Grammar validation
    this._bus.emit('omr:progress', { stage: 10, name: 'Validating grammar' });
    const { notes: validatedNotes, rests: validatedRests, corrections } =
      this._grammarValidator.validate(
        notesWithDuration, rests, symbols, staffSpace, timeSig
      );

    console.log(`[OMR] Stage 10: ${validatedNotes.length} validated notes, ${validatedRests.length} rests, ${corrections.length} corrections`);

    // Stage 11: MIDI assembly — merge notes and rests, compute start times
    this._bus.emit('omr:progress', { stage: 11, name: 'Generating MIDI' });

    // Merge into time-ordered sequence and compute cumulative startBeat
    const allEvents = [
      ...validatedNotes.map(n => ({ ...n, isRest: false })),
      ...validatedRests.map(r => ({ ...r, isRest: true, midiNote: -1 }))
    ];
    allEvents.sort((a, b) => a.x - b.x);

    let currentBeat = 0;
    for (const e of allEvents) {
      e.startBeat = currentBeat;
      currentBeat += e.beats;
    }

    const midiNotes = allEvents
      .filter(n => !n.isRest && n.midiNote > 0)
      .map(n => ({ note: n.midiNote, beats: n.beats, startBeat: n.startBeat }));
    console.log(`[OMR] Stage 11: ${midiNotes.length} MIDI notes, ${validatedRests.length} rests integrated`);

    const midi = MidiWriter.build({
      bpm,
      notes: midiNotes,
      meter: timeSig
    });

    this._bus.emit('omr:midi', {
      midi,
      noteCount: midiNotes.length,
      corrections
    });

    return {
      midi,
      notes: validatedNotes,
      corrections,
      staffInfo: { groups, staffSpace, lineThickness },
      symbols
    };
  }

  /**
   * Split tall components (note+stem combos) by scanning for notehead-dense
   * horizontal bands. Returns a new component array with extracted noteheads
   * appended.
   * @param {Array} components
   * @param {Uint8Array} binary - 0=foreground, 255=background
   * @param {number} imgWidth
   * @param {number} imgHeight
   * @param {number} staffSpace
   * @returns {Array}
   */
  _splitNoteStems(components, binary, imgWidth, imgHeight, staffSpace) {
    const result = [...components];
    const noteH = Math.round(staffSpace * 0.9);  // expected notehead height
    const noteW = Math.round(staffSpace * 1.3);  // expected notehead width
    const minDensity = 0.45; // minimum fill ratio for a notehead band

    for (const comp of components) {
      // Only try splitting tall-ish components that aren't already small noteheads
      if (comp.heightSS < 1.5 || comp.widthSS > 5.0 || comp.widthSS < 0.3) continue;

      const bb = comp.bbox;

      // Compute horizontal density profile: for each row, count black pixels
      // in the notehead-width center region
      const halfNoteW = Math.floor(noteW / 2);
      const cx = Math.round(comp.centroid.x);

      // Scan rows in the bounding box looking for dense horizontal bands
      const rowDensity = [];
      for (let y = bb.y; y < bb.y + bb.height && y < imgHeight; y++) {
        let count = 0;
        let total = 0;
        // Scan the full width of the component
        for (let x = bb.x; x < bb.x + bb.width && x < imgWidth; x++) {
          total++;
          if (binary[y * imgWidth + x] === 0) count++;
        }
        rowDensity.push({ y, density: total > 0 ? count / bb.width : 0 });
      }

      // Find peaks in the density profile — these are notehead locations
      // Look for contiguous bands of high density that are ~1 staffSpace tall
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
        } else {
          if (inPeak) {
            const peakHeight = i - peakStart;
            // Only accept peaks roughly notehead-sized (0.3–1.5 staffSpaces tall)
            if (peakHeight >= staffSpace * 0.3 && peakHeight <= staffSpace * 1.8) {
              peaks.push({
                y: rowDensity[peakStart].y,
                height: peakHeight,
                centerRow: rowDensity[peakMaxRow].y,
                maxDensity: peakMaxDensity
              });
            }
            inPeak = false;
          }
        }
      }
      // Close any open peak
      if (inPeak) {
        const peakHeight = rowDensity.length - peakStart;
        if (peakHeight >= staffSpace * 0.3 && peakHeight <= staffSpace * 1.8) {
          peaks.push({
            y: rowDensity[peakStart].y,
            height: peakHeight,
            centerRow: rowDensity[peakMaxRow].y,
            maxDensity: peakMaxDensity
          });
        }
      }

      // Create synthetic notehead components from each peak
      for (const peak of peaks) {
        const subBbox = {
          x: bb.x,
          y: peak.y,
          width: bb.width,
          height: peak.height
        };

        // Compute area within sub-bbox
        let area = 0;
        let sumX = 0;
        let sumY = 0;
        for (let y = subBbox.y; y < subBbox.y + subBbox.height && y < imgHeight; y++) {
          for (let x = subBbox.x; x < subBbox.x + subBbox.width && x < imgWidth; x++) {
            if (binary[y * imgWidth + x] === 0) {
              area++;
              sumX += x;
              sumY += y;
            }
          }
        }

        if (area < 5) continue;

        const subComp = {
          label: comp.label,
          bbox: subBbox,
          centroid: { x: sumX / area, y: sumY / area },
          area,
          fillRatio: area / (subBbox.width * subBbox.height),
          aspectRatio: subBbox.width / subBbox.height,
          holes: 0,
          widthSS: subBbox.width / staffSpace,
          heightSS: subBbox.height / staffSpace,
          _splitFrom: true // marker for debugging
        };

        result.push(subComp);
      }
    }

    return result;
  }

  /**
   * Get a preview of the binarized image as ImageData.
   * @param {Uint8Array} binary
   * @param {number} width
   * @param {number} height
   * @returns {ImageData}
   */
  binaryToImageData(binary, width, height) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < binary.length; i++) {
      const v = binary[i];
      const j = i * 4;
      data[j] = v;
      data[j + 1] = v;
      data[j + 2] = v;
      data[j + 3] = 255;
    }
    return new ImageData(data, width, height);
  }
}
