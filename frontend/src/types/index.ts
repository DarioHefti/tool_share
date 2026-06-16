export const TOOL_CATEGORIES = [
  'Drilling',
  'Cutting',
  'Measuring',
  'Sanding',
  'Fastening',
  'Clamping',
  'Gardening',
  'Painting',
  'Plumbing',
  'Electrical',
  'Other',
] as const

export type ToolCategory = (typeof TOOL_CATEGORIES)[number]

export interface User {
  id: string
  email: string
  name: string
}

export interface UserWithPassword extends User {
  password: string
}

export interface Tool {
  id: string
  ownerId: string
  name: string
  description: string
  category: ToolCategory
  sharedToGroups: string[]
}

export interface Group {
  id: string
  name: string
  description: string
  createdBy: string
  inviteCode: string
  memberIds: string[]
}

export type BorrowRequestStatus = 'pending' | 'approved' | 'declined' | 'returned'

export interface BorrowRequest {
  id: string
  toolId: string
  requesterId: string
  ownerId: string
  groupId: string
  status: BorrowRequestStatus
  createdAt: string
  message?: string
}

export interface CreateToolDto {
  name: string
  description: string
  category: ToolCategory
}

export interface UpdateToolDto {
  name?: string
  description?: string
  category?: ToolCategory
}

export interface CreateGroupDto {
  name: string
  description: string
}

export interface CreateBorrowRequestDto {
  toolId: string
  groupId: string
  message?: string
}

export interface LoginDto {
  email: string
  password: string
}

export interface RegisterDto {
  name: string
  email: string
  password: string
}
