import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { setSessionExpiredHandler } from './lib/apiClient'
import { useAuthStore } from './stores/useAuthStore'

setSessionExpiredHandler(() => useAuthStore.getState().signOut())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
