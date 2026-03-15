// ─────────────────────────────────────────────
// ImageProcessor — image loading, grayscale,
// binarization with Otsu and Sauvola methods
// ─────────────────────────────────────────────

// ── Constants ──────────────────────────────────

const SAUVOLA_K = 0.5;
const SAUVOLA_R = 128;
const SAUVOLA_WINDOW = 15;

// ── ImageProcessor ─────────────────────────────

export class ImageProcessor {
  /**
   * @param {EventBus} bus
   */
  constructor(bus) {
    this._bus = bus;
  }

  /**
   * Load an image file into a grayscale Uint8Array.
   * @param {File|Blob} file
   * @returns {Promise<{gray: Uint8Array, width: number, height: number}>}
   */
  async load(file) {
    const bitmap = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    const rgba = imageData.data;
    const w = bitmap.width;
    const h = bitmap.height;
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < gray.length; i++) {
      const j = i * 4;
      gray[i] = Math.round(0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2]);
    }
    this._bus.emit('omr:loaded', { width: w, height: h });
    return { gray, width: w, height: h };
  }

  /**
   * Otsu's global threshold.
   * @param {Uint8Array} gray
   * @returns {number} threshold 0–255
   */
  otsuThreshold(gray) {
    const hist = new Uint32Array(256);
    for (let i = 0; i < gray.length; i++) hist[gray[i]]++;

    const total = gray.length;
    let sumAll = 0;
    for (let i = 0; i < 256; i++) sumAll += i * hist[i];

    let sumBg = 0;
    let wBg = 0;
    let best = 0;
    let bestT = 0;

    for (let t = 0; t < 256; t++) {
      wBg += hist[t];
      if (wBg === 0) continue;
      const wFg = total - wBg;
      if (wFg === 0) break;

      sumBg += t * hist[t];
      const meanBg = sumBg / wBg;
      const meanFg = (sumAll - sumBg) / wFg;
      const between = wBg * wFg * (meanBg - meanFg) * (meanBg - meanFg);
      if (between > best) {
        best = between;
        bestT = t;
      }
    }
    return bestT;
  }

  /**
   * Binarize with Otsu's global threshold.
   * @param {Uint8Array} gray
   * @returns {Uint8Array} binary (0 = black/foreground, 255 = white/background)
   */
  binarizeOtsu(gray) {
    const t = this.otsuThreshold(gray);
    const out = new Uint8Array(gray.length);
    for (let i = 0; i < gray.length; i++) {
      out[i] = gray[i] > t ? 255 : 0;
    }
    return out;
  }

  /**
   * Build integral image and integral squared image.
   * @param {Uint8Array} gray
   * @param {number} width
   * @param {number} height
   * @returns {{integral: Float64Array, integralSq: Float64Array}}
   */
  buildIntegralImages(gray, width, height) {
    const n = width * height;
    const integral = new Float64Array(n);
    const integralSq = new Float64Array(n);

    for (let y = 0; y < height; y++) {
      let rowSum = 0;
      let rowSumSq = 0;
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const v = gray[idx];
        rowSum += v;
        rowSumSq += v * v;
        integral[idx] = rowSum + (y > 0 ? integral[idx - width] : 0);
        integralSq[idx] = rowSumSq + (y > 0 ? integralSq[idx - width] : 0);
      }
    }
    return { integral, integralSq };
  }

  /**
   * Query a rectangular sum from an integral image.
   * @param {Float64Array} integral
   * @param {number} width
   * @param {number} x1 - left (inclusive)
   * @param {number} y1 - top (inclusive)
   * @param {number} x2 - right (inclusive)
   * @param {number} y2 - bottom (inclusive)
   * @returns {number}
   */
  _rectSum(integral, width, x1, y1, x2, y2) {
    let sum = integral[y2 * width + x2];
    if (x1 > 0) sum -= integral[y2 * width + (x1 - 1)];
    if (y1 > 0) sum -= integral[(y1 - 1) * width + x2];
    if (x1 > 0 && y1 > 0) sum += integral[(y1 - 1) * width + (x1 - 1)];
    return sum;
  }

  /**
   * Sauvola adaptive binarization using integral images.
   * @param {Uint8Array} gray
   * @param {number} width
   * @param {number} height
   * @param {number} [windowSize] - neighborhood half-size
   * @param {number} [k] - sensitivity parameter
   * @returns {Uint8Array} binary (0 = foreground, 255 = background)
   */
  binarizeSauvola(gray, width, height, windowSize = SAUVOLA_WINDOW, k = SAUVOLA_K) {
    const { integral, integralSq } = this.buildIntegralImages(gray, width, height);
    const out = new Uint8Array(gray.length);
    const halfW = Math.floor(windowSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const x1 = Math.max(0, x - halfW);
        const y1 = Math.max(0, y - halfW);
        const x2 = Math.min(width - 1, x + halfW);
        const y2 = Math.min(height - 1, y + halfW);

        const count = (x2 - x1 + 1) * (y2 - y1 + 1);
        const sum = this._rectSum(integral, width, x1, y1, x2, y2);
        const sumSq = this._rectSum(integralSq, width, x1, y1, x2, y2);

        const mean = sum / count;
        const variance = (sumSq / count) - (mean * mean);
        const stddev = Math.sqrt(Math.max(0, variance));

        const threshold = mean * (1 + k * (stddev / SAUVOLA_R - 1));
        const idx = y * width + x;
        out[idx] = gray[idx] > threshold ? 255 : 0;
      }
    }
    return out;
  }

  /**
   * Auto-select binarization method based on image uniformity.
   * Uses Otsu for uniform lighting, Sauvola for uneven.
   * @param {Uint8Array} gray
   * @param {number} width
   * @param {number} height
   * @returns {Uint8Array}
   */
  binarize(gray, width, height) {
    // Check illumination uniformity by comparing quadrant means
    const qw = Math.floor(width / 2);
    const qh = Math.floor(height / 2);
    const means = [];
    for (let qy = 0; qy < 2; qy++) {
      for (let qx = 0; qx < 2; qx++) {
        let sum = 0;
        let count = 0;
        const startY = qy * qh;
        const startX = qx * qw;
        const endY = Math.min(startY + qh, height);
        const endX = Math.min(startX + qw, width);
        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            sum += gray[y * width + x];
            count++;
          }
        }
        means.push(sum / count);
      }
    }
    const maxDiff = Math.max(...means) - Math.min(...means);

    // If quadrant means differ by more than 30, illumination is uneven
    if (maxDiff > 30) {
      return this.binarizeSauvola(gray, width, height);
    }
    return this.binarizeOtsu(gray);
  }

  /**
   * Apply morphological closing (dilate then erode) with a square kernel.
   * @param {Uint8Array} binary
   * @param {number} width
   * @param {number} height
   * @param {number} radius
   * @returns {Uint8Array}
   */
  morphClose(binary, width, height, radius) {
    const dilated = this._dilate(binary, width, height, radius);
    return this._erode(dilated, width, height, radius);
  }

  /** @param {Uint8Array} img @param {number} w @param {number} h @param {number} r */
  _dilate(img, w, h, r) {
    const out = new Uint8Array(img.length).fill(255);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (img[y * w + x] === 0) {
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              const ny = y + dy;
              const nx = x + dx;
              if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
                out[ny * w + nx] = 0;
              }
            }
          }
        }
      }
    }
    return out;
  }

  /** @param {Uint8Array} img @param {number} w @param {number} h @param {number} r */
  _erode(img, w, h, r) {
    const out = new Uint8Array(img.length).fill(0);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (img[y * w + x] === 255) {
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              const ny = y + dy;
              const nx = x + dx;
              if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
                out[ny * w + nx] = 255;
              }
            }
          }
        }
      }
    }
    return out;
  }
}
