import { useState, useEffect } from 'react'
import { Card } from '../ui/components/Card'
import { Button } from '../ui/components/Button'
import { Input } from '../ui/components/Input'
import { get, set } from '../lib/storage'

interface SettingsProps {
  onBack: () => void
}

export const Settings = ({ onBack }: SettingsProps) => {
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [model, setModel] = useState('gpt-5')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    const defaultUrl = 'https://msomzmvhvgsxfxrpvrzp.supabase.co'
    const url = await get<string>('supabaseUrl', defaultUrl)
    
    // Try to get anon key from environment variable
    let key = await get<string>('supabaseAnonKey', '')
    if (!key && typeof window !== 'undefined' && window.electronAPI?.env) {
      const envKey = await window.electronAPI.env.get('SUPABASE_ANON_KEY')
      if (envKey) {
        key = envKey
      }
    }
    
    const openai = await get<string>('openaiKey', '')
    const m = await get<string>('model', 'gpt-5')
    setSupabaseUrl(url || defaultUrl)
    setSupabaseAnonKey(key)
    setOpenaiKey(openai)
    setModel(m)
  }

  const handleSave = async () => {
    setLoading(true)
    setSaved(false)
    try {
      await set('supabaseUrl', supabaseUrl)
      await set('supabaseAnonKey', supabaseAnonKey)
      await set('openaiKey', openaiKey)
      await set('model', model)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
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
              Required for authentication and game storage. Get these from your Supabase project dashboard.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#533F31] mb-2">
                  Supabase URL
                </label>
                <Input
                  type="text"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xxxxx.supabase.co"
                />
                <p className="text-xs text-[#2E2A25]/50 mt-1">
                  Found in Settings → API → Project URL
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#533F31] mb-2">
                  Supabase Anon Key
                </label>
                <Input
                  type="password"
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                />
                <p className="text-xs text-[#2E2A25]/50 mt-1">
                  Found in Settings → API → anon/public key
                </p>
              </div>
            </div>
          </div>

          {/* OpenAI Configuration */}
          <div>
            <h2 className="font-medium text-lg text-[#2E2A25] mb-4">OpenAI Configuration</h2>
            <p className="text-sm text-[#2E2A25]/70 mb-4">
              Required for AI chat functionality. You can also set OPENAI_API_KEY environment variable.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#533F31] mb-2">
                  OpenAI API Key
                </label>
                <Input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                />
              </div>

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
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                </select>
              </div>
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

