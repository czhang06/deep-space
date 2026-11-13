// Keeps Deep Space up to date from the GitHub releases of czhang06/deep-space.
//
// electron-updater reads latest.yml from the newest release, downloads the installer over HTTPS
// in the background, checks it against the SHA-512 in latest.yml, and installs it silently the
// next time the app quits (or right away if you choose "Restart and update"). It makes its
// requests on its own session, so the app windows stay locked to their own files.
// Only the installed app updates; a development copy just reports that it can't.

const { app } = require("electron");

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const FIRST_CHECK_AFTER_MS = 20 * 1000;

function createUpdater({ log, onStatus, isEnabled }) {
  /** @type {{ state: string, version?: string, percent?: number, message?: string, checkedAt?: number }} */
  let status = { state: app.isPackaged ? "idle" : "unavailable" };
  let timer = null;
  let firstTimer = null;
  let autoUpdater = null;

  const set = (next) => {
    status = { ...next, checkedAt: next.checkedAt ?? status.checkedAt };
    onStatus(status);
  };

  function load() {
    if (autoUpdater || !app.isPackaged) {
      return autoUpdater;
    }
    ({ autoUpdater } = require("electron-updater"));
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;
    autoUpdater.logger = {
      info: (message) => log("updater", String(message)),
      warn: (message) => log("updater warning", String(message)),
      error: (message) => log("updater error", String(message)),
      debug: () => {}
    };
    autoUpdater.on("checking-for-update", () => set({ state: "checking" }));
    autoUpdater.on("update-available", (info) => set({ state: "downloading", version: info.version, percent: 0 }));
    autoUpdater.on("update-not-available", () => set({ state: "current", checkedAt: Date.now() }));
    autoUpdater.on("download-progress", (progress) => set({ ...status, state: "downloading", percent: Math.round(progress.percent) }));
    autoUpdater.on("update-downloaded", (info) => set({ state: "ready", version: info.version, checkedAt: Date.now() }));
    autoUpdater.on("error", (error) => {
      // Offline, GitHub unreachable, no release yet: not worth alarming anyone about.
      log("updater failed", error?.message ?? String(error));
      set({ state: "error", message: "Couldn't check for updates. It will try again later.", checkedAt: Date.now() });
    });
    return autoUpdater;
  }

  function check() {
    const updater = load();
    if (!updater) {
      set({ state: "unavailable" });
      return;
    }
    if (status.state === "checking" || status.state === "downloading" || status.state === "ready") {
      return;
    }
    updater.checkForUpdates().catch(() => {}); // failures arrive through the "error" event
  }

  function start() {
    stop();
    if (!app.isPackaged) {
      return;
    }
    firstTimer = setTimeout(() => isEnabled() && check(), FIRST_CHECK_AFTER_MS);
    timer = setInterval(() => isEnabled() && check(), CHECK_EVERY_MS);
  }

  function stop() {
    clearTimeout(firstTimer);
    clearInterval(timer);
    firstTimer = null;
    timer = null;
  }

  /** Quits and installs a downloaded update, then reopens the app. */
  function installNow() {
    if (status.state === "ready" && autoUpdater) {
      autoUpdater.quitAndInstall(true, true);
    }
  }

  return { check, start, stop, installNow, status: () => status };
}

module.exports = { createUpdater };
