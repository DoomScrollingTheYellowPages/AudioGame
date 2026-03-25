# Spec: Themeable Design System

## Overview

Implement a themeable design system with three switchable visual themes on a shared structural base. The theme selector lives on the main navigation page (`index.html`), and the chosen theme persists via `localStorage` across all pages and sessions.

## Themes

1. **Dark / Techy (Default)** — `#0d0d0d` bg, `#e0e0e0` text, `#00ff88` accent, `'Courier New', monospace`
2. **Warm / Approachable** — `#faf5ef` bg, `#3a3330` text, `#e8863a` accent, `'Nunito', 'Segoe UI', sans-serif`, rounded corners (8px)
3. **Clean / Professional** — `#ffffff` bg, `#212121` text, `#1976d2` accent, `'Inter', 'Helvetica Neue', sans-serif`, minimal decoration

Full color definitions are in `conductor/product-guidelines.md`.

## Technical Approach

- **CSS custom properties** on `:root` for all DOM styling (colors, fonts, borders, score tier colors). A class on `<body>` (e.g., `theme-dark`, `theme-warm`, `theme-clean`) selects the active variable set.
- **Shared `theme.js` module** exports a `Theme` object with the current palette as plain JS values for canvas renderers. Listens for theme changes and updates the object. All canvas modules read colors from `Theme` instead of hardcoded constants.
- **`localStorage` key** `audiogame-theme` stores the selected theme ID. Applied on page load before first paint.
- **Theme selector** on `index.html` only — three clickable swatches or buttons.

## Functional Requirements

1. All six HTML pages apply the active theme on load from `localStorage`
2. Switching themes on `index.html` immediately updates the page and saves the preference
3. All canvas renderers (Oscilloscope, StaffRenderer, Highway, StaffHighway, KeyboardDisplay, FingeringRenderer) use `Theme` colors instead of hardcoded values
4. Score tier colors (Perfect, Great, Good, Miss) change per theme
5. Button/input styles, backgrounds, text colors, and fonts all respond to theme
6. Existing dark theme appearance is preserved exactly when "Dark / Techy" is selected

## Non-Functional Requirements

- No external CSS files — themes defined in inline `<style>` per page using CSS variables
- No flicker on page load (theme class applied before DOM renders)
- Zero new dependencies

## Acceptance Criteria

1. User can select any of the three themes on `index.html`
2. Theme persists across page navigation and browser restart
3. All pages render correctly in all three themes
4. Canvas visuals use theme-appropriate colors
5. Dark theme output is visually identical to the current hardcoded appearance

## Out of Scope

- Custom user-defined themes
- Per-page theme overrides
- Theme transition animations
