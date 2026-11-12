const { spawn } = require("node:child_process");
const path = require("node:path");
const readline = require("node:readline");

// Inside a packaged app the script lives in app.asar.unpacked, because powershell.exe can't read asar.
function scriptPath() {
  return path
    .join(__dirname, "..", "scripts", "foreground-watcher.ps1")
    .replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
}

/**
 * Keeps one PowerShell helper running and remembers the latest foreground window it reported.
 * Restarts the helper (with backoff) if it ever dies.
 */
class ForegroundWatcher {
  constructor({ intervalSeconds = 2 } = {}) {
    this.intervalSeconds = intervalSeconds;
    this.child = null;
    this.latest = null;
    this.latestAt = 0;
    this.stopped = true;
    this.restartDelayMs = 2000;
    this.restartTimer = null;
  }

  start() {
    if (process.platform !== "win32" || !this.stopped) {
      return;
    }
    this.stopped = false;
    this.spawnChild();
  }

  spawnChild() {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-WindowStyle",
        "Hidden",
        "-File",
        scriptPath(),
        "-ParentPid",
        String(process.pid),
        "-IntervalSeconds",
        String(this.intervalSeconds)
      ],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
    );

    this.child = child;
    const lines = readline.createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      try {
        const sample = JSON.parse(line);
        if (!sample.error) {
          this.latest = sample;
          this.latestAt = Date.now();
          this.restartDelayMs = 2000;
        }
      } catch {
        // Ignore partial or non-JSON lines.
      }
    });
    child.stderr.on("data", () => {});

    child.on("exit", () => {
      if (this.child === child) {
        this.child = null;
      }
      if (this.stopped) {
        return;
      }
      this.restartTimer = setTimeout(() => this.spawnChild(), this.restartDelayMs);
      this.restartDelayMs = Math.min(this.restartDelayMs * 2, 60000);
    });
    child.on("error", () => {});
  }

  /** The most recent sample, or null when the helper hasn't reported in a while. */
  current() {
    if (!this.latest || Date.now() - this.latestAt > this.intervalSeconds * 1000 * 5) {
      return null;
    }
    return this.latest;
  }

  get healthy() {
    return this.current() !== null;
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.restartTimer);
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
  }
}

module.exports = { ForegroundWatcher };
