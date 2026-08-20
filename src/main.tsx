import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App, { BootWatchdog, resetAuth } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary onReset={resetAuth}>
        <BootWatchdog>
          <App />
        </BootWatchdog>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>,
)
