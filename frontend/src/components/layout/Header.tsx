import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useRequestStore } from '@/stores/requestStore'
import { Button } from '@/components/ui/button'
import { Wrench, LogOut, Settings, LayoutDashboard, Users, ArrowLeftRight } from 'lucide-react'

export function Header() {
  const currentUser = useAuthStore((s) => s.currentUser)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const incoming = useRequestStore((s) => s.incoming)
  const pendingCount = incoming.filter((r) => r.status === 'pending').length

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className="border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-primary font-bold text-xl no-underline">
          <Wrench className="h-6 w-6" />
          <span>ToolShare</span>
        </Link>

        {currentUser && (
          <nav className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <LayoutDashboard className="h-4 w-4 mr-1.5" />
              Dashboard
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/groups')}>
              <Users className="h-4 w-4 mr-1.5" />
              Groups
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/requests')} className="relative">
              <ArrowLeftRight className="h-4 w-4 mr-1.5" />
              Requests
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </Button>
            <div className="w-px h-6 bg-border mx-2" />
            <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void handleLogout()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </nav>
        )}
      </div>
    </header>
  )
}
