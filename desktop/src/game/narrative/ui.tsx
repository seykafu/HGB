import { useState, useEffect } from 'react'
import { DialogueRunner } from './runner'
import type { DialogueNode, DialogueChoice } from './types'
import { Bubble } from '../../ui/components/Bubble'
import { Button } from '../../ui/components/Button'
import { Card } from '../../ui/components/Card'

interface DialogueUIProps {
  runner: DialogueRunner
  onComplete?: () => void
}

export const DialogueUI = ({ runner, onComplete }: DialogueUIProps) => {
  const [currentNode, setCurrentNode] = useState<DialogueNode | null>(null)
  const [choices, setChoices] = useState<DialogueChoice[]>([])
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    const runDialogue = async () => {
      const gen = runner.run()
      let result = await gen.next()

      while (!result.done) {
        const node = result.value as DialogueNode

        if (node.type === 'line') {
          setCurrentNode(node)
          setChoices([])
          // Auto-advance after a delay or wait for click
          result = await gen.next()
        } else if (node.type === 'choice') {
          setCurrentNode(node)
          setChoices(node.choices || [])
          // Wait for user selection
          break
        } else {
          result = await gen.next()
        }
      }

      if (result.done) {
        setIsComplete(true)
        if (onComplete) onComplete()
      }
    }

    runDialogue()
  }, [runner, onComplete])

  const handleChoice = async (index: number) => {
    const gen = runner.run()
    let result = await gen.next(index)

    while (!result.done) {
      const node = result.value as DialogueNode

      if (node.type === 'line') {
        setCurrentNode(node)
        setChoices([])
        result = await gen.next()
      } else if (node.type === 'choice') {
        setCurrentNode(node)
        setChoices(node.choices || [])
        break
      } else {
        result = await gen.next()
      }
    }

    if (result.done) {
      setIsComplete(true)
      if (onComplete) onComplete()
    }
  }

  if (isComplete) {
    return (
      <Card className="p-4 text-center">
        <p className="text-[#2E2A25]">Dialogue complete.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {currentNode?.type === 'line' && currentNode.content && (
        <Bubble from="npc">
          <p className="whitespace-pre-wrap">{currentNode.content}</p>
        </Bubble>
      )}

      {choices.length > 0 && (
        <div className="space-y-2">
          {choices.map((choice, index) => (
            <Button
              key={index}
              onClick={() => handleChoice(index)}
              variant="outlined"
              className="w-full text-left justify-start"
            >
              {choice.text}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

