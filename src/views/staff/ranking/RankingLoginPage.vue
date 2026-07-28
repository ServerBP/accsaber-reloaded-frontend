<script setup lang="ts">
import logoUrl from '@/assets/logo.png'
import { buildOAuthStartUrl } from '@/api/auth'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import { usePageMeta } from '@/composables/usePageMeta'
import { rankingDashboardRoute } from '@/router'
import { useAuthStore } from '@/stores/auth'
import type { OAuthProvider } from '@/types/api/player-auth'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

type Mode = 'providers' | 'password' | 'request'

usePageMeta({
  title: 'Login | AccSaber Ranking',
  description: 'Sign-in for AccSaber ranking staff.',
})

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const mode = ref<Mode>('providers')

const identifier = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const requestUsername = ref('')
const requestEmail = ref('')
const requestPassword = ref('')
const requestConfirmPassword = ref('')
const requestError = ref('')
const requestSuccess = ref(false)
const requestLoading = ref(false)

const isPlayerLoggedIn = computed(() => auth.isLoggedIn)
const staffStatus = computed(() => auth.authMe?.staff?.status ?? null)

onMounted(async () => {
  if (auth.accessToken && !auth.authMe) {
    await auth.fetchAuthMe()
  }
  if (route.query.requestAccess === '1') {
    mode.value = 'request'
  }
  if (auth.isStaffAuthorized) {
    router.replace({ name: rankingDashboardRoute })
  }
})

watch(
  () => auth.isStaffAuthorized,
  (authorized) => {
    if (authorized) {
      const redirect = route.query.redirect as string | undefined
      const safe = redirect && redirect.startsWith('/') && !redirect.includes('login') ? redirect : undefined
      router.replace(safe ?? { name: rankingDashboardRoute })
    }
  },
)

function rankingCallbackUrl(): string {
  return `${window.location.origin}/auth/callback`
}

function startProvider(provider: OAuthProvider) {
  error.value = ''
  window.location.href = buildOAuthStartUrl(provider, rankingCallbackUrl())
}

async function handleLogin() {
  if (!identifier.value || !password.value) return
  loading.value = true
  error.value = ''
  try {
    try {
      await auth.login(identifier.value, password.value, 'RANKING')
    } catch {
      await auth.login(identifier.value, password.value, 'RANKING_HEAD')
    }

    if (!auth.hasRole('RANKING')) {
      auth.clearStaffAuth()
      error.value = 'Access denied - this panel requires the RANKING role or higher.'
      return
    }

    const redirect = route.query.redirect as string | undefined
    const safe = redirect && redirect.startsWith('/') && !redirect.includes('login') ? redirect : undefined
    router.push(safe ?? { name: rankingDashboardRoute })
  } catch {
    error.value = 'Invalid credentials.'
  } finally {
    loading.value = false
  }
}

async function handleRequestAccess() {
  if (!requestUsername.value || !requestPassword.value) return
  if (requestPassword.value !== requestConfirmPassword.value) {
    requestError.value = 'Passwords do not match.'
    return
  }
  requestLoading.value = true
  requestError.value = ''
  try {
    const { requestAccess } = await import('@/api/staff-auth')
    await requestAccess({
      username: requestUsername.value,
      email: requestEmail.value || undefined,
      password: requestPassword.value,
      role: 'RANKING',
    })
    requestSuccess.value = true
  } catch (e) {
    const err = e as { status?: number; message?: string }
    if (err.status === 401) {
      requestError.value = 'Please log in first so we can link your request to your player.'
    } else if (err.status === 409) {
      requestError.value = 'You already have a staff record. Contact an administrator.'
    } else {
      requestError.value = 'Failed to submit request. Try again later.'
    }
  } finally {
    requestLoading.value = false
  }
}

const providerMeta: Record<OAuthProvider, string> = {
  discord: 'Continue with Discord',
  beatleader: 'Continue with BeatLeader',
  steam: 'Continue with Steam',
}
</script>

<template>
  <div class="ranking-login">
    <div class="ranking-login__card">
      <header class="ranking-login__header">
        <div class="ranking-login__logo">
          <img :src="logoUrl" alt="AccSaber" class="ranking-login__logo-img" fetchpriority="high" decoding="async" />
        </div>
        <div>
          <h1 class="ranking-login__title">AccSaber Ranking</h1>
          <p class="ranking-login__subtitle">Ranking team access</p>
        </div>
      </header>

      <template v-if="mode === 'providers'">
        <p class="ranking-login__intro">
          Log in with the account you already use on AccSaber. Your ranking team role is attached
          automatically if your player is on the roster.
        </p>

        <button class="provider provider--primary provider--discord" @click="startProvider('discord')">
          <span class="provider__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path
                d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.098 13.098 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.927 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.418 2.157-2.418 1.21 0 2.176 1.095 2.157 2.418 0 1.334-.956 2.419-2.157 2.419zm7.974 0c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.095 2.157 2.418 0 1.334-.946 2.419-2.157 2.419z" />
            </svg>
          </span>
          <span class="provider__label">{{ providerMeta.discord }}</span>
        </button>

        <div class="provider-row">
          <button class="provider" data-provider="beatleader" @click="startProvider('beatleader')">
            <span class="provider__icon" aria-hidden="true">
              <img src="https://beatleader.com/assets/favicon-32x32.png" alt="" width="18" height="18"
                class="provider__brand-img" decoding="async" />
            </span>
            <span>BeatLeader</span>
          </button>
          <button class="provider" data-provider="steam" @click="startProvider('steam')">
            <span class="provider__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path
                  d="M12 0C5.76 0 .63 4.77.04 10.86l6.44 2.66a3.4 3.4 0 0 1 1.92-.59c.06 0 .12 0 .18.01l2.87-4.15v-.06a4.54 4.54 0 1 1 4.54 4.54h-.1l-4.08 2.92c0 .05.01.1.01.15a3.41 3.41 0 1 1-6.75-.76L.2 13.64C1.63 18.58 6.38 22 12 22c6.63 0 12-5.37 12-12S18.63 0 12 0z" />
              </svg>
            </span>
            <span>Steam</span>
          </button>
        </div>

        <div class="ranking-login__divider"><span>or</span></div>

        <button class="ranking-login__secondary" @click="mode = 'password'">
          Sign in with username & password
        </button>
        <button class="ranking-login__link" @click="mode = 'request'">Request Access</button>
      </template>

      <form v-else-if="mode === 'password'" class="ranking-login__form" @submit.prevent="handleLogin">
        <BaseInput v-model="identifier" label="Username" placeholder="Username or email"
          autocomplete="username" :disabled="loading" />
        <BaseInput v-model="password" label="Password" type="password" placeholder="Password"
          autocomplete="current-password" :disabled="loading" />

        <div v-if="error" class="ranking-login__error" role="alert">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {{ error }}
        </div>

        <BaseButton type="submit" variant="primary" size="lg" :loading="loading"
          :disabled="!identifier || !password" style="width: 100%">
          Sign In
        </BaseButton>

        <button type="button" class="ranking-login__link" @click="mode = 'providers'">
          Back to OAuth
        </button>
      </form>

      <div v-else class="ranking-login__form">
        <template v-if="!requestSuccess">
          <p class="ranking-login__request-info">
            Submit a request to join the ranking team. An administrator will review your application.
          </p>

          <div v-if="!isPlayerLoggedIn" class="ranking-login__notice">
            You must log in with your AccSaber account first so we can link the request to your player.
            <div class="ranking-login__notice-actions">
              <button type="button" class="ranking-login__secondary" @click="mode = 'providers'">
                Log in first
              </button>
            </div>
          </div>

          <form v-else @submit.prevent="handleRequestAccess">
            <div class="ranking-login__form-fields">
              <BaseInput v-model="requestUsername" label="Username" placeholder="Your username"
                autocomplete="username" :disabled="requestLoading" />
              <div class="ranking-login__field">
                <BaseInput v-model="requestEmail" label="Email (optional)" type="email"
                  placeholder="your@email.com" autocomplete="email" :disabled="requestLoading" />
                <span class="ranking-login__field-hint">
                  Optional - only used if an admin needs to reach you about your request.
                </span>
              </div>
              <BaseInput v-model="requestPassword" label="Password" type="password" placeholder="Password"
                autocomplete="new-password" :disabled="requestLoading" />
              <BaseInput v-model="requestConfirmPassword" label="Confirm Password" type="password"
                placeholder="Confirm password" autocomplete="new-password" :disabled="requestLoading" />
            </div>

            <div v-if="requestError" class="ranking-login__error" role="alert">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {{ requestError }}
            </div>

            <BaseButton type="submit" variant="primary" size="lg" :loading="requestLoading"
              :disabled="!requestUsername || !requestPassword || !requestConfirmPassword"
              style="width: 100%; margin-top: var(--space-md)">
              Submit Request
            </BaseButton>
          </form>

          <p v-if="staffStatus === 'REQUESTED'" class="ranking-login__note">
            A request is already on file for your account - check back once it has been approved.
          </p>

          <button type="button" class="ranking-login__link" @click="mode = 'providers'">
            Back to Sign In
          </button>
        </template>

        <template v-else>
          <div class="ranking-login__success">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p class="ranking-login__success-text">
              Your request has been submitted. An administrator will review it shortly.
            </p>
            <button type="button" class="ranking-login__link"
              @click="mode = 'providers'; requestSuccess = false">
              Back to Sign In
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ranking-login {
  min-height: 100vh;
  margin-top: calc(-1 * var(--navbar-height, 64px));
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-base);
  padding: var(--space-lg);
}

.ranking-login__card {
  width: 100%;
  max-width: 420px;
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-modal);
  padding: var(--space-xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.ranking-login__header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-sm);
}

.ranking-login__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}

.ranking-login__logo-img {
  width: 48px;
  height: 48px;
  object-fit: contain;
}

.ranking-login__title {
  font-size: var(--text-section);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
}

.ranking-login__subtitle {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  margin: 2px 0 0;
}

.ranking-login__intro {
  color: var(--text-secondary);
  font-size: var(--text-body);
  line-height: 1.55;
  margin: 0;
}

.provider {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  height: 44px;
  padding: 0 var(--space-lg);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: 500;
  cursor: pointer;
  transition: border-color 120ms ease, background 120ms ease, color 120ms ease;
}

.provider__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--provider-accent, var(--text-primary));
}

.provider__brand-img {
  border-radius: 3px;
  display: block;
}

.provider--primary {
  background: var(--provider-accent);
  border-color: var(--provider-accent);
  color: #ffffff;
  height: 48px;
  font-weight: 600;
}

.provider--primary .provider__icon {
  color: #ffffff;
}

.provider--primary:hover {
  background: color-mix(in srgb, var(--provider-accent) 88%, #000 12%);
  border-color: color-mix(in srgb, var(--provider-accent) 88%, #000 12%);
}

.provider--discord {
  --provider-accent: #5865f2;
}

.provider[data-provider="beatleader"] {
  --provider-accent: #a855f7;
}

.provider[data-provider="steam"] {
  --provider-accent: #4b6a8c;
}

[data-theme="light"] .provider[data-provider="steam"] {
  --provider-accent: #1b2838;
}

.provider:not(.provider--primary):hover {
  border-color: var(--provider-accent, var(--text-tertiary));
  background: color-mix(in srgb, var(--provider-accent, var(--bg-elevated)) 10%, var(--bg-surface));
}

.provider-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm);
}

.ranking-login__divider {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--text-tertiary);
  font-size: var(--text-caption);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin: var(--space-xs) 0;
}

.ranking-login__divider::before,
.ranking-login__divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--bg-overlay);
}

.ranking-login__secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 var(--space-md);
  background: transparent;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: 500;
  cursor: pointer;
  transition: border-color 120ms ease, background 120ms ease;
}

.ranking-login__secondary:hover {
  border-color: var(--text-tertiary);
  background: var(--bg-elevated);
}

.ranking-login__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.ranking-login__form-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.ranking-login__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.ranking-login__field-hint {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  line-height: 1.4;
}

.ranking-login__error {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: color-mix(in srgb, var(--error) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--error) 25%, transparent);
  border-radius: var(--radius-btn);
  color: var(--error);
  font-size: var(--text-caption);
}

.ranking-login__link {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: var(--text-caption);
  cursor: pointer;
  padding: 0;
  text-align: center;
  transition: color 120ms ease;
}

.ranking-login__link:hover {
  color: var(--accent);
}

.ranking-login__request-info {
  font-size: var(--text-body);
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.55;
}

.ranking-login__notice {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  color: var(--text-secondary);
  font-size: var(--text-caption);
  line-height: 1.55;
}

.ranking-login__notice-actions {
  display: flex;
  gap: var(--space-sm);
}

.ranking-login__note {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  margin: 0;
  text-align: center;
}

.ranking-login__success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  text-align: center;
  padding: var(--space-lg) 0;
}

.ranking-login__success-text {
  font-size: var(--text-body);
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}
</style>
