import { useState, useEffect } from 'react'
import { AuthGate } from '../windows/AuthGate'
import { Home } from '../windows/Home'
import { ProjectsList } from '../windows/ProjectsList'
import { Playground } from '../windows/Playground'
import { scaffoldProject } from '../services/scaffold'
import { get, set } from '../lib/storage'

type View = 'home' | 'build' | 'load' | 'playground'

interface AppState {
  view: View
  gameId: string | null
  initialPrompt?: string
}

const App = () => {
  const [state, setState] = useState<AppState>({ view: 'home', gameId: null })
  const [isRestored, setIsRestored] = useState(false)

  // Restore app state from storage on mount
  useEffect(() => {
    const restoreState = async () => {
      try {
        const savedState = await get<AppState>('appState', null)
        if (savedState && savedState.view === 'playground' && savedState.gameId) {
          console.log('App: Restoring previous session:', savedState)
          setState(savedState)
        }
      } catch (error) {
        console.error('Failed to restore app state:', error)
      } finally {
        setIsRestored(true)
      }
    }
    restoreState()
  }, [])

  // Save app state to storage whenever it changes
  useEffect(() => {
    if (isRestored) {
      // Only save if we're in playground view (don't save home view)
      if (state.view === 'playground' && state.gameId) {
        set('appState', state).catch(error => {
          console.error('Failed to save app state:', error)
        })
      } else if (state.view === 'home') {
        // Clear saved state when going to home
        set('appState', null).catch(() => {})
      }
    }
  }, [state, isRestored])

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

  // Show loading state while restoring (only if we might have a saved state)
  if (!isRestored) {
    return (
      <AuthGate>
        {() => (
          <div className="w-full h-full flex items-center justify-center bg-[#F8F1E3]">
            <div className="text-[#2E2A25]">Loading...</div>
          </div>
        )}
      </AuthGate>
    )
  }

  return (
    <AuthGate>
      {({ onOpenSettings }) => (
        <div className="w-full h-full">
          {state.view === 'home' && (
            <Home
              onBuildNew={handleBuildNew}
              onLoadGame={handleLoadGame}
              onOpenSettings={onOpenSettings}
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
      )}
    </AuthGate>
  )
}

export default App
