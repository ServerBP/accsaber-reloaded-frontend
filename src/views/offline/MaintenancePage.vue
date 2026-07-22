<script setup lang="ts">
import logoUrl from '@/assets/logo.png'
import BaseButton from '@/components/common/BaseButton.vue'
import { usePageMeta } from '@/composables/usePageMeta'
import { useReducedMotion } from '@/composables/useReducedMotion'
import { useBackendStatusStore } from '@/stores/backendStatus'
import { DISCORD_URL } from '@/utils/constants'
import { computed, onUnmounted, ref } from 'vue'
import PracticeRange from './PracticeRange.vue'

const status = useBackendStatusStore()
const reduced = useReducedMotion()

usePageMeta({
  title: 'Under maintenance | AccSaber',
  description: 'AccSaber is briefly down for maintenance.',
})

const now = ref(Date.now())
const ticker = setInterval(() => {
  now.value = Date.now()
}, 500)
onUnmounted(() => clearInterval(ticker))

const isNetwork = computed(() => status.reason === 'network')
const showRange = computed(() => !reduced.value)

const title = computed(() => (isNetwork.value ? "You're offline." : "We're under maintenance."))

const lede = computed(() => {
  const base = isNetwork.value
    ? "Your connection dropped. We'll pick everything back up the moment it returns."
    : "The backend isn't answering, which usually means we're shipping something new. Your scores are safe and will sync once we're back."
  return showRange.value ? `${base} Meanwhile, the practice range is open.` : base
})

const retryInSec = computed(() => {
  if (status.nextProbeAt === null) return null
  return Math.max(0, Math.ceil((status.nextProbeAt - now.value) / 1000))
})

const lastChecked = computed(() =>
  status.lastCheckedAt !== null ? new Date(status.lastCheckedAt).toLocaleTimeString() : null,
)

const statusText = computed(() => {
  if (status.recovering) return 'Back online. Reloading…'
  if (status.checking) return 'Checking…'
  const parts: string[] = []
  if (retryInSec.value !== null) parts.push(`Retrying in ${retryInSec.value}s`)
  if (lastChecked.value !== null) parts.push(`last checked ${lastChecked.value}`)
  return parts.join(' · ') || 'Waiting to retry'
})
</script>

<template>
  <div class="offline">
    <div class="offline__inner">
      <img :src="logoUrl" alt="AccSaber" class="offline__logo" />
      <p class="offline__face" aria-hidden="true">:(</p>
      <h1 class="offline__title">{{ title }}</h1>
      <p class="offline__lede">{{ lede }}</p>

      <PracticeRange v-if="showRange" class="offline__range" />

      <div class="offline__status">
        <p class="offline__status-text" role="status">{{ statusText }}</p>
        <div class="offline__actions">
          <BaseButton
            size="sm"
            variant="primary"
            :loading="status.checking"
            :disabled="status.recovering"
            @click="status.checkNow()"
          >
            Check now
          </BaseButton>
          <BaseButton size="sm" :href="DISCORD_URL">Discord</BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.offline {
  min-height: 100vh;
  display: flex;
  align-items: center;
  padding: var(--space-xl);
}

.offline__inner {
  width: 100%;
  max-width: 880px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-md);
}

.offline__logo {
  height: 40px;
  width: auto;
  margin-bottom: var(--space-lg);
}

.offline__face {
  font-size: 5rem;
  font-weight: 600;
  line-height: 1;
  color: var(--text-primary);
}

.offline__title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
}

.offline__lede {
  font-size: var(--text-body);
  line-height: 1.6;
  color: var(--text-secondary);
  max-width: 62ch;
}

.offline__range {
  align-self: stretch;
  margin-top: var(--space-sm);
}

.offline__status {
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-md);
  margin-top: var(--space-sm);
}

.offline__status-text {
  font-size: var(--text-body);
  color: var(--text-secondary);
}

.offline__actions {
  display: flex;
  gap: var(--space-sm);
}

@media (max-width: 767px) {
  .offline {
    align-items: flex-start;
    padding: var(--space-md);
    padding-top: var(--space-2xl);
  }
}
</style>
