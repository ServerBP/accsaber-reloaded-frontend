import { useAuthStore } from '@/stores/auth'
import { useBackendStatusStore } from '@/stores/backendStatus'
import { currentRealm } from '@/utils/subdomain'

const GATEWAY_DOWN_STATUSES = new Set([502, 503, 504])

async function trackedFetch(url: string, init: RequestInit): Promise<Response> {
  const backendStatus = useBackendStatusStore()
  let res: Response
  try {
    res = await fetch(url, init)
  } catch (err) {
    backendStatus.reportUnreachable()
    throw err
  }
  if (GATEWAY_DOWN_STATUSES.has(res.status)) backendStatus.reportUnreachable()
  else backendStatus.reportReachable()
  return res
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback
  try {
    const parsed = JSON.parse(err.message) as { message?: unknown }
    return typeof parsed.message === 'string' ? parsed.message : fallback
  } catch {
    return fallback
  }
}

export interface ApiFieldError {
  field: string
  message: string
  rejectedValue?: unknown
}

export interface ParsedApiError {
  status: number
  code: string | null
  message: string
  fieldErrors: ApiFieldError[]
}

export function parseApiError(err: unknown, fallback = 'Request failed'): ParsedApiError {
  if (!(err instanceof ApiError)) {
    return {
      status: 0,
      code: null,
      message: err instanceof Error ? err.message : fallback,
      fieldErrors: [],
    }
  }
  try {
    const body = JSON.parse(err.message) as {
      code?: unknown
      message?: unknown
      fieldErrors?: unknown
    }
    const fieldErrors = Array.isArray(body.fieldErrors)
      ? (body.fieldErrors.filter(
          (f): f is ApiFieldError =>
            !!f && typeof f === 'object' && typeof (f as ApiFieldError).field === 'string',
        ) as ApiFieldError[])
      : []
    return {
      status: err.status,
      code: typeof body.code === 'string' ? body.code : null,
      message: typeof body.message === 'string' ? body.message : fallback,
      fieldErrors,
    }
  } catch {
    return { status: err.status, code: null, message: err.message || fallback, fieldErrors: [] }
  }
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function detectBannedWrite(method: string, status: number, body: string): void {
  if (status !== 403 || !WRITE_METHODS.has(method)) return
  try {
    const parsed = JSON.parse(body) as { code?: unknown; message?: unknown }
    const message = typeof parsed.message === 'string' ? parsed.message : ''
    if (parsed.code === 'FORBIDDEN' && /banned/i.test(message)) {
      useAuthStore().markRestricted()
    }
  } catch {
    /* non-JSON body */
  }
}

const NO_AUTO_AUTH_PATHS = [
  '/auth/refresh',
  '/auth/logout',
  '/staff/auth/login',
  '/staff/auth/refresh',
  '/staff/auth/logout',
]

function isStaffPath(path: string): boolean {
  return path.startsWith('/staff/') || path.startsWith('/admin/') || path.startsWith('/ranking/')
}

function shouldSkipAuth(path: string): boolean {
  return NO_AUTO_AUTH_PATHS.some((p) => path.startsWith(p))
}

async function refreshStaffIfNeeded(auth: ReturnType<typeof useAuthStore>) {
  if (auth.staffToken && auth.isTokenExpiringSoon) {
    try {
      await auth.refreshStaffToken()
    } catch {
      auth.clearStaffAuth()
    }
  }
}

async function refreshPlayerIfNeeded(auth: ReturnType<typeof useAuthStore>) {
  if (auth.accessToken && auth.isPlayerTokenExpiringSoon && auth.refreshTokenValue) {
    await auth.refreshPlayerSession()
  }
}

function isAdminPath(path: string): boolean {
  return path.startsWith('/admin/')
}

async function resolveAuthHeader(path: string): Promise<string | null> {
  if (shouldSkipAuth(path)) return null
  const auth = useAuthStore()

  if (isAdminPath(path)) {
    await refreshStaffIfNeeded(auth)
    if (auth.staffToken) return auth.staffToken
    await refreshPlayerIfNeeded(auth)
    return auth.accessToken ?? null
  }

  if (isStaffPath(path)) {
    await refreshPlayerIfNeeded(auth)
    if (auth.accessToken) return auth.accessToken
    await refreshStaffIfNeeded(auth)
    return auth.staffToken ?? null
  }

  await refreshPlayerIfNeeded(auth)
  if (auth.accessToken) return auth.accessToken

  await refreshStaffIfNeeded(auth)
  return auth.staffToken ?? null
}

function buildAuthHeaders(authHeader: string | null): Record<string, string> {
  const headers: Record<string, string> = {}
  if (authHeader) headers['Authorization'] = `Bearer ${authHeader}`
  if (currentRealm) headers['X-AccSaber-Realm'] = currentRealm
  return headers
}

async function executeFetch<T>(
  method: string,
  path: string,
  body: unknown,
  authHeader: string | null,
): Promise<{ res: Response; parsed: T | undefined }> {
  const baseUrl = import.meta.env.VITE_API_BASE
  const url = `${baseUrl}${path}`

  const headers = {
    'Content-Type': 'application/json',
    ...buildAuthHeaders(authHeader),
  }

  const res = await trackedFetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    return { res, parsed: undefined }
  }

  if (res.status === 204) {
    return { res, parsed: undefined }
  }

  const text = await res.text()
  if (!text) {
    return { res, parsed: undefined }
  }
  const sanitizedJsonText = text.replace(/:\s*(\d{16,})/g, ': "$1"')
  return { res, parsed: JSON.parse(sanitizedJsonText) as T }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const authHeader = await resolveAuthHeader(path)

  let { res, parsed } = await executeFetch<T>(method, path, body, authHeader)

  if (res.status === 401 && !shouldSkipAuth(path)) {
    const auth = useAuthStore()
    const attachedPlayerToken = !!authHeader && authHeader === auth.accessToken
    if (attachedPlayerToken && auth.refreshTokenValue) {
      const refreshed = await auth.refreshPlayerSession()
      if (refreshed && auth.accessToken) {
        const retry = await executeFetch<T>(method, path, body, auth.accessToken)
        res = retry.res
        parsed = retry.parsed
      }
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    detectBannedWrite(method, res.status, text)
    throw new ApiError(res.status, text)
  }

  return parsed as T
}

const inflightGets = new Map<string, Promise<unknown>>()

function dedupKey(path: string): string {
  const auth = useAuthStore()
  const token = auth.accessToken ?? auth.staffToken ?? ''
  return `${token ? token.slice(-12) : 'anon'}:${path}`
}

export function get<T>(path: string): Promise<T> {
  const key = dedupKey(path)
  const existing = inflightGets.get(key) as Promise<T> | undefined
  if (existing) return existing
  const promise = request<T>('GET', path).finally(() => {
    inflightGets.delete(key)
  })
  inflightGets.set(key, promise)
  return promise
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body)
}

export function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PUT', path, body)
}

export function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PATCH', path, body)
}

export function del<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('DELETE', path, body)
}

function parseAttachmentFilename(disposition: string | null): string | null {
  if (!disposition) return null
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim())
    } catch {
      return null
    }
  }
  const quoted = disposition.match(/filename="([^"]+)"/i)
  if (quoted) return quoted[1]
  const bare = disposition.match(/filename=([^;]+)/i)
  return bare ? bare[1].trim() : null
}

export interface DownloadedFile {
  blob: Blob
  filename: string | null
}

export async function getFile(path: string): Promise<DownloadedFile> {
  const baseUrl = import.meta.env.VITE_API_BASE
  const url = `${baseUrl}${path}`

  const authHeader = await resolveAuthHeader(path)
  let res = await trackedFetch(url, { method: 'GET', headers: buildAuthHeaders(authHeader) })

  if (res.status === 401 && !shouldSkipAuth(path)) {
    const auth = useAuthStore()
    if (!!authHeader && authHeader === auth.accessToken && auth.refreshTokenValue) {
      const refreshed = await auth.refreshPlayerSession()
      if (refreshed && auth.accessToken) {
        res = await trackedFetch(url, {
          method: 'GET',
          headers: buildAuthHeaders(auth.accessToken),
        })
      }
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new ApiError(res.status, text)
  }

  return {
    blob: await res.blob(),
    filename: parseAttachmentFilename(res.headers.get('Content-Disposition')),
  }
}

export async function postMultipart<T>(path: string, formData: FormData): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_BASE
  const url = `${baseUrl}${path}`
  const authHeader = await resolveAuthHeader(path)
  const res = await trackedFetch(url, {
    method: 'POST',
    headers: buildAuthHeaders(authHeader),
    body: formData,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    detectBannedWrite('POST', res.status, text)
    throw new ApiError(res.status, text)
  }
  if (res.status === 204 || res.status === 202) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  const sanitized = text.replace(/:\s*(\d{16,})/g, ': "$1"')
  try {
    return JSON.parse(sanitized) as T
  } catch {
    return text as unknown as T
  }
}
