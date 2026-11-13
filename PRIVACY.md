# Deep Space Privacy Policy

_Last updated: 12 November 2026_

Deep Space is a desktop app that turns your focused computer time into a growing space station. This policy explains what it looks at, what it keeps, and what it never does. The short version: **everything stays on your computer, and nothing is ever sent anywhere.**

## Who is responsible

Deep Space is a personal project by czhang06. There is no company, server, or account behind it. Questions can be raised as an issue on the project's GitHub repository.

## What the app looks at while it runs

| What | How often | Why |
| --- | --- | --- |
| The name of the app in front (for example `Code` or `chrome`) and its installation folder | Every 2 seconds | To tell work, play and neutral time apart. A game's folder (such as Steam's `steamapps`) marks it as play. |
| The title of the window in front | Every 2 seconds, **in memory only** | For browsers, the site name at the end of the tab title (for example "YouTube") identifies the site. The title is discarded right after. |
| Time since the last mouse or keyboard input | Every 5 seconds | After 5 quiet minutes, time counts as a break. The app gets a single number from Windows. It never sees which keys or buttons you pressed. |
| Whether the screen is locked or the computer is asleep | When it happens | Locked or asleep time counts as a break. |

## What the app stores

Everything is stored in one file on your computer:
`%APPDATA%\Deep Space\data\kingdom.json`

That file holds:

- **Daily totals**: minutes of work, play, break and neutral time per day, for the last 60 days.
- **Per-app and per-site minutes**: for each day, minutes spent per app (for example "Visual Studio Code") or recognised site (for example "YouTube"). Sites the app doesn't recognise are grouped as "Other sites in Chrome", so page titles are never written down.
- **Your rules**: the apps and sites you have told it to count as work, play or neutral.
- **Your settings**: whether it starts with Windows, your daily free play time, and pause state.
- **The station**: a random seed, the station's build progress, whether you're building or upgrading and how far upgrades have got, any aliens currently latched on, the date and time the ship reached each place on its journey (dates for places reached before an update that added the logbook are estimated from your daily totals), and the last few station events (for example "The crew pried Gloop off the hull and sent it drifting.").

## What the app never collects

- Window titles, tab titles, page addresses or browsing history (titles are read in memory and discarded)
- Keystrokes, typed text, mouse clicks or clipboard contents
- Screenshots or screen recordings
- File names or file contents
- Location, camera or microphone (the app denies all such permissions)
- Any personal identifier: no account, no email, no device ID

## Network and third parties

Deep Space makes **no network connections**. It has no analytics, crash reporting, advertising, update checks or telemetry, and it shares nothing with anyone. The app's windows load only from the app's own files and block every other request.

## Your controls

- **Pause**: pause tracking for 30 minutes, an hour, or until you resume, from the tray menu or Settings.
- **Correct**: tell it an app or site is work, play or neutral, and remove those rules at any time.
- **Clear history**: Settings → Privacy → Clear history deletes all daily records and events, keeping your station and rules.
- **Delete everything**: quit the app, uninstall it from Windows Settings → Apps, and delete the `%APPDATA%\Deep Space` folder.
- **Start with Windows**: turn it on or off in Settings or the tray menu.

## Earlier versions

Deep Space was previously called Tiny Kingdom. On its first launch under the new name it copies your station, rules and history from `%APPDATA%\Tiny Kingdom\data` to the new folder. The old folder is left in place, and you can delete it.

The first prototype (version 0.1) stored full window and tab titles in `activity-log.json` and `browser-event-log.json`. Version 0.2 deletes those files the first time it starts.

## Children

Deep Space collects no personal information from anyone, including children.

## Changes

If this policy changes, the new version will be in this file and in the app's Settings → Privacy section, with a new "Last updated" date.
