import { useState, useEffect } from 'react'
import { Card } from '../ui/components/Card'
import { Button } from '../ui/components/Button'
import { get, set } from '../lib/storage'

interface SettingsProps {
  onBack: () => void
  onSave?: () => void
}

export const Settings = ({ onBack, onSave }: SettingsProps) => {
  const [model, setModel] = useState('gpt-5')
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    const defaultSupabaseUrl = 'https://msomzmvhvgsxfxrpvrzp.supabase.co'
    
    let m = await get<string>('model', 'gpt-5')
    let url = await get<string>('supabaseUrl', '')
    let key = await get<string>('supabaseAnonKey', '')
    
    setModel(m)
    setSupabaseUrl(url || defaultSupabaseUrl)
    setSupabaseAnonKey(key || '')
  }

  const handleSave = async () => {
    setLoading(true)
    setSaved(false)
    try {
      await set('model', model)
      await set('supabaseUrl', supabaseUrl)
      await set('supabaseAnonKey', supabaseAnonKey)
      
      // Clear the Supabase client cache so it uses new settings
      const { clearSupabaseClient } = await import('../lib/supabase')
      clearSupabaseClient()
      
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      
      // Call onSave callback if provided
      if (onSave) {
        setTimeout(() => {
          onSave()
        }, 500)
      }
    } catch (error) {
      alert(`Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#F8F1E3] p-4">
      <Card className="w-full max-w-2xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl tracking-tight text-[#2E2A25]">Settings</h1>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
        </div>

        <div className="space-y-6">
          {/* Supabase Configuration */}
          <div>
            <h2 className="font-medium text-lg text-[#2E2A25] mb-4">Supabase Configuration</h2>
            <p className="text-sm text-[#2E2A25]/70 mb-4">
              Configure your Supabase project to enable authentication and data storage.
              Get your keys from: <a href="https://supabase.com/dashboard/project/msomzmvhvgsxfxrpvrzp/settings/api" target="_blank" rel="noopener noreferrer" className="text-[#E9C46A] underline">Supabase Dashboard → Settings → API</a>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#533F31] mb-2">
                  Supabase URL
                </label>
                <input
                  type="text"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://your-project.supabase.co"
                  className="w-full px-3 py-2 rounded-lg bg-[#FBF7EF] border border-[#533F31]/20 text-[#2E2A25]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#533F31] mb-2">
                  Supabase Anon Key
                </label>
                <input
                  type="password"
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-3 py-2 rounded-lg bg-[#FBF7EF] border border-[#533F31]/20 text-[#2E2A25]"
                />
                <p className="text-xs text-[#2E2A25]/60 mt-1">
                  This is your public anon key (safe to use in client apps)
                </p>
              </div>
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <h2 className="font-medium text-lg text-[#2E2A25] mb-4">AI Model</h2>
            <p className="text-sm text-[#2E2A25]/70 mb-4">
              Select the AI model to use for game generation and chat.
            </p>
            <div>
              <label className="block text-sm font-medium text-[#533F31] mb-2">
                Model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#FBF7EF] border border-[#533F31]/20 text-[#2E2A25]"
              >
                <option value="gpt-5">GPT-5</option>
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
              </select>
            </div>
          </div>

          {saved && (
            <div className="p-3 rounded-lg bg-[#E9C46A]/20 ring-1 ring-[#E9C46A] text-sm text-[#2E2A25]">
              Settings saved successfully!
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={loading} className="flex-1">
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

