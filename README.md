# Tiny Kingdom

A little castle that lives in your Windows system tray and grows while you focus.

Focused work hires builders, who snap new pieces onto the castle: walls, round towers, gatehouses, great halls, chapels, cottages and gardens, and they raise towers storey by storey over time. Breaks cost nothing. Play is free up to a daily allowance; past that, rogues sneak in, slow the builders and knock things over until more work chases them out.

Everything runs locally. See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

## Using it

- **Install**: run `release/Tiny Kingdom Setup <version>.exe`. It installs for your user only and adds a desktop shortcut and a Start-menu entry.
- **Tray**: click the castle icon by the clock for a quick look. Right-click it to pause, toggle "Start with Windows", or quit.
- **Main window**: the desktop shortcut, or the expand button in the popup, opens the full view. Closing it keeps the app running in the tray.
- **Wrong category?** In the popup or main window, "Right now" shows what's in front. Click Work, Play or Neutral to always count that app or site that way.

## How it decides

1. Your own rules
2. Known apps (editors, terminals, Office → work; game launchers → play; Spotify, Discord, Slack → neutral)
3. Anything installed in a game library folder (Steam, Epic, Riot, …) → play
4. Browsers: the site name browsers put at the end of the tab title ("… - YouTube", "GitHub - …")
5. Everything else → neutral

A new category has to hold for a minute before it counts, so a quick alt-tab doesn't flip anything. Five minutes without input, or a locked screen, counts as a break.

## How the castle grows

The castle is generated jigsaw-style from a fixed seed: every piece has connectors (wall ends, tower sides, yard edges), and each new piece snaps onto an open connector whose pool allows it. Some steps raise an existing tower or the keep by a storey instead. The plan is deterministic, so the castle is rebuilt exactly from `(seed, build points)` and never reshuffles. One build point is one focused minute (1.5× once a streak passes 25 minutes), and later pieces cost more.

## Development

```bash
npm install
npm run dev            # Vite + Electron with live reload
npm run dev:renderer   # UI only, in a browser, with sample data
npm test               # classifier, simulation and generator tests
npm run check          # TypeScript
npm run dist           # tests + build + Windows installer in release/
```

Browser-preview knobs: `?points=900&damage=1&rogues=2&hour=20&grow=5` (`grow` adds points every second).

| Path | What |
| --- | --- |
| `electron/main.cjs` | Tray, popup and main windows, `app://` protocol, security hardening, IPC |
| `electron/services/` | Foreground watcher, classifier, simulation, storage |
| `src/castle/` | Piece catalog, jigsaw generator, 3D models, citizens, scene |
| `src/ui/` | Popup, main window, settings |
| `scripts/make-icons.mjs` | Draws the app and tray icons |
