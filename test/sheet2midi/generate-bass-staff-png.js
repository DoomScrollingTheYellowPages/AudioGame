// generate-bass-staff-png.js — generate TestObjects/BassStaffScale.png
// A clean programmatic PNG: bass clef staff + 8 quarter noteheads (G2–G3)
// with one interior barline. No accidentals.
//
// Run: node test/sheet2midi/generate-bass-staff-png.js

import { writeFileSync } from 'fs';
import { deflateSync, crc32 } from 'zlib';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../../TestObjects/BassStaffScale.png');

// ── Image dimensions ──────────────────────────────

const W = 800;         // image width (px)
const H = 180;         // image height (px)
const WHITE = 255;
const BLACK = 0;

// ── Staff geometry ────────────────────────────────
//
// 5 staff lines at equal spacing.
// staffSpace = 20px → line 1..5 at y = 50, 70, 90, 110, 130
// Bottom line (line 5) = G2 → staffPos 0
// Top line   (line 1) = A3 → staffPos 8

const STAFF_SPACE  = 20;   // px between adjacent staff lines
const LINE_THICK   = 2;    // staff line thickness (px)
const Y_LINE5      = 130;  // bottom line y (staffPos 0 = G2)
const Y_LINE4      = 110;  // line 4 (staffPos 6 = F3, anchor)
const Y_LINE3      =  90;  // line 3 middle (staffPos 4 = D3)
const Y_LINE2      =  70;  // line 2 (staffPos 2 = B2)
const Y_LINE1      =  50;  // top line (staffPos 8 = A3)
const STAFF_LINES  = [Y_LINE1, Y_LINE2, Y_LINE3, Y_LINE4, Y_LINE5];

// staffPos → pixel y (centre of note)
// staffPos 0 = Y_LINE5 = G2
function staffPosToY(pos) {
  return Y_LINE5 - pos * (STAFF_SPACE / 2);
}

// ── Note positions (G2–G3 scale) ─────────────────
// staffPos: 0=G2 1=A2 2=B2 3=C3 4=D3 5=E3 6=F3 7=G3

const NOTES = [
  { staffPos: 0, name: 'G2' },   // G2
  { staffPos: 1, name: 'A2' },   // A2
  { staffPos: 2, name: 'B2' },   // B2
  { staffPos: 3, name: 'C3' },   // C3
  { staffPos: 4, name: 'D3' },   // D3
  { staffPos: 5, name: 'E3' },   // E3
  { staffPos: 6, name: 'F3' },   // F3
  { staffPos: 7, name: 'G3' },   // G3
];

// ── Layout ────────────────────────────────────────

const X_FIRST_NOTE = 120;   // first note x
const NOTE_SPACING =  74;   // horizontal spacing between notes
const BARLINE_X    = X_FIRST_NOTE + NOTE_SPACING * 4 - 32; // between notes 4 and 5

const NOTE_RX      =   8;   // notehead semi-axis x (horizontal)
const NOTE_RY      =   6;   // notehead semi-axis y (vertical)

// ── Pixel buffer ──────────────────────────────────

const pixels = new Uint8Array(W * H).fill(WHITE);

function setPixel(x, y, val) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  pixels[y * W + x] = val;
}

function fillRect(x0, y0, x1, y1, val) {
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++)
      pixels[y * W + x] = val;
}

// Filled ellipse (for noteheads)
function fillEllipse(cx, cy, rx, ry, val) {
  const rx2 = rx * rx, ry2 = ry * ry;
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      if ((dx * dx) / rx2 + (dy * dy) / ry2 <= 1.0) {
        setPixel(cx + dx, cy + dy, val);
      }
    }
  }
}

// ── Draw staff lines ──────────────────────────────

for (const lineY of STAFF_LINES) {
  fillRect(20, lineY, W - 20, lineY + LINE_THICK - 1, BLACK);
}

// ── Draw barline ─────────────────────────────────

fillRect(BARLINE_X, Y_LINE1, BARLINE_X + 1, Y_LINE5 + LINE_THICK - 1, BLACK);

// ── Draw noteheads ────────────────────────────────

for (let i = 0; i < NOTES.length; i++) {
  const { staffPos } = NOTES[i];
  const cx = X_FIRST_NOTE + i * NOTE_SPACING;
  const cy = staffPosToY(staffPos);
  fillEllipse(cx, cy, NOTE_RX, NOTE_RY, BLACK);
}

// ── PNG encoding ─────────────────────────────────

// Build raw scanlines: 1 filter byte (0 = None) + pixels per row
const scanlines = Buffer.alloc((W + 1) * H);
for (let y = 0; y < H; y++) {
  scanlines[y * (W + 1)] = 0; // filter type: None
  for (let x = 0; x < W; x++) {
    scanlines[y * (W + 1) + 1 + x] = pixels[y * W + x];
  }
}

const compressed = deflateSync(scanlines, { level: 6 });

function u32be(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const lenBytes  = u32be(data.length);
  const crcInput  = Buffer.concat([typeBytes, data]);
  const crcVal    = crc32(crcInput);
  // crc32 in Node returns signed int — convert to unsigned
  const crcBytes  = u32be(crcVal >>> 0);
  return Buffer.concat([lenBytes, typeBytes, data, crcBytes]);
}

// IHDR: width, height, bitDepth=8, colorType=0 (grayscale), compress=0, filter=0, interlace=0
const ihdrData = Buffer.concat([
  u32be(W), u32be(H),
  Buffer.from([8, 0, 0, 0, 0])
]);

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
  chunk('IHDR', ihdrData),
  chunk('IDAT', compressed),
  chunk('IEND', Buffer.alloc(0))
]);

writeFileSync(OUT, png);
console.log(`Written: ${OUT} (${W}×${H}, ${png.length} bytes)`);
