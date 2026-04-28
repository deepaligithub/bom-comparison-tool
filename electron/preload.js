const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openDataFolder: (dir) => ipcRenderer.invoke("open-data-folder", dir),
  isElectron: true,
});
