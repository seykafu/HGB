import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { get } from './storage'
import { BUILD_TIME_CONFIG } from '../config/app-config'

let supabaseClient: SupabaseClient | null = null

// Cache the config used to create the client
let cachedConfig: { url: string; key: string } | null = null
let clientCreationInProgress = false

// Track if we've already set up the auth listener to prevent duplicates
let authStateChangeListenerSet = false
let currentAuthSubscription: any = null
let lastSessionUserId: string | null = null
let lastSignInTime: number = 0

// Export function to clear the client cache (useful when settings change)
export function clearSupabaseClient() {
  supabaseClient = null
  cachedConfig = null
  clientCreationInProgress = false
  // Also reset auth listener tracking when clearing client
  authStateChangeListenerSet = false
  currentAuthSubscription = null
  lastSessionUserId = null
  lastSignInTime = 0
}

export async function getSupabaseClient(): Promise<SupabaseClient> {
  // Get current config
  const defaultSupabaseUrl = 'https://msomzmvhvgsxfxrpvrzp.supabase.co'
  
  let supabaseUrl = await get<string>('supabaseUrl', '')
  let supabaseAnonKey = await get<string>('supabaseAnonKey', '')
  
  // Use default URL if not set
  if (!supabaseUrl) {
    supabaseUrl = BUILD_TIME_CONFIG.SUPABASE_URL || defaultSupabaseUrl
  }
  
  // Try build-time config if no user setting
  if (!supabaseAnonKey) {
    supabaseAnonKey = BUILD_TIME_CONFIG.SUPABASE_ANON_KEY
    if (supabaseAnonKey) {
      // Only log once per session
      if (!(window as any).__supabase_build_key_logged) {
        console.log('✓ Using build-time Supabase anon key')
        ;(window as any).__supabase_build_key_logged = true
      }
    } else {
      // Only warn once if build-time key is missing (expected in dev mode)
      if (!(window as any).__supabase_build_key_warned) {
        // Don't show warning in dev mode if we have runtime env var as fallback
        // This is expected behavior
        ;(window as any).__supabase_build_key_warned = true
      }
    }
  }
  
  // Try runtime environment variable (for development)
  if (!supabaseAnonKey && typeof window !== 'undefined' && window.electronAPI?.env) {
    const envKey = await window.electronAPI.env.get('SUPABASE_ANON_KEY')
    if (envKey) {
      supabaseAnonKey = envKey
      // Only log once per session
      if (!(window as any).__supabase_runtime_key_logged) {
        console.log('✓ Using runtime environment variable for Supabase anon key')
        ;(window as any).__supabase_runtime_key_logged = true
      }
    }
  }
  
  // If still no key, throw error with helpful message
  if (!supabaseAnonKey) {
    const errorMsg = `Supabase anon key not found. 

Options:
1. Set VITE_SUPABASE_ANON_KEY environment variable and rebuild:
   export VITE_SUPABASE_ANON_KEY=your_key_here
   npm run build:mac

2. Create desktop/.env.local with:
   VITE_SUPABASE_ANON_KEY=your_key_here
   Then rebuild: npm run build:mac

3. Configure it in Settings (click Settings button on login screen)`
    throw new Error(errorMsg)
  }
  
  // Check if we can reuse the existing client
  if (supabaseClient && cachedConfig) {
    if (cachedConfig.url === supabaseUrl && cachedConfig.key === supabaseAnonKey) {
      // Same config, reuse existing client
      return supabaseClient
    } else {
      // Config changed, clear old client
      clearSupabaseClient()
    }
  }
  
  // Prevent multiple simultaneous client creations
  if (clientCreationInProgress) {
    // Wait for the in-progress creation to complete
    while (clientCreationInProgress) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    if (supabaseClient) {
      return supabaseClient
    }
  }
  
  clientCreationInProgress = true
  
  // Log config for debugging (only first time, and only show partial key for security)
  if (!(window as any).__supabase_config_logged) {
    const keyPreview = supabaseAnonKey.length > 20 
      ? `${supabaseAnonKey.substring(0, 20)}...${supabaseAnonKey.substring(supabaseAnonKey.length - 10)}` 
      : supabaseAnonKey
    const keyStartsCorrectly = supabaseAnonKey.startsWith('eyJ') // JWT tokens start with eyJ
    console.log('🔧 Supabase Config:', {
      url: supabaseUrl,
      keyLength: supabaseAnonKey.length,
      keyPreview: keyPreview,
      keyStartsCorrectly: keyStartsCorrectly,
      source: supabaseAnonKey === BUILD_TIME_CONFIG.SUPABASE_ANON_KEY ? 'build-time' 
        : typeof window !== 'undefined' && window.electronAPI?.env ? 'runtime-env' 
        : 'user-settings'
    })
    
    // Warn if key doesn't look valid
    if (!keyStartsCorrectly || supabaseAnonKey.length < 100) {
      console.warn('⚠️  WARNING: Supabase anon key may be invalid!')
      console.warn('   Valid keys should:')
      console.warn('   - Start with "eyJ" (JWT format)')
      console.warn('   - Be at least 100 characters long')
      console.warn('   - Get it from: https://supabase.com/dashboard/project/msomzmvhvgsxfxrpvrzp/settings/api')
    }
    
    ;(window as any).__supabase_config_logged = true
  }
  
  // Create new client with current config
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: 'sb-msomzmvhvgsxfxrpvrzp-auth-token',
    },
  })
  
  // Set up automatic session refresh when window regains focus (only once globally)
  if (typeof window !== 'undefined' && !(window as any).__supabase_visibility_listener_set) {
    let refreshTimeout: NodeJS.Timeout | null = null
    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        // Debounce refresh calls
        if (refreshTimeout) {
          clearTimeout(refreshTimeout)
        }
        refreshTimeout = setTimeout(async () => {
          // Window regained focus - refresh session if needed
          try {
            const { data: { session } } = await supabaseClient.auth.getSession()
            if (session) {
              // Try to refresh the token if it's close to expiring
              const expiresAt = session.expires_at
              if (expiresAt) {
                const expiresIn = expiresAt - Math.floor(Date.now() / 1000)
                // Refresh if token expires in less than 5 minutes
                if (expiresIn < 300) {
                  await supabaseClient.auth.refreshSession()
                }
              }
            }
          } catch (error) {
            // Silently handle refresh errors
            console.debug('Session refresh on focus:', error)
          }
        }, 1000) // Wait 1 second before refreshing
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true })
    window.addEventListener('focus', handleVisibilityChange, { passive: true })
    ;(window as any).__supabase_visibility_listener_set = true
  }
  
  // Cache the config used to create this client
  cachedConfig = { url: supabaseUrl, key: supabaseAnonKey }
  clientCreationInProgress = false

  return supabaseClient
}

export async function getUser() {
  const supabase = await getSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

export async function signIn(email: string, password: string) {
  const supabase = await getSupabaseClient()
  
  // Debug: Log the request (without password)
  console.log('🔐 Attempting sign in for:', email)
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) {
    console.error('❌ Sign in error:', {
      message: error.message,
      status: error.status,
      name: error.name
    })
    
    // Provide more helpful error messages
    if (error.message.includes('Invalid login credentials') || error.status === 401) {
      throw new Error('Invalid email or password. Please check your credentials and try again.')
    }
    if (error.message.includes('Email not confirmed')) {
      throw new Error('Please check your email and verify your account before signing in.')
    }
    throw error
  }
  
  console.log('✅ Sign in successful')
  return data
}

export async function signUp(email: string, password: string) {
  const supabase = await getSupabaseClient()
  
  console.log('🔐 Attempting sign up for:', email)
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  
  if (error) {
    console.error('❌ Sign up error:', {
      message: error.message,
      status: error.status,
      name: error.name
    })
    
    // Provide more helpful error messages
    if (error.message.includes('Invalid API key') || error.message.includes('invalid_api_key')) {
      throw new Error('Invalid Supabase API key. Please check your SUPABASE_ANON_KEY in Settings or environment variables.')
    }
    if (error.message.includes('Email not confirmed')) {
      throw new Error('Please check your email and verify your account.')
    }
    throw error
  }
  
  console.log('✅ Sign up successful')
  return data
}

export async function signOut() {
  const supabase = await getSupabaseClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function onAuthStateChange(callback: (user: any) => void) {
  // Only set up one listener per app instance
  if (authStateChangeListenerSet && currentAuthSubscription) {
    return Promise.resolve({ subscription: currentAuthSubscription })
  }
  
  const supabase = await getSupabaseClient()
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    const currentUserId = session?.user?.id || null
    const now = Date.now()
    
    // Aggressively suppress repeated SIGNED_IN events for the same user within 30 seconds
    // This prevents spam when window regains focus or multiple clients are created
    if (event === 'SIGNED_IN' && currentUserId === lastSessionUserId && (now - lastSignInTime) < 30000) {
      // Same user, same session, recent sign-in - completely ignore this duplicate event
      return
    }
    
    // Suppress TOKEN_REFRESHED events that don't change the user
    if (event === 'TOKEN_REFRESHED' && currentUserId === lastSessionUserId) {
      // Token refreshed but same user - don't trigger callback or log
      return
    }
    
    // Only log significant events, not every token refresh or duplicate sign-in
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
      // Only log if it's actually a new sign-in (different user or first time)
      if (event !== 'SIGNED_IN' || currentUserId !== lastSessionUserId) {
        console.log('🔐 Auth state change:', event, session ? 'has session' : 'no session')
      }
    }
    
    // Update tracking
    if (event === 'SIGNED_IN') {
      lastSessionUserId = currentUserId
      lastSignInTime = now
    } else if (event === 'SIGNED_OUT') {
      lastSessionUserId = null
      lastSignInTime = 0
    }
    
    // Handle different auth events
    if (event === 'SIGNED_OUT') {
      // Explicit sign out - clear user
      callback(null)
    } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
      // User signed in or updated - update user
      callback(session?.user ?? null)
    } else if (event === 'TOKEN_REFRESHED') {
      // Token refreshed - only update if session exists and user changed
      if (session?.user && session.user.id !== lastSessionUserId) {
        callback(session.user)
        lastSessionUserId = session.user.id
      }
      // Don't clear user on token refresh failure - session might still be valid
    } else if (session?.user) {
      // Session exists for other events, only update if user changed
      if (session.user.id !== lastSessionUserId) {
        callback(session.user)
        lastSessionUserId = session.user.id
      }
    }
    // For other events without a session, don't change the user state
  })
  
  authStateChangeListenerSet = true
  currentAuthSubscription = subscription
  return Promise.resolve({ subscription })
}
