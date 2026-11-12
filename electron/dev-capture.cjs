// Development aid: with TK_CAPTURE_DIR set (and only in an unpackaged build), saves screenshots
// of the main window and the tray popup a few seconds after launch, then quits.
const fs = require("node:fs");
const path = require("node:path");

module.exports = function scheduleCapture({ app, getWindows, showPopup, delayMs = 6000 }) {
  const dir = process.env.TK_CAPTURE_DIR;
  if (!dir || app.isPackaged) {
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  setTimeout(async () => {
    try {
      const { mainWindow } = getWindows();
      if (mainWindow) {
        fs.writeFileSync(path.join(dir, "main.png"), (await mainWindow.webContents.capturePage()).toPNG());
      }
      showPopup();
      await new Promise((resolve) => setTimeout(resolve, 3500));
      const { popup } = getWindows();
      if (popup) {
        fs.writeFileSync(path.join(dir, "popup.png"), (await popup.webContents.capturePage()).toPNG());
      }
      console.log("capture: saved to", dir);
    } catch (error) {
      console.error("capture failed", error);
    }
    if (process.env.TK_CAPTURE_QUIT !== "0") {
      app.quit();
    }
  }, delayMs);
};
