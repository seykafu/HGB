import { NextRequest, NextResponse } from 'next/server'
import { OpenAI } from 'openai'

export async function POST(request: NextRequest) {
  try {
    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    // Support both 'message' (old format) and 'messages' (new format)
    const { message, messages } = body

    // If messages array is provided, use it (full conversation history)
    // Otherwise, fall back to single message format
    let conversationMessages: Array<{ role: string; content: string }> = []
    
    if (messages && Array.isArray(messages)) {
      // Use the full conversation history
      conversationMessages = messages.map((msg: any) => ({
        role: msg.role || 'user',
        content: msg.content || '',
      }))
    } else if (message) {
      // Legacy format: single message
      conversationMessages = [
        {
          role: 'system',
          content:
            "You're a Copilot called Paralogue, an AI assistant that's designed to help people who have cool story ideas for games but don't know how to get started. Always make sure to only answer questions related to game development, narrative design, and how any aspiring game dev can get started for newbies. Keep all responses to 250 words or less."
        },
        {
          role: 'user',
          content: message
        }
      ]
    } else {
      return NextResponse.json(
        { error: 'Message or messages array is required' },
        { status: 400 }
      )
    }

    // Ensure we have at least one message
    if (conversationMessages.length === 0) {
      return NextResponse.json(
        { error: 'No messages provided' },
        { status: 400 }
      )
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: conversationMessages as any,
      max_tokens: 1000,
    })

    return NextResponse.json({
      choices: [
        {
          message: {
            content: completion.choices[0]?.message?.content || 'No response generated'
          }
        }
      ]
    })
  } catch (error: any) {
    console.error('OpenAI API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get response from OpenAI',
        details: error.message 
      },
      { status: 500 }
    )
  }
}
