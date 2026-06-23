import type { ReplayService } from '@/types/api/settings'

const SCORESABER_2_RELEASE_MS = Date.parse('2026-05-25T00:00:00Z')

const REPLAY_ICON = {
  beatleader: 'https://beatleader.com/assets/bs-pepe.gif',
  arcviewer: 'https://beatleader.com/assets/ArcViewerIcon.webp',
  scoresaber: 'https://scoresaber.com/favicon-32x32.png',
} as const

export type ReplayProvider = 'beatleader' | 'arcviewer' | 'scoresaber'

export interface ReplaySource {
  blScoreId?: number | null
  ssScoreId?: number | null
  date?: string | null
}

export interface ResolvedReplay {
  url: string
  label: string
  icon: string
  provider: ReplayProvider
}

export function beatLeaderReplayUrl(
  blScoreId: number | null | undefined,
  service: ReplayService,
): string | null {
  if (blScoreId == null) return null
  return service === 'arcviewer'
    ? `https://allpoland.github.io/ArcViewer/?scoreID=${blScoreId}`
    : `https://replay.beatleader.com/?scoreId=${blScoreId}`
}

/**
 * ScoreSaber 2 replay link. Only a fallback for when no BeatLeader replay
 * exists: requires a null blScoreId, a non-null ssScoreId, and a score set on
 * or after the ScoreSaber 2 release (2026-05-25) since the viewer cannot play
 * older ScoreSaber replays.
 */
export function scoreSaberReplayUrl(src: ReplaySource): string | null {
  if (src.blScoreId != null) return null
  if (src.ssScoreId == null) return null
  if (!src.date || Date.parse(src.date) < SCORESABER_2_RELEASE_MS) return null
  return `https://watch.scoresaber.com/?ssScoreId=${src.ssScoreId}&autoPlay=true`
}

/**
 * Resolves the single best replay link for a score: the user's preferred
 * BeatLeader viewer when a BeatLeader replay exists, otherwise the ScoreSaber 2
 * fallback. Returns null when neither is available.
 */
export function resolveReplay(
  src: ReplaySource,
  service: ReplayService,
): ResolvedReplay | null {
  const bl = beatLeaderReplayUrl(src.blScoreId, service)
  if (bl) {
    return service === 'arcviewer'
      ? { url: bl, label: 'Watch in ArcViewer', icon: REPLAY_ICON.arcviewer, provider: 'arcviewer' }
      : { url: bl, label: 'Watch replay', icon: REPLAY_ICON.beatleader, provider: 'beatleader' }
  }
  const ss = scoreSaberReplayUrl(src)
  if (ss) {
    return { url: ss, label: 'Watch on ScoreSaber', icon: REPLAY_ICON.scoresaber, provider: 'scoresaber' }
  }
  return null
}
