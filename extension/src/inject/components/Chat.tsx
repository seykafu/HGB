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

interface ChatProps {
  currentNpc: NpcProfile | null
  onAction: (action: any) => void
  quickAsk?: string | null
  onQuickAskProcessed?: () => void
}

interface ToolCallChip {
  tool: string
  args: any
  timestamp: number
}

export const Chat = ({ currentNpc, onAction, quickAsk, onQuickAskProcessed }: ChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [toolCalls, setToolCalls] = useState<ToolCallChip[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Handle quick ask from popup
  useEffect(() => {
    if (quickAsk && currentNpc) {
      setInput(quickAsk)
      setTimeout(() => {
        handleSendMessage(quickAsk)
        if (onQuickAskProcessed) {
          onQuickAskProcessed()
        }
      }, 100)
    }
  }, [quickAsk])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading, toolCalls])

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
    if (!messageToSend || !currentNpc || isLoading) return

    const userMessage: ChatMessage = { role: 'user', content: messageToSend }
    setInput('')
    setIsLoading(true)
    setToolCalls([])

    // Add user message immediately
    setMessages((prev) => [...prev, userMessage])

    try {
      // Use orchestrator with tool calling
      const conversationHistory = messages
      const result = await orchestrate(messageToSend, conversationHistory)
      
      if (!result.stream) {
        throw new Error('Failed to get stream')
      }

      // Add empty assistant message with citations
      setMessages((prev) => [...prev, { 
        role: 'assistant', 
        content: '',
        citations: result.citations
      }])

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
          return newMsgs
        })
      }

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
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}` }])
    } finally {
      setIsLoading(false)
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

  return (
    <div className="flex flex-col h-full bg-[#F8F1E3]">
      {messages.length === 0 && (
        <div className="p-4 border-b border-[#533F31]/20 bg-[#FBF7EF]">
          <div className="flex items-start gap-3">
            <Mascot className="h-8 w-8 flex-shrink-0" />
            <div className="flex-1">
              <Bubble from="npc">
                {currentNpc 
                  ? `Greetings! How can I assist you with NPC agents today? I can help with documentation, code generation, debugging, and game actions.`
                  : `Please create an NPC first in the NPCs tab.`}
              </Bubble>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
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

        {/* Tool call chips */}
        {toolCalls.map((toolCall, i) => (
          <div key={i} className="flex justify-start">
            <div className="px-3 py-1.5 rounded-lg bg-[#E9C46A]/40 ring-1 ring-[#533F31]/20 text-xs text-[#2E2A25]">
              🔧 TOOL: <span className="font-semibold">{toolCall.tool}</span>
              {toolCall.args && Object.keys(toolCall.args).length > 0 && (
                <span className="ml-1 opacity-70">
                  ({Object.keys(toolCall.args).join(', ')})
                </span>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <Bubble from="npc">
              <TypingAnimation />
            </Bubble>
          </div>
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
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              className="min-h-[60px] max-h-[120px] overflow-y-auto"
              placeholder={currentNpc ? "Type a message..." : "Create an NPC first..."}
              disabled={!currentNpc || isLoading}
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
            disabled={!currentNpc || isLoading || !input.trim()}
            className="px-4 py-2 min-w-[80px] shrink-0"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
