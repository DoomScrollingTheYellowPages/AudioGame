# Initial Concept

Zero-dependency browser app for music education — flashcards, music games, and audio/MIDI monitoring. Pure HTML/JS/CSS with native ES modules, Web Audio API, and Web MIDI API. No build system, no package.json.

---

# Product Guide

## Vision

AudioGame is a zero-dependency, browser-based music education platform that helps musicians of all skill levels learn to read, play, and understand music through interactive games and tools. It provides a ubiquitous baseline experience accessible to complete beginners while offering depth for advanced players, with plans for game mode modifiers to further customize difficulty and challenge.

## Core Capabilities

### 1. Sheet Music Reading
Interactive flashcard drills and speed-reading exercises that teach users to identify notes on the staff. Covers all 12 chromatic notes across treble and bass clefs.

### 2. Rhythm & Note Accuracy Game
A Guitar Hero-style music game where notes scroll across a highway and players must hit them in time. Supports input via MIDI controllers, microphone pitch detection, on-screen buttons, and keyboard. Includes built-in songs and custom MIDI file upload.

### 3. Sheet Music to MIDI (OMR) — Planned
An optical music recognition engine intended to convert scanned sheet music images into MIDI data. This feature is not yet functional. The design includes detection of staff lines, clefs, noteheads, accidentals, key signatures, and rhythmic values to produce playable MIDI output.

### 4. MIDI to Sheet Music Export
Converts MIDI files into readable sheet music, exportable as PDF or other standard notation formats.

### 5. Multi-Instrument Support
Designed to support learning across a wide range of instruments, each with its own appropriate notation and fingering representations:
- **Keyboard instruments** (piano, organ, synthesizer) — via MIDI input for direct, precise note detection. Key charts for fingering reference.
- **Wind and brass instruments** (flute, clarinet, saxophone, trumpet, oboe) — via microphone with monophonic pitch detection. Fingering charts per instrument (oboe already implemented).
- **String instruments** (guitar, bass, violin) — via microphone, with future support for polyphonic chord detection. Guitar tab notation for fretted instruments.

Each instrument will include its own visual note representation (fingering diagrams, key charts, tablature, etc.) appropriate to how that instrument is played.

## Target Audience

Musicians of all skill levels:
- **Complete beginners** with no prior music reading or playing experience
- **Early-intermediate players** who can read basic notation but need practice with timing and accuracy
- **Advanced players** seeking sight-reading drills, speed challenges, and complex repertoire

The app provides a universal baseline experience across all modes, with game mode modifiers planned for future customization.

## Platform

Desktop browsers (Chrome, Edge, Firefox) are the primary deployment target. The app requires HTTPS or localhost for Web MIDI access. Mobile and native app support may be added in a future phase.

## Technical Philosophy

- Zero external dependencies — pure HTML, JavaScript, and CSS
- Native ES modules with no build system or bundler
- EventBus pub/sub architecture for clean module decoupling
- Web Audio API for real-time audio capture and pitch detection
- Web MIDI API for hardware instrument input
- Canvas API for all visual rendering (staff notation, highways, keyboards)
