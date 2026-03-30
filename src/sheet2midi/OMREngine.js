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
import { SIG } from './SIG.js';
import { BeamDetector } from './BeamDetector.js';
import { LedgerDetector } from './LedgerDetector.js';

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
    this._beamDetector = new BeamDetector();
    this._ledgerDetector = new LedgerDetector();
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
    // 'grand' means use grand staff auto-detection (brace→gap→fallback cascade)
    // 'treble'/'bass' force a single-clef override for all staves
    // null/'auto' uses single-staff NCC detection
    const clef = (options.clef === 'grand' || !options.clef) ? null : options.clef;
    const grandStaffMode = options.clef === 'grand';

    // Stage 1: Load image
    this._bus.emit('omr:progress', { stage: 1, name: 'Loading image' });
    let { gray, width, height } = await this._imageProcessor.load(file);

    // Stage 1.5: Preprocessing — border cropping only (median filter applied later)
    const cropped = this._imageProcessor.cropBorders(gray, width, height);
    const cropOffsetX = cropped.offsetX;
    const cropOffsetY = cropped.offsetY;
    if (cropOffsetX > 0 || cropOffsetY > 0) {
      console.log(`[OMR] Cropped borders: offset=(${cropOffsetX},${cropOffsetY}) size=${cropped.width}×${cropped.height} (was ${width}×${height})`);
      gray = cropped.gray;
      width = cropped.width;
      height = cropped.height;
    }

    // Save pre-upscale dimensions so the debug overlay can map coordinates correctly
    const preCropW = width;
    const preCropH = height;

    // Stage 1.8: Auto-upscale small images for reliable feature detection
    let wasUpscaled = false;
    if (height < 200) {
      const factor = Math.min(Math.ceil(200 / height), 3);
      console.log(`[OMR] Auto-upscaling ${width}×${height} by ${factor}× → ${width * factor}×${height * factor}`);
      const upscaled = this._upscaleGray(gray, width, height, factor);
      gray = upscaled.gray;
      width = upscaled.width;
      height = upscaled.height;
      wasUpscaled = true;
    }

    // Stage 2: Binarization
    this._bus.emit('omr:progress', { stage: 2, name: 'Binarizing' });
    const binary = this._imageProcessor.binarize(gray, width, height);
    this._bus.emit('omr:preprocessed', { width, height });
    this._bus.emit('omr:debug', {
      step: 'binary', label: 'Binarization',
      data: { binary: binary.slice(), width, height, cropOffsetX, cropOffsetY, preCropW, preCropH }
    });

    // Stage 3: Skew correction (skip for upscaled digital images)
    this._bus.emit('omr:progress', { stage: 3, name: 'Correcting skew' });
    let correctedGray, angle;
    if (wasUpscaled) {
      // Clean digital images don't need skew correction
      correctedGray = new Uint8Array(gray);
      angle = 0;
      console.log(`[OMR] Skipping skew correction (upscaled digital image)`);
    } else {
      const result = this._skewCorrector.correct(binary, gray, width, height);
      correctedGray = result.data;
      angle = result.angle;
    }
    // Re-binarize corrected image if it was rotated
    const correctedBinary = Math.abs(angle) > 0.002
      ? this._imageProcessor.binarize(correctedGray, width, height)
      : binary;

    // Stage 4: Staff line detection
    this._bus.emit('omr:progress', { stage: 4, name: 'Detecting staff lines' });
    const { groups, staffSpace, lineThickness, staffRows } =
      this._staffAnalyzer.detect(correctedBinary, width, height);

    console.log(`[OMR] Stage 4: ${groups.length} staff groups, staffSpace=${staffSpace}, lineThick=${lineThickness}, staffRows=${staffRows.length}`);
    this._bus.emit('omr:debug', {
      step: 'staff_lines', label: 'Staff Line Detection',
      data: { binary: correctedBinary.slice(), width, height, staffRows, groups, staffSpace, lineThickness }
    });

    if (groups.length === 0) {
      throw new Error('No staff lines detected. Ensure the image contains printed sheet music.');
    }

    // Stage 5: Staff line removal
    this._bus.emit('omr:progress', { stage: 5, name: 'Removing staff lines' });
    let cleaned = this._staffAnalyzer.removeStaffLines(
      correctedBinary, width, height, staffRows, lineThickness
    );

    // Noise removal + morphological repair
    cleaned = this._imageProcessor.medianFilter(cleaned, width, height);
    cleaned = this._imageProcessor.morphClose(cleaned, width, height,
      Math.ceil(lineThickness / 2) + 1);

    this._bus.emit('omr:debug', {
      step: 'cleaned', label: 'After Staff Removal',
      data: { binary: cleaned.slice(), width, height }
    });

    // Stage 5.5: Beam and ledger pre-detection (SIG-based)
    const sig = new SIG();
    const detectedBeams = this._beamDetector.detect(
      correctedBinary, width, height, staffSpace, sig
    );
    const detectedLedgers = this._ledgerDetector.detect(
      correctedBinary, width, height, groups, staffSpace, lineThickness, sig
    );
    console.log(`[OMR] Stage 5.5: ${detectedBeams.length} beams, ${detectedLedgers.length} ledgers pre-detected`);

    // Stage 6: Connected component labeling
    this._bus.emit('omr:progress', { stage: 6, name: 'Segmenting symbols' });
    const { labels, count } = this._componentLabeler.label(cleaned, width, height);
    const components = this._componentLabeler.extractFeatures(
      labels, width, height, count, staffSpace
    );
    console.log(`[OMR] Stage 6: ${count} raw labels, ${components.length} components after filtering`);

    // Stage 6.1: Priority label integration — tag components overlapping
    // pre-detected beam/ledger regions so classifier can use them
    for (const comp of components) {
      for (const beam of detectedBeams) {
        if (this._bboxOverlap(comp.bbox, beam.bbox) > 0.3) {
          comp._priorityLabel = 'beam';
          break;
        }
      }
      if (!comp._priorityLabel) {
        for (const ledger of detectedLedgers) {
          if (this._bboxOverlap(comp.bbox, ledger.bbox) > 0.3) {
            comp._priorityLabel = 'ledger';
            break;
          }
        }
      }
    }

    // Stage 6.2: Spatial validity filter — discard components outside the
    // staff's vertical zone or taller than the full staff span.
    // This removes image-border artifacts (e.g. a vertical line at the page edge).
    const staffTop    = Math.min(...groups.map(g => g[0]));
    const staffBottom = Math.max(...groups.map(g => g[g.length - 1]));
    const staffSpan   = staffBottom - staffTop; // height of one staff system
    const zoneTop    = staffTop    - staffSpace * 2;
    const zoneBottom = staffBottom + staffSpace * 2;
    // No musical symbol legitimately exceeds the staff span by more than ~1.5×
    const maxHeightPx = staffSpan * 1.5 + staffSpace * 2;

    const validComponents = components.filter(c => {
      if (c.centroid.y < zoneTop || c.centroid.y > zoneBottom) return false;
      if (c.bbox.height > maxHeightPx) return false;
      return true;
    });
    console.log(`[OMR] Stage 6.2: ${validComponents.length}/${components.length} components kept after spatial filter`);

    // Stage 6.5: Split note+stem combos — extract noteheads from tall components
    const splitComponents = this._splitNoteStems(validComponents, correctedBinary, width, height, staffSpace);
    console.log(`[OMR] Stage 6.5: ${splitComponents.length} components after note+stem splitting (added ${splitComponents.length - validComponents.length})`);
    this._bus.emit('omr:debug', {
      step: 'components', label: 'Connected Components',
      data: { binary: cleaned.slice(), width, height, components: splitComponents, staffSpace }
    });

    // Stage 7: Symbol classification
    this._bus.emit('omr:progress', { stage: 7, name: 'Classifying symbols' });
    const symbols = this._symbolClassifier.classify(splitComponents);
    const typeCounts = {};
    for (const s of symbols) typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;
    console.log(`[OMR] Stage 7: ${symbols.length} symbols`, JSON.stringify(typeCounts));
    this._bus.emit('omr:debug', {
      step: 'symbols', label: 'Classified Symbols',
      data: { binary: cleaned.slice(), width, height, symbols, staffSpace }
    });

    // Log a sample of components that were classified as unknown to understand what's being missed
    const unknowns = symbols.filter(s => s.type === 'unknown');
    if (unknowns.length > 0) {
      const sample = unknowns.slice(0, 15).map(s => {
        const c = s.component;
        return `wSS=${c.widthSS.toFixed(2)} hSS=${c.heightSS.toFixed(2)} ar=${c.aspectRatio.toFixed(2)} fill=${c.fillRatio.toFixed(2)} holes=${c.holes} area=${c.area} bbox=${c.bbox.width}x${c.bbox.height}`;
      });
      console.log(`[OMR] ${unknowns.length} unknowns, sample:\n` + sample.join('\n'));
    }

    // Stage 7.5: Position-based clef filtering — only keep leftmost clef per staff
    // Note+stem combos can look like clefs, so reclassify non-leftmost clefs
    const clefSymbols = symbols.filter(s =>
      s.type === 'clef_treble' || s.type === 'clef_bass'
    );
    if (clefSymbols.length > 1) {
      // Find the leftmost clef per staff group
      const leftmostX = Math.min(...clefSymbols.map(s => s.component.centroid.x));
      const leftmostThreshold = leftmostX + staffSpace * 3;
      for (const s of clefSymbols) {
        if (s.component.centroid.x > leftmostThreshold) {
          console.log(`[OMR] Reclassifying non-leftmost ${s.type} at x=${Math.round(s.component.centroid.x)} → unknown`);
          s.type = 'unknown';
        }
      }
    }

    // Stage 7.8: Register classified symbols as Inter nodes in the SIG
    const noteTypes = new Set([
      'filled_notehead', 'open_notehead', 'whole_note'
    ]);
    for (const s of symbols) {
      if (s.type === 'unknown') continue;
      // Compute grade based on classifier confidence heuristics
      const grade = noteTypes.has(s.type) ? 0.8 : 0.6;
      const inter = sig.addInter({
        type: s.type,
        grade: s._priorityLabel ? 0.9 : grade,
        bbox: s.component.bbox,
        data: { symbol: s }
      });
      s._interId = inter.id;
    }

    // Build support edges: notehead ↔ nearest stem
    const stemInters = sig.getIntersByType('stem');
    const headInters = [
      ...sig.getIntersByType('filled_notehead'),
      ...sig.getIntersByType('open_notehead'),
      ...sig.getIntersByType('whole_note')
    ];
    for (const head of headInters) {
      let bestStem = null;
      let bestDist = Infinity;
      for (const stem of stemInters) {
        const dx = Math.abs((head.bbox?.x ?? 0) - (stem.bbox?.x ?? 0));
        const dy = Math.abs((head.bbox?.y ?? 0) - (stem.bbox?.y ?? 0));
        const dist = dx + dy;
        if (dist < bestDist && dx < staffSpace * 2) {
          bestDist = dist;
          bestStem = stem;
        }
      }
      if (bestStem) sig.addSupport(head.id, bestStem.id);
    }

    // Build support edges: stem ↔ beam (pre-detected beams)
    for (const stem of stemInters) {
      for (const beamInter of sig.getIntersByType('beam')) {
        if (stem.bbox && beamInter.bbox && this._bboxOverlap(stem.bbox, beamInter.bbox) > 0.1) {
          sig.addSupport(stem.id, beamInter.id);
        }
      }
    }

    // Run SIG reduction to resolve any exclusions from pre-detection
    sig.reduce();
    console.log(`[OMR] Stage 7.8: SIG has ${sig.getAllInters().length} Inters, ${sig.toJSON().edges.length} edges after reduction`);

    // Stage 8: Pitch assignment
    this._bus.emit('omr:progress', { stage: 8, name: 'Assigning pitches' });
    const pitchedNotes = this._pitchMapper.assignPitches(
      symbols, groups, staffSpace, correctedBinary, width, clef
    );
    console.log(`[OMR] Stage 8: ${pitchedNotes.length} pitched notes`);
    this._bus.emit('omr:debug', {
      step: 'pitched', label: 'Pitch Assignment',
      data: { binary: cleaned.slice(), width, height, notes: pitchedNotes, groups, staffSpace }
    });

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
    this._bus.emit('omr:debug', {
      step: 'final', label: 'Final Notes',
      data: { binary: cleaned.slice(), width, height, notes: validatedNotes, symbols, groups, staffSpace }
    });

    // Stage 11: MIDI assembly — merge notes and rests, compute start times
    this._bus.emit('omr:progress', { stage: 11, name: 'Generating MIDI' });

    // Determine if a grand staff pair was detected
    const isGrandStaff = grandStaffMode && !!this._pitchMapper._lastPairingMethod;

    // Build MIDI key signature meta event from detected key signature
    const mergedKeySig = { sharps: new Set(), flats: new Set() };
    for (const group of groups) {
      const ks = this._pitchMapper.detectKeySignature(symbols, group, staffSpace);
      for (const s of ks.sharps) mergedKeySig.sharps.add(s);
      for (const f of ks.flats) mergedKeySig.flats.add(f);
    }
    const midiKeySig = (mergedKeySig.sharps.size > 0 || mergedKeySig.flats.size > 0)
      ? { sf: mergedKeySig.sharps.size > 0 ? mergedKeySig.sharps.size : -mergedKeySig.flats.size, mi: 0 }
      : null;

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

    let midi;
    let midiNoteCount;

    if (isGrandStaff) {
      // Split notes by clef into two tracks (treble = track 1, bass = track 2)
      const trebleMidi = allEvents
        .filter(n => !n.isRest && n.midiNote > 0 && n.clef === 'treble')
        .map(n => ({ note: n.midiNote, beats: n.beats, startBeat: n.startBeat }));
      const bassMidi = allEvents
        .filter(n => !n.isRest && n.midiNote > 0 && n.clef === 'bass')
        .map(n => ({ note: n.midiNote, beats: n.beats, startBeat: n.startBeat }));
      midiNoteCount = trebleMidi.length + bassMidi.length;
      console.log(`[OMR] Stage 11 (grand staff): ${trebleMidi.length} treble + ${bassMidi.length} bass MIDI notes → Format 1`);
      midi = MidiWriter.buildMultiTrack({
        bpm,
        tracks: [trebleMidi, bassMidi],
        meter: timeSig,
        keySig: midiKeySig
      });
    } else {
      const midiNotes = allEvents
        .filter(n => !n.isRest && n.midiNote > 0)
        .map(n => ({ note: n.midiNote, beats: n.beats, startBeat: n.startBeat }));
      midiNoteCount = midiNotes.length;
      console.log(`[OMR] Stage 11: ${midiNotes.length} MIDI notes, ${validatedRests.length} rests integrated`);
      midi = MidiWriter.build({
        bpm,
        notes: midiNotes,
        meter: timeSig,
        keySig: midiKeySig
      });
    }

    this._bus.emit('omr:midi', {
      midi,
      noteCount: midiNoteCount,
      corrections
    });

    return {
      midi,
      notes: validatedNotes,
      corrections,
      staffInfo: { groups, staffSpace, lineThickness },
      symbols,
      keySig: mergedKeySig,
      sig: sig.toJSON()
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
  /**
   * Upscale a grayscale image using bilinear interpolation.
   * @param {Uint8Array} gray
   * @param {number} width
   * @param {number} height
   * @param {number} factor
   * @returns {{gray: Uint8Array, width: number, height: number}}
   */
  _upscaleGray(gray, width, height, factor) {
    const nw = width * factor;
    const nh = height * factor;
    const out = new Uint8Array(nw * nh);
    for (let y = 0; y < nh; y++) {
      const srcY = y / factor;
      const y0 = Math.floor(srcY);
      const y1 = Math.min(y0 + 1, height - 1);
      const fy = srcY - y0;
      for (let x = 0; x < nw; x++) {
        const srcX = x / factor;
        const x0 = Math.floor(srcX);
        const x1 = Math.min(x0 + 1, width - 1);
        const fx = srcX - x0;
        out[y * nw + x] = Math.round(
          (1 - fx) * (1 - fy) * gray[y0 * width + x0]
          + fx * (1 - fy) * gray[y0 * width + x1]
          + (1 - fx) * fy * gray[y1 * width + x0]
          + fx * fy * gray[y1 * width + x1]
        );
      }
    }
    return { gray: out, width: nw, height: nh };
  }

  /**
   * Compute overlap ratio between two bounding boxes (intersection / smaller area).
   * @param {{x:number,y:number,width:number,height:number}} a
   * @param {{x:number,y:number,width:number,height:number}} b
   * @returns {number} overlap ratio 0.0–1.0
   */
  _bboxOverlap(a, b) {
    const x1 = Math.max(a.x, b.x);
    const y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.width, b.x + b.width);
    const y2 = Math.min(a.y + a.height, b.y + b.height);
    if (x2 <= x1 || y2 <= y1) return 0;
    const intersection = (x2 - x1) * (y2 - y1);
    const smaller = Math.min(a.width * a.height, b.width * b.height);
    return smaller > 0 ? intersection / smaller : 0;
  }

  _splitNoteStems(components, binary, imgWidth, imgHeight, staffSpace) {
    const result = [...components];
    const noteH = Math.round(staffSpace * 0.9);  // expected notehead height
    const noteW = Math.round(staffSpace * 1.3);  // expected notehead width
    const minDensity = 0.45; // minimum fill ratio for a notehead band

    // Find the clef region boundary — the actual clef symbol is typically
    // in the leftmost ~3 staffSpaces. Use a fixed positional heuristic
    // rather than relying on finding small notehead-like components.
    const clefRegionEndX = staffSpace * 5;

    for (const comp of components) {
      // Only try splitting tall-ish components that aren't already small noteheads
      if (comp.heightSS < 1.5 || comp.widthSS > 5.0 || comp.widthSS < 0.3) continue;

      // Skip components in the clef region (leftmost area)
      if (comp.centroid.x < clefRegionEndX) continue;

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

      if (peaks.length > 0) {
        console.log(`[OMR] Split: comp at x=${Math.round(comp.centroid.x)} bbox=${bb.x},${bb.y} ${bb.width}x${bb.height} → ${peaks.length} peak(s): ${peaks.map(p => `y=${p.y} h=${p.height} maxD=${p.maxDensity.toFixed(2)}`).join(', ')}`);
      }

      // Create synthetic notehead components from each peak
      for (const peak of peaks) {
        // First pass: scan peak rows to get area, centroid, and tight x-extent
        let area = 0;
        let sumX = 0;
        let sumY = 0;
        let tightMinX = bb.x + bb.width;
        let tightMaxX = bb.x - 1;
        for (let y = peak.y; y < peak.y + peak.height && y < imgHeight; y++) {
          for (let x = bb.x; x < bb.x + bb.width && x < imgWidth; x++) {
            if (binary[y * imgWidth + x] === 0) {
              area++;
              sumX += x;
              sumY += y;
              if (x < tightMinX) tightMinX = x;
              if (x > tightMaxX) tightMaxX = x;
            }
          }
        }

        if (area < 5) continue;

        // Clamp sub-bbox width to prevent ledger lines from artificially
        // widening the component — cap at 1.8× staffSpace centered on x-centroid
        const centX = Math.round(sumX / area);
        const rawW = tightMinX <= tightMaxX ? tightMaxX - tightMinX + 1 : bb.width;
        const maxW = Math.round(staffSpace * 1.8);
        const tightW = Math.min(rawW, maxW);
        const subX = Math.max(0, centX - Math.floor(tightW / 2));
        const subBbox = { x: subX, y: peak.y, width: tightW, height: peak.height };

        // Second pass: recount within clamped bbox for accurate fillRatio
        let subArea = 0;
        let subSumX = 0;
        let subSumY = 0;
        for (let y = subBbox.y; y < subBbox.y + subBbox.height && y < imgHeight; y++) {
          for (let x = subBbox.x; x < subBbox.x + subBbox.width && x < imgWidth; x++) {
            if (binary[y * imgWidth + x] === 0) {
              subArea++;
              subSumX += x;
              subSumY += y;
            }
          }
        }

        if (subArea < 5) continue;

        const subComp = {
          label: comp.label,
          bbox: subBbox,
          centroid: { x: subSumX / subArea, y: subSumY / subArea },
          area: subArea,
          fillRatio: subArea / (tightW * peak.height),
          aspectRatio: tightW / peak.height,
          holes: 0,
          widthSS: tightW / staffSpace,
          heightSS: peak.height / staffSpace,
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
