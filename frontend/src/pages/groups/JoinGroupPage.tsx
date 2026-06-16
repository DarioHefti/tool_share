import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGroupStore } from '@/stores/groupStore'
import { ApiError } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'

export function JoinGroupPage() {
  const navigate = useNavigate()
  const joinByInviteCode = useGroupStore((s) => s.joinByInviteCode)

  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const group = await joinByInviteCode(code.trim())
      navigate(`/groups/${group.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not join group.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <Button variant="ghost" onClick={() => navigate('/groups')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Groups
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Join a Group</CardTitle>
          <CardDescription>Enter the invite code shared by the group creator</CardDescription>
        </CardHeader>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="code">Invite Code</Label>
              <Input
                id="code"
                placeholder="e.g., ELM123"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                maxLength={6}
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? 'Joining...' : 'Join Group'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/groups')}>Cancel</Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
