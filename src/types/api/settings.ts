export type Visibility = 'public' | 'followers_only' | 'private'

export type SettingGroup = 'privacy' | 'appearance' | 'notifications'

export type ReplayService = 'beatleader' | 'scoresaber' | 'arcviewer'

export type ComplexityNumberStyle = 'colored' | 'plain'

export type ScoreRowField =
  | 'difficulty'
  | 'accuracy'
  | 'ap'
  | 'weighted_ap'
  | 'complexity'
  | 'category'
  | 'streak_115'
  | 'pauses'
  | 'play_count'
  | 'date'

export type SettingKey =
  | 'privacy.followingVisibility'
  | 'privacy.rivalsVisibility'
  | 'appearance.theme'
  | 'appearance.colorScheme'
  | 'appearance.primaryReplayService'
  | 'appearance.fallbackReplayService'
  | 'appearance.complexityNumberStyle'
  | 'appearance.complexityBar'
  | 'appearance.scoreRowFields'
  | 'appearance.hideReloadedProfileFeatures'
  | 'appearance.showStatisticsChart'
  | 'notifications.tradeOffer'
  | 'notifications.tradeResolved'
  | 'notifications.marketSold'
  | 'notifications.marketBid'
  | 'notifications.itemEarned'
  | 'notifications.server'

export type SettingsBag = Record<string, unknown>

export interface PrivacySettings extends SettingsBag {
  'privacy.followingVisibility': Visibility
  'privacy.rivalsVisibility': Visibility
}

export interface AppearanceSettings extends SettingsBag {
  'appearance.theme': string
  'appearance.colorScheme': string
  'appearance.primaryReplayService': ReplayService
  'appearance.fallbackReplayService': ReplayService | null
  'appearance.complexityNumberStyle': ComplexityNumberStyle
  'appearance.complexityBar': boolean
  'appearance.scoreRowFields': ScoreRowField[]
  'appearance.hideReloadedProfileFeatures': boolean
  'appearance.showStatisticsChart': boolean
}

export interface NotificationSettings extends SettingsBag {
  'notifications.tradeOffer': boolean
  'notifications.tradeResolved': boolean
  'notifications.marketSold': boolean
  'notifications.marketBid': boolean
  'notifications.itemEarned': boolean
  'notifications.server': boolean
}
