import type {
  CreateNewsRequest,
  NewsResponse,
  StaffNewsListParams,
  UpdateNewsRequest,
} from '@/types/api/news'
import type { Page } from '@/types/pagination'
import { del, get, patch, post, postMultipart } from '../client'
import { invalidateNewsCache } from '../news'
import { buildQuery } from '../utils'

function multipartFile(file: File): FormData {
  const form = new FormData()
  form.append('file', file)
  return form
}

export function listMyNews(params?: StaffNewsListParams): Promise<Page<NewsResponse>> {
  return get<Page<NewsResponse>>(`/ranking/news/mine${buildQuery(params)}`)
}

export function getRankingNews(id: string): Promise<NewsResponse> {
  return get<NewsResponse>(`/ranking/news/${id}`)
}

export async function createRankingNews(req: CreateNewsRequest): Promise<NewsResponse> {
  const res = await post<NewsResponse>('/ranking/news', req)
  invalidateNewsCache()
  return res
}

export async function updateRankingNews(id: string, req: UpdateNewsRequest): Promise<NewsResponse> {
  const res = await patch<NewsResponse>(`/ranking/news/${id}`, req)
  invalidateNewsCache()
  return res
}

export async function uploadRankingNewsImage(id: string, file: File): Promise<NewsResponse> {
  const res = await postMultipart<NewsResponse>(`/ranking/news/${id}/image`, multipartFile(file))
  invalidateNewsCache()
  return res
}

export async function deleteRankingNewsImage(id: string): Promise<NewsResponse> {
  const res = await del<NewsResponse>(`/ranking/news/${id}/image`)
  invalidateNewsCache()
  return res
}
