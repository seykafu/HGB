import { useEffect, useState } from 'react'
import { getUser, onAuthStateChange } from '../lib/supabase'
import Login from './Login'

interface AuthGateProps {
  children: React.ReactNode
}

export const AuthGate = ({ children }: AuthGateProps) => {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check initial auth state
    getUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))

    // Listen for auth changes
    let subscription: any = null
    onAuthStateChange((user) => {
      setUser(user)
    }).then((result) => {
      subscription = result.subscription
    })

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#F8F1E3]">
        <div className="text-[#2E2A25]">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return <>{children}</>
}

