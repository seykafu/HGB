import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { get } from './storage'

let supabaseClient: SupabaseClient | null = null

export async function getSupabaseClient(): Promise<SupabaseClient> {
  if (supabaseClient) {
    return supabaseClient
  }

  // Default Supabase URL (can be overridden in Settings)
  const defaultSupabaseUrl = 'https://msomzmvhvgsxfxrpvrzp.supabase.co'
  
  // Get Supabase config from storage, environment variable, or use defaults
  let supabaseUrl = await get<string>('supabaseUrl', '')
  let supabaseAnonKey = await get<string>('supabaseAnonKey', '')
  
  // Use default URL if not set
  if (!supabaseUrl) {
    supabaseUrl = defaultSupabaseUrl
  }
  
  // Try to get anon key from environment variable first
  if (!supabaseAnonKey && typeof window !== 'undefined' && window.electronAPI?.env) {
    const envKey = await window.electronAPI.env.get('SUPABASE_ANON_KEY')
    if (envKey) {
      supabaseAnonKey = envKey
    }
  }
  
  // If still no key, try to get from storage (user may have set it)
  if (!supabaseAnonKey) {
    throw new Error('Supabase anon key not found. Please set SUPABASE_ANON_KEY environment variable or configure it in Settings.')
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  })

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
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

export async function signUp(email: string, password: string) {
  const supabase = await getSupabaseClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const supabase = await getSupabaseClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function onAuthStateChange(callback: (user: any) => void) {
  const supabase = await getSupabaseClient()
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    // Suppress errors from auth state changes when offline
    try {
      callback(session?.user ?? null)
    } catch (error: any) {
      // Silently handle offline errors
      if (!error.message?.includes('ERR_INTERNET_DISCONNECTED')) {
        console.error('Auth state change error:', error)
      }
    }
  })
  return Promise.resolve({ subscription })
}
