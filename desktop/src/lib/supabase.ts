import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { get } from './storage'

let supabaseClient: SupabaseClient | null = null

export async function getSupabaseClient(): Promise<SupabaseClient> {
  if (supabaseClient) {
    return supabaseClient
  }

  // Get Supabase config from storage or environment
  const supabaseUrl = await get<string>('supabaseUrl', '')
  const supabaseAnonKey = await get<string>('supabaseAnonKey', '')

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration not found. Please set supabaseUrl and supabaseAnonKey in Settings.')
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
    callback(session?.user ?? null)
  })
  return Promise.resolve({ subscription })
}
