import { useState, useEffect } from 'react'
import { Draggable } from './components/Draggable'
import { NpcForm } from './components/NpcForm'
import { Chat } from './components/Chat'
import { ActionBar } from './components/ActionBar'
import { WorldTab } from './components/WorldTab'
import { Tabs } from '../ui/components/Tabs'
import { Button } from '../ui/components/Button'
import { Swords } from '../ui/icons/Swords'
import { Gear } from '../ui/icons/Gear'
import type { NpcProfile, NpcAction, ActionLog } from '../types/npc'
import { get, set } from '../lib/storage'
import { NpcWebSocket } from '../lib/ws'

type Tab = 'chat' | 'npc' | 'world' | 'log'

const App = () => {
  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const [npcs, setNpcs] = useState<NpcProfile[]>([])
  const [currentNpc, setCurrentNpc] = useState<NpcProfile | null>(null)
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([])
  const [wsEnabled, setWsEnabled] = useState(false)
  const [ws, setWs] = useState<NpcWebSocket | null>(null)
  const [postMessageEnabled, setPostMessageEnabled] = useState(true)
  const [quickAskMessage, setQuickAskMessage] = useState<string | null>(null)

  useEffect(() => {
    loadNpcs()
    loadSettings()
    
    // Listen for quick ask from popup
    const handleQuickAsk = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail?.message) {
        setQuickAskMessage(customEvent.detail.message)
        setActiveTab('chat')
      }
    }
    
    // Listen in Shadow DOM
    window.addEventListener('paralogue-quick-ask', handleQuickAsk as EventListener)
    
    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const root = document.getElementById('paralogue-root')
        if (root) root.style.display = 'none'
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    
    return () => {
      window.removeEventListener('paralogue-quick-ask', handleQuickAsk as EventListener)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const loadNpcs = async () => {
    const saved = await get<NpcProfile[]>('npcs', [])
    setNpcs(saved)
    if (saved.length > 0 && !currentNpc) {
      setCurrentNpc(saved[0])
    } else if (saved.length === 0) {
      // Create a default NPC if none exists
      const defaultNpc: NpcProfile = {
        id: crypto.randomUUID(),
        name: 'Default NPC',
        emoji: '🤖',
        systemPrompt: 'You are a helpful NPC assistant.',
        traits: [],
      }
      setNpcs([defaultNpc])
      setCurrentNpc(defaultNpc)
      await set('npcs', [defaultNpc])
    }
  }

  const loadSettings = async () => {
    const wsUrl = await get<string>('wsUrl', '')
    setWsEnabled(!!wsUrl)
    const pmEnabled = await get<boolean>('postMessageEnabled', true)
    setPostMessageEnabled(pmEnabled)
  }

  const handleSaveNpc = async (npc: NpcProfile) => {
    const updated = npcs.find((n) => n.id === npc.id)
      ? npcs.map((n) => (n.id === npc.id ? npc : n))
      : [...npcs, npc]
    setNpcs(updated)
    await set('npcs', updated)
    setCurrentNpc(npc)
  }

  const handleDeleteNpc = async (id: string) => {
    const updated = npcs.filter((n) => n.id !== id)
    setNpcs(updated)
    await set('npcs', updated)
    if (currentNpc?.id === id) {
      setCurrentNpc(updated[0] || null)
    }
  }

  const handleAction = (action: NpcAction) => {
    const log: ActionLog = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      npcId: currentNpc?.id || '',
      action,
    }
    setActionLogs([...actionLogs, log])

    if (postMessageEnabled) {
      window.postMessage(
        {
          source: 'PARALOGUE',
          npcId: currentNpc?.id,
          action,
        },
        '*'
      )
    }

    if (ws && ws.isConnected()) {
      ws.sendAction(action)
    }
  }

  const handleConnectWs = async () => {
    try {
      const socket = new NpcWebSocket()
      await socket.connect()
      setWs(socket)
      setWsEnabled(true)
    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
      alert('Failed to connect WebSocket')
    }
  }

  const handleDisconnectWs = () => {
    if (ws) {
      ws.disconnect()
      setWs(null)
      setWsEnabled(false)
    }
  }

  const tabs = [
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'npc', label: 'NPCs', icon: '🤖' },
    { id: 'world', label: 'World', icon: '🌍' },
    { id: 'log', label: 'Log', icon: '📜' },
  ]

  return (
    <Draggable>
      <div className="w-[420px] h-[600px] bg-[#FBF7EF] rounded-card shadow-[0_2px_0_rgba(46,42,37,0.2),0_10px_20px_rgba(46,42,37,0.08)] border border-[#533F31] flex flex-col overflow-hidden pointer-events-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#E9C46A] to-[#D4AF37] p-4 flex items-center justify-between border-b border-[#533F31]/20">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-[#533F31]" />
            <h1 className="font-display text-lg tracking-tight text-[#2E2A25]">
              NPC Chat
            </h1>
          </div>
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="p-1.5 rounded-lg hover:bg-[#FBF7EF]/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#533F31]/40"
            aria-label="Open options"
          >
            <Gear className="h-5 w-5 text-[#533F31]" />
          </button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={(v) => setActiveTab(v as Tab)} items={tabs} />

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden bg-[#F8F1E3]" role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
          {activeTab === 'chat' && (
            <div className="flex flex-col h-full">
              <ActionBar onAction={handleAction} />
              <Chat 
                currentNpc={currentNpc} 
                onAction={handleAction}
                quickAsk={quickAskMessage}
                onQuickAskProcessed={() => setQuickAskMessage(null)}
              />
            </div>
          )}

          {activeTab === 'npc' && (
            <div className="p-4 overflow-y-auto h-full">
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#533F31] mb-2">
                  Select NPC
                </label>
                <select
                  value={currentNpc?.id || ''}
                  onChange={(e) => {
                    const npc = npcs.find((n) => n.id === e.target.value)
                    setCurrentNpc(npc || null)
                  }}
                  className="w-full h-10 px-3 rounded-lg bg-[#FBF7EF] text-[#2E2A25] ring-1 ring-[#533F31]/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-2px_0_rgba(0,0,0,0.05)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#533F31]/40"
                >
                  <option value="">Create New...</option>
                  {npcs.map((npc) => (
                    <option key={npc.id} value={npc.id}>
                      {npc.emoji} {npc.name}
                    </option>
                  ))}
                </select>
              </div>
              <NpcForm npc={currentNpc} onSave={handleSaveNpc} onDelete={handleDeleteNpc} />
            </div>
          )}

          {activeTab === 'world' && (
            <WorldTab
              ws={ws}
              wsEnabled={wsEnabled}
              postMessageEnabled={postMessageEnabled}
              onConnectWs={handleConnectWs}
              onDisconnectWs={handleDisconnectWs}
              onTogglePostMessage={async (enabled) => {
                setPostMessageEnabled(enabled)
                await set('postMessageEnabled', enabled)
              }}
            />
          )}

          {activeTab === 'log' && (
            <div className="p-4 overflow-y-auto h-full space-y-2">
              {actionLogs.length === 0 ? (
                <p className="text-[#2E2A25]/50 text-sm text-center py-8">
                  No actions logged yet
                </p>
              ) : (
                actionLogs
                  .slice()
                  .reverse()
                  .map((log) => {
                    const npc = npcs.find((n) => n.id === log.npcId)
                    return (
                      <div
                        key={log.id}
                        className="bg-[#FBF7EF] rounded-lg p-3 border border-[#533F31]/10"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-[#533F31] font-mono">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span className="text-xs text-[#E9C46A]">
                            {npc?.name || 'Unknown'}
                          </span>
                        </div>
                        <div className="text-sm text-[#2E2A25]">
                          {log.action.type === 'say' && (
                            <span>💬 &quot;{log.action.text}&quot;</span>
                          )}
                          {log.action.type === 'walk' && (
                            <span>
                              🚶 Walk to ({log.action.to.x}, {log.action.to.y})
                            </span>
                          )}
                          {log.action.type === 'emote' && (
                            <span>🎭 {log.action.name}</span>
                          )}
                        </div>
                      </div>
                    )
                  })
              )}
            </div>
          )}
        </div>
      </div>
    </Draggable>
  )
}

export default App
