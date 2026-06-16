import { createStore } from 'zustand/vanilla'
import type { Group, CreateGroupDto } from '@/types'
import { groupApi, type GroupDetail } from '@/services/apiClient'
import { useStoreSlice } from '@/lib/useStoreSlice'

export interface GroupState {
  groups: Group[]
  groupDetails: Record<string, GroupDetail>
  loading: boolean
  fetchMyGroups: () => Promise<void>
  fetchGroupDetail: (id: string) => Promise<GroupDetail>
  addGroup: (data: CreateGroupDto) => Promise<Group>
  joinByInviteCode: (inviteCode: string) => Promise<Group>
  leaveOrDeleteGroup: (id: string) => Promise<void>
  getGroupById: (id: string) => Group | undefined
}

export const groupStore = createStore<GroupState>()((set, get) => ({
  groups: [],
  groupDetails: {},
  loading: false,

  fetchMyGroups: async () => {
    set({ loading: true })
    try {
      const groups = await groupApi.listMine()
      set({ groups, loading: false })
    } catch {
      set({ loading: false })
      throw new Error('Failed to load groups')
    }
  },

  fetchGroupDetail: async (id) => {
    const detail = await groupApi.get(id)
    set((s) => ({
      groupDetails: { ...s.groupDetails, [id]: detail },
      groups: s.groups.some((g) => g.id === id)
        ? s.groups.map((g) => (g.id === id ? detail : g))
        : [...s.groups, detail],
    }))
    return detail
  },

  addGroup: async (data) => {
    const group = await groupApi.create(data)
    set((s) => ({ groups: [...s.groups, group] }))
    return group
  },

  joinByInviteCode: async (inviteCode) => {
    const group = await groupApi.join(inviteCode)
    set((s) => ({
      groups: s.groups.some((g) => g.id === group.id)
        ? s.groups.map((g) => (g.id === group.id ? group : g))
        : [...s.groups, group],
    }))
    return group
  },

  leaveOrDeleteGroup: async (id) => {
    await groupApi.leaveOrDelete(id)
    set((s) => {
      const { [id]: _, ...rest } = s.groupDetails
      void _
      return {
        groups: s.groups.filter((g) => g.id !== id),
        groupDetails: rest,
      }
    })
  },

  getGroupById: (id) => get().groups.find((g) => g.id === id),
}))

export function useGroupStore<T>(selector: (state: GroupState) => T): T {
  return useStoreSlice(groupStore, selector)
}
