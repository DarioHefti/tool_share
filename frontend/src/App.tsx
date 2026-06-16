import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { AddToolPage } from '@/pages/tools/AddToolPage'
import { EditToolPage } from '@/pages/tools/EditToolPage'
import { GroupListPage } from '@/pages/groups/GroupListPage'
import { CreateGroupPage } from '@/pages/groups/CreateGroupPage'
import { JoinGroupPage } from '@/pages/groups/JoinGroupPage'
import { GroupDetailPage } from '@/pages/groups/GroupDetailPage'
import { RequestsPage } from '@/pages/requests/RequestsPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/tools/new" element={<AddToolPage />} />
            <Route path="/tools/:id/edit" element={<EditToolPage />} />
            <Route path="/groups" element={<GroupListPage />} />
            <Route path="/groups/create" element={<CreateGroupPage />} />
            <Route path="/groups/join" element={<JoinGroupPage />} />
            <Route path="/groups/:id" element={<GroupDetailPage />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
