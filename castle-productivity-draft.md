# Castle Productivity App Draft

## Working Title

Castlekeeper

## One-Sentence Pitch

A Windows desktop app that turns your computer activity into a living medieval castle, where focused work recruits builders, long idle stretches attract drifters, and games or distracting sessions bring in rogues who interfere with progress.

## Product Direction

This should feel like a playful local desktop companion, not a surveillance tool and not a harsh productivity judge.

The main fantasy:

- Your day shapes the castle.
- Work grows the settlement.
- Rest is allowed and can be healthy.
- Too much chaos creates funny trouble, not shame.

The visual direction is medieval, cozy, and slightly mischievous, with pixel-ish 3D presentation rather than realistic graphics.

## MVP Goal

Build a Windows-only app that:

- tracks idle time
- tracks the active desktop app/window
- classifies time into `work`, `play`, or `idle`
- reads browser tab categories through a browser extension
- updates a simple 3D castle scene locally
- stores all data on-device

The first release does not need:

- cloud sync
- accounts
- multiplayer
- deep simulation
- advanced punishments
- keystroke logging

## Core User Loop

1. The app runs locally in the tray/background.
2. It samples current context every few seconds.
3. Time is grouped into small blocks, such as 5-minute slices.
4. Each block is classified as `work`, `play`, or `idle`.
5. Every few blocks, the sim resolves outcomes:
   - work adds productive citizens
   - idle adds neutral citizens
   - play adds disruptive citizens
6. The castle visibly changes over the day.
7. The user opens the app to see what kind of settlement they created.

## Activity Model

The app should use the minimum tracking needed to support the fantasy.

### Inputs

- system idle time
- active foreground app/window title
- browser domain or category from an extension

### Explicitly Out of Scope

- keylogging
- reading typed content
- full browsing history import
- screenshots
- screen recording

## Classification Model

The MVP should keep classification simple and editable.

### Base States

- `idle`
- `work`
- `play`
- `unknown`

### How Classification Works

If system idle time exceeds a threshold, classify as `idle`.

Otherwise:

- if the active app matches a known work app, classify as `work`
- if the active app matches a known game or entertainment app, classify as `play`
- if the active app is a browser, ask the browser extension for the current tab category
- if no rule matches, classify as `unknown` and treat it conservatively

### Example Rules

`work`

- VS Code
- Cursor
- Visual Studio
- Terminal
- Notion
- Figma
- Google Docs
- GitHub
- documentation sites

`play`

- Steam games
- Battle.net games
- Discord during non-work category usage
- YouTube
- Twitch
- Reddit
- social media

`idle`

- no input beyond threshold

`unknown`

- uncategorized apps
- browser tabs with no known category

### Recommendation

Treat `unknown` as neutral at first. It is better to under-classify than to make the app feel wrong or creepy.

## Browser Category Strategy

Use a lightweight Chrome extension first.

The extension should only send:

- current tab domain
- tab title
- a local category label
- timestamps

The desktop app should categorize by a small local ruleset:

- docs/dev tools -> `work`
- streaming/video/social -> `play`
- everything else -> `unknown`

For privacy, raw URLs should be avoided when possible. Prefer storing:

- domain
- top-level page label if needed
- category result

## Game Design

The game should reward patterns more than punish them.

### Initial Citizens

- `Builder`
  - created by sustained `work`
  - increases castle progress
- `Drifter`
  - created by sustained `idle`
  - harmless, wanders the castle
- `Rogue`
  - created by sustained `play`
  - distracts builders and lowers build efficiency

### Basic Sim Stats

- `Build`
  - determines structure progress
- `Order`
  - reduces rogue disruption
- `Morale`
  - small boost from balanced days and healthy breaks

### Simple Rules

- 3 hours of `work` in a day -> +1 `Builder`
- 3 hours of `idle` in a day -> +1 `Drifter`
- 3 hours of `play` in a day -> +1 `Rogue`
- each `Builder` adds build progress daily
- each `Rogue` reduces builder efficiency
- `Drifters` are mostly cosmetic in MVP

### Important Balance Note

Do not make one evening of gaming wreck the castle. Chaos should be visible and funny before it becomes frustrating.

## 3D Visual Direction

Use Three.js with a stylized low-poly scene and pixel-friendly rendering choices.

### Suggested Look

- low-poly medieval buildings
- small terrain chunk or diorama
- nearest-neighbor pixel textures
- reduced render resolution upscaled to create a pixel-ish feel
- simple day/night lighting
- tiny looping walk/build/idling animations

### Why This Works

This gets close to "medieval pixel-ish 3D" without needing a full voxel engine.

### First Scene

The initial MVP scene can be:

- one keep
- one path
- one scaffolded construction site
- a few roaming citizens
- simple labels or icon bubbles over characters

## Recommended Tech Stack

### Desktop App

- Electron
- TypeScript
- React
- Vite

### 3D Layer

- Three.js
- React Three Fiber
- Drei

### State / App Logic

- Zustand for UI and sim state
- Electron IPC for main/renderer communication

### Storage

- SQLite
- Drizzle ORM or a thin handwritten repository layer

### Windows Activity Tracking

- Electron for shell/tray/windowing
- native Windows helper for foreground window and idle state
- browser extension for tab category signals

### Art Pipeline

- Blender for models and simple animations
- glTF for exported assets
- Aseprite or similar for textures if you want stronger pixel-art control

## Recommended Package Breakdown

### Electron Main Process

Responsibilities:

- app lifecycle
- system tray
- window creation
- IPC
- activity polling
- database writes
- integration with Windows helper process

### React Renderer

Responsibilities:

- dashboard
- settings
- timeline view
- embedding the Three.js castle scene

### Simulation Engine

Responsibilities:

- translate activity blocks into daily totals
- resolve totals into citizens and state changes
- apply ongoing effects like rogue disruption
- output render-friendly world state

### Browser Extension

Responsibilities:

- detect active tab changes
- send domain/title/category to local app
- allow per-domain override later

## Proposed App Structure

```text
castlekeeper/
  electron/
    main/
      ipc/
      tracking/
      db/
      native/
    preload/
  src/
    app/
    components/
    features/
      dashboard/
      castle/
      settings/
      history/
    sim/
    store/
    lib/
  extension/
    chrome/
  assets/
    models/
    textures/
    audio/
  docs/
```

## Data Model Draft

### activity_blocks

- `id`
- `started_at`
- `ended_at`
- `source_type` (`desktop_app`, `browser_tab`, `idle`)
- `app_name`
- `window_title`
- `domain`
- `category` (`work`, `play`, `idle`, `unknown`)
- `confidence`

### daily_summaries

- `date`
- `work_minutes`
- `play_minutes`
- `idle_minutes`
- `unknown_minutes`

### citizens

- `id`
- `type` (`builder`, `drifter`, `rogue`)
- `created_at`
- `status`
- `x`
- `z`

### castle_state

- `level`
- `build_progress`
- `order_score`
- `morale_score`
- `last_resolved_at`

### classification_rules

- `id`
- `rule_type` (`app`, `domain`)
- `pattern`
- `category`
- `is_user_override`

## Privacy Principles

This should be a strong part of the product.

- local-first by default
- no account required
- no content capture
- no keystroke logging
- no screenshots
- clear settings that show exactly what is tracked
- easy pause button in tray
- easy per-app and per-domain exclusions

Recommended product language:

"Tracks app names, idle time, and optional browser categories on this device only."

## MVP Screens

### Main Castle Screen

- 3D castle view
- current population counts
- today's classification summary

### Activity Summary

- work/play/idle bars for today
- top apps
- browser category summary

### Settings

- idle threshold
- app overrides
- domain overrides
- privacy toggles
- pause tracking

## Technical Risks

### 1. Classification Accuracy

Users will lose trust quickly if the app mislabels too much.

Mitigation:

- ship with a tiny high-confidence ruleset
- allow manual overrides early
- treat unknown as neutral

### 2. Browser Integration Friction

Extension install adds setup friction.

Mitigation:

- make browser support optional for the first run
- app still works with desktop app detection only

### 3. 3D Scope Creep

A beautiful castle can swallow the whole project.

Mitigation:

- keep first environment tiny
- use simple loops and low character counts
- ship placeholder art early

### 4. Native Windows Tracking Complexity

Foreground app and idle state are easy conceptually but can get messy in production.

Mitigation:

- target Windows only first
- isolate tracking in one module
- keep a polling architecture rather than event-heavy complexity

## First Milestone Plan

### Milestone 1: Local Tracker

- Electron app launches
- tray icon works
- active window is sampled
- idle time is sampled
- activity blocks are written to SQLite

### Milestone 2: Classification

- rules map apps/domains to `work`, `play`, `idle`, `unknown`
- browser extension sends tab context
- daily summary screen renders real local data

### Milestone 3: Castle Prototype

- Three.js scene loads
- citizens spawn from local summary data
- builders, drifters, and rogues move in simple loops

### Milestone 4: Sim Resolution

- build progress changes over time
- rogues affect builder output
- castle visibly upgrades from simple thresholds

### Milestone 5: Settings and Trust

- pause tracking
- exclusions
- category overrides
- privacy explainer

## What I Would Change From the Original Idea

I would make two small design changes for the first version:

### 1. "Play" should not always mean "bad"

For MVP, keep the `Rogue` fantasy because it is readable. But in later versions, some play sessions should create positive or mixed outcomes too, especially if the user has already had a productive day.

### 2. Breaks should eventually become useful

Right now `idle` creates `Drifters`, which is fine for MVP. Later, some healthy breaks should improve morale instead of only creating neutral citizens.

## My Recommendation

Build this as a desktop app with a small game inside it, not as a full game pretending to be a productivity app.

That means:

- prioritize trustworthy tracking first
- keep the sim tiny and readable
- keep the 3D scene cheap and charming
- make the castle feel responsive within the first day of use

## Immediate Next Step

Start by drafting the codebase as four working parts:

1. Electron shell
2. activity tracker
3. SQLite-backed classification pipeline
4. React + Three.js castle scene

Once those exist, the rest of the idea becomes much easier to iterate.
