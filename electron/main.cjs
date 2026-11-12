const fs = require("node:fs");
const path = require("node:path");
const {
  BrowserWindow,
  Menu,
  Tray,
  app,
  ipcMain,
  nativeImage,
  powerMonitor,
  protocol,
  screen,
  session,
  shell
} = require("electron");
const { KingdomService } = require("./services/kingdom-service.cjs");

const APP_NAME = "Tiny Kingdom";
const APP_ID = "com.czhang.tinykingdom";
const DEV_URL = process.env.VITE_DEV_SERVER_URL || "";
const IS_DEV = Boolean(DEV_URL) && !app.isPackaged;
const STARTED_HIDDEN = process.argv.includes("--hidden");
const SCHEME = "app";
const APP_ORIGIN = `${SCHEME}://tiny`;
const DIST_DIR = path.join(__dirname, "..", "dist");
const ASSETS = path.join(__dirname, "assets");
const POPUP_SIZE = { width: 380, height: 600 };

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2"
};

// Locked-down content policy for the app's own pages. Nothing is loaded from the network.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join("; ");

/** Tiny local log for errors and startup events (never activity data). Kept under 256 KB. */
function log(...parts) {
  try {
    const file = path.join(app.getPath("userData"), "logs", "main.log");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file) && fs.statSync(file).size > 256 * 1024) {
      fs.renameSync(file, `${file}.old`);
    }
    const text = parts.map((part) => (part instanceof Error ? part.stack : typeof part === "string" ? part : JSON.stringify(part))).join(" ");
    fs.appendFileSync(file, `${new Date().toISOString()} ${text}\n`);
  } catch {
    // Logging must never break the app.
  }
}

process.on("uncaughtException", (error) => log("uncaught", error));
process.on("unhandledRejection", (error) => log("unhandled rejection", error));

app.setName(APP_NAME);
app.setAppUserModelId(APP_ID);
app.enableSandbox();

// Only one copy runs; launching again (e.g. from the desktop shortcut) opens the existing window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  protocol.registerSchemesAsPrivileged([
    // No supportFetchAPI/corsEnabled: the page never fetches, and leaving them off keeps
    // other origins from reading app:// responses.
    { scheme: SCHEME, privileges: { standard: true, secure: true } }
  ]);
  main();
}

function main() {
  /** @type {KingdomService} */
  let kingdom;
  /** @type {Tray} */
  let tray;
  /** @type {BrowserWindow | null} */
  let mainWindow = null;
  /** @type {BrowserWindow | null} */
  let popup = null;
  let popupHiddenAt = 0;
  let quitting = false;
  let menuKey = "";

  app.on("second-instance", () => showMain());

  app.whenReady().then(() => {
    log("start", { version: app.getVersion(), packaged: app.isPackaged, hidden: STARTED_HIDDEN });
    serveAppFiles();
    lockDownSession();

    kingdom = new KingdomService({
      dataDir: path.join(app.getPath("userData"), "data"),
      getIdleSeconds: () => powerMonitor.getSystemIdleTime()
    });
    kingdom.on("snapshot", (snapshot) => {
      for (const window of [mainWindow, popup]) {
        if (window && !window.isDestroyed()) {
          window.webContents.send("kingdom:snapshot", snapshot);
        }
      }
      updateTray(snapshot);
    });

    powerMonitor.on("lock-screen", () => kingdom.setLocked(true));
    powerMonitor.on("unlock-screen", () => kingdom.setLocked(false));
    powerMonitor.on("suspend", () => kingdom.setLocked(true));
    powerMonitor.on("resume", () => kingdom.setLocked(false));

    registerIpc();
    createTray();
    syncLoginItem(kingdom.getSnapshot().settings.openAtLogin);
    kingdom.start();

    if (!STARTED_HIDDEN) {
      showMain();
    }

    if (process.env.TK_CAPTURE_DIR && !app.isPackaged) {
      require("./dev-capture.cjs")({
        app,
        getWindows: () => ({ mainWindow, popup }),
        showPopup: () => {
          popupHiddenAt = 0;
          togglePopup();
        }
      });
    }
  }).catch((error) => log("startup failed", error));

  // Closing windows keeps the app in the tray; only "Quit" from the tray menu exits.
  app.on("window-all-closed", () => {});
  app.on("before-quit", () => {
    quitting = true;
    kingdom?.stop();
  });

  // ---- serving the UI ----------------------------------------------------------------

  function serveAppFiles() {
    protocol.handle(SCHEME, async (request) => {
      const { pathname } = new URL(request.url);
      const relative = decodeURIComponent(pathname).replace(/^\/+/, "") || "index.html";
      const filePath = path.resolve(DIST_DIR, relative);
      if (!filePath.startsWith(DIST_DIR + path.sep) || !fs.existsSync(filePath)) {
        return new Response("Not found", { status: 404 });
      }
      const body = await fs.promises.readFile(filePath);
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
          "Content-Security-Policy": CSP,
          "X-Content-Type-Options": "nosniff"
        }
      });
    });
  }

  function pageUrl(view) {
    const base = IS_DEV ? DEV_URL.replace(/\/$/, "") : APP_ORIGIN;
    return `${base}/index.html${view === "popup" ? "#popup" : ""}`;
  }

  function isAppUrl(url) {
    try {
      // Node reports the origin of custom schemes as "null", so compare scheme and host.
      const parsed = new URL(url);
      if (parsed.protocol === `${SCHEME}:` && parsed.host === "tiny") {
        return true;
      }
      return IS_DEV && parsed.origin === new URL(DEV_URL).origin;
    } catch {
      return false;
    }
  }

  function lockDownSession() {
    const appSession = session.defaultSession;
    // The app needs no camera, microphone, notifications, clipboard or anything else.
    appSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    appSession.setPermissionCheckHandler(() => false);
    // Block every request that isn't the app's own files (or the dev server while developing).
    appSession.webRequest.onBeforeRequest((details, callback) => {
      const allowed =
        details.url.startsWith(`${APP_ORIGIN}/`) ||
        details.url.startsWith("devtools://") ||
        details.url.startsWith("data:") ||
        details.url.startsWith("blob:") ||
        (IS_DEV && (details.url.startsWith(DEV_URL) || details.url.startsWith(DEV_URL.replace(/^http/, "ws"))));
      callback({ cancel: !allowed });
    });
  }

  function hardenWindow(window) {
    const contents = window.webContents;
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    contents.on("will-navigate", (event, url) => {
      if (!isAppUrl(url)) {
        event.preventDefault();
      }
    });
    contents.on("will-attach-webview", (event) => event.preventDefault());
    contents.on("render-process-gone", (_event, details) => log("renderer gone", details));
    contents.on("did-fail-load", (_event, code, description) => log("page failed to load", { code, description }));
    if (!IS_DEV) {
      contents.on("devtools-opened", () => contents.closeDevTools());
    }
  }

  const webPreferences = () => ({
    preload: path.join(__dirname, "preload.cjs"),
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    webSecurity: true,
    spellcheck: false,
    devTools: IS_DEV
  });

  // ---- windows ------------------------------------------------------------------------

  function showMain() {
    if (popup?.isVisible()) {
      popup.hide();
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
      return;
    }

    mainWindow = new BrowserWindow({
      width: 1280,
      height: 820,
      minWidth: 820,
      minHeight: 600,
      show: false,
      title: APP_NAME,
      icon: path.join(ASSETS, "icon.png"),
      backgroundColor: "#a8d3ee",
      autoHideMenuBar: true,
      webPreferences: webPreferences()
    });
    mainWindow.removeMenu();
    hardenWindow(mainWindow);
    mainWindow.once("ready-to-show", () => mainWindow?.show());
    mainWindow.on("close", (event) => {
      if (!quitting) {
        event.preventDefault();
        mainWindow?.hide();
      }
    });
    mainWindow.on("closed", () => {
      mainWindow = null;
    });
    void mainWindow.loadURL(pageUrl("main"));
  }

  function createPopup() {
    popup = new BrowserWindow({
      ...POPUP_SIZE,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      title: APP_NAME,
      webPreferences: webPreferences()
    });
    hardenWindow(popup);
    popup.on("blur", () => {
      if (popup && !popup.webContents.isDevToolsOpened()) {
        popup.hide();
        popupHiddenAt = Date.now();
      }
    });
    popup.on("closed", () => {
      popup = null;
    });
    void popup.loadURL(pageUrl("popup"));
  }

  /** Puts the popup next to the tray icon, wherever the taskbar is. */
  function positionPopup() {
    const trayBounds = tray.getBounds();
    const anchor = { x: Math.round(trayBounds.x + trayBounds.width / 2), y: Math.round(trayBounds.y + trayBounds.height / 2) };
    const { workArea } = screen.getDisplayNearestPoint(anchor);
    const margin = 10;
    const { width, height } = POPUP_SIZE;
    let x = anchor.x - Math.round(width / 2);
    let y = anchor.y > workArea.y + workArea.height / 2 ? workArea.y + workArea.height - height - margin : workArea.y + margin;
    if (anchor.x > workArea.x + workArea.width - 4) {
      x = workArea.x + workArea.width - width - margin; // taskbar on the right
    } else if (anchor.x < workArea.x + 4) {
      x = workArea.x + margin; // taskbar on the left
    }
    x = Math.min(Math.max(x, workArea.x + margin), workArea.x + workArea.width - width - margin);
    y = Math.min(Math.max(y, workArea.y + margin), workArea.y + workArea.height - height - margin);
    popup?.setPosition(x, y, false);
  }

  function togglePopup() {
    if (!popup || popup.isDestroyed()) {
      createPopup();
    }
    if (popup.isVisible()) {
      popup.hide();
      return;
    }
    // Clicking the tray icon blurs (and hides) the popup first; don't immediately reopen it.
    if (Date.now() - popupHiddenAt < 300) {
      return;
    }
    positionPopup();
    popup.show();
    popup.focus();
  }

  // ---- tray -----------------------------------------------------------------------------

  function trayImage(paused) {
    const image = nativeImage.createFromPath(path.join(ASSETS, paused ? "tray-paused.png" : "tray.png"));
    const large = nativeImage.createFromPath(path.join(ASSETS, paused ? "tray-paused@2x.png" : "tray@2x.png"));
    if (!large.isEmpty()) {
      image.addRepresentation({ scaleFactor: 2, buffer: large.toPNG() });
    }
    return image;
  }

  function createTray() {
    tray = new Tray(trayImage(false));
    tray.setToolTip(APP_NAME);
    tray.on("click", togglePopup);
    tray.on("double-click", showMain);
    createPopup();
  }

  function updateTray(snapshot) {
    const label = snapshot.paused ? "paused" : snapshot.now.category;
    tray.setToolTip(snapshot.paused ? `${APP_NAME}: tracking paused` : `${APP_NAME}: ${label}`);

    const key = `${snapshot.paused}|${snapshot.settings.openAtLogin}`;
    if (key === menuKey) {
      return;
    }
    menuKey = key;
    tray.setImage(trayImage(snapshot.paused));
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Open Tiny Kingdom", click: showMain },
        { type: "separator" },
        ...(snapshot.paused
          ? [{ label: "Resume tracking", click: () => kingdom.resume() }]
          : [
              { label: "Pause for 30 minutes", click: () => kingdom.pause(30) },
              { label: "Pause for 1 hour", click: () => kingdom.pause(60) },
              { label: "Pause until I resume", click: () => kingdom.pause(null) }
            ]),
        { type: "separator" },
        {
          label: "Start with Windows",
          type: "checkbox",
          checked: snapshot.settings.openAtLogin,
          click: (item) => setOpenAtLogin(item.checked)
        },
        { type: "separator" },
        { label: "Quit Tiny Kingdom", click: () => app.quit() }
      ])
    );
  }

  // ---- settings -------------------------------------------------------------------------

  function syncLoginItem(enabled) {
    // Only the installed app registers itself; a dev build would register electron.exe.
    if (!app.isPackaged) {
      return;
    }
    // Windows matches the startup entry by name only, so always remove it and re-add it with
    // this copy's path. That way a moved or reinstalled app never leaves a stale entry.
    const item = { name: APP_ID, path: process.execPath, args: ["--hidden"] };
    try {
      app.setLoginItemSettings({ ...item, openAtLogin: false });
      if (enabled) {
        app.setLoginItemSettings({ ...item, openAtLogin: true });
      }
      log("login item", { enabled, launchItems: app.getLoginItemSettings(item).launchItems });
    } catch (error) {
      log("login item failed", error);
    }
  }

  function setOpenAtLogin(enabled) {
    syncLoginItem(enabled);
    return kingdom.updateSettings({ openAtLogin: enabled });
  }

  // ---- IPC: every call checks who is asking and what it sent ---------------------------------

  function registerIpc() {
    const handle = (channel, handler) => {
      ipcMain.handle(channel, (event, ...args) => {
        if (!isAppUrl(event.senderFrame?.url ?? "")) {
          throw new Error("Blocked: request did not come from Tiny Kingdom");
        }
        return handler(...args);
      });
    };

    const CATEGORIES = new Set(["work", "play", "neutral"]);
    const TARGETS = new Set(["app", "site"]);

    handle("kingdom:get-snapshot", () => kingdom.getSnapshot());
    handle("kingdom:set-rule", (rule) => {
      if (
        !rule ||
        typeof rule !== "object" ||
        !TARGETS.has(rule.targetType) ||
        !CATEGORIES.has(rule.category) ||
        typeof rule.pattern !== "string" ||
        rule.pattern.trim().length === 0 ||
        rule.pattern.length > 120
      ) {
        throw new Error("Invalid rule");
      }
      return kingdom.setRule({ targetType: rule.targetType, pattern: rule.pattern, category: rule.category });
    });
    handle("kingdom:delete-rule", (id) => {
      if (typeof id !== "string" || id.length > 64) {
        throw new Error("Invalid rule id");
      }
      return kingdom.deleteRule(id);
    });
    handle("kingdom:pause", (minutes) => {
      if (minutes !== null && !(Number.isInteger(minutes) && minutes > 0 && minutes <= 24 * 60)) {
        throw new Error("Invalid pause length");
      }
      return kingdom.pause(minutes);
    });
    handle("kingdom:resume", () => kingdom.resume());
    handle("kingdom:set-open-at-login", (enabled) => {
      if (typeof enabled !== "boolean") {
        throw new Error("Invalid value");
      }
      return setOpenAtLogin(enabled);
    });
    handle("kingdom:set-play-allowance", (minutes) => {
      if (!Number.isInteger(minutes) || minutes < 0 || minutes > 240) {
        throw new Error("Invalid allowance");
      }
      return kingdom.updateSettings({ playAllowanceMinutes: minutes });
    });
    handle("kingdom:clear-history", () => kingdom.clearHistory());
    handle("kingdom:open-main", () => showMain());
    handle("kingdom:hide-popup", () => popup?.hide());
    handle("kingdom:open-data-folder", () => shell.openPath(path.join(app.getPath("userData"), "data")));
  }
}
