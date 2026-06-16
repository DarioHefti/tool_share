import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useToolStore } from '@/stores/toolStore'
import { useGroupStore } from '@/stores/groupStore'
import { useRequestStore } from '@/stores/requestStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Users, ArrowLeftRight, Share2 } from 'lucide-react'
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { Tool } from '@/types'

export function DashboardPage() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.currentUser)!
  const getUserById = useAuthStore((s) => s.getUserById)
  const fetchUser = useAuthStore((s) => s.fetchUser)
  const getToolById = useToolStore((s) => s.getToolById)
  const myTools = useToolStore((s) => s.tools)
  const deleteTool = useToolStore((s) => s.deleteTool)
  const shareToGroup = useToolStore((s) => s.shareToGroup)
  const unshareFromGroup = useToolStore((s) => s.unshareFromGroup)
  const myGroups = useGroupStore((s) => s.groups)
  const incoming = useRequestStore((s) => s.incoming)
  const fetchAllRequests = useRequestStore((s) => s.fetchAll)

  const pendingIncoming = useMemo(
    () => incoming.filter((r) => r.status === 'pending'),
    [incoming]
  )

  const [deleteTarget, setDeleteTarget] = useState<Tool | null>(null)
  const [shareTarget, setShareTarget] = useState<Tool | null>(null)

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteTool(deleteTarget.id)
    await fetchAllRequests()
    setDeleteTarget(null)
  }

  const toggleGroupShare = async (toolId: string, groupId: string, isShared: boolean) => {
    if (isShared) {
      await unshareFromGroup(toolId, groupId)
    } else {
      await shareToGroup(toolId, groupId)
    }
    if (shareTarget) {
      const updated = getToolById(toolId)
      if (updated) setShareTarget(updated)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {currentUser.name}!</p>
        </div>
        <Button onClick={() => navigate('/tools/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Tool
        </Button>
      </div>

      {pendingIncoming.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              Pending Borrow Requests
            </CardTitle>
            <CardDescription>
              You have {pendingIncoming.length} pending request{pendingIncoming.length > 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingIncoming.slice(0, 3).map((req) => {
                const requester = getUserById(req.requesterId)
                const tool = getToolById(req.toolId)
                if (!requester) void fetchUser(req.requesterId)
                return (
                  <div key={req.id} className="flex items-center justify-between p-3 rounded-md bg-background border">
                    <span className="text-sm">
                      <strong>{requester?.name ?? 'Unknown'}</strong> wants to borrow{' '}
                      <strong>{tool?.name ?? 'Unknown Tool'}</strong>
                    </span>
                    <Button size="sm" variant="outline" onClick={() => navigate('/requests')}>
                      Review
                    </Button>
                  </div>
                )
              })}
              {pendingIncoming.length > 3 && (
                <Button variant="link" onClick={() => navigate('/requests')}>
                  View all {pendingIncoming.length} requests
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">My Tools ({myTools.length})</h2>
        </div>
        {myTools.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground mb-4">You haven't added any tools yet.</p>
              <Button onClick={() => navigate('/tools/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Tool
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myTools.map((tool) => (
              <Card key={tool.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{tool.name}</CardTitle>
                      <Badge variant="secondary" className="mt-1">{tool.category}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setShareTarget(tool)}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/tools/${tool.id}/edit`)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(tool)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{tool.description}</p>
                  {tool.sharedToGroups.length > 0 && (
                    <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      Shared to {tool.sharedToGroups.length} group{tool.sharedToGroups.length > 1 ? 's' : ''}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogHeader>
          <DialogTitle>Delete Tool</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will also remove all related borrow requests. This action cannot be undone.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="destructive" onClick={() => void handleDelete()}>Delete</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={!!shareTarget} onClose={() => setShareTarget(null)}>
        <DialogHeader>
          <DialogTitle>Share "{shareTarget?.name}" to Groups</DialogTitle>
        </DialogHeader>
        {myGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">You are not a member of any groups yet.</p>
        ) : (
          <div className="space-y-2">
            {myGroups.map((group) => {
              const isShared = shareTarget?.sharedToGroups.includes(group.id) ?? false
              return (
                <div key={group.id} className="flex items-center justify-between p-3 rounded-md border">
                  <span className="text-sm font-medium">{group.name}</span>
                  <Button
                    size="sm"
                    variant={isShared ? 'destructive' : 'default'}
                    onClick={() => shareTarget && void toggleGroupShare(shareTarget.id, group.id, isShared)}
                  >
                    {isShared ? 'Unshare' : 'Share'}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setShareTarget(null)}>Done</Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
