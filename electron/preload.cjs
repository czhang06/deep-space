// Runs in a sandbox. Exposes a small, fixed API to the page; the page never gets ipcRenderer itself.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kingdom", {
  getSnapshot: () => ipcRenderer.invoke("kingdom:get-snapshot"),
  onSnapshot: (listener) => {
    const wrapped = (_event, snapshot) => listener(snapshot);
    ipcRenderer.on("kingdom:snapshot", wrapped);
    return () => ipcRenderer.removeListener("kingdom:snapshot", wrapped);
  },
  setRule: (rule) => ipcRenderer.invoke("kingdom:set-rule", rule),
  deleteRule: (id) => ipcRenderer.invoke("kingdom:delete-rule", id),
  pause: (minutes) => ipcRenderer.invoke("kingdom:pause", minutes),
  resume: () => ipcRenderer.invoke("kingdom:resume"),
  setOpenAtLogin: (enabled) => ipcRenderer.invoke("kingdom:set-open-at-login", enabled),
  setPlayAllowance: (minutes) => ipcRenderer.invoke("kingdom:set-play-allowance", minutes),
  setMode: (mode) => ipcRenderer.invoke("kingdom:set-mode", mode),
  setUpgradeFocus: (pieceId, label) => ipcRenderer.invoke("kingdom:set-upgrade-focus", pieceId, label),
  setMilestonePlan: (plan) => ipcRenderer.invoke("kingdom:set-milestone-plan", plan),
  setMilestoneNotifications: (enabled) => ipcRenderer.invoke("kingdom:set-milestone-notifications", enabled),
  onOpenLogbook: (listener) => {
    const wrapped = () => listener();
    ipcRenderer.on("kingdom:open-logbook", wrapped);
    return () => ipcRenderer.removeListener("kingdom:open-logbook", wrapped);
  },
  checkForUpdates: () => ipcRenderer.invoke("kingdom:check-for-updates"),
  installUpdate: () => ipcRenderer.invoke("kingdom:install-update"),
  setAutoUpdate: (enabled) => ipcRenderer.invoke("kingdom:set-auto-update", enabled),
  setWeeklyRecap: (enabled) => ipcRenderer.invoke("kingdom:set-weekly-recap", enabled),
  onOpenRecap: (listener) => {
    const wrapped = () => listener();
    ipcRenderer.on("kingdom:open-recap", wrapped);
    return () => ipcRenderer.removeListener("kingdom:open-recap", wrapped);
  },
  clearHistory: () => ipcRenderer.invoke("kingdom:clear-history"),
  openMain: () => ipcRenderer.invoke("kingdom:open-main"),
  hidePopup: () => ipcRenderer.invoke("kingdom:hide-popup"),
  openDataFolder: () => ipcRenderer.invoke("kingdom:open-data-folder")
});
