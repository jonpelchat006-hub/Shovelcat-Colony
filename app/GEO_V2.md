# GEO V2 Draft

`geo v2` is the next container layer for Shovelcat. It does not replace the current v1 spore file. It sits beside it as the universal object format we can grow into.

## Core Model

- Identity belongs to the full closed loop, not a point.
- The object path is written as quaternion deltas: `w + xi + yj + zk`.
- `w` is phase, time, and closure pressure.
- `x` is form, geometry, and world-state.
- `y` is signal, meaning, and style.
- `z` is dynamics, agency, and causality.
- Media types are projections of that space, not the axes themselves.

## Bubble Field

- A bubble is a closure point, keyframe, or stabilization node.
- Bubbles must be at least one `H-window` apart.
- New bubbles are inserted when path distance, phase drift, curvature, or axis dominance crosses a threshold.
- The origin bubble is required and anchors identity.
- A closed loop ends by returning to origin through a closure bubble.

## Layer Stack

Suggested reserved layers:

- `+2` storage/history
- `+1` code/logic
- `0` display plane
- `-1` sound/resonance
- `-2` text/symbol

The same object can project differently across layers. A visible display bubble can have supporting code/storage depth behind it and sound/text shadows beneath it.

## Tracks

V2 tracks are payload projections, not the identity itself.

- `text`
- `audio`
- `image`
- `video`
- `code`
- `metadata`
- `binary`
- `latent`

The loop gives the object identity. Tracks carry the bytes or references that let the object render, play, or regenerate.

## First Practical Use

A video-shaped object can be modeled as:

- origin bubble with schema, trust, timing, and intent
- display-layer path for visible keyframes
- sound-layer track for audio
- text-layer track for subtitles, metadata, captions
- code/storage layers for receipts, generation hints, and reconstruction state
- closure bubble that seals the loop

## Initial Build Scope

The first implementation in [format-v2.ts](/D:/shovelcat-colony/app/src/geo/format-v2.ts) intentionally stays simple:

- binary header plus JSON payload
- quaternion segments
- threshold-based bubble insertion
- layered tracks
- loop checksum derived from the whole path

That gives us a stable scaffold before chunked media storage, encryption-by-angle, or full generator/deconstructor training are added.
