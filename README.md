# Tiny Kingdom

A little space station that lives in your Windows system tray and grows while you focus.

Focused work snaps new modules onto the station: corridors, hab nodes that stack into towers, lab modules, docking ports with shuttles, observatories, solar arrays, greenhouse domes, comms dishes and, later on, spinning ring habitats. As it grows, the station drifts outward through the solar system, past Mercury, Venus, Earth and Mars out to Jupiter, Saturn, Uranus, Neptune and Pluto, then starts another lap.

Breaks cost nothing. Play is free up to a daily allowance; past that, aliens latch onto the hull, scorch it and slow construction until more work repairs the damage and pries them off.

Everything runs locally. See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

## Using it

- **Install**: run `release/Tiny Kingdom Setup <version>.exe`. It installs for your user only and adds a desktop shortcut and a Start-menu entry.
- **Tray**: click the station icon by the clock for a quick look. Right-click it to pause, toggle "Start with Windows", or quit.
- **Main window**: the desktop shortcut, or the expand button in the popup, opens the full view. Closing it keeps the app running in the tray.
- **Wrong category?** "Right now" shows what's in front. Click Work, Play or Neutral to always count that app or site that way.

## How it decides

1. Your own rules
2. Known apps (editors, terminals, Office → work; game launchers → play; Spotify, Discord, Slack → neutral)
3. Anything installed in a game library folder (Steam, Epic, Riot, …) → play
4. Browsers: the site name browsers put at the end of the tab title ("… - YouTube", "GitHub - …")
5. Everything else → neutral

A new category has to hold for a minute before it counts, so a quick alt-tab doesn't flip anything. Five minutes without input, or a locked screen, counts as a break.

## How the station grows

The station is generated jigsaw-style from a fixed seed. Every module has docking ports (corridor ends, node sides, side mounts), and each new module snaps onto an open port whose pool allows it. Some steps add a deck to a hab node or the command core instead. The plan is deterministic, so the station is rebuilt exactly from `(seed, build points)` and never reshuffles. One build point is one focused minute (1.5× once a streak passes 25 minutes), and later modules cost more. Every 10 finished steps moves the station on to the next planet.

## Development

```bash
npm install
npm run dev            # Vite + Electron with live reload
npm run dev:renderer   # UI only, in a browser, with sample data
npm test               # classifier, simulation and generator tests
npm run check          # TypeScript
npm run dist           # tests + build + Windows installer in release/
```

Browser-preview knobs: `?points=900&damage=1&aliens=2&grow=5` (`grow` adds points every second).

| Path | What |
| --- | --- |
| `electron/main.cjs` | Tray, popup and main windows, `app://` protocol, security hardening, IPC |
| `electron/services/` | Foreground watcher, classifier, simulation, storage |
| `src/station/` | Module catalog, jigsaw generator, 3D modules, solar-system journey, scene |
| `src/ui/` | Popup, main window, settings |
| `scripts/make-icons.mjs` | Draws the app and tray icons |
