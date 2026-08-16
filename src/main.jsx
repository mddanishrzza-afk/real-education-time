// ============================================================
// Entry point
// ============================================================
import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/global.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './context/LanguageContext'
import { ClassProvider } from './context/ClassContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider>
          <ClassProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ClassProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
