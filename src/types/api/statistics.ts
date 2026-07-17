import type { ItemRarity, ItemTypeKey } from './items'

export interface MapAvgApResponse {
  mapDifficultyId: string
  mapId: string
  songName: string
  songAuthor: string
  mapAuthor: string
  coverUrl: string
  cdnCoverUrl?: string | null
  difficulty: string
  characteristic?: string
  beatsaverCode?: string | null
  categoryId: string
  categoryName: string
  averageWeightedAp: number
  scoreCount: number
  latestScoreId: string
  latestScoreTimeSet: string
}

export interface MapRetryResponse {
  mapDifficultyId: string
  mapId: string
  songName: string
  songAuthor: string
  mapAuthor: string
  coverUrl: string
  cdnCoverUrl?: string | null
  difficulty: string
  characteristic?: string
  beatsaverCode?: string | null
  categoryId: string
  categoryName: string
  supersededCount: number
  latestScoreId: string
  latestScoreTimeSet: string
}

export interface UserImprovementsResponse {
  userId: string
  userName: string
  avatarUrl: string
  cdnAvatarUrl?: string | null
  country: string
  improvementCount: number
  latestScoreId: string
  latestScoreTimeSet: string
}

export interface UserMapImprovementsResponse {
  userId: string
  userName: string
  avatarUrl: string
  cdnAvatarUrl?: string | null
  country: string
  mapDifficultyId: string
  mapId: string
  songName: string
  songAuthor: string
  mapAuthor: string
  coverUrl: string
  cdnCoverUrl?: string | null
  difficulty: string
  categoryId: string
  categoryName: string
  improvementCount: number
  latestScoreId: string
  latestScoreTimeSet: string
}

export interface MilestoneCollectorResponse {
  userId: string
  userName: string
  avatarUrl: string
  cdnAvatarUrl?: string | null
  country: string
  milestoneCount: number
}

export interface ItemStatsPlayerRef {
  userId: string
  userName: string
  avatarUrl: string
  cdnAvatarUrl?: string | null
  country: string
}

export interface UserItemCountResponse extends ItemStatsPlayerRef {
  itemCount: number
}

export interface UserCrateCountResponse extends ItemStatsPlayerRef {
  crateCount: number
}

export interface UserInventoryValueResponse extends ItemStatsPlayerRef {
  itemsValue: number
  essenceBalance: number
  totalValue: number
}

export interface UserFirstEditionResponse extends ItemStatsPlayerRef {
  firstEditionCount: number
}

export interface UserCollectionResponse extends ItemStatsPlayerRef {
  ownedCount: number
  catalogTotal: number
  completionPercent: number
}

export interface UserTraderResponse extends ItemStatsPlayerRef {
  tradeCount: number
  itemsTraded: number
}

export interface UserEssenceEarnedResponse extends ItemStatsPlayerRef {
  essenceEarned: number
}

export interface RarestUnboxedResponse {
  linkId: string
  owner: ItemStatsPlayerRef
  itemId: string
  itemName: string
  iconUrl: string | null
  rarity: ItemRarity
  typeKey: ItemTypeKey
  serialNumber: number | null
  modifierCount: number
  modifiers: string[]
  unusualEffect: string | null
}

export interface ItemScarcityResponse {
  itemId: string
  itemName: string
  iconUrl: string | null
  rarity: ItemRarity
  typeKey: ItemTypeKey
  ownerCount: number
}

export interface TimeSeriesPointResponse {
  date: string
  value: number
}

export interface DistributionEntryResponse {
  label: string
  count: number
}
