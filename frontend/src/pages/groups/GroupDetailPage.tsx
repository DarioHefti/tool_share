import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useGroupStore } from '@/stores/groupStore'
import { useRequestStore } from '@/stores/requestStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ApiError } from '@/services/api'
import { ArrowLeft, Copy, Check, Users, HandHelping, LogOut } from 'lucide-react'

export function GroupDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const currentUser = useAuthStore((s) => s.currentUser)!
  const getUserById = useAuthStore((s) => s.getUserById)
  const fetchUser = useAuthStore((s) => s.fetchUser)
  const groupDetails = useGroupStore((s) => s.groupDetails)
  const fetchGroupDetail = useGroupStore((s) => s.fetchGroupDetail)
  const leaveOrDeleteGroup = useGroupStore((s) => s.leaveOrDeleteGroup)
  const createRequest = useRequestStore((s) => s.createRequest)
  const hasActiveRequest = useRequestStore((s) => s.hasActiveRequest)
  const fetchAllRequests = useRequestStore((s) => s.fetchAll)

  const [loading, setLoading] = useState(true)
  const [copiedCode, setCopiedCode] = useState(false)
  const [borrowTarget, setBorrowTarget] = useState<string | null>(null)
  const [borrowMessage, setBorrowMessage] = useState('')
  const [borrowError, setBorrowError] = useState('')
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)

  const detail = id ? groupDetails[id] : undefined

  useEffect(() => {
    if (!id) return
    setLoading(true)
    void fetchGroupDetail(id)
      .then((g) => {
        g.memberIds.forEach((memberId) => void fetchUser(memberId))
      })
      .finally(() => setLoading(false))
  }, [id, fetchGroupDetail, fetchUser])

  if (loading) {
    return <p className="text-muted-foreground">Loading group...</p>
  }

  if (!detail) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Group not found.</p>
        <Button variant="link" onClick={() => navigate('/groups')}>Back to Groups</Button>
      </div>
    )
  }

  const group = detail
  const sharedTools = detail.sharedTools
  const isCreator = group.createdBy === currentUser.id
  const otherMembersTools = sharedTools.filter((t) => t.ownerId !== currentUser.id)
  const mySharedTools = sharedTools.filter((t) => t.ownerId === currentUser.id)

  const handleCopyCode = () => {
    navigator.clipboard.writeText(group.inviteCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleBorrow = async () => {
    if (!borrowTarget || !id) return
    setBorrowError('')
    try {
      await createRequest({
        toolId: borrowTarget,
        groupId: id,
        message: borrowMessage || undefined,
      })
      await fetchAllRequests()
      setBorrowTarget(null)
      setBorrowMessage('')
    } catch (err) {
      setBorrowError(err instanceof ApiError ? err.message : 'Could not send borrow request.')
    }
  }

  const handleLeave = async () => {
    await leaveOrDeleteGroup(group.id)
    navigate('/groups')
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/groups')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Groups
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{group.name}</h1>
          <p className="text-muted-foreground mt-1">{group.description}</p>
        </div>
        <Button variant="outline" className="text-destructive" onClick={() => setLeaveDialogOpen(true)}>
          <LogOut className="h-4 w-4 mr-2" />
          {isCreator ? 'Delete Group' : 'Leave Group'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite Code</CardTitle>
          <CardDescription>Share this code so others can join your group</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <code className="text-2xl tracking-widest font-bold bg-muted px-4 py-2 rounded-md">
              {group.inviteCode}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopyCode}>
              {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5" />
            Members ({group.memberIds.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {group.memberIds.map((memberId) => {
              const member = getUserById(memberId)
              return (
                <Badge key={memberId} variant={memberId === currentUser.id ? 'default' : 'secondary'}>
                  {member?.name ?? 'Unknown'}
                  {memberId === group.createdBy && ' (creator)'}
                  {memberId === currentUser.id && ' (you)'}
                </Badge>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-semibold mb-4">Available Tools ({otherMembersTools.length})</h2>
        {otherMembersTools.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground">
              No tools shared by other members yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {otherMembersTools.map((tool) => {
              const owner = getUserById(tool.ownerId)
              const alreadyRequested = hasActiveRequest(tool.id, currentUser.id)
              return (
                <Card key={tool.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{tool.name}</CardTitle>
                    <Badge variant="secondary" className="w-fit">{tool.category}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{tool.description}</p>
                    <p className="text-xs text-muted-foreground">Owned by {owner?.name ?? 'Unknown'}</p>
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={alreadyRequested}
                      onClick={() => setBorrowTarget(tool.id)}
                    >
                      <HandHelping className="h-4 w-4 mr-2" />
                      {alreadyRequested ? 'Already Requested' : 'Request to Borrow'}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {mySharedTools.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Your Shared Tools ({mySharedTools.length})</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mySharedTools.map((tool) => (
              <Card key={tool.id} className="opacity-75">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{tool.name}</CardTitle>
                  <Badge variant="secondary" className="w-fit">{tool.category}</Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{tool.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!borrowTarget} onClose={() => { setBorrowTarget(null); setBorrowError('') }}>
        <DialogHeader>
          <DialogTitle>Request to Borrow</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {borrowError && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{borrowError}</div>
          )}
          <div className="space-y-2">
            <Label htmlFor="message">Message (optional)</Label>
            <Textarea
              id="message"
              placeholder="e.g., Could I borrow this over the weekend?"
              value={borrowMessage}
              onChange={(e) => setBorrowMessage(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setBorrowTarget(null)}>Cancel</Button>
          <Button onClick={() => void handleBorrow()}>Send Request</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={leaveDialogOpen} onClose={() => setLeaveDialogOpen(false)}>
        <DialogHeader>
          <DialogTitle>{isCreator ? 'Delete Group' : 'Leave Group'}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {isCreator
            ? 'Are you sure you want to delete this group? All members will be removed and shared tools will be unlinked.'
            : 'Are you sure you want to leave this group?'}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setLeaveDialogOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => void handleLeave()}>
            {isCreator ? 'Delete' : 'Leave'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
