<script setup lang="ts">
import { isRankingSubdomain, rankingDashboardRoute } from '@/router'
import { useAuthStore } from '@/stores/auth'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const authStore = useAuthStore()

const errorCode = ref<string | null>(null)
const errorMessage = ref<string | null>(null)

type StaffGate = 'none' | 'requested' | 'denied'
const staffGate = ref<StaffGate | null>(null)

const ERROR_COPY: Record<string, string> = {
  not_found:
    'Your Steam account doesn\'t match an AccSaber player. Play a ranked map on BeatLeader or ScoreSaber first, then try again.',
  forbidden: 'This account is banned or cannot be linked right now.',
  unauthorized: 'Your sign-in link expired. Please try logging in again.',
}

const STAFF_GATE_COPY: Record<StaffGate, { title: string; message: string }> = {
  none: {
    title: 'Not a ranking team member',
    message:
      'You are signed in, but your account is not on the ranking team. Request access or head back to the main site.',
  },
  requested: {
    title: 'Request pending',
    message:
      'Your ranking team request is waiting for an administrator. Check back once it has been approved.',
  },
  denied: {
    title: 'Access denied',
    message: 'Your ranking team request was denied. Reach out to an administrator for details.',
  },
}

const activeGate = computed(() => (staffGate.value ? STAFF_GATE_COPY[staffGate.value] : null))

onMounted(async () => {
  const rawHash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash
  const hash = new URLSearchParams(rawHash)
  const search = new URLSearchParams(window.location.search)

  const cleanPath = window.location.pathname
  history.replaceState(null, '', cleanPath)

  const error = hash.get('error') ?? search.get('error')
  if (error) {
    errorCode.value = error
    errorMessage.value = hash.get('message') ?? search.get('message') ?? ERROR_COPY[error] ?? null
    return
  }

  const pendingLinkToken = hash.get('pendingLinkToken')
  if (pendingLinkToken) {
    if (isRankingSubdomain) {
      const mainSite = 'https://accsaber.com'
      window.location.href = `${mainSite}/login/finish?pendingLinkToken=${encodeURIComponent(pendingLinkToken)}`
      return
    }
    sessionStorage.setItem('pendingLinkToken', pendingLinkToken)
    router.replace({ name: 'login-finish' })
    return
  }

  const accessToken = hash.get('accessToken')
  const refreshToken = hash.get('refreshToken')
  const expiresIn = Number(hash.get('expiresIn'))
  const userId = hash.get('userId')

  if (!accessToken || !refreshToken || !userId || !Number.isFinite(expiresIn)) {
    errorCode.value = 'unauthorized'
    errorMessage.value = ERROR_COPY.unauthorized
    return
  }

  sessionStorage.removeItem('pendingLinkToken')
  authStore.persistSession({
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    userId,
  })
  await authStore.fetchAuthMe()

  if (isRankingSubdomain) {
    const staff = authStore.authMe?.staff ?? null
    if (staff?.status === 'ACCEPTED') {
      router.replace({ name: rankingDashboardRoute })
      return
    }
    if (staff?.status === 'REQUESTED') {
      staffGate.value = 'requested'
      return
    }
    if (staff?.status === 'DENIED') {
      staffGate.value = 'denied'
      return
    }
    staffGate.value = 'none'
    return
  }

  const redirect = sessionStorage.getItem('authRedirectTo')
  sessionStorage.removeItem('authRedirectTo')
  router.replace(redirect && redirect.startsWith('/') ? redirect : '/')
})

function goHome() {
  router.replace('/')
}

function goRequestAccess() {
  router.replace({ name: 'ranking-login', query: { requestAccess: '1' } })
}

function goMainSite() {
  window.location.href = 'https://accsaber.com'
}
</script>

<template>
  <div class="auth-callback">
    <template v-if="errorCode">
      <h1 class="auth-callback__title">Sign-in failed</h1>
      <p class="auth-callback__message">
        {{ errorMessage ?? ERROR_COPY[errorCode] ?? 'Something went wrong. Please try again.' }}
      </p>
      <button class="auth-callback__btn" @click="goHome">Back to home</button>
    </template>
    <template v-else-if="activeGate">
      <h1 class="auth-callback__title">{{ activeGate.title }}</h1>
      <p class="auth-callback__message">{{ activeGate.message }}</p>
      <div class="auth-callback__actions">
        <button v-if="staffGate === 'none'" class="auth-callback__btn auth-callback__btn--primary"
          @click="goRequestAccess">
          Request access
        </button>
        <button class="auth-callback__btn" @click="goMainSite">Back to main site</button>
      </div>
    </template>
    <template v-else>
      <div class="auth-callback__spinner" aria-hidden="true" />
      <p class="auth-callback__message">Signing you in...</p>
    </template>
  </div>
</template>

<style scoped>
.auth-callback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  min-height: 60vh;
  text-align: center;
  padding: var(--space-xl);
}

.auth-callback__title {
  font-size: var(--text-page-title);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.auth-callback__message {
  color: var(--text-secondary);
  max-width: 480px;
  line-height: 1.55;
}

.auth-callback__actions {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
  justify-content: center;
}

.auth-callback__btn {
  height: 40px;
  padding: 0 var(--space-lg);
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: 500;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}

.auth-callback__btn:hover {
  background: var(--bg-elevated);
  border-color: var(--text-tertiary);
}

.auth-callback__btn--primary {
  color: var(--accent);
  border-color: var(--accent);
}

.auth-callback__btn--primary:hover {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border-color: var(--accent);
}

.auth-callback__spinner {
  width: 28px;
  height: 28px;
  border: 2px solid var(--bg-overlay);
  border-top-color: var(--accent, var(--text-primary));
  border-radius: 50%;
  animation: auth-spin 700ms linear infinite;
}

@keyframes auth-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-callback__spinner {
    animation: none;
  }
}
</style>
