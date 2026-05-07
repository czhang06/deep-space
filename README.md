# Tiny Kingdom Starter Scaffold

This is a Windows-first starter scaffold for the castle productivity app concept:

- `Electron` for the desktop shell
- `React` for the interface
- `Three.js` via React Three Fiber for the castle scene
- mock local activity data for the first pass

## Commands

```bash
npm install
npm run dev
```

The app also works in plain browser preview mode while you build the UI:

```bash
npm run dev:renderer
```

For a production-style local run after building:

```bash
npm run build
npm start
```

## Current Scope

The scaffold includes:

- an Electron window and preload bridge
- a typed castle snapshot model
- a Zustand store that hydrates from Electron IPC
- a live mock kingdom service in Electron that updates every few seconds
- a first 3D castle diorama with moving citizens
- dashboard panels for activity totals and citizen counts
- pause/resume controls and a recent-events log
- a placeholder Chrome extension folder

It does not yet include:

- real Windows idle detection
- active-window tracking
- SQLite persistence
- a browser extension implementation
- asset pipeline integration from Blender

## Suggested Next Steps

1. Replace the mock `getSnapshot` handler in [electron/main.cjs](C:/Users/charl/Documents/Codex/2026-04-22-if-i-want-to-build-a/electron/main.cjs) with a real tracker service.
2. Add SQLite-backed activity blocks and daily summaries.
3. Wire the browser extension to the Electron main process with local IPC or localhost messaging.
4. Replace the placeholder geometry in [src/features/castle/CastleScene.tsx](C:/Users/charl/Documents/Codex/2026-04-22-if-i-want-to-build-a/src/features/castle/CastleScene.tsx) with Blender-exported `glTF` assets.
