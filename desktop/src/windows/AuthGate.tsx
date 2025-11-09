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
      onAuthStateChange((user) => {
        setUser(user)
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
