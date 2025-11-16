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
  
  // Filter out Supabase auth token refresh and storage errors when offline
  const isOfflineError = errorMessage.includes('ERR_INTERNET_DISCONNECTED') ||
                        errorMessage.includes('Failed to fetch') ||
                        errorStack.includes('TypeError: Failed to fetch') ||
                        errorMessage.includes('StorageUnknownError') ||
                        errorMessage.includes('AuthRetryableFetchError')
  
  const isAuthError = errorStack.includes('/auth/v1/token') ||
                     errorStack.includes('refresh_token') ||
                     errorStack.includes('_refreshAccessToken') ||
                     errorStack.includes('_callRefreshToken') ||
                     errorStack.includes('_recoverAndRefresh') ||
                     errorStack.includes('_getUser') ||
                     errorStack.includes('_useSession') ||
                     errorStack.includes('AuthRetryableFetchError') ||
                     errorMessage.includes('AuthRetryableFetchError')
  
  const isStorageError = errorStack.includes('/storage/v1/object') ||
                        errorStack.includes('Failed to load') ||
                        errorMessage.includes('StorageUnknownError')
  
  if (isOfflineError && (isAuthError || isStorageError)) {
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
  
  // Suppress Supabase auth refresh and storage errors when offline
  const isOfflineError = errorMessage.includes('ERR_INTERNET_DISCONNECTED') ||
                        errorMessage.includes('Failed to fetch') ||
                        errorStack.includes('TypeError: Failed to fetch') ||
                        errorMessage.includes('StorageUnknownError') ||
                        errorMessage.includes('AuthRetryableFetchError')
  
  const isAuthError = errorStack.includes('/auth/v1/token') ||
                     errorStack.includes('refresh_token') ||
                     errorStack.includes('_refreshAccessToken') ||
                     errorStack.includes('_callRefreshToken') ||
                     errorStack.includes('_recoverAndRefresh') ||
                     errorStack.includes('_getUser') ||
                     errorStack.includes('_useSession') ||
                     errorStack.includes('AuthRetryableFetchError') ||
                     errorMessage.includes('AuthRetryableFetchError')
  
  const isStorageError = errorStack.includes('/storage/v1/object') ||
                        errorStack.includes('Failed to load') ||
                        errorMessage.includes('StorageUnknownError')
  
  if (isOfflineError && (isAuthError || isStorageError)) {
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

