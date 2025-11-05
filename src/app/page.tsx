'use client'

import { useState, FormEvent, ChangeEvent, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import axios from 'axios'
import TypingAnimation from './components/TypingAnimation'
import { createClient } from '@/lib/supabase/client'

interface ChatMessage {
  type: 'user' | 'bot'
  message: string
}

export default function Home() {
  const router = useRouter()
  const [inputValue, setInputValue] = useState<string>('')
  const [chatLog, setChatLog] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [user, setUser] = useState<any>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoadingUser(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoadingUser(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!inputValue.trim() || isLoading) return

    const messageToSend = inputValue.trim()
    setChatLog((prevChatLog) => [...prevChatLog, { type: 'user', message: messageToSend }])
    setInputValue('')
    sendMessage(messageToSend)
  }

  const sendMessage = async (message: string) => {
    setIsLoading(true)

    try {
      const response = await axios.post('/api/chat', { message })
      setChatLog((prevChatLog) => [
        ...prevChatLog,
        { type: 'bot', message: response.data.choices[0].message.content }
      ])
    } catch (error: any) {
      console.error('Error sending message:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Sorry, I encountered an error. Please try again.'
      setChatLog((prevChatLog) => [
        ...prevChatLog,
        { type: 'bot', message: `Error: ${errorMessage}` }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleTextareaChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    // Auto-resize textarea
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const form = e.currentTarget.form
      if (form) {
        form.requestSubmit()
      }
    }
  }

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-[700px]">
      <div className="flex flex-col h-screen bg-gray-900">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text font-bold text-4xl">
            Paralogue
          </h1>
          <div className="flex items-center gap-4">
            {user && (
              <div className="text-sm text-gray-400">
                {user.email}
              </div>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
        <div className="flex-grow p-6 overflow-y-auto">
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col-reverse space-y-4 space-y-reverse">
              {chatLog.map((message, index) => (
                <div
                  key={`${message.type}-${index}-${message.message.slice(0, 10)}`}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`flex flex-col ${message.type === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`flex items-center justify-center px-4 py-2 rounded-lg ${
                        message.type === 'user' ? 'bg-blue-500' : 'bg-gray-700'
                      }`}
                    >
                      <p
                        className={`text-sm ${
                          message.type === 'user' ? 'text-white' : 'text-gray-200'
                        }`}
                      >
                        {message.message}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div key={chatLog.length} className="flex justify-start">
                  <div className="bg-gray-800 rounded-lg p-4 text-white max-w-sm">
                    <TypingAnimation />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-none p-6">
          <div className="flex rounded-lg border border-gray-700 bg-gray-800">
            <textarea
              className="flex-grow px-4 py-2 bg-transparent text-white focus:outline-none"
              placeholder="Type your question!"
              rows={1}
              style={{ resize: 'none', overflow: 'hidden' }}
              value={inputValue}
              onChange={handleTextareaChange}
              onKeyPress={handleKeyPress}
            />
          </div>
          <button
            type="submit"
            className="mt-2 bg-purple-500 rounded-lg px-4 py-2 text-white font-semibold focus:outline-none hover:bg-purple-600 transition-colors duration-300"
          >
            Send
          </button>
        </form>
        <div className="flex justify-center p-4">
          <Image src="/vercel.svg" alt="Vercel Logo" width={72} height={16} />
        </div>
      </div>
    </div>
  )
}
