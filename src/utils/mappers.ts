import type { PublicMapDifficultyResponse } from '@/types/api/maps'
import type { MilestoneCompletionResponse } from '@/types/api/milestones'
import type { PublicStaffUserResponse } from '@/types/api/staff'
import type { LeaderboardResponse, ScoreResponse, UserMilestoneProgressResponse, XpLeaderboardResponse } from '@/types/api/users'
import type { CategoryCode, DifficultyScoreDisplay, MapDisplay, MilestoneDisplay, PlayerDisplay, ScoreDisplay, UserRefDisplay, XpPlayerDisplay } from '@/types/display'
import { pickAvatarFallback, pickAvatarUrl, pickCoverFallback, pickCoverUrl } from '@/composables/useAvatarFallback'

export function formatDifficulty(diff: string): string {
  switch (diff) {
    case 'EASY': return 'Easy'
    case 'NORMAL': return 'Normal'
    case 'HARD': return 'Hard'
    case 'EXPERT': return 'Expert'
    case 'EXPERT_PLUS': return 'Expert+'
    default: return diff
  }
}

export function toStaffUserDisplay(staff: PublicStaffUserResponse): UserRefDisplay {
  return {
    id: staff.userId,
    name: staff.username,
    avatarUrl: staff.avatarUrl,
    cdnAvatarUrl: staff.cdnAvatarUrl,
  }
}

export function toPlayerDisplay(entry: LeaderboardResponse): PlayerDisplay {
  return {
    userId: entry.userId,
    name: entry.userName,
    country: entry.country,
    avatarUrl: pickAvatarUrl(entry),
    avatarFallbackUrl: pickAvatarFallback(entry),
    rank: entry.ranking,
    countryRank: entry.countryRanking,
    rankChange: entry.rankingLastWeek != null ? entry.rankingLastWeek - entry.ranking : null,
    ap: entry.ap,
    avgAccuracy: entry.averageAcc,
    rankedPlays: entry.rankedPlays,
    playerInactive: entry.playerInactive,
    supporterTier: entry.supporterTier ?? null,
  }
}

export function toXpPlayerDisplay(entry: XpLeaderboardResponse): XpPlayerDisplay {
  return {
    userId: entry.userId,
    name: entry.userName,
    country: entry.country,
    avatarUrl: pickAvatarUrl(entry),
    avatarFallbackUrl: pickAvatarFallback(entry),
    rank: entry.ranking,
    countryRank: entry.countryRanking,
    rankChange: entry.rankingLastWeek != null ? entry.rankingLastWeek - entry.ranking : null,
    totalXp: entry.totalXp,
    level: entry.level,
    playerInactive: entry.playerInactive,
    supporterTier: entry.supporterTier ?? null,
  }
}

export function toScoreDisplay(
  score: ScoreResponse,
  modifierNames: string[],
  categoryCode?: CategoryCode,
): ScoreDisplay {
  return {
    scoreId: score.id,
    mapId: score.mapId,
    mapDifficultyId: score.mapDifficultyId,
    beatsaverCode: score.beatsaverCode ?? null,
    characteristic: score.characteristic,
    rawDifficulty: score.difficulty,
    mapName: score.songName ?? 'Unknown Map',
    artistName: score.songAuthor,
    difficulty: formatDifficulty(score.difficulty),
    categoryCode: categoryCode ?? 'overall',
    coverUrl: pickCoverUrl(score),
    coverFallbackUrl: pickCoverFallback(score),
    leaderboardRank: score.rank,
    score: score.score,
    scoreNoMods: score.scoreNoMods,
    accuracy: score.accuracy,
    ap: score.ap,
    weightedAp: score.weightedAp,
    complexity: score.complexity ?? null,
    modifiers: modifierNames,
    date: score.timeSet,
    misses: score.misses ?? undefined,
    badCuts: score.badCuts ?? undefined,
    maxCombo: score.maxCombo ?? undefined,
    wallHits: score.wallHits ?? undefined,
    bombHits: score.bombHits ?? undefined,
    pauses: score.pauses ?? undefined,
    streak115: score.streak115 ?? undefined,
    playCount: score.playCount ?? undefined,
    hmd: score.hmd ?? undefined,
    xpGained: score.xpGained ?? undefined,
    rankWhenSet: score.rankWhenSet ?? undefined,
    blScoreId: score.blScoreId ?? undefined,
    ssScoreId: score.ssScoreId ?? undefined,
    mapAuthor: score.mapAuthor,
    active: score.active,
    partial: score.partial,
    supersedesReason: score.supersedesReason,
    supporterTier: score.supporterTier ?? null,
  }
}

export function toMapDisplay(
  diff: PublicMapDifficultyResponse,
  getCategoryCode: (id: string) => CategoryCode | undefined,
): MapDisplay {
  return {
    id: diff.mapId,
    difficultyId: diff.id,
    songName: diff.songName,
    artistName: diff.songAuthor,
    mapperName: diff.mapAuthor,
    coverUrl: pickCoverUrl(diff),
    coverFallbackUrl: pickCoverFallback(diff),
    complexity: diff.complexity ?? 0,
    categoryCode: getCategoryCode(diff.categoryId) ?? 'overall',
    difficulty: diff.difficulty,
    difficultyLabel: formatDifficulty(diff.difficulty),
    characteristic: diff.characteristic,
    totalScores: diff.statistics?.totalScores,
    rankedAt: diff.rankedAt ?? undefined,
    beatsaverCode: diff.beatsaverCode ?? undefined,
  }
}

export function toDifficultyScoreDisplay(
  score: ScoreResponse,
  modifierNames: string[],
): DifficultyScoreDisplay {
  return {
    id: score.id,
    rank: score.rank,
    countryRank: score.countryRank,
    userId: score.userId,
    userName: score.userName,
    avatarUrl: pickAvatarUrl(score),
    avatarFallbackUrl: pickAvatarFallback(score),
    country: score.country,
    accuracy: score.accuracy,
    score: score.score,
    scoreNoMods: score.scoreNoMods,
    ap: score.ap,
    weightedAp: score.weightedAp,
    modifiers: modifierNames,
    date: score.timeSet,
    blScoreId: score.blScoreId ?? undefined,
    ssScoreId: score.ssScoreId ?? undefined,
    misses: score.misses,
    badCuts: score.badCuts,
    maxCombo: score.maxCombo,
    wallHits: score.wallHits,
    bombHits: score.bombHits,
    pauses: score.pauses,
    streak115: score.streak115,
    playCount: score.playCount,
    hmd: score.hmd,
    xpGained: score.xpGained,
    rankWhenSet: score.rankWhenSet,
    supporterTier: score.supporterTier ?? null,
  }
}

export function toMilestoneDisplay(
  m: UserMilestoneProgressResponse,
  categoryCode?: CategoryCode,
): MilestoneDisplay {
  return {
    id: m.milestoneId,
    title: m.title,
    description: m.description,
    type: m.type,
    tier: m.tier,
    xp: m.xp,
    targetValue: m.targetValue,
    userProgress: m.progress,
    normalizedProgress: m.normalizedProgress,
    completionPercent: m.completionPercentage,
    isCompleted: m.completed,
    categoryCode,
  }
}

export function toMilestoneCompletion(
  m: UserMilestoneProgressResponse,
): MilestoneCompletionResponse {
  return {
    milestoneId: m.milestoneId,
    title: m.title,
    description: m.description,
    type: m.type,
    tier: m.tier,
    xp: m.xp,
    targetValue: m.targetValue,
    comparison: 'GTE',
    setId: m.setId,
    categoryId: m.categoryId,
    blExclusive: false,
    completions: 0,
    totalPlayers: 0,
    completionPercentage: m.completionPercentage,
    userCompleted: m.completed,
    userCompletedAt: m.completedAt ?? undefined,
  }
}
