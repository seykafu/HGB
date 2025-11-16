#!/usr/bin/env node
/**
 * Script to check if environment variables are set correctly
 */

const requiredVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY'
]

console.log('Checking environment variables...\n')

let allSet = true

for (const varName of requiredVars) {
  const value = process.env[varName]
  if (value) {
    const displayValue = varName.includes('KEY') 
      ? `${value.substring(0, 20)}... (${value.length} chars)`
      : value
    console.log(`✓ ${varName}: ${displayValue}`)
  } else {
    console.log(`✗ ${varName}: NOT SET`)
    allSet = false
  }
}

console.log('')

if (allSet) {
  console.log('✓ All environment variables are set!')
  console.log('You can now run: npm run build:mac')
  process.exit(0)
} else {
  console.log('✗ Some environment variables are missing!')
  console.log('\nTo set them:')
  console.log('  export VITE_SUPABASE_URL=https://msomzmvhvgsxfxrpvrzp.supabase.co')
  console.log('  export VITE_SUPABASE_ANON_KEY=your_key_here')
  console.log('\nOr create desktop/.env.local with:')
  console.log('  VITE_SUPABASE_URL=https://msomzmvhvgsxfxrpvrzp.supabase.co')
  console.log('  VITE_SUPABASE_ANON_KEY=your_key_here')
  process.exit(1)
}

