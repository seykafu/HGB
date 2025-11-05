import { NextRequest, NextResponse } from 'next/server'
import { OpenAI } from 'openai'

export async function POST(request: NextRequest) {
  try {
    const referer = request.headers.get('referer') || request.headers.get('referrer')

    if (process.env.NODE_ENV !== 'development') {
      if (!referer || referer !== process.env.APP_URL) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await request.json()
    const url = 'https://api.openai.com/v1/chat/completions'
    const headers = {
      'Content-type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    })

    const data = await response.json()

    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { message: 'Something went wrong' },
      { status: 500 }
    )
  }
}

