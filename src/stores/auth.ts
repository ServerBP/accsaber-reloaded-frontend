import {
  getAuthMe,
  logoutPlayer,
  refreshPlayerToken,
} from '@/api/auth'
import { login as apiLogin, refreshToken as apiRefresh, logout as apiLogout } from '@/api/staff-auth'
import type { AuthMeResponse, OAuthProvider } from '@/types/api/player-auth'
import type { StaffRole } from '@/types/enums'
import {
  clearPlayerSession,
  migrateLegacyPlayerSession,
  readPlayerSession,
  writePlayerSession,
} from '@/utils/playerSession'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const ROLE_HIERARCHY: Record<StaffRole, number> = {
  RANKING: 2,
  RANKING_HEAD: 3,
  CAMPAIGN_CURATOR: 3,
  CREATIVE: 1,
  ADMIN: 5,
  DEVELOPER: 4,
  MODERATOR: 1,
}

const PROACTIVE_REFRESH_MS = 24 * 60 * 60 * 1000

const LEGACY_LS_USER_ID = 'userId'

migrateLegacyPlayerSession()

interface UserProfileShape {
  name: string
  avatarUrl: string
  avatarFallbackUrl: string | null
  country: string
}

export const useAuthStore = defineStore('auth', () => {
  const initialSession = readPlayerSession()
  const accessToken = ref<string | null>(initialSession.accessToken)
  const refreshTokenValue = ref<string | null>(initialSession.refreshToken)
  const expiresAt = ref<number>(initialSession.expiresAt)
  const userId = ref<string | null>(initialSession.userId)

  const authMe = ref<AuthMeResponse | null>(null)

  const legacyUserIdDetected = ref<string | null>(null)

  const restricted = ref(false)
  function markRestricted() {
    restricted.value = true
  }
  function clearRestricted() {
    restricted.value = false
  }

  const staffToken = ref<string | null>(localStorage.getItem('staffToken'))
  const staffRefreshToken = ref<string | null>(localStorage.getItem('staffRefreshToken'))
  const staffRole = ref<StaffRole | null>(
    (localStorage.getItem('staffRole') as StaffRole) || null,
  )
  const staffTokenExpiresAt = ref<number>(
    Number(localStorage.getItem('staffTokenExpiresAt')) || 0,
  )

  const hasPlayerSession = computed(() => accessToken.value !== null && refreshTokenValue.value !== null)
  const isLoggedIn = computed(() => authMe.value !== null)
  const isStaffAuthenticated = computed(() => staffToken.value !== null)
  const isAdmin = computed(() => staffRole.value === 'ADMIN')

  const userProfile = computed<UserProfileShape | null>(() => {
    const me = authMe.value
    if (!me) return null
    const resolved = me.cdnAvatarUrl ?? me.avatarUrl ?? ''
    const fallback = me.cdnAvatarUrl && me.avatarUrl && me.cdnAvatarUrl !== me.avatarUrl
      ? me.avatarUrl
      : null
    return {
      name: me.name,
      avatarUrl: resolved,
      avatarFallbackUrl: fallback,
      country: me.country ?? '',
    }
  })

  const staffId = computed<string | null>(() => {
    const token = staffToken.value
    if (!token) return null
    try {
      return JSON.parse(atob(token.split('.')[1])).sub as string
    } catch {
      return null
    }
  })

  const isTokenExpiringSoon = computed(
    () => staffTokenExpiresAt.value > 0 && Date.now() > staffTokenExpiresAt.value - 60_000,
  )

  const isPlayerTokenExpiringSoon = computed(
    () => expiresAt.value > 0 && Date.now() > expiresAt.value - PROACTIVE_REFRESH_MS,
  )

  const oauthStaffRole = computed<StaffRole | null>(() => {
    const staff = authMe.value?.staff
    if (!staff || staff.status !== 'ACCEPTED') return null
    const role = staff.role as StaffRole
    return role in ROLE_HIERARCHY ? role : null
  })

  function hasRole(requiredRole: StaffRole): boolean {
    const required = ROLE_HIERARCHY[requiredRole]
    if (oauthStaffRole.value && ROLE_HIERARCHY[oauthStaffRole.value] >= required) return true
    if (staffRole.value && ROLE_HIERARCHY[staffRole.value] >= required) return true
    return false
  }

  const currentStaffRole = computed<StaffRole | null>(
    () => oauthStaffRole.value ?? staffRole.value ?? null,
  )

  const isStaffAuthorized = computed(
    () => staffToken.value !== null || oauthStaffRole.value !== null,
  )

  const hasCreativeAccess = computed(
    () => currentStaffRole.value === 'CREATIVE' || currentStaffRole.value === 'ADMIN',
  )

  function persistSession(session: {
    accessToken: string
    refreshToken: string
    expiresAt: number
    userId: string
  }) {
    accessToken.value = session.accessToken
    refreshTokenValue.value = session.refreshToken
    expiresAt.value = session.expiresAt
    userId.value = session.userId
    restricted.value = false
    writePlayerSession(session)
    clearStaffAuth()
  }

  function clearSession() {
    accessToken.value = null
    refreshTokenValue.value = null
    expiresAt.value = 0
    userId.value = null
    authMe.value = null
    restricted.value = false
    clearPlayerSession()
  }

  let playerRefreshPromise: Promise<boolean> | null = null

  async function refreshPlayerSession(): Promise<boolean> {
    if (playerRefreshPromise) return playerRefreshPromise
    const token = refreshTokenValue.value
    if (!token) return false

    playerRefreshPromise = (async () => {
      try {
        const res = await refreshPlayerToken({ refreshToken: token })
        persistSession({
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          expiresAt: Date.now() + res.expiresIn * 1000,
          userId: res.userId,
        })
        return true
      } catch {
        clearSession()
        return false
      } finally {
        playerRefreshPromise = null
      }
    })()

    return playerRefreshPromise
  }

  async function fetchAuthMe(): Promise<AuthMeResponse | null> {
    if (!accessToken.value) {
      authMe.value = null
      return null
    }
    try {
      const me = await getAuthMe()
      authMe.value = me
      const nextUserId = String(me.userId)
      if (userId.value !== nextUserId && accessToken.value && refreshTokenValue.value) {
        writePlayerSession({
          accessToken: accessToken.value,
          refreshToken: refreshTokenValue.value,
          expiresAt: expiresAt.value,
          userId: nextUserId,
        })
      }
      userId.value = nextUserId
      return me
    } catch {
      authMe.value = null
      return null
    }
  }

  async function bootstrap(): Promise<void> {
    const legacy = localStorage.getItem(LEGACY_LS_USER_ID)
    if (legacy && !accessToken.value) {
      legacyUserIdDetected.value = legacy
      localStorage.removeItem(LEGACY_LS_USER_ID)
    }

    if (accessToken.value) {
      await fetchAuthMe()
    }
  }

  function dismissLegacyMigration() {
    legacyUserIdDetected.value = null
  }

  async function logout(): Promise<void> {
    const token = refreshTokenValue.value
    if (token) {
      try {
        await logoutPlayer({ refreshToken: token })
      } catch {
      }
    }
    clearSession()
  }

  async function removeConnection(provider: OAuthProvider): Promise<void> {
    const { deletePlayerConnection } = await import('@/api/auth')
    await deletePlayerConnection(provider)
    await fetchAuthMe()
  }

  function setStaffAuth(token: string, role: StaffRole) {
    staffToken.value = token
    staffRole.value = role
    localStorage.setItem('staffToken', token)
    localStorage.setItem('staffRole', role)
  }

  function clearStaffAuth() {
    staffToken.value = null
    staffRefreshToken.value = null
    staffRole.value = null
    staffTokenExpiresAt.value = 0
    localStorage.removeItem('staffToken')
    localStorage.removeItem('staffRefreshToken')
    localStorage.removeItem('staffRole')
    localStorage.removeItem('staffTokenExpiresAt')
  }

  let staffRefreshPromise: Promise<void> | null = null

  async function staffLogin(identifier: string, password: string, role?: StaffRole): Promise<void> {
    const res = await apiLogin({ identifier, password, role })
    staffToken.value = res.accessToken
    staffRefreshToken.value = res.refreshToken
    staffRole.value = res.role
    staffTokenExpiresAt.value = Date.now() + res.expiresIn * 1000
    localStorage.setItem('staffToken', res.accessToken)
    localStorage.setItem('staffRefreshToken', res.refreshToken)
    localStorage.setItem('staffRole', res.role)
    localStorage.setItem('staffTokenExpiresAt', String(staffTokenExpiresAt.value))
  }

  async function refreshStaffToken(): Promise<void> {
    if (staffRefreshPromise) return staffRefreshPromise

    staffRefreshPromise = (async () => {
      try {
        if (!staffRefreshToken.value) {
          clearStaffAuth()
          return
        }
        const res = await apiRefresh({ refreshToken: staffRefreshToken.value })
        staffToken.value = res.accessToken
        staffRefreshToken.value = res.refreshToken
        staffRole.value = res.role
        staffTokenExpiresAt.value = Date.now() + res.expiresIn * 1000
        localStorage.setItem('staffToken', res.accessToken)
        localStorage.setItem('staffRefreshToken', res.refreshToken)
        localStorage.setItem('staffRole', res.role)
        localStorage.setItem('staffTokenExpiresAt', String(staffTokenExpiresAt.value))
      } catch {
        clearStaffAuth()
      } finally {
        staffRefreshPromise = null
      }
    })()

    return staffRefreshPromise
  }

  async function staffLogout(): Promise<void> {
    try {
      await apiLogout()
    } catch {
    }
    clearStaffAuth()
  }

  return {
    accessToken,
    refreshTokenValue,
    expiresAt,
    userId,
    authMe,
    userProfile,
    legacyUserIdDetected,
    restricted,
    markRestricted,
    clearRestricted,
    hasPlayerSession,
    isLoggedIn,
    isPlayerTokenExpiringSoon,

    staffToken,
    staffRefreshToken,
    staffRole,
    staffTokenExpiresAt,
    staffId,
    oauthStaffRole,
    currentStaffRole,
    isStaffAuthenticated,
    isStaffAuthorized,
    hasCreativeAccess,
    isAdmin,
    isTokenExpiringSoon,

    hasRole,
    persistSession,
    clearSession,
    refreshPlayerSession,
    fetchAuthMe,
    bootstrap,
    dismissLegacyMigration,
    logout,
    removeConnection,

    setStaffAuth,
    clearStaffAuth,
    login: staffLogin,
    refreshStaffToken,
    staffLogout,
  }
})
