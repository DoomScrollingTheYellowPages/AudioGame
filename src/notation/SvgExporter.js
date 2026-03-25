// ─────────────────────────────────────────────
// SvgExporter — convert draw commands to SVG
// string for download/printing
// ─────────────────────────────────────────────

const NOTEHEAD_RX = 5;
const NOTEHEAD_RY = 3.5;

export class SvgExporter {
  /**
   * Convert draw commands to an SVG string.
   * Uses black-on-white print styling.
   * @param {Array<object>} cmds — from SheetRenderer.buildDrawCommands
   * @param {object} [opts]
   * @param {number} [opts.width=800]
   * @param {number} [opts.height=120]
   * @returns {string}
   */
  static toSvg(cmds, opts = {}) {
    // Compute bounds from commands
    let maxX = 0, maxY = 0;
    for (const c of cmds) {
      if (c.x2 !== undefined) maxX = Math.max(maxX, c.x2);
      if (c.x !== undefined) maxX = Math.max(maxX, c.x);
      if (c.y !== undefined) maxY = Math.max(maxY, c.y);
      if (c.y2 !== undefined) maxY = Math.max(maxY, c.y2);
    }
    const width = opts.width ?? Math.max(maxX + 40, 400);
    const height = opts.height ?? Math.max(maxY + 40, 120);

    const elements = [];

    // Background
    elements.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`);

    for (const cmd of cmds) {
      switch (cmd.type) {
        case 'staffLine':
          elements.push(
            `<line x1="${cmd.x1}" y1="${cmd.y}" x2="${cmd.x2}" y2="${cmd.y}" stroke="#000000" stroke-width="1"/>`
          );
          break;

        case 'notehead':
          elements.push(
            `<ellipse cx="${cmd.x}" cy="${cmd.y}" rx="${NOTEHEAD_RX}" ry="${NOTEHEAD_RY}" ` +
            `fill="${cmd.filled ? '#000000' : 'none'}" stroke="#000000" stroke-width="1.2" ` +
            `transform="rotate(-17 ${cmd.x} ${cmd.y})"/>`
          );
          break;

        case 'stem':
          elements.push(
            `<line x1="${cmd.x}" y1="${cmd.y1}" x2="${cmd.x}" y2="${cmd.y2}" stroke="#000000" stroke-width="1.2"/>`
          );
          break;

        case 'barLine':
          elements.push(
            `<line x1="${cmd.x}" y1="${cmd.y1}" x2="${cmd.x}" y2="${cmd.y2}" stroke="#000000" stroke-width="1"/>`
          );
          break;

        case 'ledgerLine':
          elements.push(
            `<line x1="${cmd.x}" y1="${cmd.y}" x2="${cmd.x2}" y2="${cmd.y}" stroke="#000000" stroke-width="1"/>`
          );
          break;

        case 'clef':
          elements.push(
            `<text x="${cmd.x}" y="${cmd.y + 28}" font-size="32" font-family="serif" fill="#000000">` +
            `${cmd.clef === 'treble' ? '\uD834\uDD1E' : '\uD834\uDD22'}</text>`
          );
          break;

        case 'timeSig':
          elements.push(
            `<text x="${cmd.x}" y="${cmd.y + 14}" font-size="14" font-weight="bold" font-family="serif" text-anchor="middle" fill="#000000">${cmd.meter[0]}</text>`
          );
          elements.push(
            `<text x="${cmd.x}" y="${cmd.y + 28}" font-size="14" font-weight="bold" font-family="serif" text-anchor="middle" fill="#000000">${cmd.meter[1]}</text>`
          );
          break;

        case 'rest':
          elements.push(
            `<text x="${cmd.x}" y="${cmd.y + 4}" font-size="12" font-family="serif" text-anchor="middle" fill="#666666">` +
            `${cmd.beats >= 4 ? '\u{1D13B}' : cmd.beats >= 2 ? '\u{1D13C}' : cmd.beats >= 1 ? '\u{1D13D}' : '\u{1D13E}'}</text>`
          );
          break;
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n` +
      elements.map(e => `  ${e}`).join('\n') +
      '\n</svg>';
  }

  /**
   * Create a downloadable blob URL for the SVG.
   * @param {string} svgString
   * @returns {string} blob URL
   */
  static createBlobUrl(svgString) {
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    return URL.createObjectURL(blob);
  }
}
