// ─────────────────────────────────────────────
// node-png-loader.js — decode a PNG file into
// a grayscale Uint8Array for Node.js OMR tests
// (no browser APIs required)
// ─────────────────────────────────────────────
import { readFileSync } from 'fs';
import { inflateSync } from 'zlib';

/**
 * Parse a PNG file into raw RGBA pixels.
 * @param {Buffer} buffer
 * @returns {{ pixels: Uint8Array, width: number, height: number, channels: number }}
 */
function parsePng(buffer) {
  let offset = 8; // skip PNG signature

  let width, height, bitDepth, colorType;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset); offset += 4;
    const type = buffer.toString('ascii', offset, offset + 4); offset += 4;
    const data = buffer.slice(offset, offset + length); offset += length;
    offset += 4; // CRC

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  const compressed = Buffer.concat(idatChunks);
  const raw = inflateSync(compressed);

  // colorType: 0=gray, 2=RGB, 3=indexed, 4=gray+alpha, 6=RGBA
  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 4 ? 2 : 1;
  const bytesPerPixel = channels * (bitDepth / 8);
  const stride = width * bytesPerPixel;

  // Undo PNG filter for each scanline
  const pixels = new Uint8Array(width * height * channels);
  for (let y = 0; y < height; y++) {
    const filterType = raw[y * (stride + 1)];
    const srcRow = y * (stride + 1) + 1;
    const dstRow = y * stride;
    const prev = y > 0 ? pixels.slice((y - 1) * stride, y * stride) : new Uint8Array(stride);

    for (let x = 0; x < stride; x++) {
      const a = x >= bytesPerPixel ? pixels[dstRow + x - bytesPerPixel] : 0;
      const b = prev[x];
      const c = x >= bytesPerPixel ? prev[x - bytesPerPixel] : 0;
      const rawVal = raw[srcRow + x];
      let val;
      switch (filterType) {
        case 0: val = rawVal; break;
        case 1: val = (rawVal + a) & 0xff; break;
        case 2: val = (rawVal + b) & 0xff; break;
        case 3: val = (rawVal + Math.floor((a + b) / 2)) & 0xff; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          val = (rawVal + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
          break;
        }
        default: val = rawVal;
      }
      pixels[dstRow + x] = val;
    }
  }

  return { pixels, width, height, channels };
}

/**
 * Load a PNG file and return a grayscale Uint8Array.
 * @param {string} filePath — absolute or relative path to PNG
 * @returns {{ gray: Uint8Array, width: number, height: number }}
 */
export function loadPngGray(filePath) {
  const buf = readFileSync(filePath);
  const { pixels, width, height, channels } = parsePng(buf);

  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const j = i * channels;
    if (channels === 1) {
      gray[i] = pixels[j];
    } else {
      // Luminance: 0.299R + 0.587G + 0.114B
      gray[i] = Math.round(0.299 * pixels[j] + 0.587 * pixels[j + 1] + 0.114 * pixels[j + 2]);
    }
  }

  return { gray, width, height };
}
