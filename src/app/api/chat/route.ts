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
    const { message } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: [
        {
          role: 'system',
          content:
            "You're a Copilot called Paralogue, an AI assistant that's designed to help people who have cool story ideas for games but don't know how to get started. Always make sure to only answer questions related to game development, narrative design, and how any aspiring game dev can get started for newbies. Keep all responses to 250 words or less."
        },
        {
          role: 'user',
          content: message
        }
      ],
      max_tokens: 500,
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

