import { useState } from 'react'
import { signIn, signUp } from '../lib/supabase'
import { Card } from '../ui/components/Card'
import { Button } from '../ui/components/Button'
import { Input } from '../ui/components/Input'
import { Mascot } from '../ui/mascot/Mascot'
import { Sparkle } from '../ui/icons/Sparkle'

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isSignUp) {
        await signUp(email, password)
        setError('Account created! Please check your email to verify your account.')
      } else {
        await signIn(email, password)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#F8F1E3] p-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="relative flex-shrink-0 mb-4">
            <Mascot className="h-16 w-16 animate-bob" />
            <Sparkle className="absolute -top-1 left-0 h-4 w-4 text-[#E9C46A] animate-pulseSoft" />
            <Sparkle className="absolute -bottom-1 right-0 h-4 w-4 text-[#E9C46A] animate-pulseSoft delay-100" />
          </div>
          <h1 className="font-display text-2xl tracking-tight text-[#2E2A25] mb-2">
            GameNPC
          </h1>
          <p className="text-sm text-[#2E2A25]/70">
            {isSignUp ? 'Create your account' : 'Sign in to continue'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#533F31] mb-2">
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#533F31] mb-2">
              Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-[#C86B6B]/20 ring-1 ring-[#C86B6B] text-sm text-[#2E2A25]">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-[#533F31] hover:text-[#2E2A25] underline"
          >
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </Card>
    </div>
  )
}

