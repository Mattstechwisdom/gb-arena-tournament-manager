/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  ipcRenderer: import('electron').IpcRenderer
  arena: {
    env: {
      get: () => Promise<{ profile: string | null; storeName: string; userDataPath: string; isPackaged: boolean }>
    }
    appState: {
      get: () => Promise<unknown>
      set: (nextState: unknown) => Promise<boolean>
      clear: () => Promise<boolean>
    }
    files: {
      saveTextFile: (args: { defaultPath?: string; content: string }) => Promise<{ canceled: boolean; filePath?: string }>
      pickImageDataUrl: () => Promise<{ canceled: true } | { canceled: false; dataUrl: string; fileName?: string }>
      pickImageFolderDataUrls: () => Promise<
        | { canceled: true }
        | { canceled: false; folderPath: string; files: Array<{ fileName: string; dataUrl: string }> }
      >
      openTextFile: () => Promise<
        | { canceled: true }
        | { canceled: false; filePath: string; fileName?: string; content: string }
      >
    }
  }
}
