import { useState } from 'react'
import { Card } from '../ui/components/Card'
import { Button } from '../ui/components/Button'
import { Mascot } from '../ui/mascot/Mascot'
import { Sparkle } from '../ui/icons/Sparkle'
import { signOut } from '../lib/supabase'

interface HomeProps {
  onBuildNew: () => void
  onLoadGame: () => void
  onOpenSettings?: () => void
}

export const Home = ({ onBuildNew, onLoadGame, onOpenSettings }: HomeProps) => {
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#F8F1E3] p-8">
      <div className="flex flex-col items-center mb-12">
        <div className="relative flex-shrink-0 mb-6">
          <Mascot className="h-24 w-24 animate-bob" />
          <Sparkle className="absolute -top-2 left-0 h-5 w-5 text-[#E9C46A] animate-pulseSoft" />
          <Sparkle className="absolute -bottom-2 right-0 h-5 w-5 text-[#E9C46A] animate-pulseSoft delay-100" />
        </div>
        <h1 className="font-display text-4xl tracking-tight text-[#2E2A25] mb-2">
          Himalayan Game Builder
        </h1>
        <p className="text-lg text-[#2E2A25]/70">
          Build 2D games with AI
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-md mb-8">
        <Button
          onClick={onBuildNew}
          className="w-full py-4 text-lg font-medium shadow-lg hover:shadow-xl transition"
          size="lg"
        >
          Build New Game
        </Button>
        <Button
          onClick={onLoadGame}
          variant="outlined"
          className="w-full py-4 text-lg font-medium shadow-lg hover:shadow-xl transition"
          size="lg"
        >
          Load Game
        </Button>
      </div>

      <div className="flex flex-col items-center gap-3">
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="text-sm text-[#533F31]/60 hover:text-[#533F31] transition"
          >
            Settings
          </button>
        )}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="text-sm text-[#533F31]/60 hover:text-[#533F31] transition"
        >
          {signingOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    </div>
  )
}

