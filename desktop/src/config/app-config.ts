/**
 * App configuration - generated at build time
 * This file is populated from environment variables during the build process
 */

// These values are set at build time via environment variables
// If not set, they will be empty strings and the app will fall back to user settings
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Debug logging (only in development)
if (import.meta.env.DEV) {
  console.log('Build-time config:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    urlLength: supabaseUrl.length,
    keyLength: supabaseAnonKey.length,
  })
}

export const BUILD_TIME_CONFIG = {
  SUPABASE_URL: supabaseUrl,
  SUPABASE_ANON_KEY: supabaseAnonKey,
}

