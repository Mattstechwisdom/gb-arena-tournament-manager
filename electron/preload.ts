import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})

contextBridge.exposeInMainWorld('arena', {
  env: {
    get() {
      return ipcRenderer.invoke('env:get') as Promise<{
        profile: string | null
        storeName: string
        userDataPath: string
        isPackaged: boolean
      }>
    },
  },
  appState: {
    get() {
      return ipcRenderer.invoke('appState:get')
    },
    set(nextState: unknown) {
      return ipcRenderer.invoke('appState:set', nextState)
    },
    clear() {
      return ipcRenderer.invoke('appState:clear')
    },
  },
  files: {
    saveTextFile(args: { defaultPath?: string; content: string }) {
      return ipcRenderer.invoke('file:saveText', args)
    },
    pickImageDataUrl() {
      return ipcRenderer.invoke('file:pickImageDataUrl')
    },
    pickImageFolderDataUrls() {
      return ipcRenderer.invoke('file:pickImageFolderDataUrls')
    },
    openTextFile() {
      return ipcRenderer.invoke('file:openText')
    },
  },
})
