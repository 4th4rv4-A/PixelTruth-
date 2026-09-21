import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { detectAI } from './utils/detectAI'

if (typeof window !== 'undefined') {
  window.__detectAI = detectAI;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
