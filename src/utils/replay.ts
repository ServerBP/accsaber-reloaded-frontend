import type { ReplayService } from '@/types/api/settings'

const SCORESABER_2_RELEASE_MS = Date.parse('2026-05-25T00:00:00Z')

const REPLAY_ICON: Record<ReplayService, string> = {
  beatleader: 'https://beatleader.com/assets/bs-pepe.gif',
  arcviewer: 'https://beatleader.com/assets/ArcViewerIcon.webp',
  scoresaber: 'https://scoresaber.com/favicon-32x32.png',
}

const REPLAY_LABEL: Record<ReplayService, string> = {
  beatleader: 'Watch replay',
  arcviewer: 'Watch in ArcViewer',
  scoresaber: 'Watch on ScoreSaber',
}

const REPLAY_NAME: Record<ReplayService, string> = {
  beatleader: 'BeatLeader',
  arcviewer: 'ArcViewer',
  scoresaber: 'ScoreSaber',
}

const PROVIDER_ORDER: ReplayService[] = ['beatleader', 'arcviewer', 'scoresaber']

export interface ReplaySource {
  blScoreId?: number | null
  ssScoreId?: number | null
  date?: string | null
}

export interface ResolvedReplay {
  url: string
  label: string
  name: string
  icon: string
  provider: ReplayService
}

export function beatLeaderReplayUrl(blScoreId: number | null | undefined): string | null {
  return blScoreId == null ? null : `https://replay.beatleader.com/?scoreId=${blScoreId}`
}

export function arcViewerReplayUrl(blScoreId: number | null | undefined): string | null {
  return blScoreId == null ? null : `https://allpoland.github.io/ArcViewer/?scoreID=${blScoreId}`
}

/**
 * ScoreSaber 2 replay link. Requires a non-null ssScoreId and a score set on or
 * after the ScoreSaber 2 release (2026-05-25) since the viewer cannot play
 * older ScoreSaber replays.
 */
export function scoreSaberReplayUrl(src: ReplaySource): string | null {
  if (src.ssScoreId == null) return null
  if (!src.date || Date.parse(src.date) < SCORESABER_2_RELEASE_MS) return null
  return `https://watch.scoresaber.com/?ssScoreId=${src.ssScoreId}&autoPlay=true`
}

function providerUrl(src: ReplaySource, provider: ReplayService): string | null {
  switch (provider) {
    case 'beatleader': return beatLeaderReplayUrl(src.blScoreId)
    case 'arcviewer': return arcViewerReplayUrl(src.blScoreId)
    case 'scoresaber': return scoreSaberReplayUrl(src)
  }
}

function describe(url: string, provider: ReplayService): ResolvedReplay {
  return {
    url,
    label: REPLAY_LABEL[provider],
    name: REPLAY_NAME[provider],
    icon: REPLAY_ICON[provider],
    provider,
  }
}

/**
 * Providers that can actually play this score, ordered by the viewer's
 * preference: primary first, then the configured fallback, then whatever
 * remains so a score is never left without a playable link.
 */
export function resolveReplayChain(
  src: ReplaySource,
  primary: ReplayService,
  fallback?: ReplayService | null,
): ResolvedReplay[] {
  const ordered: ReplayService[] = [primary]
  if (fallback && fallback !== primary) ordered.push(fallback)
  for (const provider of PROVIDER_ORDER) {
    if (!ordered.includes(provider)) ordered.push(provider)
  }
  const out: ResolvedReplay[] = []
  for (const provider of ordered) {
    const url = providerUrl(src, provider)
    if (url) out.push(describe(url, provider))
  }
  return out
}

/**
 * The single best replay link for a score, or null when no provider can play it.
 */
export function resolveReplay(
  src: ReplaySource,
  primary: ReplayService,
  fallback?: ReplayService | null,
): ResolvedReplay | null {
  return resolveReplayChain(src, primary, fallback)[0] ?? null
}

/**
 * Opens a replay, retrying once with the next resolved provider when the window
 * fails to open. A blocked or failed open is retried; nothing is opened when the
 * chain is empty.
 */
export function openReplay(chain: ResolvedReplay[]): void {
  for (const replay of chain.slice(0, 2)) {
    if (window.open(replay.url, '_blank', 'noopener,noreferrer')) return
  }
}
