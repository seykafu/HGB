import { useState, useEffect } from 'react'
import { get, set } from '../../lib/storage'
import { NpcWebSocket } from '../../lib/ws'
import { Field } from '../../ui/components/Field'
import { Input } from '../../ui/components/Input'
import { Button } from '../../ui/components/Button'

interface WorldTabProps {
  ws: NpcWebSocket | null
  wsEnabled: boolean
  postMessageEnabled: boolean
  onConnectWs: () => Promise<void>
  onDisconnectWs: () => void
  onTogglePostMessage: (enabled: boolean) => Promise<void>
}

export const WorldTab = ({
  ws,
  wsEnabled,
  postMessageEnabled,
  onConnectWs,
  onDisconnectWs,
  onTogglePostMessage,
}: WorldTabProps) => {
  const [wsUrl, setWsUrl] = useState('')

  useEffect(() => {
    get<string>('wsUrl', 'ws://localhost:5173/npc').then(setWsUrl)
  }, [])

  const handleWsUrlChange = async (value: string) => {
    setWsUrl(value)
    await set('wsUrl', value)
  }

  return (
    <div className="p-4 space-y-4">
      <Field label="WebSocket URL">
        <Input
          type="text"
          value={wsUrl}
          onChange={(e) => handleWsUrlChange(e.target.value)}
          placeholder="ws://localhost:5173/npc"
        />
      </Field>

      <div className="flex items-center gap-2 p-3 bg-[var(--bg)] rounded-lg">
        <input
          type="checkbox"
          checked={postMessageEnabled}
          onChange={(e) => onTogglePostMessage(e.target.checked)}
          className="rounded"
          id="postmessage-toggle"
        />
        <label htmlFor="postmessage-toggle" className="text-sm text-[var(--text)]">
          Enable postMessage
        </label>
      </div>

      <div className="flex gap-2">
        {ws && ws.isConnected() ? (
          <>
            <div className="flex items-center gap-2 px-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulseSoft" />
              <span className="text-sm text-[var(--text)]/70">Connected</span>
            </div>
            <Button variant="danger" onClick={onDisconnectWs}>
              Disconnect WS
            </Button>
          </>
        ) : (
          <Button onClick={onConnectWs}>
            Connect WS
          </Button>
        )}
      </div>
    </div>
  )
}
