// generate-mixed-durations-png.js — generate TestObjects/MixedDurations.png
// A programmatic PNG: treble staff, 2 bars of 4/4 with mixed durations:
//   Bar 1: whole note F4  (4 beats)
//   Bar 2: half G4 (2) + quarter B4 (1) + two beamed eighth C5×2 (0.5+0.5)
//
// Design constraints (2x upscaling + bilinear → morphClose radius 4):
//  - Noteheads drawn as separate components from stems (GAP=8 between them)
//  - Beam drawn with gap from stem tops (BEAM_GAP=12, ensures 22px gap > 2×radius=8)
//  - Whole note wider (rx=14) than half note (rx=10) for classification
//
// Run: node test/sheet2midi/generate-mixed-durations-png.js

import { writeFileSync } from 'fs';
import { deflateSync, crc32 } from 'zlib';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../../TestObjects/MixedDurations.png');

// ── Image dimensions ──────────────────────────

const W = 660;
const H = 200;
const WHITE = 255;
const BLACK = 0;

// ── Staff geometry ────────────────────────────
// Treble clef reference: E4 = staffPos 0 = bottom line y=140
// staffPosToY(pos) = 140 - pos * 10

const STAFF_SPACE = 20;
const LINE_THICK  = 2;
const BOTTOM_Y    = 140;   // bottom staff line y (E4, staffPos=0)

// Staff lines at staffPos 0,2,4,6,8 → y = 140,120,100,80,60
const STAFF_LINES = [60, 80, 100, 120, 140];

function staffPosToY(pos) {
  return BOTTOM_Y - pos * (STAFF_SPACE / 2);
}

// ── Note/stem dimensions ──────────────────────

// Whole note is visibly WIDER (rx=14 vs 10) so widthSS≥1.3 → classified as WHOLE_NOTE
const WHOLE_RX = 14, WHOLE_RY = 8;
const WHOLE_INNER_RX = 9, WHOLE_INNER_RY = 5;

// Standard notehead (half and filled)
const NH_RX = 10, NH_RY = 7;
const HALF_INNER_RX = 6, HALF_INNER_RY = 4;

// Stem: centered above notehead, large gap to survive morphClose at 2x
const STEM_W    = 2;
const STEM_H    = 2 * STAFF_SPACE;  // 2 staffSpaces tall (40px)
const GAP       = 8;   // px gap between notehead top and stem bottom (survives 2x morphClose)

// Beam: horizontal bar connecting stem tops, large gap to survive morphClose at 2x
// With bilinear upscaling lineThick=5 → morphRadius=4 → dilation bridges up to 8px.
// Need BEAM_GAP such that (BEAM_GAP - 1) gap rows × 2 > 8 → BEAM_GAP ≥ 6 (min safe).
// Use BEAM_GAP=12 (11 gap rows = 22px at 2x, well above threshold of 8px).
const BEAM_H    = 4;   // beam thickness (px)
const BEAM_GAP  = 12;  // px gap between stem top and beam bottom (survives bilinear 2x morphClose)

// ── Pixel buffer ──────────────────────────────

const pixels = new Uint8Array(W * H).fill(WHITE);

function setPixel(x, y, v) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  pixels[y * W + x] = v;
}

function fillRect(x0, y0, x1, y1, v) {
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++)
      pixels[y * W + x] = v;
}

function fillEllipse(cx, cy, rx, ry, v) {
  const rx2 = rx * rx, ry2 = ry * ry;
  for (let dy = -ry; dy <= ry; dy++)
    for (let dx = -rx; dx <= rx; dx++)
      if ((dx * dx) / rx2 + (dy * dy) / ry2 <= 1.0)
        setPixel(cx + dx, cy + dy, v);
}

// ── Drawing helpers ───────────────────────────

/** Whole note: large open ring (wider than half, widthSS≥1.3 → WHOLE_NOTE rule) */
function drawWholeNote(cx, cy) {
  fillEllipse(cx, cy, WHOLE_RX, WHOLE_RY, BLACK);
  fillEllipse(cx, cy, WHOLE_INNER_RX, WHOLE_INNER_RY, WHITE);
}

/** Half note notehead: open ring (narrower, widthSS≈1.0 → OPEN_NOTEHEAD rule) */
function drawOpenNotehead(cx, cy) {
  fillEllipse(cx, cy, NH_RX, NH_RY, BLACK);
  fillEllipse(cx, cy, HALF_INNER_RX, HALF_INNER_RY, WHITE);
}

/** Quarter/eighth notehead: filled ellipse */
function drawFilledNotehead(cx, cy) {
  fillEllipse(cx, cy, NH_RX, NH_RY, BLACK);
}

/**
 * Stem up: centered above notehead, starting GAP px above the notehead top.
 * @returns { stemX, stemTopY } for beam attachment
 */
function drawStemUp(cx, cy) {
  const stemCx   = cx;                         // centered on notehead
  const stemBotY = cy - NH_RY - GAP;           // just above notehead top (with gap)
  const stemTopY = stemBotY - STEM_H;          // extend STEM_H px upward
  const x0 = stemCx - Math.floor(STEM_W / 2);
  fillRect(x0, stemTopY, x0 + STEM_W - 1, stemBotY, BLACK);
  return { stemX: stemCx, stemTopY };
}

// ── Draw staff lines ──────────────────────────

for (const lineY of STAFF_LINES)
  fillRect(20, lineY, W - 20, lineY + LINE_THICK - 1, BLACK);

// ── Draw barline (between bar 1 and bar 2) ────

const BARLINE_X = 190;
fillRect(BARLINE_X, STAFF_LINES[0], BARLINE_X + 1, STAFF_LINES[4] + LINE_THICK - 1, BLACK);

// ── Bar 1: Whole note F4 (pos=1, y=130) ──────
// F4 is in the space between E4(y=140) and G4(y=120) — no staff line at y=130.

const WHOLE_X = 110;
const WHOLE_Y = staffPosToY(1);  // F4, y=130 (space)
drawWholeNote(WHOLE_X, WHOLE_Y);

// ── Bar 2: Half G4 + Quarter B4 + Eighth C5 × 2 ──

// Half note: G4, pos=2, y=120 (on 2nd line)
const HALF_X = 240;
const HALF_Y = staffPosToY(2);   // G4, y=120
drawOpenNotehead(HALF_X, HALF_Y);
drawStemUp(HALF_X, HALF_Y);

// Quarter note: B4, pos=4, y=100 (on middle line)
const QTR_X = 340;
const QTR_Y = staffPosToY(4);   // B4, y=100
drawFilledNotehead(QTR_X, QTR_Y);
drawStemUp(QTR_X, QTR_Y);

// Eighth notes (beamed): C5 × 2 at pos=5, y=90 (in space between 3rd and 4th lines)
const E8A_X = 440;
const E8B_X = 530;
const E8_Y  = staffPosToY(5);   // C5, y=90 (space)

drawFilledNotehead(E8A_X, E8_Y);
const stemA = drawStemUp(E8A_X, E8_Y);

drawFilledNotehead(E8B_X, E8_Y);
const stemB = drawStemUp(E8B_X, E8_Y);

// Beam: 4px thick bar, BEAM_GAP px above the stem tops (separate component)
const stemTipY = Math.min(stemA.stemTopY, stemB.stemTopY);
const beamBot  = stemTipY - BEAM_GAP;           // bottom of beam (gap from stem tips)
const beamTop  = beamBot - BEAM_H + 1;          // top of beam (4 rows inclusive)
fillRect(stemA.stemX - 1, beamTop, stemB.stemX + 1, beamBot, BLACK);

// ── PNG encoding ─────────────────────────────

const scanlines = Buffer.alloc((W + 1) * H);
for (let y = 0; y < H; y++) {
  scanlines[y * (W + 1)] = 0;
  for (let x = 0; x < W; x++)
    scanlines[y * (W + 1) + 1 + x] = pixels[y * W + x];
}

const compressed = deflateSync(scanlines, { level: 6 });

function u32be(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const crcInput  = Buffer.concat([typeBytes, data]);
  const crcVal    = crc32(crcInput) >>> 0;
  return Buffer.concat([u32be(data.length), typeBytes, data, u32be(crcVal)]);
}

const ihdrData = Buffer.concat([
  u32be(W), u32be(H),
  Buffer.from([8, 0, 0, 0, 0])
]);

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdrData),
  chunk('IDAT', compressed),
  chunk('IEND', Buffer.alloc(0))
]);

writeFileSync(OUT, png);
console.log(`Written: ${OUT} (${W}×${H})`);
console.log(`Stem tops: A=${stemA.stemTopY}, B=${stemB.stemTopY}`);
console.log(`Beam: y=${beamTop}–${beamBot} (${BEAM_H}px), gap from stems: ${BEAM_GAP}px`);
