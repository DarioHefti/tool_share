import { useNavigate } from 'react-router-dom'
import { useGroupStore } from '@/stores/groupStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, UserPlus, Users, ChevronRight } from 'lucide-react'

export function GroupListPage() {
  const navigate = useNavigate()
  const myGroups = useGroupStore((s) => s.groups)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Groups</h1>
          <p className="text-muted-foreground">Manage your tool-sharing groups</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/groups/join')}>
            <UserPlus className="h-4 w-4 mr-2" />
            Join Group
          </Button>
          <Button onClick={() => navigate('/groups/create')}>
            <Plus className="h-4 w-4 mr-2" />
            Create Group
          </Button>
        </div>
      </div>

      {myGroups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">You haven't joined any groups yet.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/groups/join')}>
                Join a Group
              </Button>
              <Button onClick={() => navigate('/groups/create')}>
                Create a Group
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {myGroups.map((group) => (
            <Card
              key={group.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/groups/${group.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{group.name}</CardTitle>
                    <CardDescription className="mt-1">{group.description}</CardDescription>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {group.memberIds.length} member{group.memberIds.length !== 1 ? 's' : ''}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
