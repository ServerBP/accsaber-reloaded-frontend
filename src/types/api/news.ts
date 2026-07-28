import type { NewsStatus, NewsType } from '../enums'
import type { PaginationParams } from '../pagination'

export interface PublicNewsResponse {
  id: string
  authorName: string | null
  title: string
  slug: string
  description: string | null
  content: string
  imageUrl: string | null
  pinned: boolean
  type: NewsType
  batchId: string | null
  campaignId: string | null
  milestoneSetId: string | null
  curveId: string | null
  publishedAt: string | null
}

export interface NewsResponse {
  id: string
  staffUserId: string
  staffUsername: string | null
  title: string
  slug: string
  description: string | null
  content: string
  imageUrl: string | null
  status: NewsStatus
  pinned: boolean
  type: NewsType
  batchId: string | null
  campaignId: string | null
  milestoneSetId: string | null
  curveId: string | null
  publishedAt: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateNewsRequest {
  title: string
  slug?: string
  description?: string
  content: string
  imageUrl?: string
  status?: NewsStatus
  pinned?: boolean
  type?: NewsType
  batchId?: string | null
  campaignId?: string | null
  milestoneSetId?: string | null
  curveId?: string | null
}

export type UpdateNewsRequest = Partial<CreateNewsRequest>

export interface NewsListParams extends PaginationParams {
  type?: NewsType
}

export interface StaffNewsListParams extends NewsListParams {
  status?: NewsStatus
  mine?: boolean
}
