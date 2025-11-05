import { useState, useEffect } from 'react'
import type { NpcProfile } from '../../types/npc'
import { Field } from '../../ui/components/Field'
import { Input, Textarea } from '../../ui/components/Input'
import { Button } from '../../ui/components/Button'
import { Card } from '../../ui/components/Card'

interface NpcFormProps {
  npc: NpcProfile | null
  onSave: (npc: NpcProfile) => void
  onDelete: (id: string) => void
}

export const NpcForm = ({ npc, onSave, onDelete }: NpcFormProps) => {
  const [formData, setFormData] = useState<NpcProfile>({
    id: npc?.id || crypto.randomUUID(),
    name: npc?.name || '',
    emoji: npc?.emoji || '🤖',
    systemPrompt: npc?.systemPrompt || '',
    traits: npc?.traits || [],
    goals: npc?.goals || [],
    memory: npc?.memory || '',
  })

  useEffect(() => {
    if (npc) {
      setFormData(npc)
    }
  }, [npc])

  const handleSave = () => {
    onSave(formData)
  }

  const handleAddTrait = () => {
    setFormData({
      ...formData,
      traits: [...formData.traits, ''],
    })
  }

  const handleAddGoal = () => {
    setFormData({
      ...formData,
      goals: [...formData.goals, ''],
    })
  }

  return (
    <div className="space-y-4">
      <Field label="Name">
        <Input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="NPC Name"
        />
      </Field>

      <Field label="Emoji">
        <Input
          type="text"
          value={formData.emoji}
          onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
          placeholder="🤖"
          maxLength={2}
        />
      </Field>

      <Field label="System Prompt">
        <Textarea
          value={formData.systemPrompt}
          onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
          placeholder="You are a helpful NPC in an open-world game..."
          className="h-24"
        />
      </Field>

      <Field label="Traits">
        <div className="space-y-2">
          {formData.traits.map((trait, i) => (
            <Input
              key={i}
              type="text"
              value={trait}
              onChange={(e) => {
                const newTraits = [...formData.traits]
                newTraits[i] = e.target.value
                setFormData({ ...formData, traits: newTraits })
              }}
              placeholder="Trait"
            />
          ))}
          <button
            onClick={handleAddTrait}
            className="text-xs text-[var(--stroke)] hover:text-[var(--text)] transition-colors"
          >
            + Add Trait
          </button>
        </div>
      </Field>

      <Field label="Goals">
        <div className="space-y-2">
          {formData.goals.map((goal, i) => (
            <Input
              key={i}
              type="text"
              value={goal}
              onChange={(e) => {
                const newGoals = [...formData.goals]
                newGoals[i] = e.target.value
                setFormData({ ...formData, goals: newGoals })
              }}
              placeholder="Goal"
            />
          ))}
          <button
            onClick={handleAddGoal}
            className="text-xs text-[var(--stroke)] hover:text-[var(--text)] transition-colors"
          >
            + Add Goal
          </button>
        </div>
      </Field>

      <div className="flex gap-2 pt-2">
        <Button className="flex-1" onClick={handleSave}>
          Save NPC
        </Button>
        {npc && (
          <Button variant="danger" onClick={() => onDelete(npc.id)}>
            Delete
          </Button>
        )}
      </div>
    </div>
  )
}
