const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, ipcMain } = require("electron");
const { KingdomService } = require("./services/kingdom-service.cjs");
const { StaticFileServer } = require("./services/static-file-server.cjs");

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const appName = "Tiny Kingdom";

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
  return targetPath;
}

function configureAppPaths() {
  app.setName(appName);

  const roamingRoot = app.getPath("appData");
  const localRoot =
    process.env.LOCALAPPDATA ??
    path.resolve(roamingRoot, "..", "Local");

  const userDataPath = ensureDir(path.join(roamingRoot, appName));
  const sessionDataPath = ensureDir(
    path.join(localRoot, appName, "SessionData")
  );

  app.setPath("userData", userDataPath);
  app.setPath("sessionData", sessionDataPath);
}

configureAppPaths();
const kingdom = new KingdomService({
  persistenceRootPath: path.join(app.getPath("userData"), "data")
});
const staticFileServer = new StaticFileServer({
  rootDir: path.join(__dirname, "..", "dist")
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#0f1712",
    title: "Tiny Kingdom",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  mainWindow.webContents.on("did-fail-load", (_event, code, description, validatedURL) => {
    console.error("did-fail-load", { code, description, validatedURL });
  });

  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log("renderer-console", { level, message, line, sourceId });
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("render-process-gone", details);
  });

  mainWindow.webContents.on("did-finish-load", () => {
    console.log("did-finish-load");
  });

  mainWindow.loadURL(staticFileServer.url);
}

app.whenReady().then(() => {
  if (!isDev) {
    staticFileServer.start();
  }

  kingdom.start();

  ipcMain.handle("castle:get-meta", () => kingdom.getMeta(process.platform));
  ipcMain.handle("castle:get-snapshot", () => kingdom.getSnapshot());
  ipcMain.handle("castle:pause", () => {
    kingdom.pause();
    return kingdom.getSnapshot();
  });
  ipcMain.handle("castle:resume", () => {
    kingdom.resume();
    return kingdom.getSnapshot();
  });
  ipcMain.handle("castle:get-rules", () => kingdom.getRules());
  ipcMain.handle("castle:add-rule", (_event, rule) => kingdom.addRule(rule));
  ipcMain.handle("castle:delete-rule", (_event, id) => kingdom.deleteRule(id));

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  kingdom.stop();
  staticFileServer.stop();

  if (process.platform !== "darwin") {
    app.quit();
  }
});
