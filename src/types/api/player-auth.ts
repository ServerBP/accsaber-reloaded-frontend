export type OAuthProvider = 'discord' | 'beatleader' | 'steam'

export interface AuthConnection {
  provider: OAuthProvider
  providerUserId: string
  providerUsername: string | null
  providerAvatarUrl: string | null
}

export interface AuthMeStaff {
  staffId: string
  role: string
  status: string
}

export interface AuthMeResponse {
  userId: string
  name: string
  avatarUrl: string | null
  cdnAvatarUrl?: string | null
  country: string | null
  banned: boolean
  connections: AuthConnection[]
  staff: AuthMeStaff | null
}

export interface PlayerAuthResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  userId: string
}

export interface PlayerRefreshRequest {
  refreshToken: string
}

export interface PlayerLogoutRequest {
  refreshToken: string
}
