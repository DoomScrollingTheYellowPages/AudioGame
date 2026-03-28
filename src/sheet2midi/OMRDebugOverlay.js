// ─────────────────────────────────────────────
// OMRDebugOverlay — pipeline visualization drawn
// transparently over the source image canvas.
// All annotations are scaled from processed-image
// coordinates to original-image coordinates.
// ─────────────────────────────────────────────

// ── Symbol colour map ──────────────────────────

const SYMBOL_COLORS = {
  filled_notehead: '#00ff88',
  open_notehead:   '#00cc66',
  clef_treble:     '#ff44ff',
  clef_bass:       '#cc22cc',
  bar_line:        '#ff8800',
  rest_quarter:    '#ffcc00',
  rest_half:       '#ffcc00',
  rest_whole:      '#ffcc00',
  rest_eighth:     '#ffcc00',
  unknown:         '#555555',
  _default:        '#4488ff'
};

// ── Legend definitions ─────────────────────────

const LEGENDS = {
  binary:      [['rgba(0,200,255,0.55)', 'Detected ink (foreground)']],
  staff_lines: [['rgba(0,200,255,0.55)', 'Detected ink'], ['#00ffcc', 'Staff rows'], ['#00ff88', 'Staff group']],
  cleaned:     [['rgba(0,255,136,0.55)', 'Symbols after staff removal']],
  components:  [['hsl(0,100%,60%)', 'Component bboxes (rainbow by index)']],
  symbols:     Object.entries(SYMBOL_COLORS)
    .filter(([k]) => k !== '_default')
    .map(([k, v]) => [v, k.replace(/_/g, ' ')]),
  pitched:     [['#00ff88', 'Pitched notehead'], ['rgba(0,200,255,0.3)', 'Staff lines']],
  final:       [['#00ff88', 'Validated note'], ['#ff8800', 'Barline'], ['rgba(0,200,255,0.3)', 'Staff lines']]
};

// ── OMRDebugOverlay ────────────────────────────

export class OMRDebugOverlay {
  /**
   * @param {HTMLCanvasElement} canvas  — the overlay canvas (sits atop preview)
   */
  constructor(canvas) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._steps = [];
    this._current = 0;
    // Scale from processed-image coords to original-image coords
    this._sx = 1;
    this._sy = 1;
  }

  // ── Public API ─────────────────────────────────

  reset() {
    this._steps = [];
    this._current = 0;
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  /**
   * Set coordinate scaling. Call once after processing completes,
   * before the first render.
   * @param {number} origW        - source image (preview canvas) intrinsic width
   * @param {number} origH        - source image intrinsic height
   * @param {number} procW        - processed image width (after crop/upscale)
   * @param {number} procH        - processed image height
   * @param {number} cropOffsetX  - pixels removed from left during border crop
   * @param {number} cropOffsetY  - pixels removed from top during border crop
   */
  /**
   * @param {number} origW     - preview canvas intrinsic width (original image)
   * @param {number} origH     - preview canvas intrinsic height
   * @param {number} procW     - processed image width (after crop + upscale)
   * @param {number} procH     - processed image height
   * @param {number} cropOffsetX - pixels removed from left by cropBorders
   * @param {number} cropOffsetY - pixels removed from top  by cropBorders
   * @param {number} preCropW  - width  after crop, before upscale
   * @param {number} preCropH  - height after crop, before upscale
   */
  setDimensions(origW, origH, procW, procH,
                cropOffsetX = 0, cropOffsetY = 0,
                preCropW = null, preCropH = null) {
    this._canvas.width  = origW;
    this._canvas.height = origH;
    // preCropW/H are the exact pixel extents of the processed content
    // in original-image space (= cropped size = procSize / upscaleFactor).
    const cW = preCropW ?? procW;
    const cH = preCropH ?? procH;
    this._sx    = cW / procW;   // processed → original scale (= 1/upscaleFactor)
    this._sy    = cH / procH;
    this._ox    = cropOffsetX;  // left offset in original-image pixels
    this._oy    = cropOffsetY;  // top  offset in original-image pixels
    this._destW = cW;           // width  of the drawn region on the overlay
    this._destH = cH;           // height of the drawn region on the overlay
  }

  /** @param {{ step: string, label: string, data: object }} stepData */
  addStep(stepData) {
    this._steps.push(stepData);
  }

  get stepCount() { return this._steps.length; }
  get currentIndex() { return this._current; }
  get currentLabel() { return this._steps[this._current]?.label ?? ''; }

  goTo(index) {
    if (index < 0 || index >= this._steps.length) return false;
    this._current = index;
    this._render();
    return true;
  }

  next() { return this.goTo(this._current + 1); }
  prev() { return this.goTo(this._current - 1); }

  /** @returns {string} HTML for the legend row */
  legendHtml() {
    const step = this._steps[this._current];
    if (!step) return '';
    const items = LEGENDS[step.step] || [];
    return items.map(([color, label]) =>
      `<span class="legend-item"><span class="legend-color" style="background:${color}"></span>${label}</span>`
    ).join('');
  }

  // ── Render dispatch ────────────────────────────

  _render() {
    if (!this._steps.length) return;
    const { step, data } = this._steps[this._current];
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    switch (step) {
      case 'binary':      this._drawColorMask(data.binary, data.width, data.height, 0, 200, 255, 140); break;
      case 'staff_lines': this._drawStaffLines(data); break;
      case 'cleaned':     this._drawColorMask(data.binary, data.width, data.height, 0, 255, 136, 140); break;
      case 'components':  this._drawComponents(data); break;
      case 'symbols':     this._drawSymbols(data); break;
      case 'pitched':     this._drawPitchedNotes(data); break;
      case 'final':       this._drawFinalNotes(data); break;
    }
  }

  // ── Pixel-mask helper ──────────────────────────

  /**
   * Draw a coloured semi-transparent mask for foreground pixels.
   * Uses an OffscreenCanvas at processed resolution then scales to overlay.
   */
  _drawColorMask(pixels, procW, procH, r, g, b, alpha) {
    const img = new ImageData(procW, procH);
    const d = img.data;
    for (let i = 0; i < pixels.length; i++) {
      if (pixels[i] === 0) { // foreground (ink)
        d[i * 4]     = r;
        d[i * 4 + 1] = g;
        d[i * 4 + 2] = b;
        d[i * 4 + 3] = alpha;
      }
      // background → transparent (alpha stays 0)
    }
    const off = new OffscreenCanvas(procW, procH);
    off.getContext('2d').putImageData(img, 0, 0);
    this._ctx.drawImage(off, this._ox, this._oy, this._destW, this._destH);
  }

  // ── Coordinate helpers ─────────────────────────
  // _px/_py: translate a position (adds crop offset)
  // _pw/_ph: scale a size/dimension  (no offset — offsets only apply to origins)

  _px(x) { return x * this._sx + this._ox; }
  _py(y) { return y * this._sy + this._oy; }
  _pw(w) { return w * this._sx; }
  _ph(h) { return h * this._sy; }

  _rect(x, y, w, h) {
    this._ctx.strokeRect(this._px(x), this._py(y), this._pw(w), this._ph(h));
  }

  _fillRect(x, y, w, h) {
    this._ctx.fillRect(this._px(x), this._py(y), this._pw(w), this._ph(h));
  }

  _line(x0, y0, x1, y1) {
    this._ctx.beginPath();
    this._ctx.moveTo(this._px(x0), this._py(y0));
    this._ctx.lineTo(this._px(x1), this._py(y1));
    this._ctx.stroke();
  }

  _dot(x, y, r) {
    this._ctx.beginPath();
    this._ctx.arc(this._px(x), this._py(y), r, 0, Math.PI * 2);
    this._ctx.fill();
  }

  _label(text, x, y) {
    const px = this._px(x);
    const py = this._py(y);
    this._ctx.fillStyle = 'rgba(0,0,0,0.75)';
    this._ctx.fillText(text, px + 1, py + 1);
    this._ctx.fillStyle = this._labelColor;
    this._ctx.fillText(text, px, py);
  }

  // ── Step renderers ─────────────────────────────

  _drawStaffLines({ binary, width, height, staffRows, groups, staffSpace }) {
    const ctx = this._ctx;
    this._drawColorMask(binary, width, height, 0, 200, 255, 100);

    // Staff rows — bright teal horizontal stripes
    ctx.fillStyle = 'rgba(0,255,204,0.7)';
    for (const y of staffRows) {
      this._fillRect(0, y, width, 1);
    }

    // Staff group brackets on left edge
    if (groups && groups.length > 0) {
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = Math.max(1, this._pw(3));
      for (const group of groups) {
        const top = group[0];
        const bot = group[group.length - 1];
        ctx.strokeRect(
          this._px(2), this._py(top - 4),
          this._pw(10), this._ph(bot - top + 8)
        );
      }
    }
  }

  _drawComponents({ components }) {
    const ctx = this._ctx;
    ctx.lineWidth = Math.max(1, this._pw(1.5));
    for (let i = 0; i < components.length; i++) {
      const c = components[i];
      const hue = (i * 47) % 360;
      ctx.strokeStyle = `hsl(${hue},100%,62%)`;
      this._rect(c.bbox.x, c.bbox.y, c.bbox.width, c.bbox.height);
    }
  }

  _drawSymbols({ symbols, staffSpace }) {
    const ctx = this._ctx;
    for (const s of symbols) {
      const color = SYMBOL_COLORS[s.type] ?? SYMBOL_COLORS._default;
      const c = s.component;
      const isClef = s.type === 'clef_treble' || s.type === 'clef_bass';
      ctx.strokeStyle = color;
      ctx.lineWidth = isClef ? Math.max(3, this._pw(4)) : Math.max(1, this._pw(2));
      this._rect(c.bbox.x, c.bbox.y, c.bbox.width, c.bbox.height);
      ctx.fillStyle = color;
      this._dot(c.centroid.x, c.centroid.y, isClef ? Math.max(3, this._pw(4)) : Math.max(1.5, this._pw(2)));
    }
  }

  _drawStaffGuides(groups, width) {
    const ctx = this._ctx;
    ctx.strokeStyle = 'rgba(0,200,255,0.3)';
    ctx.lineWidth = Math.max(1, this._pw(1));
    for (const group of (groups || [])) {
      for (const lineY of group) {
        this._line(0, lineY, width, lineY);
      }
    }
  }

  _drawPitchedNotes({ notes, groups, staffSpace, width }) {
    const ctx = this._ctx;
    this._drawStaffGuides(groups, width);

    const fontSize = Math.max(9, Math.round(this._pw(staffSpace * 0.85)));
    ctx.font = `${fontSize}px 'Courier New', monospace`;

    for (const n of notes) {
      const c = n.symbol.component;
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = Math.max(1, this._pw(2));
      this._rect(c.bbox.x - 2, c.bbox.y - 2, c.bbox.width + 4, c.bbox.height + 4);

      this._labelColor = '#00ff88';
      this._label(`${n.noteName}${n.octave}`, c.centroid.x - staffSpace * 0.9, c.bbox.y - 3);
    }
  }

  _drawFinalNotes({ notes, symbols, groups, staffSpace, width }) {
    const ctx = this._ctx;
    this._drawStaffGuides(groups, width);

    // Barlines
    ctx.strokeStyle = '#ff8800';
    ctx.lineWidth = Math.max(1, this._pw(2));
    for (const s of (symbols || []).filter(s2 => s2.type === 'bar_line')) {
      const c = s.component;
      this._rect(c.bbox.x, c.bbox.y, c.bbox.width, c.bbox.height);
    }

    const fontSize = Math.max(9, Math.round(this._pw(staffSpace * 0.9)));
    const smallSize = Math.max(7, Math.round(this._pw(staffSpace * 0.65)));
    ctx.font = `bold ${fontSize}px 'Courier New', monospace`;

    for (const n of notes) {
      const c = n.symbol.component;
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = Math.max(1, this._pw(2));
      this._rect(c.bbox.x - 2, c.bbox.y - 2, c.bbox.width + 4, c.bbox.height + 4);

      // Note name above
      this._labelColor = '#00ff88';
      this._label(`${n.noteName}${n.octave}`, c.centroid.x - staffSpace * 0.9, c.bbox.y - 3);

      // MIDI number below
      ctx.font = `${smallSize}px 'Courier New', monospace`;
      this._labelColor = '#aaaaaa';
      this._label(`${n.midiNote}`, c.centroid.x - staffSpace * 0.35, c.bbox.y + c.bbox.height + smallSize);
      ctx.font = `bold ${fontSize}px 'Courier New', monospace`;
    }
  }
}
