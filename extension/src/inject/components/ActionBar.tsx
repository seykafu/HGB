import type { NpcAction } from '../../types/npc'
import { Button } from '../../ui/components/Button'

interface ActionBarProps {
  onAction: (action: NpcAction) => void
}

export const ActionBar = ({ onAction }: ActionBarProps) => {
  const handleSay = () => {
    const text = prompt('What should the NPC say?')
    if (text) {
      onAction({ type: 'say', text })
    }
  }

  const handleWalk = () => {
    const x = prompt('X coordinate?')
    const y = prompt('Y coordinate?')
    if (x && y) {
      onAction({ type: 'walk', to: { x: parseInt(x), y: parseInt(y) } })
    }
  }

  const handleEmote = (name: 'wave' | 'shrug' | 'dance' | 'laugh' | 'think') => {
    onAction({ type: 'emote', name })
  }

  return (
    <div className="p-4 border-b border-[var(--stroke)]/20 bg-[var(--bg-muted)]">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleSay}
          className="text-xs px-3 py-1.5"
          variant="ghost"
        >
          💬 Say
        </Button>
        <Button
          onClick={handleWalk}
          className="text-xs px-3 py-1.5"
          variant="ghost"
        >
          🚶 Walk
        </Button>
        <Button
          onClick={() => handleEmote('wave')}
          className="text-xs px-3 py-1.5"
          variant="ghost"
        >
          👋 Wave
        </Button>
        <Button
          onClick={() => handleEmote('dance')}
          className="text-xs px-3 py-1.5"
          variant="ghost"
        >
          💃 Dance
        </Button>
        <Button
          onClick={() => handleEmote('think')}
          className="text-xs px-3 py-1.5"
          variant="ghost"
        >
          🤔 Think
        </Button>
      </div>
    </div>
  )
}
