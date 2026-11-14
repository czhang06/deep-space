# Deep Space

A dark grey battleship that lives in your Windows system tray and grows while you focus.

Focused work adds to the ship: hull sections behind an armoured prow, escort ships docked along the flanks (each with forward needle banks, terraced a deck above or below their neighbours), city blocks that grow taller, small "sky hulls" raised on pylons, stepped command towers, spires, lattice masts, needle arrays, keel spires hanging underneath, turrets, broadside batteries and hangars. Over time it reads less like one ship and more like a floating city. It grows wider as well as longer, keeping roughly a 1.6:1 outline that tapers to the bow, and the two flanks fill unevenly so it never looks stamped out. Hulls carry procedural armour plating, and needles come in dense round sheaves. As it grows, the ship also gets faster: it drifts out through the solar system from Mercury to Pluto, then leaves for nearby stars (Alpha Centauri, Sirius, Betelgeuse), the Pleiades, the Orion and Crab nebulae and the galactic core, then other galaxies (the Magellanic Cloud, Andromeda, Triangulum, the Whirlpool, the Sombrero), and finally an endless deep field of distant galaxies. A Next stop bar shows how close the next place is, the Logbook lists every place the ship has passed (with the date it got there) and the next few ahead, and a Windows notification marks each arrival. **This week** charts your focus per day against last week, with focused days, best day, places reached and where the time went, and a Monday-morning notification sums up the week before (both notifications can be turned off in Settings). The status bar shows the speed (fractions of light speed up to millions of times it) and the distance from Earth, from km to billions of light years.

Flip to **Upgrade mode** (popup, Settings or tray menu) and focused work levels up the modules you already have instead, Clash-of-Clans style: the bridge goes first, then upgrades ripple outward, and nothing reaches the next level until everything closer in has the current one. Click a module in the main window to see its level and pick it to upgrade next. A new hull section takes about 15 focused minutes to build and about 30 more to take through all five levels. When everything is maxed it switches back to building.

Breaks cost nothing. Play is free up to a daily allowance; past that, aliens latch onto the hull, scorch it and slow construction until more work repairs the damage and pries them off.

Everything runs locally. See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

## Using it

- **Install**: run `release/Deep Space Setup <version>.exe`. It installs for your user only and adds a desktop shortcut and a Start-menu entry.
- **Tray**: click the ship icon by the clock for a quick look. Right-click it to pause, toggle "Start with Windows", or quit.
- **Main window**: the desktop shortcut, or the expand button in the popup, opens the full view. Closing it keeps the app running in the tray.
- **Wrong category?** "Right now" shows what's in front. Click Work, Play or Neutral to always count that app or site that way.

## How it decides

1. Your own rules
2. Known apps (editors, terminals, Office → work; game launchers → play; Spotify, Discord, Slack → neutral)
3. Anything installed in a game library folder (Steam, Epic, Riot, …) → play
4. Browsers: the site name browsers put at the end of the tab title ("… - YouTube", "GitHub - …")
5. Everything else → neutral

A new category has to hold for a minute before it counts, so a quick alt-tab doesn't flip anything. Five minutes without input, or a locked screen, counts as a break.

## How the ship grows

The ship is generated from a fixed seed and a design preset (`src/station/designs.ts`: outline ratio, bow taper, which structures it favours, escort classes, colours and finish). Each step adds a hull section, an escort on a free flank slot, or a structure on a free deck; the generator keeps the average width in step with the length so it fills out sideways instead of only getting longer. The plan is deterministic, so the ship is rebuilt exactly from `(seed, build points)` and never reshuffles. One build point is one focused minute (1.5× once a streak passes 25 minutes), and later modules cost a little more. Every 10 finished steps moves the ship on to the next planet. Upgrades are derived the same way: the app logs where building stood each time you enter upgrade mode and each module you pick, so replaying that log gives identical levels.

## Updates

The installed app checks this repo's GitHub releases every few hours and installs new versions when it next restarts (Settings > Updates, or the tray menu). To publish a release: bump the version in `package.json`, commit, set `GH_TOKEN` to a GitHub token that can write this repo's contents, and run `npm run release`. It checks, tests and builds, tags the commit `v<version>` and pushes the tag (GitHub only publishes releases for existing tags), then electron-builder uploads the installer and `latest.yml`. `npm run dist` builds locally without publishing.

## Development

```bash
npm install
npm run dev            # Vite + Electron with live reload
npm run dev:renderer   # UI only, in a browser, with sample data
npm test               # classifier, simulation and generator tests
npm run check          # TypeScript
npm run dist           # tests + build + Windows installer in release/ (never publishes)
npm run release        # same, then publishes a GitHub release (needs GH_TOKEN)
```

Browser-preview knobs: `?points=900&damage=1&aliens=2&grow=5&mode=upgrade&upgrade=700` (`grow` adds points every second), `?design=gothic` (other presets: raft, wedge, crown), `?still` (no auto-rotate), `?bare` (hide the cards).

| Path | What |
| --- | --- |
| `electron/main.cjs` | Tray, popup and main windows, `app://` protocol, security hardening, IPC |
| `electron/services/` | Foreground watcher, classifier, simulation, storage |
| `src/station/` | Part catalog, design presets, ship generator, upgrade planner, 3D parts and upgrade tiers, solar-system journey, scene |
| `src/ui/` | Popup, main window, settings |
| `scripts/make-icons.mjs` | Draws the app and tray icons |
