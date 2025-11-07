import { useState, useEffect, useRef } from 'react'
import { Card } from '../ui/components/Card'
import { Button } from '../ui/components/Button'
import { Textarea } from '../ui/components/Input'
import { Bubble } from '../ui/components/Bubble'
import { MessageContent } from '../ui/components/MessageContent'
import { Mascot } from '../ui/mascot/Mascot'
import { orchestrate } from '../agents/orchestrator'
import { readStream } from '../lib/stream'
import type { ChatMessage } from '../lib/openai'
import { PhaserGameRuntime } from '../game/engine/phaserRuntime'
import { DialogueUI } from '../game/narrative/ui'
import { DialogueRunner } from '../game/narrative/runner'
import type { DialogueGraph } from '../game/narrative/types'
import { saveFiles, getGame } from '../services/projects'
import { exportGame } from '../services/export'
const TypingAnimation = () => {
  return (
    <div className="flex items-center space-x-2">
      <div className="w-2 h-2 rounded-full bg-[#533F31] animate-pulse"></div>
      <div
        className="w-2 h-2 rounded-full bg-[#533F31] animate-pulse"
        style={{ animationDelay: '0.2s' }}
      ></div>
      <div
        className="w-2 h-2 rounded-full bg-[#533F31] animate-pulse"
        style={{ animationDelay: '0.4s' }}
      ></div>
    </div>
  )
}

interface PlaygroundProps {
  gameId: string | null
  initialPrompt?: string
  onBack: () => void
}

export const Playground = ({ gameId, initialPrompt, onBack }: PlaygroundProps) => {
  const [input, setInput] = useState(initialPrompt || '')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [phaserContainer, setPhaserContainer] = useState<HTMLDivElement | null>(null)
  const [gameRuntime, setGameRuntime] = useState<PhaserGameRuntime | null>(null)
  const [dialogueRunner, setDialogueRunner] = useState<DialogueRunner | null>(null)
  const [projectName, setProjectName] = useState('Untitled Game')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (phaserContainer && !gameRuntime) {
      const runtime = new PhaserGameRuntime(phaserContainer)
      setGameRuntime(runtime)
    }

    if (gameId) {
      loadGameInfo()
    }

    if (initialPrompt) {
      setTimeout(() => {
        handleSend(initialPrompt)
      }, 100)
    }

    return () => {
      if (gameRuntime) {
        gameRuntime.destroy()
      }
    }
  }, [phaserContainer, gameId, initialPrompt])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading, statusMessage])

  const loadGameInfo = async () => {
    if (!gameId) return
    try {
      const game = await getGame(gameId)
      setProjectName(game.title)
    } catch (error) {
      console.error('Failed to load game info:', error)
    }
  }

  const handleSend = async (messageText?: string) => {
    const messageToSend = messageText || input.trim()
    if (!messageToSend || isLoading || !gameId) return

    const userMessage: ChatMessage = { role: 'user', content: messageToSend }
    setInput('')
    setIsLoading(true)
    setStatusMessage(null)

    setMessages(prev => [...prev, userMessage])

    try {
      const result = await orchestrate(messageToSend, messages, (status) => {
        setStatusMessage(status)
      })

      if (!result.stream) {
        throw new Error('Failed to get stream')
      }

      let fullResponse = ''
      const assistantMessage: ChatMessage = { role: 'assistant', content: '', citations: result.citations }
      setMessages(prev => [...prev, assistantMessage])

      for await (const chunk of readStream(result.stream)) {
        fullResponse += chunk
        setMessages(prev => {
          const updated = [...prev]
          const lastMsg = updated[updated.length - 1]
          if (lastMsg.role === 'assistant') {
            updated[updated.length - 1] = { ...lastMsg, content: fullResponse }
          }
          return updated
        })
      }

      setStatusMessage(null)
      setHasUnsavedChanges(true)
    } catch (error) {
      console.error('Chat error:', error)
      setStatusMessage(null)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`
      }])
    } finally {
      setIsLoading(false)
      setStatusMessage(null)
    }
  }

  const handleSave = async () => {
    if (!gameId) return
    try {
      // TODO: Collect current project state and save
      await saveFiles(gameId, [])
      setHasUnsavedChanges(false)
      alert('Game saved!')
    } catch (error) {
      alert(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleExport = async () => {
    if (!gameId) return
    try {
      const exportPath = await exportGame(gameId)
      alert(`Game exported to: ${exportPath}`)
    } catch (error) {
      alert(`Failed to export: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#F8F1E3]">
      {/* Top Bar */}
      <div className="p-3 border-b border-[#533F31]/20 bg-[#FBF7EF] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} size="sm">
            ← Back
          </Button>
          <h2 className="font-display text-lg text-[#2E2A25]">{projectName}</h2>
          {hasUnsavedChanges && (
            <span className="text-xs text-[#533F31]/60">• Unsaved changes</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outlined" onClick={handleSave} size="sm" disabled={!hasUnsavedChanges}>
            Save
          </Button>
          <Button variant="outlined" onClick={handleExport} size="sm">
            Export
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel (Left) */}
        <div className="w-96 border-r border-[#533F31]/20 bg-[#FBF7EF] flex flex-col">
          <div className="p-4 border-b border-[#533F31]/20">
            <div className="flex items-center gap-2 mb-2">
              <Mascot className="h-6 w-6" />
              <h3 className="font-medium text-[#2E2A25]">AI Assistant</h3>
            </div>
            <p className="text-xs text-[#2E2A25]/70">
              Describe your game, add NPCs, create scenes, and build dialogue.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <Bubble from="npc">
                <p>Describe your 2D narrative game (setting, main character, goals).</p>
              </Bubble>
            )}

            {messages.map((msg, i) => (
              <Bubble key={i} from={msg.role === 'user' ? 'you' : 'npc'}>
                {msg.role === 'user' ? (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                ) : (
                  <MessageContent content={msg.content} />
                )}
              </Bubble>
            ))}

            {statusMessage && (
              <div className="px-3 py-2 rounded-lg bg-[#E9C46A]/40 ring-1 ring-[#533F31]/20 text-sm text-[#2E2A25]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#533F31] animate-pulse"></div>
                  <span>{statusMessage}</span>
                </div>
              </div>
            )}

            {isLoading && !statusMessage && (
              <Bubble from="npc">
                <TypingAnimation />
              </Bubble>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-[#533F31]/20">
            <div className="flex gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Add an NPC, create a scene, branch dialogue..."
                className="flex-1 min-h-[60px] max-h-[120px]"
                rows={2}
              />
              <Button onClick={() => handleSend()} disabled={!input.trim() || isLoading}>
                Send
              </Button>
            </div>
          </div>
        </div>

        {/* Design Board & Play Panel (Right) */}
        <div className="flex-1 flex flex-col">
          {/* Design Board */}
          <div className="flex-1 p-4 border-b border-[#533F31]/20 bg-[#FBF7EF] overflow-y-auto">
            <h3 className="font-medium text-[#2E2A25] mb-4">Design Board</h3>
            <div className="text-sm text-[#2E2A25]/70">
              Game structure, scenes, and dialogue will appear here as you build.
            </div>
          </div>

          {/* Play Panel */}
          <div className="h-80 border-t border-[#533F31]/20 bg-[#2E2A25] p-4">
            <h3 className="font-medium text-[#F8F1E3] mb-2">Play Preview</h3>
            <div
              ref={setPhaserContainer}
              className="w-full h-full bg-[#1a1a1a] rounded"
              style={{ minHeight: '300px' }}
            />
            {dialogueRunner && (
              <div className="mt-4">
                <DialogueUI runner={dialogueRunner} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

