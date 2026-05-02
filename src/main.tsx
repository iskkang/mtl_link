import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './lib/i18n'

// Service Worker 등록 (Web Push + PWA 지원)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
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
