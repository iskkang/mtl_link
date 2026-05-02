import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './lib/i18n'

// Service Worker 등록 (Web Push + PWA 지원)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            // Reload only when a NEW SW activates over an existing one.
            // navigator.serviceWorker.controller being non-null means there
            // was already a SW controlling this page (i.e. not the first install).
            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
              console.log('[SW] New version activated, reloading...')
              window.location.reload()
            }
          })
        })
      })
      .catch(err => console.warn('[SW] registration failed:', err))
  })
}

window.addEventListener('appinstalled', () => {
  console.log('[PWA] App installed')
  localStorage.setItem('pwa-installed', 'true')
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
