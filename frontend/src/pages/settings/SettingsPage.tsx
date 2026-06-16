import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertTriangle } from 'lucide-react'

export function SettingsPage() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.currentUser)!
  const deleteAccount = useAuthStore((s) => s.deleteAccount)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [passwordChanged, setPasswordChanged] = useState(false)

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordChanged(true)
    setTimeout(() => setPasswordChanged(false), 3000)
  }

  const handleDeleteAccount = async () => {
    await deleteAccount()
    navigate('/login')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-muted-foreground text-xs">Name</Label>
            <p className="font-medium">{currentUser.name}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Email</Label>
            <p className="font-medium">{currentUser.email}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Change Password</CardTitle>
          <CardDescription>Update your password (mocked for POC)</CardDescription>
        </CardHeader>
        <form onSubmit={handlePasswordChange}>
          <CardContent className="space-y-4">
            {passwordChanged && (
              <div className="p-3 rounded-md bg-green-50 text-green-700 text-sm">
                Password changed successfully! (mocked)
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input id="current-password" type="password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input id="new-password" type="password" required minLength={6} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm New Password</Label>
              <Input id="confirm-new-password" type="password" required />
            </div>
            <Button type="submit">Update Password</Button>
          </CardContent>
        </form>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-lg text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            Delete Account
          </Button>
        </CardContent>
      </Card>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogHeader>
          <DialogTitle className="text-destructive">Delete Account</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This action is <strong>permanent and irreversible</strong>. All your tools, group memberships,
            and borrow requests will be deleted.
          </p>
          <div className="space-y-2">
            <Label htmlFor="confirm-email">
              Type <strong>{currentUser.email}</strong> to confirm
            </Label>
            <Input
              id="confirm-email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={currentUser.email}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setConfirmEmail('') }}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={confirmEmail !== currentUser.email}
            onClick={() => void handleDeleteAccount()}
          >
            Delete My Account
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
