<script setup lang="ts">
import { useCategoryStore } from '@/stores/categories'
import type {
  CampaignProgressResponse,
  CampaignResponse,
  CampaignTagResponse,
} from '@/types/api/campaigns'
import { computed } from 'vue'

const props = defineProps<{
  campaign: CampaignResponse
  progress?: CampaignProgressResponse | null
}>()

const categoryStore = useCategoryStore()

const categoryTag = computed<CampaignTagResponse | null>(
  () => props.campaign.tags.find((t) => t.kind === 'CATEGORY') ?? null,
)

const DIFFICULTY_TIER_ORDER = [
  'Beginner',
  'Apprentice',
  'Intermediate',
  'Advanced',
  'Expert',
  'Impossible',
  'Progressive',
] as const

const DIFFICULTY_TIER_COLORS: Record<string, string> = {
  Beginner: 'var(--success)',
  Apprentice: 'var(--info)',
  Intermediate: 'var(--warning)',
  Advanced: '#f97316',
  Expert: 'var(--error)',
  Impossible: 'var(--tier-diamond, #b9f2ff)',
  Progressive: 'var(--accent-overall)',
}

const difficultyTags = computed<CampaignTagResponse[]>(() => {
  const tags = props.campaign.tags.filter((t) => t.kind === 'DIFFICULTY')
  return tags.slice().sort((a, b) => {
    const ai = DIFFICULTY_TIER_ORDER.indexOf(a.name as (typeof DIFFICULTY_TIER_ORDER)[number])
    const bi = DIFFICULTY_TIER_ORDER.indexOf(b.name as (typeof DIFFICULTY_TIER_ORDER)[number])
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
})

const difficultyLabel = computed<string | null>(() => {
  const tags = difficultyTags.value
  if (tags.length === 0) return null
  if (tags.length === 1) return tags[0].name
  const first = tags[0].name
  const last = tags[tags.length - 1].name
  return first === last ? first : `${first} - ${last}`
})

const themeTags = computed(() =>
  props.campaign.tags.filter((t) => t.kind === 'THEME' || t.kind === 'GENRE').slice(0, 2),
)

const accent = computed(() => {
  const code = categoryTag.value?.categoryId
    ? categoryStore.getCategoryCode(categoryTag.value.categoryId)
    : null
  if (code) return categoryStore.getCategoryInfo(code)?.accent ?? 'var(--accent-overall)'
  return 'var(--accent-overall)'
})

const difficultyColor = computed(() => {
  const tags = difficultyTags.value
  if (tags.length === 0) return accent.value
  const peak = tags[tags.length - 1].name
  return DIFFICULTY_TIER_COLORS[peak] ?? accent.value
})

const totalNodes = computed(() =>
  props.progress?.totalDifficulties || props.campaign.difficultyCount || 0,
)

const progressPct = computed(() => {
  if (!props.progress) return 0
  if (totalNodes.value === 0) return 0
  return Math.round((props.progress.completedDifficulties / totalNodes.value) * 100)
})

const statusLabel = computed(() => {
  if (props.progress?.status === 'COMPLETED') return 'Completed'
  if (props.progress?.status === 'IN_PROGRESS') return 'In progress'
  if (props.campaign.status === 'DRAFT') return 'Draft'
  if (props.campaign.status === 'EDITING') return 'Editing'
  if (props.campaign.status === 'CURATED') return 'Curated'
  if (props.campaign.status === 'PUBLISHED') return 'Published'
  return ''
})

const statusTone = computed(() => {
  if (props.progress?.status === 'COMPLETED') return 'success'
  if (props.progress?.status === 'IN_PROGRESS') return 'accent'
  if (props.campaign.status === 'DRAFT') return 'muted'
  if (props.campaign.status === 'CURATED') return 'accent'
  return 'muted'
})

const creator = computed(
  () => props.campaign.creatorAlias || props.campaign.creatorName || 'AccSaber',
)

const completionLabel = computed(() =>
  props.campaign.completionMode === 'ALL' ? 'Clear all' : 'Reach end',
)

const coverUrl = computed(
  () => props.campaign.iconUrl || props.campaign.backgroundUrl || null,
)

const hasCover = computed(() => !!coverUrl.value)
</script>

<template>
  <router-link
    class="campaign-card"
    :to="{ name: 'campaign-detail', params: { campaignId: campaign.slug || campaign.id } }"
    :style="{ '--card-accent': accent, '--card-diff': difficultyColor }"
  >
    <div class="campaign-card__cover" aria-hidden="true">
      <img v-if="hasCover && coverUrl" :src="coverUrl" :alt="campaign.name" loading="lazy" />
      <div v-else class="campaign-card__fallback">
        <svg viewBox="-30 -30 60 60" width="64" height="64" aria-hidden="true">
          <polygon points="28,0 14,24.25 -14,24.25 -28,0 -14,-24.25 14,-24.25"
            fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" />
          <polygon points="16,0 8,13.86 -8,13.86 -16,0 -8,-13.86 8,-13.86"
            fill="currentColor" opacity="0.18" />
        </svg>
        <span class="campaign-card__fallback-count">{{ totalNodes }}</span>
      </div>
      <span v-if="difficultyLabel" class="campaign-card__diff-pill">{{ difficultyLabel }}</span>
    </div>

    <div class="campaign-card__body">
      <header class="campaign-card__head">
        <h3 class="campaign-card__name">{{ campaign.name }}</h3>
        <p class="campaign-card__creator">by {{ creator }}</p>
      </header>

      <p v-if="campaign.summary" class="campaign-card__summary">{{ campaign.summary }}</p>

      <div class="campaign-card__meta">
        <span v-if="categoryTag" class="campaign-card__chip campaign-card__chip--category"
          :style="{ color: accent }">
          {{ categoryTag.name }}
        </span>
        <span class="campaign-card__chip campaign-card__chip--mode">{{ completionLabel }}</span>
        <span v-if="campaign.legacy" class="campaign-card__chip campaign-card__chip--legacy">
          Retroactive
        </span>
        <span v-for="t in themeTags" :key="t.id" class="campaign-card__chip">{{ t.name }}</span>
      </div>

      <footer class="campaign-card__foot">
        <span class="campaign-card__status" :data-tone="statusTone">{{ statusLabel }}</span>
        <span v-if="progress" class="campaign-card__progress">
          <span class="campaign-card__progress-track" aria-hidden="true">
            <span class="campaign-card__progress-fill"
              :style="{ transform: `scaleX(${progressPct / 100})` }" />
          </span>
          <span class="campaign-card__progress-text">
            {{ progress.completedDifficulties }}/{{ totalNodes }}
          </span>
        </span>
        <span v-else class="campaign-card__count">
          {{ totalNodes }} nodes
        </span>
      </footer>
    </div>
  </router-link>
</template>

<style scoped>
.campaign-card {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: 4px;
  overflow: hidden;
  transition: border-color 140ms ease, transform 140ms ease;
}

.campaign-card:hover {
  border-color: var(--card-accent);
  transform: translateY(-1px);
}

.campaign-card__cover {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--bg-base);
  overflow: hidden;
}

.campaign-card__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.campaign-card__fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: var(--space-xs);
  color: var(--card-diff);
  background:
    radial-gradient(ellipse 70% 80% at 50% 50%,
      color-mix(in srgb, var(--card-diff) 18%, transparent),
      transparent 75%),
    var(--bg-base);
}

.campaign-card__fallback-count {
  font-family: var(--font-mono);
  font-size: 1.5rem;
  font-weight: 500;
  color: var(--card-diff);
}

.campaign-card__diff-pill {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 4px 8px;
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--card-diff);
  background: color-mix(in srgb, var(--bg-base) 80%, transparent);
  border: 1px solid color-mix(in srgb, var(--card-diff) 40%, transparent);
  border-radius: 3px;
  backdrop-filter: blur(8px);
}

.campaign-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
  flex: 1;
  min-width: 0;
}

.campaign-card__head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.campaign-card__name {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.25;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.campaign-card__creator {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.campaign-card__summary {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.campaign-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.campaign-card__chip {
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.campaign-card__chip--category {
  letter-spacing: 0.16em;
}

.campaign-card__chip--mode,
.campaign-card__chip--legacy {
  padding: 2px 6px;
  border: 1px solid var(--bg-overlay);
  border-radius: 2px;
  color: var(--text-secondary);
}

.campaign-card__foot {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--bg-overlay);
}

.campaign-card__status {
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.campaign-card__status[data-tone="success"] { color: var(--success); }
.campaign-card__status[data-tone="accent"] { color: var(--card-accent); }

.campaign-card__progress {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.campaign-card__progress-track {
  position: relative;
  width: 84px;
  height: 3px;
  background: var(--bg-overlay);
  border-radius: 1px;
  overflow: hidden;
}

.campaign-card__progress-fill {
  position: absolute;
  inset: 0;
  background: var(--card-accent);
  transform-origin: left center;
}

.campaign-card__count {
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
}
</style>
