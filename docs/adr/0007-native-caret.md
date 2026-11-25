# 7. Use the native caret instead of the virtual cursor

Date: 2026-11-25

## Status

Accepted. Applies to the Milkdown plugin only.

## Context

Crepe replaces the browser caret with `prosemirror-virtual-cursor`, an element the plugin moves
after every change. This project also animated it (`transition: left 80ms, top 80ms`), which made
typing feel delayed. The plugin reads the caret position back from the page on each key and each
selection change, forcing a layout, and restarts its blink animation, which keeps the page
drawing frames while the caret is idle.

Two alternatives were measured with `npm run perf` on a 50k character note: keeping the virtual
cursor without the transition, and turning it off (`virtual: false` in the Crepe cursor feature)
with `caret-color` set to the accent color.

| Main thread time per key | Before | Without transition | Native caret |
| ------------------------ | ------ | ------------------ | ------------ |
| Typing                   | 55 ms  | 49 ms              | 36 ms        |
| Arrow keys               | 35 ms  | 28 ms              | 19 ms        |

Latency from keydown to the next frame is the same with either caret once the load on the
renderer is equal. Without it, the native caret read up to 10 ms slower on a desktop with CPU
frequency scaling: the idle frames of the virtual cursor kept the core at a high clock.

## Decision

Use the native caret, colored with `caret-color`.

## Consequences

The arrow keys no longer step between the inside and the outside of an inline code span, and the
caret no longer shows which side it is on. Typing at the end of a code span leaves it, as the mark
is not inclusive; `Mod-e` turns inline code on again. The caret has no glow, and its shape, width
and blink are those of the browser and the system. The drop indicator and the gap cursor of the
same Crepe feature are unchanged.
