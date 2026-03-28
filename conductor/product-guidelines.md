# Product Guidelines

## Design System Overview

AudioGame uses a themeable design system with a shared structural base and multiple selectable visual themes. All themes share the same layout, spacing, component structure, and interaction patterns — only colors, fonts, and decorative styling differ.

## Shared Base

### Layout
- CSS Grid/Flexbox for responsive layout
- Inline `<style>` per page — no external stylesheets
- Consistent component spacing and sizing across all pages

### Components
- Canvas-based renderers for game visuals (staff, highway, keyboard)
- Button/input controls with hover transitions (0.2s)
- Score overlays with tier breakdowns and combo displays

### Interaction
- All input methods (MIDI, microphone, keyboard, mouse) available on every game page
- Immediate visual feedback on input (key highlights, hit zone flashes)
- Count-in length equals two bars of the current MIDI file's time signature and tempo

## Themes

### Theme 1: Dark / Techy (Default)
The current established look. Feels like a retro game console or developer tool.
- **Background:** `#0d0d0d`
- **Text:** `#e0e0e0`
- **Accent:** `#00ff88` (green)
- **Error:** `#ff4444`
- **Controls:** `#1a1a1a` bg, `#2a2a2a` border
- **Font:** `'Courier New', monospace`
- **Score tiers:** Perfect `#00ff88`, Great `#88cc44`, Good `#ccaa22`, Miss `#ff4444`

### Theme 2: Warm / Approachable
Softer and friendlier, aimed at making beginners feel comfortable.
- **Background:** `#faf5ef`
- **Text:** `#3a3330`
- **Accent:** `#e8863a` (warm orange)
- **Error:** `#d94444`
- **Controls:** `#f0e8df` bg, `#d9cfc3` border
- **Font:** `'Nunito', 'Segoe UI', sans-serif`
- **Score tiers:** Perfect `#4caf50`, Great `#8bc34a`, Good `#ffc107`, Miss `#d94444`
- **Style notes:** Rounded corners (8px), softer shadows, larger touch targets

### Theme 3: Clean / Professional
Neutral and modern, resembling professional music education software.
- **Background:** `#ffffff`
- **Text:** `#212121`
- **Accent:** `#1976d2` (blue)
- **Error:** `#c62828`
- **Controls:** `#f5f5f5` bg, `#e0e0e0` border
- **Font:** `'Inter', 'Helvetica Neue', sans-serif`
- **Score tiers:** Perfect `#1976d2`, Great `#42a5f5`, Good `#ffa726`, Miss `#c62828`
- **Style notes:** Clean lines, minimal decoration, subtle borders

## Tone & Messaging

The app uses a **playful, gamified tone** across all themes. Language is energetic and celebratory, using achievement-style callouts and combo announcements to keep players engaged.

Examples:
- On correct answer: "Nailed it!", "Combo x4! You're on fire!"
- On streak: "Unstoppable! 20 in a row!"
- On miss: "Oops! That was an F#. Shake it off!"
- On results: "Beast mode! 95% accuracy with a 32-combo streak!"

## Branding

"AudioGame" is the working title. No logo or formal branding is prioritized at this stage — focus remains on functionality and gameplay. Musical iconography and formal branding may be introduced in a future phase.
