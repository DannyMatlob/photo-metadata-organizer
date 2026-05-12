const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  pickSource:      ()       => ipcRenderer.invoke('pick-source'),
  pickOutput:      ()       => ipcRenderer.invoke('pick-output'),
  scanFolder:      (src)    => ipcRenderer.invoke('scan-folder', src),
  getFileDate:     (fp)     => ipcRenderer.invoke('get-file-date', fp),
  organisePhotos:  (opts)   => ipcRenderer.invoke('organise-photos', opts),
  openFolder:      (folder) => ipcRenderer.invoke('open-folder', folder),
  readOutputTree:  (p)      => ipcRenderer.invoke('read-output-tree', p),
  readFolderFiles: (p)      => ipcRenderer.invoke('read-folder-files', p),
  readImageB64:    (p)      => ipcRenderer.invoke('read-image-b64', p),
  onProgress:      (cb)     => ipcRenderer.on('progress', (_, data) => cb(data)),
  removeProgress:  ()       => ipcRenderer.removeAllListeners('progress')
});
