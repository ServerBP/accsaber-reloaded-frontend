<script setup lang="ts">
import { getApiErrorMessage } from '@/api/client'
import { getSupporterCredits } from '@/api/supporters'
import BaseButton from '@/components/common/BaseButton.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import CountryFlag from '@/components/domain/CountryFlag.vue'
import { usePageMeta } from '@/composables/usePageMeta'
import type { SupporterCreditEntry, SupporterTier } from '@/types/api/supporters'
import { SUPPORTER_TIER_DISPLAY, SUPPORTER_TIER_PALETTE } from '@/types/api/supporters'
import { computed, onMounted, ref } from 'vue'

usePageMeta({
  title: 'Credits | AccSaber',
  description: 'The supporters who keep AccSaber online.',
})

const KOFI_URL = 'https://ko-fi.com/accsaberreloaded'

const loading = ref(true)
const error = ref<string | null>(null)
const supporters = ref<SupporterCreditEntry[]>([])

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await getSupporterCredits({ status: 'all', size: 100 })
    supporters.value = res.content
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Failed to load credits')
  } finally {
    loading.value = false
  }
}

onMounted(load)

const TIER_ORDER: SupporterTier[] = ['gold', 'silver', 'bronze']

interface TierGroup {
  tier: SupporterTier
  rows: SupporterCreditEntry[]
}

const activeByTier = computed<TierGroup[]>(() => {
  const buckets: Record<SupporterTier, SupporterCreditEntry[]> = {
    gold: [],
    silver: [],
    bronze: [],
  }
  for (const row of supporters.value) {
    if (row.currentTier) buckets[row.currentTier].push(row)
  }
  return TIER_ORDER
    .map((tier) => ({
      tier,
      rows: buckets[tier].sort((a, b) => b.lifetimeSupportedCents - a.lifetimeSupportedCents),
    }))
    .filter((g) => g.rows.length > 0)
})

const pastSupporters = computed(() =>
  [...supporters.value]
    .filter((s) => s.currentTier == null)
    .sort((a, b) => b.lifetimeSupportedCents - a.lifetimeSupportedCents),
)

const activeTotal = computed(() => activeByTier.value.reduce((n, g) => n + g.rows.length, 0))

const showAnything = computed(() => activeTotal.value > 0 || pastSupporters.value.length > 0)

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function handleCreditAvatarError(row: SupporterCreditEntry, event: Event) {
  const img = event.currentTarget as HTMLImageElement
  if (row.cdnAvatarUrl && row.avatarUrl && img.src !== row.avatarUrl) {
    img.src = row.avatarUrl
  }
}

function tierColor(tier: SupporterTier): string {
  return SUPPORTER_TIER_PALETTE[tier].base
}

function tierLabel(tier: SupporterTier): string {
  return SUPPORTER_TIER_DISPLAY[tier]
}
</script>

<template>
  <div class="credits">
    <header class="credits__header">
      <p class="credits__eyebrow">Credits</p>
      <h1 class="credits__title">The supporters of AccSaber</h1>
      <p class="credits__subtitle">
        Server bills, domain, assets, dev time. The names below keep this place running.
      </p>
    </header>

    <div v-if="loading" class="credits__loading" aria-busy="true">
      <SkeletonLoader v-for="i in 5" :key="i" variant="text" />
    </div>

    <div v-else-if="error" class="credits__notice credits__notice--error" role="alert">
      <span>{{ error }}</span>
      <BaseButton size="sm" @click="load">Retry</BaseButton>
    </div>

    <template v-else>
      <div v-for="group in activeByTier" :key="group.tier" class="credits__tier">
        <h2 class="credits__tier-heading" :style="{ color: tierColor(group.tier) }">
          {{ tierLabel(group.tier) }}
          <span class="credits__tier-count">{{ group.rows.length }}</span>
        </h2>
        <ul class="credits__rows">
          <li v-for="row in group.rows" :key="row.userId" class="credits__row">
            <router-link :to="`/players/${row.userId}`" class="credits__row-link">
              <img v-if="row.cdnAvatarUrl || row.avatarUrl" :src="row.cdnAvatarUrl ?? row.avatarUrl"
                :alt="row.name" class="credits__avatar" loading="lazy" decoding="async"
                @error="handleCreditAvatarError(row, $event)" />
              <span v-else class="credits__avatar credits__avatar--blank" aria-hidden="true"></span>
              <span class="credits__name">{{ row.name }}</span>
              <CountryFlag v-if="row.country" :country="row.country" class="credits__flag" />
              <span class="credits__meta">{{ formatCents(row.lifetimeSupportedCents) }}</span>
            </router-link>
          </li>
        </ul>
      </div>

      <details v-if="pastSupporters.length" class="credits__past">
        <summary class="credits__past-summary">
          Tippers &amp; Past Supporters ({{ pastSupporters.length }})
        </summary>
        <ul class="credits__rows credits__rows--past">
          <li v-for="row in pastSupporters" :key="row.userId" class="credits__row">
            <router-link :to="`/players/${row.userId}`" class="credits__row-link">
              <img v-if="row.cdnAvatarUrl || row.avatarUrl" :src="row.cdnAvatarUrl ?? row.avatarUrl"
                :alt="row.name" class="credits__avatar" loading="lazy" decoding="async"
                @error="handleCreditAvatarError(row, $event)" />
              <span v-else class="credits__avatar credits__avatar--blank" aria-hidden="true"></span>
              <span class="credits__name">{{ row.name }}</span>
              <CountryFlag v-if="row.country" :country="row.country" class="credits__flag" />
              <span class="credits__meta">{{ formatCents(row.lifetimeSupportedCents) }}</span>
            </router-link>
          </li>
        </ul>
      </details>

      <p v-if="!showAnything" class="credits__empty">
        Nobody's here yet. Want to be the first?
        <a :href="KOFI_URL" target="_blank" rel="noopener" class="credits__empty-link">Support on Ko-fi.</a>
      </p>
    </template>

    <footer v-if="!loading && !error" class="credits__footer">
      Recurring tips on
      <a :href="KOFI_URL" target="_blank" rel="noopener" class="credits__footer-link">Ko-fi</a>
      keep AccSaber online.
    </footer>
  </div>
</template>

<style scoped>
.credits {
  max-width: 680px;
  margin: 0 auto;
  padding: var(--space-2xl) var(--space-md) var(--space-3xl);
}

.credits__header {
  margin-bottom: var(--space-2xl);
}

.credits__eyebrow {
  margin: 0 0 var(--space-xs);
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.credits__title {
  margin: 0 0 var(--space-sm);
  font-family: var(--font-sans);
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.credits__subtitle {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.55;
  color: var(--text-secondary);
  max-width: 56ch;
}

.credits__loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.credits__notice {
  padding: var(--space-lg);
  font-size: 0.875rem;
  color: var(--text-secondary);
  border-top: 1px solid var(--bg-overlay);
  border-bottom: 1px solid var(--bg-overlay);
}

.credits__notice--error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  color: var(--text-primary);
}

.credits__tier {
  margin-bottom: var(--space-2xl);
}

.credits__tier:last-of-type {
  margin-bottom: var(--space-xl);
}

.credits__tier-heading {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
  margin: 0 0 var(--space-md);
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  padding-bottom: var(--space-xs);
  border-bottom: 1px solid currentColor;
}

.credits__tier-count {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.credits__rows {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.credits__row + .credits__row {
  border-top: 1px solid color-mix(in srgb, var(--bg-overlay) 50%, transparent);
}

.credits__row-link {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-xs);
  color: inherit;
  text-decoration: none;
  border-radius: 3px;
  transition: background-color 140ms ease-out;
}

.credits__row-link:hover {
  background: color-mix(in srgb, var(--bg-elevated) 60%, transparent);
}

.credits__row-link:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent, var(--text-primary)) 60%, transparent);
  outline-offset: -2px;
}

.credits__avatar {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  object-fit: cover;
  background: var(--bg-elevated);
}

.credits__avatar--blank {
  background: var(--bg-elevated);
}

.credits__name {
  font-family: var(--font-sans);
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.credits__flag {
  flex-shrink: 0;
}

.credits__meta {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-tertiary);
}

.credits__past {
  margin-top: var(--space-lg);
  padding-top: var(--space-md);
  border-top: 1px solid var(--bg-overlay);
}

.credits__past-summary {
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  cursor: pointer;
  list-style: none;
  padding: var(--space-xs) 0;
  user-select: none;
}

.credits__past-summary::-webkit-details-marker {
  display: none;
}

.credits__past-summary::before {
  content: '+ ';
  font-family: var(--font-mono);
  margin-right: 4px;
}

.credits__past[open] .credits__past-summary::before {
  content: '− ';
}

.credits__rows--past {
  margin-top: var(--space-sm);
}

.credits__empty {
  padding: var(--space-2xl) 0;
  text-align: center;
  font-size: 0.9375rem;
  color: var(--text-secondary);
}

.credits__empty-link {
  color: var(--text-primary);
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
}

.credits__footer {
  margin-top: var(--space-3xl);
  padding-top: var(--space-md);
  border-top: 1px solid var(--bg-overlay);
  font-size: 0.8125rem;
  color: var(--text-tertiary);
}

.credits__footer-link {
  color: var(--text-secondary);
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-thickness: 1px;
}

.credits__footer-link:hover {
  color: var(--text-primary);
}
</style>
