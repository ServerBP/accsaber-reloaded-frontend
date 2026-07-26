<script setup lang="ts">
import CampaignCategoryTags from '@/components/domain/CampaignCategoryTags.vue'
import CampaignStatusBadge from '@/components/domain/CampaignStatusBadge.vue'
import CampaignVoteControl from '@/components/domain/CampaignVoteControl.vue'
import { useCategoryStore } from '@/stores/categories'
import type { CampaignProgressSummary, CampaignResponse } from '@/types/api/campaigns'
import { campaignBadges } from '@/utils/campaignBadges'
import {
  campaignDifficultyColor,
  campaignDifficultyGradient,
  campaignDifficultyLabel,
} from '@/utils/campaignDifficulty'
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

const props = defineProps<{
  campaign: CampaignResponse
  progress?: CampaignProgressSummary | null
  editorLink?: boolean
  collab?: boolean
}>()

const cardTo = computed<RouteLocationRaw>(() =>
  props.editorLink
    ? { name: 'campaign-editor', params: { campaignId: props.campaign.slug || props.campaign.id } }
    : { name: 'campaign-detail', params: { campaignId: props.campaign.slug || props.campaign.id } },
)

const categoryStore = useCategoryStore()

const difficultyLabel = computed<string | null>(() => campaignDifficultyLabel(props.campaign.tags))

const themeTags = computed(() =>
  props.campaign.tags.filter((t) => t.kind === 'THEME' || t.kind === 'GENRE').slice(0, 2),
)

const accent = computed(() => {
  const cats = props.campaign.tags.filter((t) => t.kind === 'CATEGORY')
  if (cats.length !== 1 || !cats[0].categoryId) return 'var(--accent-overall)'
  const code = categoryStore.getCategoryCode(cats[0].categoryId)
  if (code) return categoryStore.getCategoryInfo(code)?.accent ?? 'var(--accent-overall)'
  return 'var(--accent-overall)'
})

const difficultyColor = computed(() =>
  campaignDifficultyColor(props.campaign.tags, accent.value),
)

const difficultyGradient = computed(() => campaignDifficultyGradient(props.campaign.tags))

const totalNodes = computed(() => props.campaign.difficultyCount || 0)

const progressPct = computed(() => {
  if (!props.progress) return 0
  if (totalNodes.value === 0) return 0
  return Math.round((props.progress.completedDifficulties / totalNodes.value) * 100)
})

const statusLabel = computed(() => {
  if (props.progress?.progressStatus === 'COMPLETED') return 'Completed'
  if (props.progress?.progressStatus === 'IN_PROGRESS') return 'In progress'
  if (props.campaign.status === 'DRAFT') return 'Draft'
  if (props.campaign.status === 'EDITING') return 'Editing'
  if (props.campaign.status === 'CURATED') return 'Curated'
  if (props.campaign.status === 'PUBLISHED') return 'Published'
  return ''
})

const statusTone = computed(() => {
  if (props.progress?.progressStatus === 'COMPLETED') return 'success'
  if (props.progress?.progressStatus === 'IN_PROGRESS') return 'accent'
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

const hasProgressLabel = computed(
  () =>
    props.progress?.progressStatus === 'COMPLETED' ||
    props.progress?.progressStatus === 'IN_PROGRESS',
)

const showStatusBadge = computed(
  () => !hasProgressLabel.value && campaignBadges(props.campaign).length > 0,
)

const hasCover = computed(() => !!coverUrl.value)

const REWARD_PREVIEW_COUNT = 2

const rewardParts = computed<string[]>(() => {
  const parts: string[] = []
  if (props.campaign.totalXp) parts.push(`${props.campaign.totalXp.toLocaleString()} XP`)
  const rewards = props.campaign.rewards ?? []
  for (const r of rewards.slice(0, REWARD_PREVIEW_COUNT)) {
    parts.push(r.quantity > 1 ? `${r.itemName} ×${r.quantity}` : r.itemName)
  }
  if (rewards.length > REWARD_PREVIEW_COUNT) {
    parts.push(`+${rewards.length - REWARD_PREVIEW_COUNT} more`)
  }
  return parts
})
</script>

<template>
  <router-link
    class="campaign-card"
    :to="cardTo"
    :style="{ '--card-accent': accent, '--card-diff': difficultyColor, '--card-diff-gradient': difficultyGradient ?? 'none' }"
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
      <span v-if="difficultyLabel" class="campaign-card__diff-pill"
        :class="{ 'campaign-card__diff-pill--fade': difficultyGradient }">
        <span class="campaign-card__diff-pill-text">{{ difficultyLabel }}</span>
      </span>
    </div>

    <div class="campaign-card__body">
      <header class="campaign-card__head">
        <h3 class="campaign-card__name">{{ campaign.name }}</h3>
        <p class="campaign-card__creator">
          by {{ creator }}
          <span v-if="collab" class="campaign-card__collab">· collaborating</span>
        </p>
      </header>

      <p v-if="campaign.summary" class="campaign-card__summary">{{ campaign.summary }}</p>

      <div class="campaign-card__meta">
        <CampaignCategoryTags :tags="campaign.tags" collapse />
        <span class="campaign-card__chip campaign-card__chip--mode">{{ completionLabel }}</span>
        <span v-if="campaign.legacy" class="campaign-card__chip campaign-card__chip--legacy">
          Retroactive
        </span>
        <span v-for="t in themeTags" :key="t.id" class="campaign-card__chip">{{ t.name }}</span>
      </div>

      <footer class="campaign-card__foot">
        <p v-if="rewardParts.length > 0" class="campaign-card__loot">
          <template v-for="(part, i) in rewardParts" :key="i">
            <span v-if="i > 0" class="campaign-card__loot-sep" aria-hidden="true">·</span>
            <span>{{ part }}</span>
          </template>
        </p>
        <div class="campaign-card__foot-row">
          <CampaignStatusBadge v-if="showStatusBadge" :campaign="campaign" size="sm" />
          <span v-else class="campaign-card__status" :data-tone="statusTone">{{ statusLabel }}</span>
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
        </div>
        <CampaignVoteControl :campaign="campaign" size="sm" />
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
  aspect-ratio: 1 / 1;
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

.campaign-card__diff-pill-text {
  color: inherit;
}

.campaign-card__diff-pill--fade .campaign-card__diff-pill-text {
  background-image: var(--card-diff-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
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

.campaign-card__collab {
  color: var(--card-accent);
  font-weight: 600;
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
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-sm);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--bg-overlay);
}

.campaign-card__loot {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.campaign-card__loot-sep {
  margin: 0 5px;
  color: var(--text-tertiary);
}

.campaign-card__foot-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  min-width: 0;
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
