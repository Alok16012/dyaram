import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { refreshSession } from './lib/auth'

// Re-check the login and permissions with the server before the first render,
// so a deactivated user or changed permissions take effect on reload.
refreshSession()
  .catch(err => console.warn('Session refresh failed:', err))
  .finally(() => {
    createRoot(document.getElementById('root')).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
