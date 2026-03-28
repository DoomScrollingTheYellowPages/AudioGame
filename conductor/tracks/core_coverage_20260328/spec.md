# Spec: EventBus & utils Test Coverage

## Overview

`EventBus.js` is the backbone of the entire AudioGame architecture — all module
communication flows through it. `utils.js` provides `noteName()` used across every
game and display module. Neither has any unit tests. This track adds comprehensive
coverage for both.

## Functional Requirements

### EventBus Tests
1. `on` / `emit`: data delivered to subscriber
2. Multiple subscribers for the same event all receive the data
3. Subscriber for event A does not receive event B emissions
4. `emit` with no subscribers does not throw
5. `emit` without data argument passes `undefined`
6. `off`: unsubscribes a specific handler
7. `off` on nonexistent event does not throw
8. `off` removes one handler but leaves others on the same event
9. `on()` return value (unsubscribe handle) works correctly
10. `clear()` removes all listeners
11. `clear()` + new `on()` works after clear
12. A throwing handler does not prevent other handlers from running (error isolation)
13. Same function reference registered twice is deduped by Set

### utils Tests
1. `noteName(60)` = 'C4'
2. `noteName(69)` = 'A4'
3. `noteName(72)` = 'C5'
4. `noteName(61)` = 'C#4'
5. `noteName(59)` = 'B3'
6. `noteName(12)` = 'C0'
7. `noteName(0)` = 'C-1'
8. `noteName(127)` = 'G9'
9. Pitch class repeats every 12 semitones
10. `timestamp()` returns 'MM:SS.mmm' format string

## Acceptance Criteria

1. `test/core/EventBus.test.js` with ≥ 13 passing tests
2. `test/core/utils.test.js` with ≥ 10 passing tests
3. All existing tests continue to pass
