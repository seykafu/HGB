import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Suppress Supabase auth refresh errors when offline
// These are expected when the internet is disconnected
const originalConsoleError = console.error
console.error = (...args: any[]) => {
  const errorMessage = args[0]?.toString() || ''
  const errorStack = args.join(' ')
  
  // Filter out Supabase auth token refresh errors when offline
  if (
    (errorMessage.includes('ERR_INTERNET_DISCONNECTED') ||
     errorMessage.includes('Failed to fetch') ||
     errorStack.includes('TypeError: Failed to fetch')) &&
    (errorStack.includes('/auth/v1/token') ||
     errorStack.includes('refresh_token') ||
     errorStack.includes('_refreshAccessToken') ||
     errorStack.includes('_callRefreshToken') ||
     errorStack.includes('_recoverAndRefresh'))
  ) {
    // Suppress these errors - they're expected when offline
    return
  }
  
  // Log all other errors normally
  originalConsoleError.apply(console, args)
}

// Also handle unhandled promise rejections for Supabase auth errors
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason
  const errorMessage = error?.message || error?.toString() || ''
  const errorStack = error?.stack || ''
  
  // Suppress Supabase auth refresh errors when offline
  if (
    (errorMessage.includes('ERR_INTERNET_DISCONNECTED') ||
     errorMessage.includes('Failed to fetch') ||
     errorStack.includes('TypeError: Failed to fetch')) &&
    (errorStack.includes('/auth/v1/token') ||
     errorStack.includes('refresh_token') ||
     errorStack.includes('_refreshAccessToken') ||
     errorStack.includes('_callRefreshToken') ||
     errorStack.includes('_recoverAndRefresh'))
  ) {
    // Prevent the error from showing in console
    event.preventDefault()
    return
  }
})

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

