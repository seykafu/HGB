import { useEffect, useState } from 'react'
import { Card } from '../ui/components/Card'
import { Button } from '../ui/components/Button'
import { listGames, deleteGame } from '../services/projects'
import { getUser } from '../lib/supabase'

interface Game {
  id: string
  title: string
  slug: string
  created_at: string
  updated_at: string
}

interface ProjectsListProps {
  onOpenGame: (gameId: string) => void
  onBack: () => void
}

export const ProjectsList = ({ onOpenGame, onBack }: ProjectsListProps) => {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadGames()
  }, [])

  const loadGames = async () => {
    try {
      setLoading(true)
      setError(null)
      const gameList = await listGames()
      setGames(gameList)
    } catch (err: any) {
      setError(err.message || 'Failed to load games')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (gameId: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) {
      return
    }

    try {
      await deleteGame(gameId)
      await loadGames()
    } catch (err: any) {
      alert(`Failed to delete game: ${err.message}`)
    }
  }

  const handleDuplicate = async (gameId: string) => {
    // TODO: Implement duplicate functionality
    alert('Duplicate functionality coming soon!')
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#F8F1E3]">
        <div className="text-[#2E2A25]">Loading games...</div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#F8F1E3] p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl tracking-tight text-[#2E2A25]">
          Your Games
        </h1>
        <Button variant="outlined" onClick={onBack}>
          Back
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-[#C86B6B]/20 ring-1 ring-[#C86B6B] text-sm text-[#2E2A25]">
          {error}
        </div>
      )}

      {games.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-[#2E2A25]/70 mb-4">No games yet.</p>
          <Button onClick={onBack}>Create Your First Game</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto">
          {games.map((game) => (
            <Card key={game.id} className="p-4 hover:shadow-lg transition">
              <div className="mb-3">
                <h3 className="font-medium text-[#2E2A25] mb-1">{game.title}</h3>
                <p className="text-xs text-[#2E2A25]/50">
                  Updated {new Date(game.updated_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => onOpenGame(game.id)}
                  className="flex-1 text-xs"
                  size="sm"
                >
                  Open
                </Button>
                <Button
                  onClick={() => handleDuplicate(game.id)}
                  variant="outlined"
                  className="flex-1 text-xs"
                  size="sm"
                >
                  Duplicate
                </Button>
                <Button
                  onClick={() => handleDelete(game.id, game.title)}
                  variant="danger"
                  className="text-xs"
                  size="sm"
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

