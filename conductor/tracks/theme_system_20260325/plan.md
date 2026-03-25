# Plan: Themeable Design System

## Phase 1: Theme Infrastructure

- [~] Task: Create the shared theme.js module
  - [ ] Sub-task: Write tests — test that theme.js exports a Theme object with correct color/font values for all three themes, test theme switching updates the object, test localStorage read/write
  - [ ] Sub-task: Implement — create src/core/Theme.js with theme definitions, get/set/apply methods, localStorage persistence
- [ ] Task: Define CSS custom properties for all three themes
  - [ ] Sub-task: Write tests — test that applying a theme class to a DOM element sets the expected CSS variable values (verify via theme.js config matching)
  - [ ] Sub-task: Implement — create a CSS variable block for each theme (dark, warm, clean) to be included in each page's inline style
- [ ] Task: Conductor - User Manual Verification 'Theme Infrastructure' (Protocol in workflow.md)

## Phase 2: Refactor Existing Pages to CSS Variables

- [ ] Task: Refactor index.html to use CSS variables and add theme selector
  - [ ] Sub-task: Write tests — test that theme selector buttons exist, clicking changes body class and localStorage value
  - [ ] Sub-task: Implement — replace hardcoded colors with var() references, add three theme selector buttons
- [ ] Task: Refactor input-config.html to use CSS variables
  - [ ] Sub-task: Write tests — test that page loads with correct theme class from localStorage
  - [ ] Sub-task: Implement — replace hardcoded colors/fonts with var() references, add theme init script
- [ ] Task: Refactor flashcard.html and speed-reader.html to use CSS variables
  - [ ] Sub-task: Write tests — test that pages load with correct theme class
  - [ ] Sub-task: Implement — replace hardcoded colors/fonts with var() references
- [ ] Task: Refactor rhythm.html and sheet2midi.html to use CSS variables
  - [ ] Sub-task: Write tests — test that pages load with correct theme class
  - [ ] Sub-task: Implement — replace hardcoded colors/fonts with var() references
- [ ] Task: Conductor - User Manual Verification 'Refactor Existing Pages to CSS Variables' (Protocol in workflow.md)

## Phase 3: Canvas Renderer Theme Integration

- [ ] Task: Update Oscilloscope and Tuner to use Theme colors
  - [ ] Sub-task: Write tests — test that canvas draw methods use colors from Theme object, not hardcoded values
  - [ ] Sub-task: Implement — replace hardcoded color constants with Theme property reads in Oscilloscope.js and Tuner.js
- [ ] Task: Update StaffRenderer and KeyboardDisplay to use Theme colors
  - [ ] Sub-task: Write tests — test that staff lines, note colors, and keyboard colors come from Theme
  - [ ] Sub-task: Implement — replace hardcoded COLORS objects with Theme reads in StaffRenderer.js and KeyboardDisplay.js
- [ ] Task: Update Highway, StaffHighway, and FingeringRenderer to use Theme colors
  - [ ] Sub-task: Write tests — test that highway lanes, hit zone, score tier colors come from Theme
  - [ ] Sub-task: Implement — replace hardcoded COLORS with Theme reads in Highway.js, StaffHighway.js, FingeringRenderer.js
- [ ] Task: Conductor - User Manual Verification 'Canvas Renderer Theme Integration' (Protocol in workflow.md)

## Phase 4: Visual Verification & Polish

- [ ] Task: Verify dark theme visual parity with current appearance
  - [ ] Sub-task: Write tests — test that Theme.get('dark') returns the exact same hex values currently hardcoded across the codebase
  - [ ] Sub-task: Implement — fix any color/font discrepancies found
- [ ] Task: Verify warm and clean themes render correctly
  - [ ] Sub-task: Write tests — test that warm theme uses rounded corners (8px) and clean theme uses sans-serif fonts
  - [ ] Sub-task: Implement — fix any layout or styling issues in non-dark themes
- [ ] Task: Prevent theme flash on page load
  - [ ] Sub-task: Write tests — test that theme init script runs before DOM content (placed in head, not deferred)
  - [ ] Sub-task: Implement — add a blocking script in each page's head that reads localStorage and sets body class before paint
- [ ] Task: Conductor - User Manual Verification 'Visual Verification & Polish' (Protocol in workflow.md)
