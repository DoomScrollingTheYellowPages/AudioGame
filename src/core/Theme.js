// ─────────────────────────────────────────────
// Theme — shared theme definitions and manager
// for CSS variables and canvas color palette
// ─────────────────────────────────────────────

// ── Storage Key ──────────────────────────────

const STORAGE_KEY = 'audiogame-theme';
const DEFAULT_THEME = 'dark';

// ── Theme Definitions ────────────────────────

export const THEMES = {
  dark: {
    id: 'dark',
    label: 'Dark / Techy',
    bg:            '#0d0d0d',
    text:          '#e0e0e0',
    accent:        '#00ff88',
    error:         '#ff4444',
    controlBg:     '#1a1a1a',
    controlBorder: '#2a2a2a',
    font:          "'Courier New', monospace",
    // Score tiers
    perfect:       '#00ff88',
    great:         '#88cc44',
    good:          '#ccaa22',
    miss:          '#ff4444',
    // Canvas-specific
    laneBg:        '#141414',
    laneBgAlt:     '#0a0a0a',
    laneLine:      '#1a1a1a',
    hitZone:       '#1a1a1a',
    hitZoneActive: '#00ff88',
    note:          '#3a3a3a',
    noteActive:    '#00ff88',
    beatLine:      '#1e1e1e',
    barLine:       '#2a2a2a',
    dimText:       '#2a2a2a',
    staffLine:     '#e0e0e0',
    notehead:      '#e0e0e0',
  },
  warm: {
    id: 'warm',
    label: 'Warm / Approachable',
    bg:            '#faf5ef',
    text:          '#3a3330',
    accent:        '#e8863a',
    error:         '#d94444',
    controlBg:     '#f0e8df',
    controlBorder: '#d9cfc3',
    font:          "'Nunito', 'Segoe UI', sans-serif",
    // Score tiers
    perfect:       '#4caf50',
    great:         '#8bc34a',
    good:          '#ffc107',
    miss:          '#d94444',
    // Canvas-specific
    laneBg:        '#f0e8df',
    laneBgAlt:     '#e8dfd4',
    laneLine:      '#d9cfc3',
    hitZone:       '#d9cfc3',
    hitZoneActive: '#e8863a',
    note:          '#c4b8aa',
    noteActive:    '#e8863a',
    beatLine:      '#d9cfc3',
    barLine:       '#bfb3a4',
    dimText:       '#bfb3a4',
    staffLine:     '#3a3330',
    notehead:      '#3a3330',
  },
  clean: {
    id: 'clean',
    label: 'Clean / Professional',
    bg:            '#ffffff',
    text:          '#212121',
    accent:        '#1976d2',
    error:         '#c62828',
    controlBg:     '#f5f5f5',
    controlBorder: '#e0e0e0',
    font:          "'Inter', 'Helvetica Neue', sans-serif",
    // Score tiers
    perfect:       '#1976d2',
    great:         '#42a5f5',
    good:          '#ffa726',
    miss:          '#c62828',
    // Canvas-specific
    laneBg:        '#f5f5f5',
    laneBgAlt:     '#eeeeee',
    laneLine:      '#e0e0e0',
    hitZone:       '#e0e0e0',
    hitZoneActive: '#1976d2',
    note:          '#bdbdbd',
    noteActive:    '#1976d2',
    beatLine:      '#e0e0e0',
    barLine:       '#bdbdbd',
    dimText:       '#bdbdbd',
    staffLine:     '#212121',
    notehead:      '#212121',
  }
};

// ── CSS Variable Mapping ─────────────────────

const CSS_VAR_MAP = [
  ['--bg', 'bg'],
  ['--text', 'text'],
  ['--accent', 'accent'],
  ['--error', 'error'],
  ['--control-bg', 'controlBg'],
  ['--control-border', 'controlBorder'],
  ['--font', 'font'],
  ['--perfect', 'perfect'],
  ['--great', 'great'],
  ['--good', 'good'],
  ['--miss', 'miss'],
];

// ── Theme Manager ────────────────────────────

export const Theme = {
  /**
   * Get the current theme ID from localStorage.
   * @returns {string}
   */
  currentId() {
    if (typeof localStorage === 'undefined') return DEFAULT_THEME;
    const id = localStorage.getItem(STORAGE_KEY);
    return (id && THEMES[id]) ? id : DEFAULT_THEME;
  },

  /**
   * Get the current theme object.
   * @returns {object}
   */
  current() {
    return THEMES[this.currentId()];
  },

  /**
   * Set the active theme.
   * @param {string} id — 'dark', 'warm', or 'clean'
   */
  set(id) {
    if (!THEMES[id]) return;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, id);
    }
  },

  /**
   * Get the CSS class name for the current theme.
   * @returns {string}
   */
  cssClass() {
    return `theme-${this.currentId()}`;
  },

  /**
   * Generate CSS variable definitions for a given theme.
   * @param {string} id
   * @returns {string}
   */
  cssVariables(id) {
    const t = THEMES[id];
    if (!t) return '';
    return CSS_VAR_MAP
      .map(([varName, prop]) => `${varName}: ${t[prop]};`)
      .join('\n    ');
  },

  /**
   * Generate CSS blocks for all themes, scoped by body class.
   * @returns {string}
   */
  allCssBlocks() {
    return Object.keys(THEMES).map(id => {
      return `body.theme-${id} {\n    ${this.cssVariables(id)}\n  }`;
    }).join('\n  ');
  },

  /**
   * Apply the current theme to a document body element.
   * Removes old theme classes and adds the current one.
   * @param {HTMLElement} body
   */
  apply(body) {
    for (const id of Object.keys(THEMES)) {
      body.classList.remove(`theme-${id}`);
    }
    body.classList.add(this.cssClass());
  }
};
