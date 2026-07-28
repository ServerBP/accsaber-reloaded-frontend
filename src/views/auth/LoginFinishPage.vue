<script setup lang="ts">
import { buildOAuthStartUrl, getDefaultCallbackUrl } from '@/api/auth'
import { usePageMeta } from '@/composables/usePageMeta'
import type { OAuthProvider } from '@/types/api/player-auth'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

usePageMeta({
  title: 'Link Your Account | AccSaber',
  description: 'Finish linking your account to AccSaber.',
})
const pendingLinkToken = ref<string | null>(null)

onMounted(() => {
  pendingLinkToken.value = sessionStorage.getItem('pendingLinkToken')
  if (!pendingLinkToken.value) {
    router.replace('/')
  }
})

function finishWith(provider: Exclude<OAuthProvider, 'discord'>) {
  const token = pendingLinkToken.value
  if (!token) return
  window.location.href = buildOAuthStartUrl(provider, getDefaultCallbackUrl(), token)
}

function cancel() {
  sessionStorage.removeItem('pendingLinkToken')
  router.replace('/')
}
</script>

<template>
  <div class="login-finish">
    <div class="login-finish__card">
      <header class="login-finish__header">
        <span class="login-finish__eyebrow">Step 2 of 2</span>
        <h1 class="login-finish__title">Link your AccSaber profile</h1>
        <p class="login-finish__message">
          Discord is connected. Now link the account you use for Beat Saber scores so we can find
          your AccSaber profile.
        </p>
      </header>

      <div class="login-finish__providers">
        <button class="provider" data-provider="beatleader" @click="finishWith('beatleader')">
          <span class="provider__icon" aria-hidden="true">
            <img src="https://beatleader.com/assets/favicon-32x32.png" alt="" width="22" height="22"
              class="provider__brand-img" decoding="async" />
          </span>
          <span class="provider__body">
            <span class="provider__label">Continue with BeatLeader</span>
            <span class="provider__hint">If your scores are on BeatLeader</span>
          </span>
          <span class="provider__chev" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        </button>

        <button class="provider" data-provider="steam" @click="finishWith('steam')">
          <span class="provider__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path
                d="M12 0C5.76 0 .63 4.77.04 10.86l6.44 2.66a3.4 3.4 0 0 1 1.92-.59c.06 0 .12 0 .18.01l2.87-4.15v-.06a4.54 4.54 0 1 1 4.54 4.54h-.1l-4.08 2.92c0 .05.01.1.01.15a3.41 3.41 0 1 1-6.75-.76L.2 13.64C1.63 18.58 6.38 22 12 22c6.63 0 12-5.37 12-12S18.63 0 12 0zM7.54 18.15l-1.47-.61a2.55 2.55 0 0 0 3.35 1.34 2.55 2.55 0 0 0 1.38-3.33 2.55 2.55 0 0 0-3.32-1.39 2.56 2.56 0 0 0-1 .67l1.52.63a1.88 1.88 0 1 1-1.47 3.46l1.01-.77zm9.85-6.39a3.03 3.03 0 1 0-6.06 0 3.03 3.03 0 0 0 6.06 0zm-5.3 0a2.27 2.27 0 1 1 4.54 0 2.27 2.27 0 0 1-4.54 0z" />
            </svg>
          </span>
          <span class="provider__body">
            <span class="provider__label">Continue with Steam</span>
            <span class="provider__hint">If your scores are on ScoreSaber</span>
          </span>
          <span class="provider__chev" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        </button>
      </div>

      <button class="login-finish__cancel" @click="cancel">Cancel</button>
    </div>
  </div>
</template>

<style scoped>
.login-finish {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: var(--space-xl) var(--space-md);
  min-height: calc(100vh - var(--navbar-height) - var(--space-2xl));
}

.login-finish__card {
  width: 100%;
  max-width: 480px;
  padding: var(--space-xl);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.login-finish__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.login-finish__eyebrow {
  color: var(--text-secondary);
  font-size: var(--text-caption);
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.login-finish__title {
  font-size: var(--text-section-heading);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
}

.login-finish__message {
  color: var(--text-secondary);
  font-size: var(--text-body);
  line-height: 1.55;
  margin: 0;
}

.login-finish__providers {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.provider {
  display: grid;
  grid-template-columns: 36px 1fr auto;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  color: var(--text-primary);
  font-family: var(--font-sans);
  cursor: pointer;
  text-align: left;
  transition: border-color 120ms ease, background 120ms ease, transform 150ms ease;
}

.provider:hover {
  border-color: var(--provider-accent, var(--text-tertiary));
  background: color-mix(in srgb, var(--provider-accent, var(--bg-overlay)) 8%, var(--bg-elevated));
  transform: scale(1.005);
}

.provider:hover .provider__chev {
  color: var(--provider-accent, var(--text-primary));
  transform: translateX(2px);
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

.provider__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-btn);
  background: color-mix(in srgb, var(--provider-accent, var(--bg-overlay)) 18%, transparent);
  color: var(--provider-accent, var(--text-primary));
  flex-shrink: 0;
}

.provider__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.provider__label {
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--text-primary);
}

.provider__hint {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.provider__chev {
  color: var(--text-tertiary);
  transition: color 120ms ease, transform 120ms ease;
}

.login-finish__cancel {
  align-self: center;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  cursor: pointer;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-btn);
}

.login-finish__cancel:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

@media (prefers-reduced-motion: reduce) {
  .provider,
  .provider__chev {
    transition: none;
  }

  .provider:hover {
    transform: none;
  }

  .provider:hover .provider__chev {
    transform: none;
  }
}

.provider__brand-img {
  border-radius: 4px;
  display: block;
}

@media (max-width: 480px) {
  .login-finish__card {
    padding: var(--space-lg);
  }
}
</style>
