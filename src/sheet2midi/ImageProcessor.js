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

  /**
   * Apply 3×3 median filter for noise removal.
   * Replaces each pixel with the median of its 3×3 neighborhood.
   * @param {Uint8Array} gray
   * @param {number} width
   * @param {number} height
   * @returns {Uint8Array}
   */
  medianFilter(gray, width, height) {
    const out = new Uint8Array(gray.length);
    const buf = new Uint8Array(9);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
          out[y * width + x] = gray[y * width + x];
          continue;
        }
        let k = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            buf[k++] = gray[(y + dy) * width + (x + dx)];
          }
        }
        // Partial sort to find median (index 4 of 9)
        for (let i = 0; i < 5; i++) {
          let minIdx = i;
          for (let j = i + 1; j < 9; j++) {
            if (buf[j] < buf[minIdx]) minIdx = j;
          }
          if (minIdx !== i) {
            const tmp = buf[i];
            buf[i] = buf[minIdx];
            buf[minIdx] = tmp;
          }
        }
        out[y * width + x] = buf[4];
      }
    }
    return out;
  }

  /**
   * Crop border/margin regions with very low ink density.
   * Divides image into a grid and trims rows/columns of cells
   * that have less than minDensity black pixels.
   * @param {Uint8Array} gray
   * @param {number} width
   * @param {number} height
   * @param {number} [gridSize=16] - number of grid divisions per axis
   * @param {number} [minDensity=0.01] - minimum black pixel ratio to keep
   * @returns {{gray: Uint8Array, width: number, height: number, offsetX: number, offsetY: number}}
   */
  cropBorders(gray, width, height, gridSize = 16, minDensity = 0.01) {
    // Compute a quick threshold for "black" pixels
    const threshold = this.otsuThreshold(gray);

    const cellW = Math.floor(width / gridSize);
    const cellH = Math.floor(height / gridSize);
    if (cellW < 2 || cellH < 2) return { gray, width, height, offsetX: 0, offsetY: 0 };

    // Compute density for each grid cell
    const density = new Float32Array(gridSize * gridSize);
    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        const startX = gx * cellW;
        const startY = gy * cellH;
        const endX = Math.min(startX + cellW, width);
        const endY = Math.min(startY + cellH, height);
        let blackCount = 0;
        let total = 0;
        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            total++;
            if (gray[y * width + x] <= threshold) blackCount++;
          }
        }
        density[gy * gridSize + gx] = total > 0 ? blackCount / total : 0;
      }
    }

    // Find content bounds by checking which grid rows/cols have ink
    let topRow = 0, bottomRow = gridSize - 1;
    let leftCol = 0, rightCol = gridSize - 1;

    // Trim top rows
    for (let gy = 0; gy < gridSize; gy++) {
      let hasContent = false;
      for (let gx = 0; gx < gridSize; gx++) {
        if (density[gy * gridSize + gx] >= minDensity) { hasContent = true; break; }
      }
      if (hasContent) { topRow = gy; break; }
    }
    // Trim bottom rows
    for (let gy = gridSize - 1; gy >= 0; gy--) {
      let hasContent = false;
      for (let gx = 0; gx < gridSize; gx++) {
        if (density[gy * gridSize + gx] >= minDensity) { hasContent = true; break; }
      }
      if (hasContent) { bottomRow = gy; break; }
    }
    // Trim left cols
    for (let gx = 0; gx < gridSize; gx++) {
      let hasContent = false;
      for (let gy = topRow; gy <= bottomRow; gy++) {
        if (density[gy * gridSize + gx] >= minDensity) { hasContent = true; break; }
      }
      if (hasContent) { leftCol = gx; break; }
    }
    // Trim right cols
    for (let gx = gridSize - 1; gx >= 0; gx--) {
      let hasContent = false;
      for (let gy = topRow; gy <= bottomRow; gy++) {
        if (density[gy * gridSize + gx] >= minDensity) { hasContent = true; break; }
      }
      if (hasContent) { rightCol = gx; break; }
    }

    // Add 1-row margin on each side to preserve ledger lines and
    // notes that extend slightly beyond the detected content bounds
    topRow = Math.max(0, topRow - 1);
    bottomRow = Math.min(gridSize - 1, bottomRow + 1);
    leftCol = Math.max(0, leftCol - 1);
    rightCol = Math.min(gridSize - 1, rightCol + 1);

    // If no significant trimming, return original
    if (topRow === 0 && bottomRow === gridSize - 1
        && leftCol === 0 && rightCol === gridSize - 1) {
      return { gray, width, height, offsetX: 0, offsetY: 0 };
    }

    // Extract cropped region — extend to image edge for outermost cells
    console.log(`[OMR] cropBorders: grid=${gridSize} cell=${cellW}×${cellH} rows=${topRow}..${bottomRow} cols=${leftCol}..${rightCol}`);
    const cropX = leftCol * cellW;
    const cropY = topRow * cellH;
    const cropRight = rightCol >= gridSize - 1 ? width : (rightCol + 1) * cellW;
    const cropBottom = bottomRow >= gridSize - 1 ? height : (bottomRow + 1) * cellH;
    const cropW = cropRight - cropX;
    const cropH = cropBottom - cropY;

    const cropped = new Uint8Array(cropW * cropH);
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        cropped[y * cropW + x] = gray[(cropY + y) * width + (cropX + x)];
      }
    }

    return { gray: cropped, width: cropW, height: cropH, offsetX: cropX, offsetY: cropY };
  }

  /**
   * Upscale a grayscale image using bilinear interpolation.
   * @param {Uint8Array} gray
   * @param {number} width
   * @param {number} height
   * @param {number} factor - integer scale factor (2, 3, 4, etc.)
   * @returns {{gray: Uint8Array, width: number, height: number}}
   */
  upscale(gray, width, height, factor) {
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

        // Bilinear interpolation
        const v00 = gray[y0 * width + x0];
        const v10 = gray[y0 * width + x1];
        const v01 = gray[y1 * width + x0];
        const v11 = gray[y1 * width + x1];

        const v = (1 - fx) * (1 - fy) * v00
          + fx * (1 - fy) * v10
          + (1 - fx) * fy * v01
          + fx * fy * v11;

        out[y * nw + x] = Math.round(v);
      }
    }

    return { gray: out, width: nw, height: nh };
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
