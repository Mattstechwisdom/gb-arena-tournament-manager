import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import Store from 'electron-store'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

type PersistedAppState = unknown
type StoreSchema = { appState?: PersistedAppState }

let store: Store<StoreSchema> | null = null

const PROFILE = resolveProfileFromArgsOrEnv()
const STORE_NAME = PROFILE ? `gb-arena-${PROFILE}` : 'gb-arena'

configureUserDataPathFromEnv()

function ensureStore() {
  if (store) return store

  store = new Store<StoreSchema>({ name: STORE_NAME })

  return store
}

function registerIpc() {
  const s = ensureStore()

  ipcMain.handle('appState:get', () => {
    return s.get('appState') ?? null
  })

  ipcMain.handle('appState:set', (_event, nextState: PersistedAppState) => {
    s.set('appState', nextState)
    return true
  })

  ipcMain.handle('appState:clear', () => {
    s.clear()
    return true
  })

  ipcMain.handle('env:get', () => {
    return {
      profile: PROFILE,
      storeName: STORE_NAME,
      userDataPath: app.getPath('userData'),
      isPackaged: app.isPackaged,
    }
  })

  ipcMain.handle('file:saveText', async (_event, args: { defaultPath?: string; content: string }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: args.defaultPath,
      filters: [
        { name: 'CSV', extensions: ['csv'] },
        { name: 'JSON', extensions: ['json'] },
        { name: 'Text', extensions: ['txt'] },
      ],
    })

    if (canceled || !filePath) {
      return { canceled: true }
    }

    await writeFile(filePath, args.content, 'utf8')
    return { canceled: false, filePath }
  })

  ipcMain.handle('file:openText', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'JSON', extensions: ['json'] },
        { name: 'Text', extensions: ['txt'] },
      ],
    })

    if (canceled || !filePaths.length) {
      return { canceled: true as const }
    }

    const filePath = filePaths[0]
    const content = await readFile(filePath, 'utf8')

    return {
      canceled: false as const,
      filePath,
      fileName: path.basename(filePath),
      content,
    }
  })

  ipcMain.handle('file:pickImageDataUrl', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        {
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'],
        },
      ],
    })

    if (canceled || !filePaths.length) {
      return { canceled: true as const }
    }

    const filePath = filePaths[0]
    const ext = path.extname(filePath).toLowerCase()
    const mime =
      ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : ext === '.webp'
            ? 'image/webp'
            : ext === '.gif'
              ? 'image/gif'
              : ext === '.svg'
                ? 'image/svg+xml'
                : 'application/octet-stream'

    const data = await readFile(filePath)
    const dataUrl = `data:${mime};base64,${data.toString('base64')}`

    return {
      canceled: false as const,
      dataUrl,
      fileName: path.basename(filePath),
    }
  })

  ipcMain.handle('file:pickImageFolderDataUrls', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    })

    if (canceled || !filePaths.length) {
      return { canceled: true as const }
    }

    const folderPath = filePaths[0]

    let entries: Array<import('node:fs').Dirent<string>>
    try {
      // Be explicit so Dirent names are typed as strings.
      entries = await readdir(folderPath, { withFileTypes: true, encoding: 'utf8' })
    } catch {
      return { canceled: false as const, folderPath, files: [] as Array<{ fileName: string; dataUrl: string }> }
    }

    const files: Array<{ fileName: string; dataUrl: string }> = []

    for (const entry of entries) {
      if (!entry.isFile()) continue

      const fileName = entry.name
      const ext = path.extname(fileName).toLowerCase()
      const mime =
        ext === '.png'
          ? 'image/png'
          : ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : ext === '.webp'
              ? 'image/webp'
              : ext === '.gif'
                ? 'image/gif'
                : ext === '.svg'
                  ? 'image/svg+xml'
                  : null

      if (!mime) continue

      try {
        const fullPath = path.join(folderPath, fileName)
        const data = await readFile(fullPath)
        const dataUrl = `data:${mime};base64,${data.toString('base64')}`
        files.push({ fileName, dataUrl })
      } catch {
        // ignore unreadable files
      }
    }

    return {
      canceled: false as const,
      folderPath,
      files,
    }
  })
}

function resolveProfileFromArgsOrEnv(): string | null {
  // Command line beats env.
  for (const arg of process.argv) {
    if (arg === '--demo') return 'demo'
    if (arg.startsWith('--profile=')) {
      const raw = arg.slice('--profile='.length).trim()
      if (raw) return raw
    }
  }

  const env = (process.env.GB_ARENA_PROFILE ?? '').trim()
  return env || null
}

function configureUserDataPathFromEnv() {
  const raw = (process.env.GB_ARENA_USER_DATA_DIR ?? '').trim()
  if (!raw) return

  try {
    const resolved = path.resolve(raw)
    app.setPath('userData', resolved)
  } catch {
    // ignore
  }
}

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setMenuBarVisibility(false)

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  registerIpc()
  createWindow()
})
