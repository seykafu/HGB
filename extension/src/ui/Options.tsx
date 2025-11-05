import { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { get, set } from '../lib/storage'
import { Card } from './components/Card'
import { Button } from './components/Button'
import { Field } from './components/Field'
import { Input } from './components/Input'
import { Swords } from './icons/Swords'

const Options = () => {
  const [backendMode, setBackendMode] = useState<'proxy' | 'direct'>('proxy')
  const [proxyUrl, setProxyUrl] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [model, setModel] = useState('')
  const [wsUrl, setWsUrl] = useState('')
  const [darkMode, setDarkMode] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadSettings()
    const root = document.documentElement
    if (root.classList.contains('dark')) {
      setDarkMode(true)
    }
  }, [])

  const loadSettings = async () => {
    const mode = await get<'proxy' | 'direct'>('backendMode', 'proxy')
    const url = await get<string>('proxyUrl', 'http://localhost:3000/api/chat')
    const key = await get<string>('openaiKey', '')
    const modelName = await get<string>('model', 'gpt-4o-mini')
    const ws = await get<string>('wsUrl', 'ws://localhost:5173/npc')

    setBackendMode(mode)
    setProxyUrl(url)
    setOpenaiKey(key)
    setModel(modelName)
    setWsUrl(ws)
  }

  const handleSave = async () => {
    await set('backendMode', backendMode)
    await set('proxyUrl', proxyUrl)
    await set('wsUrl', wsUrl)
    if (backendMode === 'direct') {
      await set('openaiKey', openaiKey)
      await set('model', model)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleThemeToggle = () => {
    const root = document.documentElement
    const newDark = !darkMode
    setDarkMode(newDark)
    if (newDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F1E3] text-[#2E2A25] p-8">
      <div className="max-w-2xl mx-auto">
        <Card className="space-y-6">
          <header className="flex items-center gap-3 pb-4 border-b border-[#533F31]/20">
            <Swords className="h-6 w-6 text-[#533F31]" />
            <h1 className="font-display text-3xl tracking-tight text-[#2E2A25]">Settings</h1>
          </header>

          <div className="space-y-6">
            <div>
              <Field label="Backend Mode">
                <div className="flex gap-4 p-2 bg-[#F8F1E3] rounded-lg">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="proxy"
                      checked={backendMode === 'proxy'}
                      onChange={() => setBackendMode('proxy')}
                      className="rounded"
                    />
                    <span className="text-sm text-[#2E2A25]">Proxy Mode (Next.js API)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="direct"
                      checked={backendMode === 'direct'}
                      onChange={() => setBackendMode('direct')}
                      className="rounded"
                    />
                    <span className="text-sm text-[#2E2A25]">Direct OpenAI</span>
                  </label>
                </div>
              </Field>
              {backendMode === 'direct' && (
                <p className="mt-2 text-xs text-[#C86B6B]">
                  ⚠️ Warning: Your API key will be stored in browser storage
                </p>
              )}
            </div>

            {backendMode === 'proxy' && (
              <Field label="Proxy URL">
                <Input
                  type="text"
                  value={proxyUrl}
                  onChange={(e) => setProxyUrl(e.target.value)}
                  placeholder="http://localhost:3000/api/chat"
                />
              </Field>
            )}

            {backendMode === 'direct' && (
              <>
                <Field label="OpenAI API Key">
                  <Input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                  />
                </Field>
                <Field label="Model">
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="h-10 px-3 rounded-lg bg-[#FBF7EF] text-[#2E2A25] ring-1 ring-[#533F31]/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-2px_0_rgba(0,0,0,0.05)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#533F31]/40"
                  >
                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="gpt-4-turbo">gpt-4-turbo</option>
                    <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                  </select>
                </Field>
              </>
            )}

            <Field label="WebSocket URL (default)">
              <Input
                type="text"
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                placeholder="ws://localhost:5173/npc"
              />
            </Field>

            <div className="flex items-center justify-between p-4 bg-[#F8F1E3] rounded-lg">
              <div>
                <label className="text-sm font-medium text-[#533F31]">Theme</label>
                <p className="text-xs text-[#2E2A25]/70 mt-1">
                  {darkMode ? 'Dark Parchment' : 'Light Parchment'}
                </p>
              </div>
              <button
                onClick={handleThemeToggle}
                className="px-4 py-2 rounded-lg bg-[#F0E4CC] ring-1 ring-[#533F31]/20 hover:bg-[#F0E4CC]/80 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#533F31]/40"
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
            </div>

            <Button className="w-full" onClick={handleSave}>
              {saved ? '✓ Saved!' : 'Save Settings'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

const container = document.getElementById('options-root')
if (container) {
  const root = createRoot(container)
  root.render(<Options />)
}

export default Options
