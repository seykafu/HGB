import { get } from './storage'
import type { NpcAction } from '../types/npc'

export class NpcWebSocket {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5

  async connect(): Promise<WebSocket> {
    const url = await get<string>('wsUrl', 'ws://localhost:5173/npc')

    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(url)

        ws.onopen = () => {
          console.log('GameNPC: WebSocket connected')
          this.ws = ws
          this.reconnectAttempts = 0
          resolve(ws)
        }

        ws.onerror = (error) => {
          console.error('GameNPC: WebSocket error', error)
          reject(error)
        }

        ws.onclose = () => {
          this.ws = null
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++
            setTimeout(() => this.connect(), 1000 * this.reconnectAttempts)
          }
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  sendAction(action: NpcAction) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(action))
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}

export const makeNpcSocket = async (): Promise<NpcWebSocket> => {
  const socket = new NpcWebSocket()
  await socket.connect()
  return socket
}

