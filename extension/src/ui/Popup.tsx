import { useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { Card } from './components/Card'
import { Button } from './components/Button'
import { Textarea } from './components/Input'
import { Bubble } from './components/Bubble'
import { MessageContent } from './components/MessageContent'
import { Citations } from './components/Citations'
import { Mascot } from './mascot/Mascot'
import { Sparkle } from './icons/Sparkle'
import { orchestrate } from '../agents/orchestrator'
import { readStream } from '../lib/stream'
import type { ChatMessage } from '../lib/openai'
import { get, set } from '../lib/storage'

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

const Popup = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    checkPanelStatus()
    loadMessages()
  }, [])

  // Save messages whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      saveMessages(messages)
    }
  }, [messages])

  const loadMessages = async () => {
    const saved = await get<ChatMessage[]>('popupMessages', [])
    if (saved.length > 0) {
      setMessages(saved)
    }
  }

  const saveMessages = async (msgs: ChatMessage[]) => {
    await set('popupMessages', msgs)
  }

  const checkPanelStatus = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: 'GAMENPC_STATUS' },
          (response) => {
            if (chrome.runtime.lastError) {
              setIsVisible(false)
            } else {
              setIsVisible(response?.visible || false)
            }
          }
        )
      }
    })
  }

  // Auto-expand textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }, [input])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleToggle = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: 'GAMENPC_TOGGLE' },
          (response) => {
            if (chrome.runtime.lastError) {
              console.log('GameNPC: Could not toggle panel (not on localhost)')
            } else {
              setIsVisible(response?.visible || false)
            }
          }
        )
      }
    })
  }

  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage()
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = { role: 'user', content: input.trim() }
    setInput('')
    setIsLoading(true)

    // Add user message immediately
    setMessages((prev) => {
      const newMsgs = [...prev, userMessage]
      saveMessages(newMsgs)
      return newMsgs
    })

    try {
      // Use orchestrator for multi-agent routing
      const conversationHistory = messages
      const result = await orchestrate(input.trim(), conversationHistory)
      
      if (!result.stream) {
        throw new Error('Failed to get stream')
      }

      // Add empty assistant message with citations
      setMessages((prev) => {
        const newMsgs = [...prev, { 
          role: 'assistant', 
          content: '',
          citations: result.citations
        }]
        saveMessages(newMsgs)
        return newMsgs
      })

      let fullResponse = ''
      for await (const chunk of readStream(result.stream)) {
        fullResponse += chunk
        // Update the last message (assistant message) with streaming content
        setMessages((prev) => {
          const newMsgs = [...prev]
          const lastMsg = newMsgs[newMsgs.length - 1]
          if (lastMsg.role === 'assistant') {
            newMsgs[newMsgs.length - 1] = { 
              ...lastMsg,
              content: fullResponse 
            }
          }
          saveMessages(newMsgs)
          return newMsgs
        })
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages((prev) => {
        const newMsgs = [
          ...prev,
          { role: 'assistant', content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}` },
        ]
        saveMessages(newMsgs)
        return newMsgs
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    if (value.length <= 150) {
      setInput(value)
    }
  }

  return (
    <div className="w-[420px] h-[600px] bg-[#F8F1E3] text-[#2E2A25] flex flex-col">
      <Card className="flex-1 flex flex-col overflow-hidden p-0">
        <header className="p-3 border-b border-[#533F31]/20">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <Mascot className="h-10 w-10 animate-bob" />
              <Sparkle className="absolute -top-1 left-0 h-3 w-3 text-[#E9C46A] animate-pulseSoft" />
              <Sparkle className="absolute -bottom-1 right-0 h-3 w-3 text-[#E9C46A] animate-pulseSoft delay-100" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-xl tracking-tight text-[#2E2A25]">GameNPC: AI Gaming Copilot</h1>
              <p className="text-xs text-[#2E2A25]/70">A copilot for indie game developers</p>
            </div>
          </div>
        </header>

        {/* Chat Messages - increased height */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F8F1E3] rounded-lg mx-4 my-2 min-h-0">
          {messages.length === 0 && (
            <div className="flex items-start gap-3">
              <Mascot className="h-8 w-8 flex-shrink-0" />
              <Bubble from="npc">
                Greetings! How can I assist you with game development today? I can help with documentation, code generation, debugging, and game actions.
              </Bubble>
            </div>
          )}

          {messages.map((msg, i) => (
            <Bubble key={i} from={msg.role === 'user' ? 'you' : 'npc'}>
              {msg.role === 'user' ? (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              ) : (
                <>
                  <MessageContent content={msg.content} />
                  {msg.citations && msg.citations.length > 0 && (
                    <Citations citations={msg.citations} />
                  )}
                </>
              )}
            </Bubble>
          ))}

          {isLoading && (
            <Bubble from="npc">
              <TypingAnimation />
            </Bubble>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 border-t border-[#533F31]/20 bg-[#FBF7EF] space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-[#533F31]">
              Ask the copilot
            </label>
            <span className="text-xs text-[#2E2A25]/50">
              {input.length}/150
            </span>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1 flex flex-col">
              <Textarea
                ref={textareaRef}
                placeholder="How do I make an NPC wander and greet players?"
                value={input}
                onChange={handleChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                className="min-h-[50px] max-h-[120px] overflow-y-auto text-sm"
                rows={1}
              />
            </div>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="px-4 py-2 min-w-[70px] shrink-0"
            >
              Send
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outlined" className="flex-1 text-xs" onClick={handleOpenOptions}>
              Options
            </Button>
            <Button variant="ghost" className="flex-1 text-xs" onClick={handleToggle}>
              {isVisible ? 'Hide' : 'Show'} Panel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

const container = document.getElementById('popup-root')
if (container) {
  const root = createRoot(container)
  root.render(<Popup />)
}

export default Popup
