import { useState, useEffect } from 'react'
import { AuthGate } from '../windows/AuthGate'
import { Home } from '../windows/Home'
import { ProjectsList } from '../windows/ProjectsList'
import { Playground } from '../windows/Playground'
import { scaffoldProject } from '../services/scaffold'

type View = 'home' | 'build' | 'load' | 'playground'

interface AppState {
  view: View
  gameId: string | null
  initialPrompt?: string
}

const App = () => {
  const [state, setState] = useState<AppState>({ view: 'home', gameId: null })

  const handleBuildNew = async () => {
    // For now, create a default project
    // In production, show a dialog to enter game title/description
    try {
      const scaffold = await scaffoldProject('My New Game', 'A 2D narrative adventure')
      setState({
        view: 'playground',
        gameId: scaffold.gameId,
        initialPrompt: 'Describe your 2D narrative game (setting, main character, goals).',
      })
    } catch (error: any) {
      console.error('Failed to create game:', error)
      let errorMessage = 'Unknown error'
      
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (error?.message) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error?.code) {
        // Supabase error
        errorMessage = `Database error (${error.code}): ${error.message || error.hint || 'Check if tables exist'}`
      }
      
      alert(`Failed to create game: ${errorMessage}\n\nMake sure you've run the database setup SQL in Supabase.`)
    }
  }

  const handleLoadGame = () => {
    setState({ view: 'load', gameId: null })
  }

  const handleOpenGame = (gameId: string) => {
    setState({ view: 'playground', gameId })
  }

  const handleBack = () => {
    setState({ view: 'home', gameId: null })
  }

  return (
    <AuthGate>
      <div className="w-full h-full">
        {state.view === 'home' && (
          <Home
            onBuildNew={handleBuildNew}
            onLoadGame={handleLoadGame}
          />
        )}
        {state.view === 'load' && (
          <ProjectsList
            onOpenGame={handleOpenGame}
            onBack={handleBack}
          />
        )}
        {state.view === 'playground' && (
          <Playground
            gameId={state.gameId}
            initialPrompt={state.initialPrompt}
            onBack={handleBack}
          />
        )}
      </div>
    </AuthGate>
  )
}

export default App
