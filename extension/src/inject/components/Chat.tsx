import { useState, useRef, useEffect } from 'react'
import TypingAnimation from './TypingAnimation'
import { orchestrate } from '../../agents/orchestrator'
import { readStream } from '../../lib/stream'
import type { ChatMessage } from '../../lib/openai'
import type { NpcProfile } from '../../types/npc'
import { Bubble } from '../../ui/components/Bubble'
import { MessageContent } from '../../ui/components/MessageContent'
import { Citations } from '../../ui/components/Citations'
import { Button } from '../../ui/components/Button'
import { Textarea } from '../../ui/components/Input'
import { Mascot } from '../../ui/mascot/Mascot'
import { sendGameAction } from '../../tools/gameBridge'
import { get, set } from '../../lib/storage'

interface ChatProps {
  currentNpc: NpcProfile | null
  onAction: (action: any) => void
  quickAsk?: string | null
  onQuickAskProcessed?: () => void
}

interface ChatSession {
  id: string
  name: string
  messages: ChatMessage[]
  createdAt: number
}

const MAX_MESSAGES_PER_CHAT = 10
const MAX_CHATS = 3

export const Chat = ({ currentNpc, onAction, quickAsk, onQuickAskProcessed }: ChatProps) => {
  const [chats, setChats] = useState<ChatSession[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const activeChat = chats.find(c => c.id === activeChatId) || chats[0]

  useEffect(() => {
    loadChats()
  }, [])

  // Save chats whenever they change
  useEffect(() => {
    if (chats.length > 0) {
      saveChats(chats)
    }
  }, [chats])

  const loadChats = async () => {
    const saved = await get<ChatSession[]>('injectChats', [])
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
    await set('injectChats', chatSessions)
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

  // Handle quick ask from popup
  useEffect(() => {
    if (quickAsk && currentNpc && activeChat) {
      setInput(quickAsk)
      setTimeout(() => {
        handleSendMessage(quickAsk)
        if (onQuickAskProcessed) {
          onQuickAskProcessed()
        }
      }, 100)
    }
  }, [quickAsk, activeChat])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeChat?.messages, isLoading, statusMessage])

  // Auto-expand textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }, [input])

  const handleSendMessage = async (messageText?: string) => {
    const messageToSend = messageText || input.trim()
    if (!messageToSend || !currentNpc || isLoading || !activeChat) return

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
      // Use orchestrator with tool calling and status updates
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

      // Check if response contains game actions and emit them
      const actionRegex = /<<<ACTION\s+type="([^"]+)"(?:\s+([^>]+))?>>>/g
      let match
      while ((match = actionRegex.exec(fullResponse)) !== null) {
        const [, actionType, attrs] = match
        if (actionType === 'say') {
          const textMatch = attrs?.match(/text="([^"]+)"/)
          if (textMatch) {
            onAction({ type: 'say', text: textMatch[1] })
            await sendGameAction({ action: 'say', args: { text: textMatch[1] } })
          }
        } else if (actionType === 'walk') {
          const coordsMatch = attrs?.match(/x=(\d+)\s+y=(\d+)/)
          if (coordsMatch) {
            const action = {
              type: 'walk',
              to: { x: parseInt(coordsMatch[1]), y: parseInt(coordsMatch[2]) },
            }
            onAction(action)
            await sendGameAction({ action: 'walk', args: { x: parseInt(coordsMatch[1]), y: parseInt(coordsMatch[2]) } })
          }
        } else if (actionType === 'emote') {
          const nameMatch = attrs?.match(/name="([^"]+)"/)
          if (nameMatch) {
            onAction({ type: 'emote', name: nameMatch[1] as any })
            await sendGameAction({ action: 'emote', args: { name: nameMatch[1] } })
          }
        }
      }
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

  const handleSend = async () => {
    await handleSendMessage()
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
    <div className="flex flex-col h-full bg-[#F8F1E3]">
      {/* Chat Tabs */}
      <div className="p-3 border-b border-[#533F31]/20 bg-[#FBF7EF]">
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
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!activeChat || activeChat.messages.length === 0 ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Mascot className="h-8 w-8 flex-shrink-0" />
              <Bubble from="npc">
                {currentNpc 
                  ? `Greetings! How can I assist you with NPC agents today? I can help with documentation, code generation, debugging, and game actions.`
                  : `Please create an NPC first in the NPCs tab.`}
              </Bubble>
            </div>
            
            {currentNpc && (
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
                        setTimeout(() => {
                          handleSendMessage(prompt)
                        }, 100)
                      }}
                      className="text-left px-4 py-2.5 rounded-lg bg-[#FBF7EF] hover:bg-[#F0E4CC] ring-1 ring-[#533F31]/20 hover:ring-[#533F31]/40 transition text-sm text-[#2E2A25] group"
                    >
                      <span className="group-hover:text-[#533F31]">{prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {activeChat.messages.map((msg, i) => (
          <div key={i} className="flex flex-col gap-1">
            <Bubble from={msg.role === 'user' ? 'you' : 'npc'}>
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
          </div>
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
        {isAtLimit && activeChat && (
          <div className="p-4 rounded-lg bg-[#C86B6B]/20 ring-2 ring-[#C86B6B] border border-[#C86B6B]/40">
            <p className="text-sm font-medium text-[#2E2A25] mb-2">
              Chat limit reached ({MAX_MESSAGES_PER_CHAT} messages)
            </p>
            <p className="text-xs text-[#2E2A25]/70 mb-3">
              Please reset this chat to continue the conversation.
            </p>
            <Button
              onClick={() => resetChat(activeChat.id)}
              variant="danger"
              className="w-full text-xs"
            >
              Delete and Continue
            </Button>
          </div>
        )}

            {isLoading && !statusMessage && (
              <div className="flex justify-start">
                <Bubble from="npc">
                  <TypingAnimation />
                </Bubble>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-[#533F31]/20 bg-[#FBF7EF]">
        <div className="flex gap-2 items-end">
          <div className="flex-1 flex flex-col">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isAtLimit) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              className="min-h-[60px] max-h-[120px] overflow-y-auto"
              placeholder={isAtLimit 
                ? "Chat limit reached. Reset to continue." 
                : currentNpc 
                  ? "Type a message..." 
                  : "Create an NPC first..."}
              disabled={!currentNpc || isLoading || isAtLimit}
              rows={1}
            />
            <div className="flex justify-end mt-1">
              <span className="text-xs text-[#2E2A25]/50">
                {input.length}/150
              </span>
            </div>
          </div>
          <Button
            onClick={handleSend}
            disabled={!currentNpc || isLoading || !input.trim() || isAtLimit}
            className="px-4 py-2 min-w-[80px] shrink-0"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
