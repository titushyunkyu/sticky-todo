const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('data:load'),
  save: (data) => ipcRenderer.invoke('data:save', data),
  getPin: () => ipcRenderer.invoke('win:pin:get'),
  setPin: (value) => ipcRenderer.invoke('win:pin:set', value),
  minimize: () => ipcRenderer.send('win:minimize'),
  close: () => ipcRenderer.send('win:close'),
  saveIcs: (text) => ipcRenderer.invoke('ics:save', text),
  revealData: () => ipcRenderer.invoke('data:reveal'),
});
