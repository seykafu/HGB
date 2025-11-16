import { useEffect, useState } from 'react'
import { getUser, onAuthStateChange, getSupabaseClient } from '../lib/supabase'
import { get } from '../lib/storage'
import Login from './Login'
import { Settings } from './Settings'

interface AuthGateProps {
  children: React.ReactNode | ((props: { onOpenSettings: () => void }) => React.ReactNode)
}

export const AuthGate = ({ children }: AuthGateProps) => {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    checkConfig()
    
    // Re-check auth state when window regains focus (debounced and throttled to prevent excessive calls)
    let focusTimeout: NodeJS.Timeout | null = null
    let lastFocusCheck = 0
    const handleFocus = async () => {
      const now = Date.now()
      // Throttle focus checks to at most once every 5 seconds
      if (now - lastFocusCheck < 5000) {
        return
      }
      
      // Debounce focus events to prevent excessive calls
      if (focusTimeout) {
        clearTimeout(focusTimeout)
      }
      focusTimeout = setTimeout(async () => {
        lastFocusCheck = Date.now()
        try {
          const currentUser = await getUser()
          setUser((prevUser) => {
            // Only update if user actually changed or was lost
            if (currentUser && !prevUser) {
              // User exists but state was lost, restore it
              console.log('🔄 Restoring user session after window focus')
              return currentUser
            } else if (currentUser?.id !== prevUser?.id) {
              // User changed, update state
              return currentUser
            }
            // No change needed - return previous to prevent re-render
            return prevUser
          })
        } catch (error) {
          // Silently fail - user might not be logged in
        }
      }, 1000) // Wait 1 second before checking
    }
    
    window.addEventListener('focus', handleFocus, { passive: true })
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        handleFocus()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true })
    
    return () => {
      if (focusTimeout) {
        clearTimeout(focusTimeout)
      }
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const checkConfig = async () => {
    try {
      // Default Supabase URL
      const defaultSupabaseUrl = 'https://msomzmvhvgsxfxrpvrzp.supabase.co'
      
      // Check if Supabase is configured
      let supabaseUrl = await get<string>('supabaseUrl', '')
      let supabaseAnonKey = await get<string>('supabaseAnonKey', '')
      
      // Use default URL if not set
      if (!supabaseUrl) {
        supabaseUrl = defaultSupabaseUrl
      }
      
      // Try to get anon key from environment variable
      if (!supabaseAnonKey && typeof window !== 'undefined' && window.electronAPI?.env) {
        const envKey = await window.electronAPI.env.get('SUPABASE_ANON_KEY')
        if (envKey) {
          supabaseAnonKey = envKey
        }
      }

      // Try to get Supabase client (assume config is available via env vars or defaults)
      await getSupabaseClient()

      // Check initial auth state
      getUser()
        .then(setUser)
        .catch(() => setUser(null))
        .finally(() => setLoading(false))

      // Listen for auth changes
      let subscription: any = null
      onAuthStateChange((newUser) => {
        // Use functional update to avoid stale closure issues
        setUser((prevUser) => {
          // Only update if user actually changed (avoid unnecessary re-renders)
          const prevId = prevUser?.id
          const newId = newUser?.id
          if (prevId !== newId) {
            // Only log significant changes
            if (newUser || prevUser) {
              console.log('👤 User state changed:', newUser ? `User ${newId}` : 'Logged out')
            }
            return newUser
          }
          // No change needed, return previous state to prevent re-render
          return prevUser
        })
      }).then((result) => {
        subscription = result.subscription
      })

      return () => {
        if (subscription) {
          subscription.unsubscribe()
        }
      }
    } catch (error) {
      // If Supabase config is invalid, still proceed (assume env vars are set)
      console.warn('Supabase config check failed, proceeding anyway:', error)
      getUser()
        .then(setUser)
        .catch(() => setUser(null))
        .finally(() => setLoading(false))
    }
  }

  const handleSettingsSaved = async () => {
    setShowSettings(false)
    // Reload config after settings are saved
    await checkConfig()
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#F8F1E3]">
        <div className="text-[#2E2A25]">Loading...</div>
      </div>
    )
  }

  if (showSettings) {
    return (
      <Settings 
        onBack={() => setShowSettings(false)}
        onSave={handleSettingsSaved}
      />
    )
  }

  if (!user) {
    return <Login onOpenSettings={() => setShowSettings(true)} />
  }

  const onOpenSettings = () => setShowSettings(true)
  
  return <>{typeof children === 'function' ? children({ onOpenSettings }) : children}</>
}
