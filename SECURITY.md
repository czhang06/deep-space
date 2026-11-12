# Security

## Reporting a problem

Please open a GitHub issue titled "Security" without exploit details, and I'll arrange a private way to share them. Tiny Kingdom is a hobby project, so fixes are best-effort.

## How the app is locked down

Tiny Kingdom watches which app is in front, so it should be hard to misuse. The design:

**No network surface**
- The UI is served from a custom `app://` protocol, not a local web server, so the app opens no ports.
- Every request that isn't the app's own files is blocked at the session level.
- There are no update checks, analytics or remote content.

**Renderer isolation** (Electron security checklist)
- `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true` on every window, plus `app.enableSandbox()`.
- A strict Content-Security-Policy on every page: scripts only from the app itself, no `eval`, no plugins, no framing, no form submissions.
- New windows are denied, navigation away from the app is blocked, `<webview>` is blocked, and DevTools are disabled in the installed app.
- All permission requests (camera, microphone, notifications, clipboard, …) are denied.
- The `app://` scheme is registered without `supportFetchAPI`/`corsEnabled`, avoiding the cross-origin read issue in older Electron releases. Electron is kept on a supported, patched major version.

**A narrow bridge**
- The preload script exposes a fixed set of named functions, never `ipcRenderer` itself.
- Every IPC handler checks that the call came from one of the app's own pages, and validates its arguments (types, allowed values, length limits) before acting.

**Tracking helper**
- Foreground-window sampling runs in one hidden, long-lived PowerShell process started with `-NoProfile -NonInteractive`. It only reads (`GetForegroundWindow`, `GetWindowText`, process name and path), and it exits as soon as the app does.
- Window titles stay in memory. Only per-app and recognised-site minutes are written to disk. See [PRIVACY.md](PRIVACY.md).

**Data on disk**
- One JSON file under `%APPDATA%\Tiny Kingdom\data`, written atomically (temp file + rename) so a crash can't corrupt it.
- Old prototype logs that held window titles are deleted on first launch.

## Known limitations

- The installer is not code-signed, so Windows SmartScreen will warn the first time you run it ("More info" → "Run anyway"). Signing needs a paid certificate.
- `npm audit` reports a moderate ReDoS in `minimatch`, which electron-builder uses **at build time only**. It isn't part of the installed app.
