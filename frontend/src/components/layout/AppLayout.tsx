import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { useToolStore } from '@/stores/toolStore'
import { useGroupStore } from '@/stores/groupStore'
import { useRequestStore } from '@/stores/requestStore'

export function AppLayout() {
  const fetchMyTools = useToolStore((s) => s.fetchMyTools)
  const fetchMyGroups = useGroupStore((s) => s.fetchMyGroups)
  const fetchAllRequests = useRequestStore((s) => s.fetchAll)

  useEffect(() => {
    void Promise.all([fetchMyTools(), fetchMyGroups(), fetchAllRequests()])
  }, [fetchMyTools, fetchMyGroups, fetchAllRequests])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
