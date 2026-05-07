const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("castlekeeper", {
  getMeta: () => ipcRenderer.invoke("castle:get-meta"),
  getSnapshot: () => ipcRenderer.invoke("castle:get-snapshot"),
  pauseSimulation: () => ipcRenderer.invoke("castle:pause"),
  resumeSimulation: () => ipcRenderer.invoke("castle:resume"),
  getRules: () => ipcRenderer.invoke("castle:get-rules"),
  addRule: (rule) => ipcRenderer.invoke("castle:add-rule", rule),
  deleteRule: (id) => ipcRenderer.invoke("castle:delete-rule", id)
});
