// ─────────────────────────────────────────────
// Test helper — minimal mocks for Node.js testing
// of browser-targeted ES modules
// ─────────────────────────────────────────────

/**
 * Minimal EventBus mock that records emitted events.
 */
export class MockBus {
  constructor() {
    this.events = [];
    this._handlers = {};
  }

  emit(name, data) {
    this.events.push({ name, data });
    const handlers = this._handlers[name];
    if (handlers) {
      for (const fn of handlers) fn(data);
    }
  }

  on(name, fn) {
    if (!this._handlers[name]) this._handlers[name] = [];
    this._handlers[name].push(fn);
  }

  off(name, fn) {
    const list = this._handlers[name];
    if (list) {
      this._handlers[name] = list.filter(f => f !== fn);
    }
  }

  /**
   * Return all events with the given name.
   * @param {string} name
   * @returns {Array<{name: string, data: any}>}
   */
  getEvents(name) {
    return this.events.filter(e => e.name === name);
  }

  /** Clear recorded events. */
  clear() {
    this.events = [];
  }
}

/**
 * Create a simple grayscale image buffer for testing.
 * @param {number} width
 * @param {number} height
 * @param {number} [fillValue=128] — default gray value
 * @returns {Uint8Array}
 */
export function createGrayImage(width, height, fillValue = 128) {
  return new Uint8Array(width * height).fill(fillValue);
}

/**
 * Draw horizontal black lines at the specified y-positions.
 * Useful for creating synthetic staff line images.
 * @param {Uint8Array} gray
 * @param {number} width
 * @param {number} height
 * @param {number[]} yPositions — row indices for black lines
 * @param {number} [thickness=1]
 */
export function drawHorizontalLines(gray, width, height, yPositions, thickness = 1) {
  for (const y of yPositions) {
    for (let t = 0; t < thickness; t++) {
      const row = y + t;
      if (row >= 0 && row < height) {
        for (let x = 0; x < width; x++) {
          gray[row * width + x] = 0; // black
        }
      }
    }
  }
}

/**
 * Draw a filled rectangle on a grayscale image.
 * @param {Uint8Array} gray
 * @param {number} width
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} [value=0] — pixel value (0=black, 255=white)
 */
export function drawRect(gray, width, x, y, w, h, value = 0) {
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      gray[row * width + col] = value;
    }
  }
}

/**
 * Draw a filled ellipse on a grayscale image.
 * @param {Uint8Array} gray
 * @param {number} imgWidth
 * @param {number} cx — center x
 * @param {number} cy — center y
 * @param {number} rx — radius x
 * @param {number} ry — radius y
 * @param {number} [value=0]
 */
export function drawEllipse(gray, imgWidth, cx, cy, rx, ry, value = 0) {
  for (let y = cy - ry; y <= cy + ry; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1.0) {
        gray[y * imgWidth + x] = value;
      }
    }
  }
}
