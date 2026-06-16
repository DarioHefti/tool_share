import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export function ProtectedRoute() {
  const initialized = useAuthStore((s) => s.initialized)
  const currentUser = useAuthStore((s) => s.currentUser)
  const bootstrap = useAuthStore((s) => s.bootstrap)

  useEffect(() => {
    if (!initialized) {
      void bootstrap()
    }
  }, [initialized, bootstrap])

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (!currentUser) return <Navigate to="/login" replace />
  return <Outlet />
}
