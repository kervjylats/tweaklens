# TweakLens Roadmap

## Tier A — Working Loop (DONE)
The core annotate → export → AI-implements pipeline.

- [x] Overlay drawing (box drag)
- [x] Stamp new widgets (button, text, card, input)
- [x] Sidebar form (action, text, color, notes)
- [x] Batch prompt builder
- [x] Copy to clipboard
- [x] Mobile / Tablet / Desktop viewports

## Tier B — Source-Aware Targeting (DONE)
The AI edits the *exact* element, not a guess.

- [x] Element inspector — pick any element in the running app
- [x] IPC bridge — webview preload sends messages to host
- [x] Auto-draw box over picked element (from its bounding rect)
- [x] React fiber `_debugSource` auto-detect (file:line)
- [x] `data-tl` semantic tags (component-level fallback)
- [x] Current computed styles captured (before-state for the AI)
- [x] Rules preamble in exported prompt (design system + gates)

## Tier C — Future Enhancements
The "Figma/FlutterFlow-like" layer.

- [x] **Responsive intent** — device presets encode real px, DPR, touch, UA; annotations tagged per-device
- [x] **Multi-frame** — Wall view renders all devices simultaneously; annotate on any device
- [ ] **Live preview** — apply tweaks in the running app before exporting
- [ ] **Style diff** — before/after side-by-side in the sidebar
- [ ] **Component reuse** — detect repeated patterns and suggest a shared component
- [ ] **Undo/redo** — step back through annotation history
