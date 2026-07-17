export interface BeatSaverMapResponse {
  id: string
  name?: string
  metadata: {
    songName: string
    songSubName: string
    songAuthorName: string
    levelAuthorName: string
    bpm: number
    duration: number
  }
  tags?: string[]
  ranked?: boolean
  blRanked?: boolean
  automapper?: boolean
  stats?: { score?: number; upvotes?: number; downvotes?: number }
  versions: {
    hash: string
    coverURL: string
    diffs: {
      difficulty: string
      characteristic: string
      njs: number
      notes: number
      nps?: number
      seconds?: number
      stars?: number
    }[]
  }[]
}

export type BeatSaverOrder =
  | 'Latest'
  | 'Relevance'
  | 'Rating'
  | 'Curated'
  | 'Random'
  | 'Duration'

export type BeatSaverLeaderboardFilter = 'All' | 'Ranked' | 'BeatLeader' | 'ScoreSaber'

export interface BeatSaverSearchParams {
  q: string
  order?: BeatSaverOrder
  tags?: string
  leaderboard?: BeatSaverLeaderboardFilter
  automapper?: boolean
  minNps?: number
  maxNps?: number
  minBpm?: number
  maxBpm?: number
  minDuration?: number
  maxDuration?: number
  minRating?: number
  maxRating?: number
  from?: string
  to?: string
  chroma?: boolean
  cinema?: boolean
  noodle?: boolean
  me?: boolean
  curated?: boolean
  verified?: boolean
  fullSpread?: boolean
}

export interface BeatSaverSearchResponse {
  docs: BeatSaverMapResponse[]
}

export async function searchBeatSaver(
  params: BeatSaverSearchParams,
  page = 0,
): Promise<BeatSaverSearchResponse> {
  const q = new URLSearchParams()
  q.set('q', params.q)
  const setStr = (k: string, v: string | undefined) => {
    if (v != null && v !== '') q.set(k, v)
  }
  const setNum = (k: string, v: number | undefined) => {
    if (v != null && Number.isFinite(v)) q.set(k, String(v))
  }
  const setBool = (k: string, v: boolean | undefined) => {
    if (v != null) q.set(k, String(v))
  }
  setStr('order', params.order)
  setStr('tags', params.tags)
  setStr('leaderboard', params.leaderboard)
  setBool('automapper', params.automapper)
  setNum('minNps', params.minNps)
  setNum('maxNps', params.maxNps)
  setNum('minBpm', params.minBpm)
  setNum('maxBpm', params.maxBpm)
  setNum('minDuration', params.minDuration)
  setNum('maxDuration', params.maxDuration)
  setNum('minRating', params.minRating)
  setNum('maxRating', params.maxRating)
  setStr('from', params.from)
  setStr('to', params.to)
  setBool('chroma', params.chroma)
  setBool('cinema', params.cinema)
  setBool('noodle', params.noodle)
  setBool('me', params.me)
  setBool('curated', params.curated)
  setBool('verified', params.verified)
  setBool('fullSpread', params.fullSpread)
  const res = await fetch(`/proxy/beatsaver/search/v1/${page}?${q.toString()}`, {
    headers: { accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`BeatSaver search failed: ${res.status}`)
  return (await res.json()) as BeatSaverSearchResponse
}

const BEATSAVER_URL_PATTERN = /(?:beatsaver\.com\/maps\/|^)([a-f0-9]+)$/i

export function parseBeatSaverCode(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const match = trimmed.match(BEATSAVER_URL_PATTERN)
  if (match) return match[1]

  if (/^[a-f0-9]+$/i.test(trimmed)) return trimmed

  return null
}

interface BeatLeaderLeaderboardEntry {
  id: string
  difficulty: {
    value: number
    mode: number
    difficultyName: string
    modeName: string
  }
}

const BL_DIFF_VALUE_TO_NAME: Record<number, string> = {
  1: 'Easy',
  3: 'Normal',
  5: 'Hard',
  7: 'Expert',
  9: 'ExpertPlus',
}


export interface BeatLeaderScore {
  id: number
  baseScore: number
  modifiedScore: number
  accuracy: number
  rank: number
  modifiers: string
  player: {
    id: string
    name: string
    avatar: string
    country: string
  }
}

export interface BeatLeaderLeaderboardPayload {
  scores: BeatLeaderScore[]
  maxScore: number
}

interface BeatLeaderLeaderboardResponse {
  scores?: { data?: BeatLeaderScore[] } | BeatLeaderScore[]
  difficulty?: { maxScore?: number; maxScoreGraph?: unknown }
  song?: { difficulties?: Array<{ maxScore?: number }> }
}

export async function fetchBeatLeaderScores(
  leaderboardId: string,
  count = 100,
): Promise<BeatLeaderLeaderboardPayload> {
  const url = `/proxy/beatleader/leaderboard/${encodeURIComponent(leaderboardId)}?page=1&count=${count}`
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`BeatLeader request failed: ${res.status}`)
  const data = (await res.json()) as BeatLeaderLeaderboardResponse
  const rawScores = Array.isArray(data.scores)
    ? data.scores
    : (data.scores?.data ?? [])
  const maxScore = data.difficulty?.maxScore
    ?? data.song?.difficulties?.[0]?.maxScore
    ?? 0
  return { scores: rawScores, maxScore }
}

export interface BeatLeaderMapInfo {
  leaderboards: Map<string, string>
  coverUrl: string | null
}

export async function fetchBeatLeaderMapInfo(hash: string): Promise<BeatLeaderMapInfo> {
  const leaderboards = new Map<string, string>()
  let coverUrl: string | null = null
  try {
    const res = await fetch(`/proxy/beatleader/leaderboards/hash/${hash}`)
    if (!res.ok) return { leaderboards, coverUrl }
    const data = await res.json()
    coverUrl = data.song?.fullCoverImage ?? data.song?.coverImage ?? null
    const entries: BeatLeaderLeaderboardEntry[] = data.leaderboards ?? []
    for (const entry of entries) {
      const diffName = BL_DIFF_VALUE_TO_NAME[entry.difficulty.value] ?? ''
      const characteristic = entry.difficulty.modeName
      leaderboards.set(`${diffName}-${characteristic}`, entry.id)
    }
  } catch {
  }
  return { leaderboards, coverUrl }
}

export async function fetchBeatLeaderLeaderboards(hash: string): Promise<Map<string, string>> {
  return (await fetchBeatLeaderMapInfo(hash)).leaderboards
}

export interface MapLeaderboardIndex {
  bl: Map<string, string>
  ss: Map<string, number>
  coverUrl: string | null
}

export async function fetchMapLeaderboardIndex(hash: string): Promise<MapLeaderboardIndex> {
  const [blInfo, ss] = await Promise.all([
    fetchBeatLeaderMapInfo(hash),
    fetchScoreSaberLeaderboards(hash),
  ])
  return { bl: blInfo.leaderboards, ss, coverUrl: blInfo.coverUrl }
}

const DIFFICULTY_TO_ENUM: Record<string, string> = {
  Easy: 'EASY',
  Normal: 'NORMAL',
  Hard: 'HARD',
  Expert: 'EXPERT',
  ExpertPlus: 'EXPERT_PLUS',
}

const ENUM_TO_DIFFICULTY: Record<string, string> = {
  EASY: 'Easy',
  NORMAL: 'Normal',
  HARD: 'Hard',
  EXPERT: 'Expert',
  EXPERT_PLUS: 'ExpertPlus',
}

export function difficultyToEnum(bsDifficulty: string): string {
  return DIFFICULTY_TO_ENUM[bsDifficulty] ?? bsDifficulty.toUpperCase()
}

export function enumToBsDifficulty(enumValue: string): string {
  return ENUM_TO_DIFFICULTY[enumValue] ?? enumValue
}

export function formatBsDifficulty(bsDifficulty: string): string {
  if (bsDifficulty === 'ExpertPlus') return 'Expert+'
  return bsDifficulty
}

export async function fetchBeatSaverMap(code: string): Promise<BeatSaverMapResponse> {
  const res = await fetch(`/proxy/beatsaver/maps/id/${code}`)
  if (!res.ok) {
    throw new Error(`BeatSaver API returned ${res.status}`)
  }
  return res.json()
}

export interface ScoreSaberDifficulty {
  leaderboardId: number
  difficulty: number
  gameMode: string
  difficultyRaw: string
}

const SS_DIFF_VALUE_TO_NAME: Record<number, string> = {
  1: 'Easy',
  3: 'Normal',
  5: 'Hard',
  7: 'Expert',
  9: 'ExpertPlus',
}

export interface ScoreSaberScoreEntry {
  id: number
  baseScore: number
  modifiedScore: number
  modifiers: string
  rank: number
  leaderboardPlayerInfo: {
    id: string
    name: string
    profilePicture: string
    country: string
  } | null
}

export interface ScoreSaberLeaderboardScoresResponse {
  scores?: ScoreSaberScoreEntry[]
  metadata?: { maxScore?: number }
  leaderboard?: { maxScore?: number }
}

export interface ScoreSaberScoresPayload {
  scores: ScoreSaberScoreEntry[]
  maxScore: number
}

export async function fetchScoreSaberLeaderboardMaxScore(leaderboardId: string): Promise<number> {
  try {
    const res = await fetch(
      `/proxy/scoresaber/api/leaderboard/by-id/${encodeURIComponent(leaderboardId)}/info`,
      { headers: { accept: 'application/json' } },
    )
    if (!res.ok) return 0
    const data = (await res.json()) as { maxScore?: number }
    return data.maxScore ?? 0
  } catch {
    return 0
  }
}

export async function fetchBeatLeaderLeaderboardMaxScore(leaderboardId: string): Promise<number> {
  try {
    const res = await fetch(
      `/proxy/beatleader/leaderboard/${encodeURIComponent(leaderboardId)}?page=1&count=1`,
      { headers: { accept: 'application/json' } },
    )
    if (!res.ok) return 0
    const data = (await res.json()) as BeatLeaderLeaderboardResponse
    return data.difficulty?.maxScore ?? data.song?.difficulties?.[0]?.maxScore ?? 0
  } catch {
    return 0
  }
}

export async function fetchScoreSaberScores(
  leaderboardId: string,
  count = 100,
): Promise<ScoreSaberScoresPayload> {
  const all: ScoreSaberScoreEntry[] = []
  let maxScore = 0
  const pageSize = 12
  const maxPages = Math.ceil(count / pageSize)
  for (let page = 1; page <= maxPages; page++) {
    const url = `/proxy/scoresaber/api/leaderboard/by-id/${encodeURIComponent(leaderboardId)}/scores?page=${page}&withMetadata=true`
    const res = await fetch(url, { headers: { accept: 'application/json' } })
    if (!res.ok) throw new Error(`ScoreSaber request failed: ${res.status}`)
    const data = (await res.json()) as ScoreSaberLeaderboardScoresResponse
    const batch = data.scores ?? []
    if (!maxScore) {
      maxScore = data.metadata?.maxScore ?? data.leaderboard?.maxScore ?? 0
    }
    for (const s of batch) {
      if (s.leaderboardPlayerInfo) all.push(s)
    }
    if (batch.length < pageSize || all.length >= count) break
  }
  if (!maxScore) {
    maxScore = await fetchScoreSaberLeaderboardMaxScore(leaderboardId)
  }
  return { scores: all.slice(0, count), maxScore }
}

export async function fetchScoreSaberLeaderboards(hash: string): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  try {
    const res = await fetch(`/proxy/scoresaber/api/leaderboard/get-difficulties/${hash}`)
    if (!res.ok) return map
    const data: ScoreSaberDifficulty[] = await res.json()
    for (const entry of data) {
      const diffName = SS_DIFF_VALUE_TO_NAME[entry.difficulty] ?? ''
      const characteristic = entry.gameMode.replace('Solo', '')
      const key = `${diffName}-${characteristic}`
      map.set(key, entry.leaderboardId)
    }
  } catch {
  }
  return map
}

export interface DifficultyDriftResult {
  drift: boolean
  oldHash: string
  newHash: string | null
  newBlLeaderboardId: string | null
  newSsLeaderboardId: string | null
}

export async function detectDifficultyDrift(args: {
  beatsaverCode: string
  currentHash: string
  difficulty: string
  characteristic: string
}): Promise<DifficultyDriftResult> {
  const empty: DifficultyDriftResult = {
    drift: false,
    oldHash: args.currentHash,
    newHash: null,
    newBlLeaderboardId: null,
    newSsLeaderboardId: null,
  }
  const map = await fetchBeatSaverMap(args.beatsaverCode)
  const latestHash = map.versions[0]?.hash ?? null
  if (!latestHash) return empty
  if (latestHash.toLowerCase() === args.currentHash.toLowerCase()) {
    return { ...empty, newHash: latestHash }
  }
  const bsDiffName = enumToBsDifficulty(args.difficulty)
  const key = `${bsDiffName}-${args.characteristic}`
  const [blMap, ssMap] = await Promise.all([
    fetchBeatLeaderLeaderboards(latestHash),
    fetchScoreSaberLeaderboards(latestHash),
  ])
  return {
    drift: true,
    oldHash: args.currentHash,
    newHash: latestHash,
    newBlLeaderboardId: blMap.get(key) ?? null,
    newSsLeaderboardId: ssMap.get(key) != null ? String(ssMap.get(key)) : null,
  }
}
