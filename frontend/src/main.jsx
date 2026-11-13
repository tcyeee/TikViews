import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import YtDlpTestPage from './pages/YtDlpTestPage.jsx'

const page = window.location.pathname === '/yt-dlp-test' ? <YtDlpTestPage /> : <App />

createRoot(document.getElementById('root')).render(
  <StrictMode>{page}</StrictMode>,
)
