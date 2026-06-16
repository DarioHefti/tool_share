import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useToolStore } from '@/stores/toolStore'
import { useGroupStore } from '@/stores/groupStore'
import { useRequestStore } from '@/stores/requestStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { BorrowRequestStatus } from '@/types'

const statusColors: Record<BorrowRequestStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  approved: 'default',
  declined: 'destructive',
  returned: 'secondary',
}

type Tab = 'incoming' | 'outgoing'

export function RequestsPage() {
  const [tab, setTab] = useState<Tab>('incoming')
  const getUserById = useAuthStore((s) => s.getUserById)
  const fetchUser = useAuthStore((s) => s.fetchUser)
  const getToolById = useToolStore((s) => s.getToolById)
  const fetchToolById = useToolStore((s) => s.fetchToolById)
  const getGroupById = useGroupStore((s) => s.getGroupById)
  const incoming = useRequestStore((s) => s.incoming)
  const outgoing = useRequestStore((s) => s.outgoing)
  const updateStatus = useRequestStore((s) => s.updateStatus)

  const requests = tab === 'incoming' ? incoming : outgoing

  useEffect(() => {
    const toolIds = [...new Set([...incoming, ...outgoing].map((r) => r.toolId))]
    toolIds.forEach((toolId) => {
      if (!getToolById(toolId)) void fetchToolById(toolId)
    })
  }, [incoming, outgoing, getToolById, fetchToolById])
  const sorted = [...requests].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const resolveUser = (id: string) => {
    const user = getUserById(id)
    if (!user) void fetchUser(id)
    return user
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Borrow Requests</h1>
        <p className="text-muted-foreground">Manage tool borrow requests</p>
      </div>

      <div className="flex gap-1 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            tab === 'incoming'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setTab('incoming')}
        >
          Incoming ({incoming.length})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            tab === 'outgoing'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setTab('outgoing')}
        >
          Outgoing ({outgoing.length})
        </button>
      </div>

      {sorted.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            No {tab} requests yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((req) => {
            const tool = getToolById(req.toolId)
            const otherUser = resolveUser(tab === 'incoming' ? req.requesterId : req.ownerId)
            const group = getGroupById(req.groupId)

            return (
              <Card key={req.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">
                      {tool?.name ?? 'Unknown Tool'}
                    </CardTitle>
                    <Badge variant={statusColors[req.status]}>
                      {req.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      {tab === 'incoming' ? 'Requested by' : 'Owned by'}{' '}
                      <strong>{otherUser?.name ?? 'Unknown'}</strong>
                    </p>
                    {group && <p>Group: {group.name}</p>}
                    <p>{new Date(req.createdAt).toLocaleDateString()}</p>
                    {req.message && (
                      <p className="italic bg-muted p-2 rounded-md mt-2">"{req.message}"</p>
                    )}
                  </div>

                  {tab === 'incoming' && req.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void updateStatus(req.id, 'approved')}>
                        Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => void updateStatus(req.id, 'declined')}>
                        Decline
                      </Button>
                    </div>
                  )}

                  {tab === 'incoming' && req.status === 'approved' && (
                    <Button size="sm" variant="outline" onClick={() => void updateStatus(req.id, 'returned')}>
                      Mark as Returned
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
