import type {
  NewsListParams,
  PublicNewsResponse,
} from '@/types/api/news'
import type { Page } from '@/types/pagination'
import { get } from './client'
import { buildQuery } from './utils'

const TTL_MS = 60_000

interface CacheEntry<T> {
  value?: T
  fetchedAt?: number
  promise?: Promise<T>
}

const listCache = new Map<string, CacheEntry<Page<PublicNewsResponse>>>()
const detailCache = new Map<string, CacheEntry<PublicNewsResponse>>()

function readFresh<T>(map: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = map.get(key)
  if (
    entry?.value !== undefined &&
    entry.fetchedAt !== undefined &&
    Date.now() - entry.fetchedAt < TTL_MS
  ) {
    return entry.value
  }
  return undefined
}

function dedupe<T>(map: Map<string, CacheEntry<T>>, key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = map.get(key)
  if (existing?.promise) return existing.promise
  const promise = fetcher()
    .then((value) => {
      map.set(key, { value, fetchedAt: Date.now() })
      return value
    })
    .catch((err) => {
      map.delete(key)
      throw err
    })
  map.set(key, { ...existing, promise })
  return promise
}

function rememberDetail(news: PublicNewsResponse) {
  const entry = { value: news, fetchedAt: Date.now() }
  detailCache.set(`id:${news.id}`, entry)
  detailCache.set(`slug:${news.slug}`, entry)
}

export function getNews(params?: NewsListParams): Promise<Page<PublicNewsResponse>> {
  const key = buildQuery(params) || '_'
  const cached = readFresh(listCache, key)
  if (cached) return Promise.resolve(cached)
  return dedupe(listCache, key, () => get<Page<PublicNewsResponse>>(`/news${buildQuery(params)}`))
}

export function getNewsById(id: string): Promise<PublicNewsResponse> {
  const cached = readFresh(detailCache, `id:${id}`)
  if (cached) return Promise.resolve(cached)
  return dedupe(detailCache, `id:${id}`, () => get<PublicNewsResponse>(`/news/${id}`))
    .then((news) => { rememberDetail(news); return news })
}

export function getNewsBySlug(slug: string): Promise<PublicNewsResponse> {
  const cached = readFresh(detailCache, `slug:${slug}`)
  if (cached) return Promise.resolve(cached)
  return dedupe(detailCache, `slug:${slug}`, () => get<PublicNewsResponse>(`/news/${slug}`))
    .then((news) => { rememberDetail(news); return news })
}

export function invalidateNewsCache() {
  listCache.clear()
  detailCache.clear()
}
