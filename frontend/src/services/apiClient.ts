import { api } from './api'
import type {
  User,
  Tool,
  Group,
  BorrowRequest,
  CreateToolDto,
  UpdateToolDto,
  CreateGroupDto,
  CreateBorrowRequestDto,
  BorrowRequestStatus,
} from '@/types'

export interface GroupDetail extends Group {
  sharedTools: Tool[]
}

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api<User>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    api<User>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  logout: () => api<void>('/auth/logout', { method: 'POST' }),

  me: () => api<User>('/auth/me'),

  forgotPassword: (email: string) =>
    api<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  deleteAccount: () => api<void>('/auth/account', { method: 'DELETE' }),
}

export const toolApi = {
  listMine: () => api<Tool[]>('/tools/mine'),

  get: (id: string) => api<Tool>(`/tools/${id}`),

  create: (data: CreateToolDto) =>
    api<Tool>('/tools', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: UpdateToolDto) =>
    api<Tool>(`/tools/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) => api<void>(`/tools/${id}`, { method: 'DELETE' }),

  share: (id: string, groupId: string) =>
    api<void>(`/tools/${id}/share`, { method: 'POST', body: JSON.stringify({ groupId }) }),

  unshare: (id: string, groupId: string) =>
    api<void>(`/tools/${id}/share/${groupId}`, { method: 'DELETE' }),
}

export const groupApi = {
  listMine: () => api<Group[]>('/groups/mine'),

  create: (data: CreateGroupDto) =>
    api<Group>('/groups', { method: 'POST', body: JSON.stringify(data) }),

  join: (inviteCode: string) =>
    api<Group>('/groups/join', { method: 'POST', body: JSON.stringify({ inviteCode }) }),

  get: (id: string) => api<GroupDetail>(`/groups/${id}`),

  leaveOrDelete: (id: string) => api<void>(`/groups/${id}`, { method: 'DELETE' }),
}

export const requestApi = {
  listIncoming: () => api<BorrowRequest[]>('/requests/incoming'),

  listOutgoing: () => api<BorrowRequest[]>('/requests/outgoing'),

  create: (data: CreateBorrowRequestDto) =>
    api<BorrowRequest>('/requests', { method: 'POST', body: JSON.stringify(data) }),

  updateStatus: (id: string, status: BorrowRequestStatus) =>
    api<BorrowRequest>(`/requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
}

export const userApi = {
  get: (id: string) => api<User>(`/users/${id}`),
}
