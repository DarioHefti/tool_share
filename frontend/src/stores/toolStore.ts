import { createStore } from 'zustand/vanilla'
import type { Tool, CreateToolDto, UpdateToolDto } from '@/types'
import { toolApi } from '@/services/apiClient'
import { useStoreSlice } from '@/lib/useStoreSlice'

export interface ToolState {
  tools: Tool[]
  toolCache: Record<string, Tool>
  loading: boolean
  fetchMyTools: () => Promise<void>
  fetchToolById: (id: string) => Promise<Tool | undefined>
  addTool: (data: CreateToolDto) => Promise<Tool>
  updateTool: (id: string, data: UpdateToolDto) => Promise<Tool>
  deleteTool: (id: string) => Promise<void>
  shareToGroup: (toolId: string, groupId: string) => Promise<void>
  unshareFromGroup: (toolId: string, groupId: string) => Promise<void>
  getToolById: (id: string) => Tool | undefined
}

export const toolStore = createStore<ToolState>()((set, get) => ({
  tools: [],
  toolCache: {},
  loading: false,

  fetchMyTools: async () => {
    set({ loading: true })
    try {
      const tools = await toolApi.listMine()
      set((s) => ({
        tools,
        loading: false,
        toolCache: tools.reduce<Record<string, Tool>>(
          (acc, tool) => ({ ...acc, [tool.id]: tool }),
          s.toolCache
        ),
      }))
    } catch {
      set({ loading: false })
      throw new Error('Failed to load tools')
    }
  },

  fetchToolById: async (id) => {
    const existing = get().getToolById(id)
    if (existing) return existing
    try {
      const tool = await toolApi.get(id)
      set((s) => ({ toolCache: { ...s.toolCache, [id]: tool } }))
      return tool
    } catch {
      return undefined
    }
  },

  addTool: async (data) => {
    const tool = await toolApi.create(data)
    set((s) => ({
      tools: [tool, ...s.tools],
      toolCache: { ...s.toolCache, [tool.id]: tool },
    }))
    return tool
  },

  updateTool: async (id, data) => {
    const tool = await toolApi.update(id, data)
    set((s) => ({
      tools: s.tools.map((t) => (t.id === id ? tool : t)),
      toolCache: { ...s.toolCache, [id]: tool },
    }))
    return tool
  },

  deleteTool: async (id) => {
    await toolApi.delete(id)
    set((s) => {
      const { [id]: _, ...toolCache } = s.toolCache
      void _
      return {
        tools: s.tools.filter((t) => t.id !== id),
        toolCache,
      }
    })
  },

  shareToGroup: async (toolId, groupId) => {
    await toolApi.share(toolId, groupId)
    set((s) => ({
      tools: s.tools.map((t) =>
        t.id === toolId && !t.sharedToGroups.includes(groupId)
          ? { ...t, sharedToGroups: [...t.sharedToGroups, groupId] }
          : t
      ),
    }))
  },

  unshareFromGroup: async (toolId, groupId) => {
    await toolApi.unshare(toolId, groupId)
    set((s) => ({
      tools: s.tools.map((t) =>
        t.id === toolId
          ? { ...t, sharedToGroups: t.sharedToGroups.filter((g) => g !== groupId) }
          : t
      ),
    }))
  },

  getToolById: (id) => get().tools.find((t) => t.id === id) ?? get().toolCache[id],
}))

export function useToolStore<T>(selector: (state: ToolState) => T): T {
  return useStoreSlice(toolStore, selector)
}
