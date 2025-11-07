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

interface ChatSession {
  id: string
  name: string
  messages: ChatMessage[]
  createdAt: number
}

const MAX_MESSAGES_PER_CHAT = 10
const MAX_CHATS = 3

const Popup = () => {
  const [chats, setChats] = useState<ChatSession[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const activeChat = chats.find(c => c.id === activeChatId) || chats[0]

  useEffect(() => {
    checkPanelStatus()
    loadChats()
  }, [])

  // Save chats whenever they change
  useEffect(() => {
    if (chats.length > 0) {
      saveChats(chats)
    }
  }, [chats])

  const loadChats = async () => {
    const saved = await get<ChatSession[]>('popupChats', [])
    if (saved.length > 0) {
      setChats(saved)
      setActiveChatId(saved[0].id)
    } else {
      // Create first chat
      const newChat: ChatSession = {
        id: crypto.randomUUID(),
        name: 'Chat 1',
        messages: [],
        createdAt: Date.now(),
      }
      setChats([newChat])
      setActiveChatId(newChat.id)
    }
  }

  const saveChats = async (chatSessions: ChatSession[]) => {
    await set('popupChats', chatSessions)
  }

  const createNewChat = () => {
    if (chats.length >= MAX_CHATS) {
      alert(`Maximum of ${MAX_CHATS} chats allowed. Please delete one first.`)
      return
    }

    const newChat: ChatSession = {
      id: crypto.randomUUID(),
      name: `Chat ${chats.length + 1}`,
      messages: [],
      createdAt: Date.now(),
    }
    setChats([...chats, newChat])
    setActiveChatId(newChat.id)
    setInput('')
  }

  const deleteChat = (chatId: string) => {
    const updated = chats.filter(c => c.id !== chatId)
    if (updated.length === 0) {
      // Create a new chat if all are deleted
      const newChat: ChatSession = {
        id: crypto.randomUUID(),
        name: 'Chat 1',
        messages: [],
        createdAt: Date.now(),
      }
      setChats([newChat])
      setActiveChatId(newChat.id)
    } else {
      setChats(updated)
      if (activeChatId === chatId) {
        setActiveChatId(updated[0].id)
      }
    }
    setInput('')
  }

  const resetChat = (chatId: string) => {
    setChats(chats.map(c => 
      c.id === chatId 
        ? { ...c, messages: [] }
        : c
    ))
    setInput('')
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
  }, [activeChat?.messages, isLoading, statusMessage])

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

  const handleSend = async (messageText?: string) => {
    const messageToSend = messageText || input.trim()
    if (!messageToSend || isLoading || !activeChat) return

    // Check message limit
    const userMessageCount = activeChat.messages.filter(m => m.role === 'user').length
    if (userMessageCount >= MAX_MESSAGES_PER_CHAT) {
      return // Should show limit message
    }

    const userMessage: ChatMessage = { role: 'user', content: messageToSend }
    setInput('')
    setIsLoading(true)
    setStatusMessage(null)

    // Add user message immediately
    setChats(prev => {
      const updated = prev.map(c => 
        c.id === activeChat.id
          ? { ...c, messages: [...c.messages, userMessage] }
          : c
      )
      saveChats(updated)
      return updated
    })

    try {
      // Use orchestrator for multi-agent routing with status updates
      const conversationHistory = activeChat.messages
      const result = await orchestrate(messageToSend, conversationHistory, (status) => {
        setStatusMessage(status)
      })
      
      if (!result.stream) {
        throw new Error('Failed to get stream')
      }

      // Add empty assistant message with citations
      setChats(prev => {
        const updated = prev.map(c => 
          c.id === activeChat.id
            ? { ...c, messages: [...c.messages, { 
                role: 'assistant', 
                content: '',
                citations: result.citations
              }] }
            : c
        )
        saveChats(updated)
        return updated
      })

      let fullResponse = ''
      for await (const chunk of readStream(result.stream)) {
        fullResponse += chunk
        // Update the last message (assistant message) with streaming content
        setChats(prev => {
          const updated = prev.map(c => {
            if (c.id === activeChat.id) {
              const newMsgs = [...c.messages]
              const lastMsg = newMsgs[newMsgs.length - 1]
              if (lastMsg.role === 'assistant') {
                newMsgs[newMsgs.length - 1] = { 
                  ...lastMsg,
                  content: fullResponse 
                }
              }
              return { ...c, messages: newMsgs }
            }
            return c
          })
          saveChats(updated)
          return updated
        })
      }
      
      // Clear status when done
      setStatusMessage(null)
    } catch (error) {
      console.error('Chat error:', error)
      setStatusMessage(null)
      setChats(prev => {
        const updated = prev.map(c => 
          c.id === activeChat.id
            ? { ...c, messages: [...c.messages, { 
                role: 'assistant', 
                content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}` 
              }] }
            : c
        )
        saveChats(updated)
        return updated
      })
    } finally {
      setIsLoading(false)
      setStatusMessage(null)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    if (value.length <= 150) {
      setInput(value)
    }
  }

  const userMessageCount = activeChat?.messages.filter(m => m.role === 'user').length || 0
  const isAtLimit = userMessageCount >= MAX_MESSAGES_PER_CHAT

  return (
    <div className="w-[420px] h-[600px] bg-[#F8F1E3] text-[#2E2A25] flex flex-col">
      <Card className="flex-1 flex flex-col overflow-hidden p-0">
        <header className="p-3 border-b border-[#533F31]/20">
          <div className="flex items-center gap-3 mb-3">
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
          
          {/* Chat Tabs */}
          <div className="flex gap-2 items-center">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeChatId === chat.id
                    ? 'bg-[#E9C46A] text-[#2E2A25] ring-1 ring-[#533F31]'
                    : 'bg-[#F8F1E3] text-[#2E2A25]/70 hover:bg-[#F0E4CC] ring-1 ring-[#533F31]/20'
                }`}
              >
                {chat.name}
              </button>
            ))}
            {chats.length < MAX_CHATS && (
              <button
                onClick={createNewChat}
                className="px-2 py-1.5 rounded-lg text-xs bg-[#F8F1E3] text-[#533F31] hover:bg-[#F0E4CC] ring-1 ring-[#533F31]/20"
                title="New Chat"
              >
                +
              </button>
            )}
          </div>
        </header>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F8F1E3] rounded-lg mx-4 my-2 min-h-0">
          {!activeChat || activeChat.messages.length === 0 ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Mascot className="h-8 w-8 flex-shrink-0" />
                <Bubble from="npc">
                  Greetings! How can I assist you with game development today? I can help with documentation, code generation, debugging, and game actions.
                </Bubble>
              </div>
              
              {/* Example Prompts */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-[#533F31] px-2">Try these example prompts:</p>
                <div className="flex flex-col gap-2">
                  {[
                    "How do I publish my game to multiple platforms?",
                    "How do I run an AI-based NPC agent in my game?",
                    "How do I get started?"
                  ].map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setInput(prompt)
                        // Auto-send after a brief delay to ensure state is set
                        setTimeout(() => {
                          handleSend()
                        }, 100)
                      }}
                      className="text-left px-4 py-2.5 rounded-lg bg-[#FBF7EF] hover:bg-[#F0E4CC] ring-1 ring-[#533F31]/20 hover:ring-[#533F31]/40 transition text-sm text-[#2E2A25] group"
                    >
                      <span className="group-hover:text-[#533F31]">{prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {activeChat.messages.map((msg, i) => (
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

              {/* Status message */}
              {statusMessage && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-lg bg-[#E9C46A]/40 ring-1 ring-[#533F31]/20 text-sm text-[#2E2A25]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#533F31] animate-pulse"></div>
                      <span>{statusMessage}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Message limit warning */}
              {isAtLimit && (
                <div className="p-4 rounded-lg bg-[#C86B6B]/20 ring-2 ring-[#C86B6B] border border-[#C86B6B]/40">
                  <p className="text-sm font-medium text-[#2E2A25] mb-2">
                    Chat limit reached ({MAX_MESSAGES_PER_CHAT} messages)
                  </p>
                  <p className="text-xs text-[#2E2A25]/70 mb-3">
                    Please reset this chat to continue the conversation.
                  </p>
                  <Button
                    onClick={() => activeChat && resetChat(activeChat.id)}
                    variant="danger"
                    className="w-full text-xs"
                  >
                    Delete and Continue
                  </Button>
                </div>
              )}

              {isLoading && !statusMessage && (
                <Bubble from="npc">
                  <TypingAnimation />
                </Bubble>
              )}
            </>
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
                placeholder={isAtLimit ? "Chat limit reached. Reset to continue." : "How do I make an NPC wander and greet players?"}
                value={input}
                onChange={handleChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !isAtLimit) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                className="min-h-[50px] max-h-[120px] overflow-y-auto text-sm"
                rows={1}
                disabled={isAtLimit}
              />
            </div>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || isAtLimit}
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
