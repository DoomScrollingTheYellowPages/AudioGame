// ─────────────────────────────────────────────
// SkewCorrector — Hough transform skew detection
// and image rotation for straightening scans
// ─────────────────────────────────────────────

// ── Constants ──────────────────────────────────

const THETA_STEPS = 360;
const THETA_RANGE = Math.PI / 12; // ±15 degrees around horizontal
const EDGE_THRESHOLD = 128;

// ── SkewCorrector ──────────────────────────────

export class SkewCorrector {
  /**
   * @param {EventBus} bus
   */
  constructor(bus) {
    this._bus = bus;
  }

  /**
   * Detect horizontal edges using a simple Sobel-Y filter.
   * @param {Uint8Array} binary
   * @param {number} width
   * @param {number} height
   * @returns {Uint8Array} edge magnitude image
   */
  detectEdges(binary, width, height) {
    const edges = new Uint8Array(width * height);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        // Sobel-Y kernel for horizontal lines
        const gy =
          -binary[(y - 1) * width + (x - 1)] - 2 * binary[(y - 1) * width + x] - binary[(y - 1) * width + (x + 1)]
          + binary[(y + 1) * width + (x - 1)] + 2 * binary[(y + 1) * width + x] + binary[(y + 1) * width + (x + 1)];
        edges[y * width + x] = Math.min(255, Math.abs(gy));
      }
    }
    return edges;
  }

  /**
   * Hough transform for near-horizontal lines.
   * Only searches ±15° around horizontal.
   * @param {Uint8Array} binary - binarized image (0 = foreground)
   * @param {number} width
   * @param {number} height
   * @returns {{angle: number, accumulator: Int32Array, thetas: Float64Array, rhoMax: number}}
   */
  houghTransform(binary, width, height) {
    const diag = Math.ceil(Math.sqrt(width * width + height * height));
    const rhoMax = diag;
    const rhoSteps = 2 * rhoMax + 1;

    // Theta range: centered around 0 (horizontal), ±THETA_RANGE
    const thetas = new Float64Array(THETA_STEPS);
    for (let i = 0; i < THETA_STEPS; i++) {
      thetas[i] = -THETA_RANGE + (2 * THETA_RANGE * i) / (THETA_STEPS - 1);
    }

    // Precompute cos/sin
    const cosT = new Float64Array(THETA_STEPS);
    const sinT = new Float64Array(THETA_STEPS);
    for (let i = 0; i < THETA_STEPS; i++) {
      cosT[i] = Math.cos(thetas[i]);
      sinT[i] = Math.sin(thetas[i]);
    }

    const accumulator = new Int32Array(THETA_STEPS * rhoSteps);

    // Vote only on foreground (black = 0) pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (binary[y * width + x] !== 0) continue;
        for (let ti = 0; ti < THETA_STEPS; ti++) {
          const rho = Math.round(x * cosT[ti] + y * sinT[ti]) + rhoMax;
          if (rho >= 0 && rho < rhoSteps) {
            accumulator[ti * rhoSteps + rho]++;
          }
        }
      }
    }

    // Find the peak theta (dominant line angle)
    // Sum votes across all rho for each theta to find dominant angle
    let bestTheta = 0;
    let bestSum = 0;

    // Find the top N rho peaks and average their theta
    const peakThreshold = 0.5;
    let globalMax = 0;
    for (let i = 0; i < accumulator.length; i++) {
      if (accumulator[i] > globalMax) globalMax = accumulator[i];
    }

    // For each theta, find the single strongest rho peak
    const thetaVotes = new Float64Array(THETA_STEPS);
    for (let ti = 0; ti < THETA_STEPS; ti++) {
      let peak = 0;
      for (let ri = 0; ri < rhoSteps; ri++) {
        const v = accumulator[ti * rhoSteps + ri];
        if (v > peak) peak = v;
      }
      thetaVotes[ti] = peak;
      if (peak > bestSum) {
        bestSum = peak;
        bestTheta = ti;
      }
    }

    const angle = thetas[bestTheta];
    return { angle, accumulator, thetas, rhoMax };
  }

  /**
   * Detect skew angle of the image.
   * @param {Uint8Array} binary
   * @param {number} width
   * @param {number} height
   * @returns {number} skew angle in radians
   */
  detectSkew(binary, width, height) {
    const { angle } = this.houghTransform(binary, width, height);
    return angle;
  }

  /**
   * Rotate a grayscale image by the given angle using bilinear interpolation.
   * @param {Uint8Array} gray
   * @param {number} width
   * @param {number} height
   * @param {number} angle - radians to rotate (counter-clockwise)
   * @returns {{data: Uint8Array, width: number, height: number}}
   */
  rotate(gray, width, height, angle) {
    if (Math.abs(angle) < 0.001) {
      return { data: new Uint8Array(gray), width, height };
    }

    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const cx = width / 2;
    const cy = height / 2;

    const out = new Uint8Array(width * height).fill(255);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Map destination to source
        const dx = x - cx;
        const dy = y - cy;
        const srcX = cos * dx - sin * dy + cx;
        const srcY = sin * dx + cos * dy + cy;

        // Bilinear interpolation
        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        const x1 = x0 + 1;
        const y1 = y0 + 1;

        if (x0 < 0 || y0 < 0 || x1 >= width || y1 >= height) continue;

        const fx = srcX - x0;
        const fy = srcY - y0;

        const v00 = gray[y0 * width + x0];
        const v10 = gray[y0 * width + x1];
        const v01 = gray[y1 * width + x0];
        const v11 = gray[y1 * width + x1];

        const v = (1 - fx) * (1 - fy) * v00
          + fx * (1 - fy) * v10
          + (1 - fx) * fy * v01
          + fx * fy * v11;

        out[y * width + x] = Math.round(v);
      }
    }

    return { data: out, width, height };
  }

  /**
   * Detect and correct skew in one step.
   * @param {Uint8Array} binary - for detection
   * @param {Uint8Array} gray - to rotate
   * @param {number} width
   * @param {number} height
   * @returns {{data: Uint8Array, width: number, height: number, angle: number}}
   */
  correct(binary, gray, width, height) {
    const angle = this.detectSkew(binary, width, height);
    if (Math.abs(angle) < 0.035) { // ~2° — ignore false positives on clean digital images
      return { data: new Uint8Array(gray), width, height, angle: 0 };
    }
    const rotated = this.rotate(gray, width, height, -angle);
    return { ...rotated, angle };
  }
}
