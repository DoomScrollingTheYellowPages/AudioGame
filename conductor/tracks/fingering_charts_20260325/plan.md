# Plan: Multi-Instrument Fingering Charts

## Phase 1: Wind & Brass Fingering Data

- [ ] Task: Create flute fingering data
  - [ ] Sub-task: Write tests — verify primary fingering for C4, D4, E4, F4, G4, A4, B4, C5, D5, C6
  - [ ] Sub-task: Implement — src/fingering/FluteFingeringData.js with complete chromatic range C4–C7
- [ ] Task: Create clarinet fingering data
  - [ ] Sub-task: Write tests — verify primary fingering for E3, G3, C4, E4, G4, C5, E5, G5, C6
  - [ ] Sub-task: Implement — src/fingering/ClarinetFingeringData.js with range E3–C7
- [ ] Task: Create trumpet fingering data
  - [ ] Sub-task: Write tests — verify valve combinations for F#3, C4, E4, G4, Bb4, C5, E5, G5, C6
  - [ ] Sub-task: Implement — src/fingering/TrumpetFingeringData.js with range F#3–C6
- [ ] Task: Create alto saxophone fingering data
  - [ ] Sub-task: Write tests — verify primary fingering for Db3, Eb3, F3, G3, A3, Bb3, C4, D4, E4, A5
  - [ ] Sub-task: Implement — src/fingering/SaxFingeringData.js with range Db3–A5
- [ ] Task: Conductor - User Manual Verification 'Wind & Brass Fingering Data' (Protocol in workflow.md)

## Phase 2: Piano & Guitar Renderers

- [ ] Task: Create piano fingering chart renderer
  - [ ] Sub-task: Write tests — verify highlighted key position for C4, F#4, Bb4
  - [ ] Sub-task: Implement — src/fingering/PianoFingeringRenderer.js showing 2-octave keyboard section with highlighted key
- [ ] Task: Create guitar tab renderer and data
  - [ ] Sub-task: Write tests — verify fret positions for E2, A2, D3, G3, B3, E4 (open strings) and common fretted notes
  - [ ] Sub-task: Implement — src/fingering/GuitarTabData.js and src/fingering/GuitarTabRenderer.js showing 6-string fretboard
- [ ] Task: Conductor - User Manual Verification 'Piano & Guitar Renderers' (Protocol in workflow.md)

## Phase 3: Instrument Selector Integration

- [ ] Task: Add instrument selector to rhythm page view dropdown
  - [ ] Sub-task: Write tests — verify dropdown options include all instruments
  - [ ] Sub-task: Implement — extend the view selector in rhythm.html with flute/clarinet/trumpet/sax/piano/guitar options, wire to appropriate renderer+data in rhythm-main.js
- [ ] Task: Conductor - User Manual Verification 'Instrument Selector Integration' (Protocol in workflow.md)
