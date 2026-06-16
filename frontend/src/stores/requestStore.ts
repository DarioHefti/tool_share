import { createStore } from 'zustand/vanilla'
import type { BorrowRequest, BorrowRequestStatus, CreateBorrowRequestDto } from '@/types'
import { requestApi } from '@/services/apiClient'
import { useStoreSlice } from '@/lib/useStoreSlice'

export interface RequestState {
  incoming: BorrowRequest[]
  outgoing: BorrowRequest[]
  loading: boolean
  fetchAll: () => Promise<void>
  createRequest: (data: CreateBorrowRequestDto) => Promise<BorrowRequest>
  updateStatus: (requestId: string, status: BorrowRequestStatus) => Promise<void>
  hasActiveRequest: (toolId: string, requesterId: string) => boolean
}

function upsertRequest(list: BorrowRequest[], item: BorrowRequest): BorrowRequest[] {
  const idx = list.findIndex((r) => r.id === item.id)
  if (idx === -1) return [item, ...list]
  return list.map((r) => (r.id === item.id ? item : r))
}

export const requestStore = createStore<RequestState>()((set, get) => ({
  incoming: [],
  outgoing: [],
  loading: false,

  fetchAll: async () => {
    set({ loading: true })
    try {
      const [incoming, outgoing] = await Promise.all([
        requestApi.listIncoming(),
        requestApi.listOutgoing(),
      ])
      set({ incoming, outgoing, loading: false })
    } catch {
      set({ loading: false })
      throw new Error('Failed to load requests')
    }
  },

  createRequest: async (data) => {
    const request = await requestApi.create(data)
    set((s) => ({ outgoing: [request, ...s.outgoing] }))
    return request
  },

  updateStatus: async (requestId, status) => {
    const updated = await requestApi.updateStatus(requestId, status)
    set((s) => ({
      incoming: upsertRequest(s.incoming, updated),
      outgoing: upsertRequest(s.outgoing, updated),
    }))
  },

  hasActiveRequest: (toolId, requesterId) => {
    const { incoming, outgoing } = get()
    return [...incoming, ...outgoing].some(
      (r) =>
        r.toolId === toolId &&
        r.requesterId === requesterId &&
        (r.status === 'pending' || r.status === 'approved')
    )
  },
}))

export function useRequestStore<T>(selector: (state: RequestState) => T): T {
  return useStoreSlice(requestStore, selector)
}
