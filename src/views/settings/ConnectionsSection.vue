<script setup lang="ts">
import { buildOAuthStartUrl, getDefaultCallbackUrl } from '@/api/auth'
import ProviderIcon from '@/components/domain/ProviderIcon.vue'
import { useAuthStore } from '@/stores/auth'
import type { AuthMeResponse } from '@/types/api/player-auth'
import type { OAuthProvider } from '@/types/api/player-auth'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps<{
  me: AuthMeResponse
}>()

const authStore = useAuthStore()
const route = useRoute()

const providerLabels: Record<OAuthProvider, string> = {
  discord: 'Discord',
  beatleader: 'BeatLeader',
  steam: 'Steam',
}

const allProviders: OAuthProvider[] = ['discord', 'beatleader', 'steam']

const availableLinkProviders = computed<OAuthProvider[]>(() =>
  allProviders.filter((p) => !props.me.connections.some((c) => c.provider === p)),
)

const connectionError = ref('')

function startLogin(provider: OAuthProvider) {
  connectionError.value = ''
  sessionStorage.setItem('authRedirectTo', route.fullPath)
  window.location.href = buildOAuthStartUrl(provider, getDefaultCallbackUrl())
}

async function disconnect(provider: OAuthProvider) {
  connectionError.value = ''
  try {
    await authStore.removeConnection(provider)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not remove connection'
    connectionError.value = msg.includes('last') ? 'You must keep at least one linked account.' : msg
  }
}
</script>

<template>
  <section class="settings-card">
    <header class="settings-card__header">
      <h2 class="settings-card__title">Linked accounts</h2>
      <p class="settings-card__desc">
        Keep at least one linked account so you can sign back in.
      </p>
    </header>

    <ul class="connections">
      <li v-for="c in me.connections" :key="c.provider" class="connection" :data-provider="c.provider">
        <span class="connection__icon" :data-provider="c.provider">
          <ProviderIcon :provider="c.provider" :size="20" />
        </span>
        <div class="connection__info">
          <span class="connection__provider">{{ providerLabels[c.provider] }}</span>
          <span v-if="c.providerUsername" class="connection__username">
            {{ c.providerUsername }}
          </span>
        </div>
        <button class="connection__remove" :disabled="me.connections.length <= 1" @click="disconnect(c.provider)">
          Remove
        </button>
      </li>
    </ul>

    <p v-if="connectionError" class="settings-card__error">{{ connectionError }}</p>
  </section>

  <section v-if="availableLinkProviders.length" class="settings-card">
    <header class="settings-card__header">
      <h2 class="settings-card__title">Link another account</h2>
      <p class="settings-card__desc">Connect additional sign-in methods for easier access.</p>
    </header>

    <div class="provider-grid">
      <button v-for="provider in availableLinkProviders" :key="provider" class="provider" :data-provider="provider"
        :aria-label="`Continue with ${providerLabels[provider]}`" @click="startLogin(provider)">
        <span class="provider__icon" aria-hidden="true">
          <ProviderIcon :provider="provider" />
        </span>
        <span class="provider__label">{{ providerLabels[provider] }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.connections {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.connection {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
}

.connection__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-btn);
  flex-shrink: 0;
}

.connection[data-provider="discord"] .connection__icon {
  background: color-mix(in srgb, #5865f2 18%, transparent);
  color: #5865f2;
}

.connection[data-provider="beatleader"] .connection__icon {
  background: color-mix(in srgb, #a855f7 18%, transparent);
  color: #a855f7;
}

.connection[data-provider="steam"] .connection__icon {
  background: color-mix(in srgb, #1b2838 30%, transparent);
  color: var(--text-primary);
}

[data-theme="light"] .connection[data-provider="steam"] .connection__icon {
  background: color-mix(in srgb, #1b2838 14%, transparent);
  color: #1b2838;
}

.connection__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.connection__provider {
  font-size: var(--text-body);
  font-weight: 500;
  color: var(--text-primary);
}

.connection__username {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.connection__remove {
  background: none;
  border: 1px solid transparent;
  color: var(--error);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 500;
  cursor: pointer;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-btn);
  transition: background 120ms ease, border-color 120ms ease;
}

.connection__remove:hover:not(:disabled) {
  background: color-mix(in srgb, var(--error) 12%, transparent);
  border-color: color-mix(in srgb, var(--error) 30%, transparent);
}

.connection__remove:disabled {
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--space-sm);
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

.provider[data-provider="discord"] {
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

.provider:hover {
  color: var(--provider-accent);
  border-color: var(--provider-accent);
  background: color-mix(in srgb, var(--provider-accent) 10%, var(--bg-surface));
}

.provider__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--provider-accent);
}
</style>
