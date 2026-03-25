// ─────────────────────────────────────────────
// Theme — unit tests
// ─────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Theme, THEMES } from '../../src/core/Theme.js';

// Mock localStorage for Node.js
const storage = {};
globalThis.localStorage = {
  getItem: (k) => storage[k] ?? null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
};

describe('Theme', () => {

  beforeEach(() => {
    delete storage['audiogame-theme'];
  });

  // ── THEMES constant ────────────────────────
  describe('THEMES', () => {
    it('defines three themes: dark, warm, clean', () => {
      assert.ok(THEMES.dark, 'dark theme should exist');
      assert.ok(THEMES.warm, 'warm theme should exist');
      assert.ok(THEMES.clean, 'clean theme should exist');
    });

    it('each theme has required color properties', () => {
      const required = ['bg', 'text', 'accent', 'error', 'controlBg', 'controlBorder', 'font',
        'perfect', 'great', 'good', 'miss'];
      for (const [name, theme] of Object.entries(THEMES)) {
        for (const prop of required) {
          assert.ok(theme[prop] !== undefined, `${name} theme missing '${prop}'`);
        }
      }
    });

    it('dark theme matches current hardcoded values', () => {
      assert.equal(THEMES.dark.bg, '#0d0d0d');
      assert.equal(THEMES.dark.text, '#e0e0e0');
      assert.equal(THEMES.dark.accent, '#00ff88');
      assert.equal(THEMES.dark.error, '#ff4444');
      assert.equal(THEMES.dark.perfect, '#00ff88');
      assert.equal(THEMES.dark.great, '#88cc44');
      assert.equal(THEMES.dark.good, '#ccaa22');
      assert.equal(THEMES.dark.miss, '#ff4444');
    });

    it('warm theme has correct values from product guidelines', () => {
      assert.equal(THEMES.warm.bg, '#faf5ef');
      assert.equal(THEMES.warm.accent, '#e8863a');
    });

    it('clean theme has correct values from product guidelines', () => {
      assert.equal(THEMES.clean.bg, '#ffffff');
      assert.equal(THEMES.clean.accent, '#1976d2');
    });
  });

  // ── Theme.current() ────────────────────────
  describe('current()', () => {
    it('returns dark theme by default', () => {
      const theme = Theme.current();
      assert.equal(theme.bg, '#0d0d0d');
    });

    it('returns the theme stored in localStorage', () => {
      storage['audiogame-theme'] = 'warm';
      const theme = Theme.current();
      assert.equal(theme.bg, '#faf5ef');
    });

    it('falls back to dark for unknown theme ID', () => {
      storage['audiogame-theme'] = 'nonexistent';
      const theme = Theme.current();
      assert.equal(theme.bg, '#0d0d0d');
    });
  });

  // ── Theme.currentId() ──────────────────────
  describe('currentId()', () => {
    it('returns "dark" by default', () => {
      assert.equal(Theme.currentId(), 'dark');
    });

    it('returns stored theme ID', () => {
      storage['audiogame-theme'] = 'clean';
      assert.equal(Theme.currentId(), 'clean');
    });
  });

  // ── Theme.set() ────────────────────────────
  describe('set()', () => {
    it('saves theme ID to localStorage', () => {
      Theme.set('warm');
      assert.equal(storage['audiogame-theme'], 'warm');
    });

    it('updates current() return value', () => {
      Theme.set('clean');
      assert.equal(Theme.current().bg, '#ffffff');
    });

    it('ignores invalid theme IDs', () => {
      Theme.set('dark');
      Theme.set('invalid');
      assert.equal(Theme.currentId(), 'dark');
    });
  });

  // ── Theme.cssClass() ──────────────────────
  describe('cssClass()', () => {
    it('returns correct class name for current theme', () => {
      Theme.set('dark');
      assert.equal(Theme.cssClass(), 'theme-dark');
      Theme.set('warm');
      assert.equal(Theme.cssClass(), 'theme-warm');
      Theme.set('clean');
      assert.equal(Theme.cssClass(), 'theme-clean');
    });
  });

  // ── Theme.cssVariables() ───────────────────
  describe('cssVariables()', () => {
    it('returns CSS variable definitions string for a theme', () => {
      const css = Theme.cssVariables('dark');
      assert.ok(css.includes('--bg:'), 'should define --bg');
      assert.ok(css.includes('--text:'), 'should define --text');
      assert.ok(css.includes('--accent:'), 'should define --accent');
      assert.ok(css.includes('#0d0d0d'), 'should contain dark bg value');
    });

    it('returns different values for different themes', () => {
      const dark = Theme.cssVariables('dark');
      const warm = Theme.cssVariables('warm');
      assert.notEqual(dark, warm);
    });
  });

  // ── Theme.allCssBlocks() ───────────────────
  describe('allCssBlocks()', () => {
    it('returns CSS blocks for all three themes', () => {
      const css = Theme.allCssBlocks();
      assert.ok(css.includes('.theme-dark'), 'should have dark class');
      assert.ok(css.includes('.theme-warm'), 'should have warm class');
      assert.ok(css.includes('.theme-clean'), 'should have clean class');
    });
  });
});
