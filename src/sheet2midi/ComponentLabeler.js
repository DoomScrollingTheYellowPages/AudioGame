// ─────────────────────────────────────────────
// ComponentLabeler — connected component labeling
// using two-pass algorithm with Union-Find, plus
// feature extraction for each component
// ─────────────────────────────────────────────

// ── Union-Find ─────────────────────────────────

class UnionFind {
  constructor(size) {
    this._parent = new Int32Array(size);
    this._rank = new Uint8Array(size);
    for (let i = 0; i < size; i++) this._parent[i] = i;
  }

  find(x) {
    while (this._parent[x] !== x) {
      this._parent[x] = this._parent[this._parent[x]]; // path compression
      x = this._parent[x];
    }
    return x;
  }

  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    if (this._rank[ra] < this._rank[rb]) {
      this._parent[ra] = rb;
    } else if (this._rank[ra] > this._rank[rb]) {
      this._parent[rb] = ra;
    } else {
      this._parent[rb] = ra;
      this._rank[ra]++;
    }
  }
}

// ── ComponentLabeler ───────────────────────────

export class ComponentLabeler {
  /**
   * @param {EventBus} bus
   */
  constructor(bus) {
    this._bus = bus;
  }

  /**
   * Two-pass connected component labeling.
   * @param {Uint8Array} binary - 0=foreground, 255=background
   * @param {number} width
   * @param {number} height
   * @returns {{labels: Int32Array, count: number}}
   */
  label(binary, width, height) {
    const labels = new Int32Array(width * height);
    let nextLabel = 1;
    const uf = new UnionFind(width * height / 4 + 1);

    // Pass 1: assign provisional labels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (binary[idx] !== 0) continue; // skip background

        const neighbors = [];

        // Check left
        if (x > 0 && labels[idx - 1] > 0) {
          neighbors.push(labels[idx - 1]);
        }
        // Check top
        if (y > 0 && labels[idx - width] > 0) {
          neighbors.push(labels[idx - width]);
        }
        // Check top-left
        if (x > 0 && y > 0 && labels[idx - width - 1] > 0) {
          neighbors.push(labels[idx - width - 1]);
        }
        // Check top-right
        if (x < width - 1 && y > 0 && labels[idx - width + 1] > 0) {
          neighbors.push(labels[idx - width + 1]);
        }

        if (neighbors.length === 0) {
          labels[idx] = nextLabel++;
        } else {
          const minLabel = Math.min(...neighbors);
          labels[idx] = minLabel;
          for (const n of neighbors) {
            if (n !== minLabel) uf.union(minLabel, n);
          }
        }
      }
    }

    // Pass 2: resolve labels to canonical roots
    const remap = new Map();
    let finalCount = 0;

    for (let i = 0; i < labels.length; i++) {
      if (labels[i] === 0) continue;
      const root = uf.find(labels[i]);
      if (!remap.has(root)) {
        remap.set(root, ++finalCount);
      }
      labels[i] = remap.get(root);
    }

    return { labels, count: finalCount };
  }

  /**
   * Extract features for each labeled component.
   * @param {Int32Array} labels
   * @param {number} width
   * @param {number} height
   * @param {number} count - number of components
   * @param {number} staffSpace - for size filtering
   * @returns {Array<ComponentFeatures>}
   */
  extractFeatures(labels, width, height, count, staffSpace) {
    // Initialize per-component accumulators
    const minX = new Int32Array(count + 1).fill(width);
    const minY = new Int32Array(count + 1).fill(height);
    const maxX = new Int32Array(count + 1).fill(-1);
    const maxY = new Int32Array(count + 1).fill(-1);
    const area = new Uint32Array(count + 1);
    const sumX = new Float64Array(count + 1);
    const sumY = new Float64Array(count + 1);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const label = labels[y * width + x];
        if (label === 0) continue;
        area[label]++;
        sumX[label] += x;
        sumY[label] += y;
        if (x < minX[label]) minX[label] = x;
        if (x > maxX[label]) maxX[label] = x;
        if (y < minY[label]) minY[label] = y;
        if (y > maxY[label]) maxY[label] = y;
      }
    }

    const components = [];
    const minSize = staffSpace * 0.1;
    const maxSize = staffSpace * 50;

    for (let i = 1; i <= count; i++) {
      if (area[i] === 0) continue;
      const w = maxX[i] - minX[i] + 1;
      const h = maxY[i] - minY[i] + 1;

      // Filter by size
      if (w < minSize && h < minSize) continue;
      if (w > maxSize || h > maxSize) continue;

      const bbox = { x: minX[i], y: minY[i], width: w, height: h };
      const centroidX = sumX[i] / area[i];
      const centroidY = sumY[i] / area[i];
      const fillRatio = area[i] / (w * h);
      const aspectRatio = w / h;

      // Count holes using Euler number approximation
      const holes = this._countHoles(labels, width, i, bbox);

      components.push({
        label: i,
        bbox,
        centroid: { x: centroidX, y: centroidY },
        area: area[i],
        fillRatio,
        aspectRatio,
        holes,
        widthSS: w / staffSpace,  // width in staff spaces
        heightSS: h / staffSpace  // height in staff spaces
      });
    }

    return components;
  }

  /**
   * Count holes in a component using a simple background flood fill.
   * @param {Int32Array} labels
   * @param {number} imgWidth
   * @param {number} componentLabel
   * @param {{x: number, y: number, width: number, height: number}} bbox
   * @returns {number}
   */
  _countHoles(labels, imgWidth, componentLabel, bbox) {
    const w = bbox.width + 2; // pad by 1 on each side
    const h = bbox.height + 2;
    const region = new Uint8Array(w * h); // 0 = background, 1 = foreground

    // Copy component pixels into padded region
    for (let dy = 0; dy < bbox.height; dy++) {
      for (let dx = 0; dx < bbox.width; dx++) {
        const imgIdx = (bbox.y + dy) * imgWidth + (bbox.x + dx);
        if (labels[imgIdx] === componentLabel) {
          region[(dy + 1) * w + (dx + 1)] = 1;
        }
      }
    }

    // Flood fill background from edges
    const visited = new Uint8Array(w * h);
    const stack = [0]; // start from top-left corner
    visited[0] = 1;

    // Seed all border pixels
    for (let x = 0; x < w; x++) {
      if (!visited[x]) { stack.push(x); visited[x] = 1; }
      const bottomIdx = (h - 1) * w + x;
      if (!visited[bottomIdx]) { stack.push(bottomIdx); visited[bottomIdx] = 1; }
    }
    for (let y = 0; y < h; y++) {
      const leftIdx = y * w;
      if (!visited[leftIdx]) { stack.push(leftIdx); visited[leftIdx] = 1; }
      const rightIdx = y * w + (w - 1);
      if (!visited[rightIdx]) { stack.push(rightIdx); visited[rightIdx] = 1; }
    }

    while (stack.length > 0) {
      const idx = stack.pop();
      const x = idx % w;
      const y = Math.floor(idx / w);
      if (region[idx] === 1) continue; // don't cross foreground

      const neighbors = [];
      if (x > 0) neighbors.push(idx - 1);
      if (x < w - 1) neighbors.push(idx + 1);
      if (y > 0) neighbors.push(idx - w);
      if (y < h - 1) neighbors.push(idx + w);

      for (const n of neighbors) {
        if (!visited[n] && region[n] === 0) {
          visited[n] = 1;
          stack.push(n);
        }
      }
    }

    // Count unvisited background regions (holes)
    let holes = 0;
    for (let i = 0; i < region.length; i++) {
      if (region[i] === 0 && !visited[i]) {
        // Found a hole — flood fill it to count as one hole
        holes++;
        const holeStack = [i];
        visited[i] = 1;
        while (holeStack.length > 0) {
          const idx = holeStack.pop();
          const x = idx % w;
          const y = Math.floor(idx / w);
          if (x > 0 && !visited[idx - 1] && region[idx - 1] === 0) {
            visited[idx - 1] = 1;
            holeStack.push(idx - 1);
          }
          if (x < w - 1 && !visited[idx + 1] && region[idx + 1] === 0) {
            visited[idx + 1] = 1;
            holeStack.push(idx + 1);
          }
          if (y > 0 && !visited[idx - w] && region[idx - w] === 0) {
            visited[idx - w] = 1;
            holeStack.push(idx - w);
          }
          if (y < h - 1 && !visited[idx + w] && region[idx + w] === 0) {
            visited[idx + w] = 1;
            holeStack.push(idx + w);
          }
        }
      }
    }

    return holes;
  }
}

/**
 * @typedef {object} ComponentFeatures
 * @property {number} label
 * @property {{x: number, y: number, width: number, height: number}} bbox
 * @property {{x: number, y: number}} centroid
 * @property {number} area
 * @property {number} fillRatio
 * @property {number} aspectRatio
 * @property {number} holes
 * @property {number} widthSS  - width in staff spaces
 * @property {number} heightSS - height in staff spaces
 */
