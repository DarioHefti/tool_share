import { createStore } from 'zustand/vanilla'
import type { User } from '@/types'
import { authApi, userApi } from '@/services/apiClient'
import { useStoreSlice } from '@/lib/useStoreSlice'

export interface AuthState {
  initialized: boolean
  currentUser: User | null
  userCache: Record<string, User>
  bootstrap: () => Promise<void>
  login: (email: string, password: string) => Promise<User>
  register: (name: string, email: string, password: string) => Promise<User>
  logout: () => Promise<void>
  deleteAccount: () => Promise<void>
  fetchUser: (id: string) => Promise<User | undefined>
  getUserById: (id: string) => User | undefined
}

export const authStore = createStore<AuthState>()((set, get) => ({
  initialized: false,
  currentUser: null,
  userCache: {},

  bootstrap: async () => {
    try {
      const user = await authApi.me()
      set((s) => ({
        initialized: true,
        currentUser: user,
        userCache: { ...s.userCache, [user.id]: user },
      }))
    } catch {
      set({ initialized: true, currentUser: null })
    }
  },

  login: async (email, password) => {
    const user = await authApi.login({ email, password })
    set((s) => ({
      currentUser: user,
      userCache: { ...s.userCache, [user.id]: user },
    }))
    return user
  },

  register: async (name, email, password) => {
    const user = await authApi.register({ name, email, password })
    set((s) => ({
      currentUser: user,
      userCache: { ...s.userCache, [user.id]: user },
    }))
    return user
  },

  logout: async () => {
    await authApi.logout()
    set({ currentUser: null })
  },

  deleteAccount: async () => {
    await authApi.deleteAccount()
    set({ currentUser: null, userCache: {} })
  },

  fetchUser: async (id) => {
    const cached = get().userCache[id]
    if (cached) return cached
    try {
      const user = await userApi.get(id)
      set((s) => ({ userCache: { ...s.userCache, [id]: user } }))
      return user
    } catch {
      return undefined
    }
  },

  getUserById: (id) => get().userCache[id],
}))

export function useAuthStore<T>(selector: (state: AuthState) => T): T {
  return useStoreSlice(authStore, selector)
}
