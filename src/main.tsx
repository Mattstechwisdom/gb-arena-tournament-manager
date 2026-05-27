import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { setupAutoSave, useArenaStore } from './state/arenaStore'

setupAutoSave()
void useArenaStore.getState().hydrate()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Use contextBridge
window.ipcRenderer?.on?.('main-process-message', (_event, message) => {
  console.log(message)
})
