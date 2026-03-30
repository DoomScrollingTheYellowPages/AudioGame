// diag-keysig.js — diagnose key signature detection on GMajorScaleTrebleAscending
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { loadPngGray } from './node-png-loader.js';
import { ImageProcessor } from '../../src/sheet2midi/ImageProcessor.js';
import { SkewCorrector } from '../../src/sheet2midi/SkewCorrector.js';
import { StaffAnalyzer } from '../../src/sheet2midi/StaffAnalyzer.js';
import { ComponentLabeler } from '../../src/sheet2midi/ComponentLabeler.js';
import { SymbolClassifier } from '../../src/sheet2midi/SymbolClassifier.js';
import { PitchMapper } from '../../src/sheet2midi/PitchMapper.js';
import { MockBus } from '../test-helper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const imagePath = resolve(__dirname, '../../TestObjects/GMajorScaleTrebleAscending.png');

const bus = new MockBus();
const imageProcessor = new ImageProcessor(bus);
const skewCorrector  = new SkewCorrector(bus);
const staffAnalyzer  = new StaffAnalyzer(bus);
const componentLabeler = new ComponentLabeler(bus);
const symbolClassifier = new SymbolClassifier(bus);
const pitchMapper    = new PitchMapper(bus);

// ── Stage 1: Load ──────────────────────────────
let { gray, width, height } = loadPngGray(imagePath);
console.log(`Image: ${width}×${height}`);

const cropped = imageProcessor.cropBorders(gray, width, height);
if (cropped.offsetX > 0 || cropped.offsetY > 0) {
  gray = cropped.gray; width = cropped.width; height = cropped.height;
  console.log(`Cropped: ${width}×${height}`);
}

let wasUpscaled = false;
if (height < 200) {
  const factor = Math.min(Math.ceil(200 / height), 3);
  const up = _upscale(gray, width, height, factor);
  gray = up.gray; width = up.width; height = up.height;
  wasUpscaled = true;
  console.log(`Upscaled ${factor}x: ${width}×${height}`);
}

// ── Stage 2: Binarize ──────────────────────────
const binary = imageProcessor.binarize(gray, width, height);

// ── Stage 3: Skew (skip for upscaled) ─────────
let correctedBinary = binary;
if (!wasUpscaled) {
  const r = skewCorrector.correct(binary, gray, width, height);
  correctedBinary = Math.abs(r.angle) > 0.002
    ? imageProcessor.binarize(r.data, width, height) : binary;
  console.log(`Skew angle: ${r.angle.toFixed(4)}`);
}

// ── Stage 4: Staff detection ───────────────────
const { groups, staffSpace, lineThickness, staffRows } =
  staffAnalyzer.detect(correctedBinary, width, height);
console.log(`\nStaff groups: ${groups.length}, staffSpace: ${staffSpace.toFixed(1)}px, lineThick: ${lineThickness}`);
for (let i = 0; i < groups.length; i++) {
  console.log(`  Group ${i}: lines y=[${groups[i].map(v=>Math.round(v)).join(', ')}]`);
}
if (groups.length === 0) { console.log('NO STAFF DETECTED — aborting'); process.exit(1); }

// ── Stage 5: Remove staff lines ────────────────
let cleaned = staffAnalyzer.removeStaffLines(correctedBinary, width, height, staffRows, lineThickness);
cleaned = imageProcessor.medianFilter(cleaned, width, height);
cleaned = imageProcessor.morphClose(cleaned, width, height, Math.ceil(lineThickness / 2) + 1);

// ── Stage 6: Components ────────────────────────
const { labels, count } = componentLabeler.label(cleaned, width, height);
const components = componentLabeler.extractFeatures(labels, width, height, count, staffSpace);
console.log(`\nComponents: ${components.length}`);

// ── Stage 7: Classify ──────────────────────────
const symbols = symbolClassifier.classify(components);

// ── All symbols sorted by x ─────────────────────
console.log(`\n── All symbols (sorted by x) ──`);
console.log('type                  cx    cy    hSS   wSS     AR   fill  holes');
const sorted = [...symbols].sort((a,b) => a.component.centroid.x - b.component.centroid.x);
for (const s of sorted) {
  const c = s.component;
  console.log(
    `${s.type.padEnd(22)}` +
    `${String(Math.round(c.centroid.x)).padStart(5)} ` +
    `${String(Math.round(c.centroid.y)).padStart(5)} ` +
    `${(c.heightSS??0).toFixed(2).padStart(5)} ` +
    `${(c.widthSS??0).toFixed(2).padStart(5)} ` +
    `${(c.aspectRatio??0).toFixed(3).padStart(7)} ` +
    `${(c.fillRatio??0).toFixed(3).padStart(6)} ` +
    `${String(c.holes??0).padStart(5)}`
  );
}

// ── Key sig region ─────────────────────────────
const group = groups[0];
const topLine = group[0], bottomLine = group[4];
const margin = staffSpace * 2;
const KEY_SIG_REGION = 6.0;

let clefRightX = 0;
for (const s of symbols) {
  if (s.type === 'clef_treble' || s.type === 'clef_bass') {
    const cy = s.component.centroid.y;
    if (cy >= topLine - margin && cy <= bottomLine + margin) {
      const rx = s.component.bbox.x + s.component.bbox.width;
      if (rx > clefRightX) clefRightX = rx;
    }
  }
}
let firstNoteX = Infinity;
for (const s of symbols) {
  if (!['filled_notehead','open_notehead','whole_note'].includes(s.type)) continue;
  const cy = s.component.centroid.y;
  if (cy >= topLine - margin && cy <= bottomLine + margin) {
    if (s.component.centroid.x < firstNoteX) firstNoteX = s.component.centroid.x;
  }
}
const keySigEndX = Math.min(clefRightX + staffSpace * KEY_SIG_REGION, firstNoteX);

console.log(`\n── Key sig region ──`);
console.log(`clefRightX=${Math.round(clefRightX)}  firstNoteX=${firstNoteX===Infinity?'∞':Math.round(firstNoteX)}  keySigEndX=${Math.round(keySigEndX)}`);
console.log(`Staff y-range: ${Math.round(topLine-margin)} – ${Math.round(bottomLine+margin)}`);
console.log('\nSymbols in y-range:');
console.log('type                  cx    cy    hSS   wSS     AR   fill  IN_REGION');
for (const s of sorted) {
  const c = s.component;
  if (c.centroid.y < topLine - margin || c.centroid.y > bottomLine + margin) continue;
  const cx = c.centroid.x;
  const inR = cx >= clefRightX && cx <= keySigEndX;
  // fallback sharp check
  const isFallbackSharp = c.heightSS>=0.6&&c.heightSS<=3.0&&c.widthSS>=0.3&&c.widthSS<=1.5&&c.aspectRatio>=0.15&&c.aspectRatio<0.7&&c.fillRatio>=0.15&&c.fillRatio<=0.65;
  const tag = inR ? (s.type==='sharp'?'✓ SHARP':isFallbackSharp?'✓ FALLBACK_SHARP':'✓ in-region') : '✗';
  console.log(
    `${s.type.padEnd(22)}` +
    `${String(Math.round(cx)).padStart(5)} ` +
    `${String(Math.round(c.centroid.y)).padStart(5)} ` +
    `${(c.heightSS??0).toFixed(2).padStart(5)} ` +
    `${(c.widthSS??0).toFixed(2).padStart(5)} ` +
    `${(c.aspectRatio??0).toFixed(3).padStart(7)} ` +
    `${(c.fillRatio??0).toFixed(3).padStart(6)}  ${tag}`
  );
}

// ── detectKeySignature result ───────────────────
console.log('\n── detectKeySignature result ──');
const ks = pitchMapper.detectKeySignature(symbols, group, staffSpace);
console.log(`sharps: [${[...ks.sharps].join(', ')}]`);
console.log(`flats:  [${[...ks.flats].join(', ')}]`);

// ── Full pitch assignment ───────────────────────
console.log('\n── Assigned notes (after key sig applied) ──');
const notes = pitchMapper.assignPitches(symbols, groups, staffSpace, correctedBinary, width, null);
for (const n of [...notes].sort((a,b)=>a.x-b.x)) {
  console.log(`  ${n.noteName}${n.octave} (midi=${n.midiNote}) staffPos=${n.staffPos} x=${Math.round(n.x)}`);
}

function _upscale(gray, width, height, factor) {
  const nw=width*factor, nh=height*factor;
  const out=new Uint8Array(nw*nh);
  for(let y=0;y<nh;y++){const sy=y/factor,y0=Math.floor(sy),y1=Math.min(y0+1,height-1),fy=sy-y0;for(let x=0;x<nw;x++){const sx=x/factor,x0=Math.floor(sx),x1=Math.min(x0+1,width-1),fx=sx-x0;out[y*nw+x]=Math.round((1-fx)*(1-fy)*gray[y0*width+x0]+fx*(1-fy)*gray[y0*width+x1]+(1-fx)*fy*gray[y1*width+x0]+fx*fy*gray[y1*width+x1]);}}
  return { gray: out, width: nw, height: nh };
}
