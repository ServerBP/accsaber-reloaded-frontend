<script setup lang="ts">
import GlowImage from '@/components/common/GlowImage.vue'
import { useCategoryStore } from '@/stores/categories'
import type { PublicMapDifficultyResponse } from '@/types/api/maps'
import { DIFF_COLOR } from '@/utils/constants'
import { formatRelativeDate } from '@/utils/formatters'
import { formatDifficulty } from '@/utils/mappers'
import { computed } from 'vue'

const props = defineProps<{
  entry: PublicMapDifficultyResponse
}>()

defineEmits<{
  click: []
}>()

const categoryStore = useCategoryStore()

const categoryCode = computed(() => categoryStore.getCategoryCode(props.entry.categoryId) ?? 'overall')
const accent = computed(() => categoryStore.getAccent(categoryCode.value))
const categoryName = computed(() =>
  categoryStore.getCategoryInfo(categoryCode.value)?.name ?? categoryCode.value,
)

const upvotes = computed(() => props.entry.rankUpvotes ?? 0)
const downvotes = computed(() => props.entry.rankDownvotes ?? 0)
const rating = computed(() => upvotes.value - downvotes.value)
const ratingClass = computed(() => {
  if (rating.value > 0) return 'queue-row__rating--positive'
  if (rating.value < 0) return 'queue-row__rating--negative'
  return 'queue-row__rating--neutral'
})

const criteriaVerdict = computed<{
  verdict: 'passed' | 'failed' | 'pending' | 'unavailable'
  source: 'staff' | 'auto'
}>(() => {
  const c = props.entry.criteriaStatus
  if (c === 'PASSED') return { verdict: 'passed', source: 'staff' }
  if (c === 'FAILED') return { verdict: 'failed', source: 'staff' }
  const auto = props.entry.autoCriteriaStatus
  if (auto === 'PASSED') return { verdict: 'passed', source: 'auto' }
  if (auto === 'FAILED') return { verdict: 'failed', source: 'auto' }
  if (auto === 'UNAVAILABLE') return { verdict: 'unavailable', source: 'auto' }
  return { verdict: 'pending', source: 'staff' }
})

const criteriaLabel = computed(() => {
  const { verdict, source } = criteriaVerdict.value
  const base =
    verdict === 'passed' ? 'Criteria Pass'
    : verdict === 'failed' ? 'Criteria Fail'
    : verdict === 'unavailable' ? 'Criteria Unavailable'
    : 'Criteria Pending'
  return source === 'auto' ? `Auto ${base}` : base
})

const criteriaClass = computed(() => {
  const { verdict, source } = criteriaVerdict.value
  const classes: string[] = []
  if (verdict === 'passed') classes.push('queue-row__criteria--passed')
  else if (verdict === 'failed') classes.push('queue-row__criteria--failed')
  else if (verdict === 'unavailable') classes.push('queue-row__criteria--unavailable')
  else classes.push('queue-row__criteria--pending')
  if (source === 'auto') classes.push('queue-row__criteria--auto')
  return classes
})

const diffColor = computed(() => DIFF_COLOR[props.entry.difficulty] ?? 'var(--text-secondary)')

const IMPORT_CUTOFF_MS = Date.parse('2026-04-19T18:00:00Z')

const dateLabel = computed(() => {
  const ts = Date.parse(props.entry.createdAt)
  if (Number.isFinite(ts) && ts < IMPORT_CUTOFF_MS) {
    return 'Imported from AccSaber Ranking Queue'
  }
  return formatRelativeDate(props.entry.createdAt)
})
</script>

<template>
  <div
    class="queue-row"
    :style="{ '--row-accent': accent }"
    tabindex="0"
    role="button"
    @click="$emit('click')"
    @keydown.enter="$emit('click')"
  >
    <div class="queue-row__cover">
      <GlowImage v-if="entry.cdnCoverUrl || entry.coverUrl"
        :src="entry.cdnCoverUrl ?? entry.coverUrl" :alt="entry.songName" :size="80"
        :fallback-src="entry.cdnCoverUrl && entry.coverUrl && entry.cdnCoverUrl !== entry.coverUrl ? entry.coverUrl : null" />
    </div>

    <div class="queue-row__info">
      <div class="queue-row__title-row">
        <span class="queue-row__song">{{ entry.songName }}</span>
        <span v-if="entry.songSubName" class="queue-row__subname">{{ entry.songSubName }}</span>
      </div>
      <div class="queue-row__meta">
        <span class="queue-row__artist">{{ entry.songAuthor }}</span>
        <span class="queue-row__sep">/</span>
        <span class="queue-row__mapper">mapped by <strong>{{ entry.mapAuthor }}</strong></span>
      </div>
      <div class="queue-row__pills">
        <span class="queue-row__diff" :style="{ color: diffColor }">{{ formatDifficulty(entry.difficulty) }}</span>
        <span class="queue-row__dot" />
        <span class="queue-row__category">{{ categoryName }}</span>
        <span class="queue-row__dot" />
        <span class="queue-row__criteria" :class="criteriaClass">{{ criteriaLabel }}</span>
      </div>
    </div>

    <div class="queue-row__right">
      <div class="queue-row__rating-block">
        <span class="queue-row__rating" :class="ratingClass">
          {{ rating > 0 ? '+' : '' }}{{ rating }}
        </span>
        <span class="queue-row__rating-label">Rating</span>
      </div>
      <div class="queue-row__votes">
        <span class="queue-row__vote queue-row__vote--up">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="18 15 12 9 6 15" />
          </svg>
          {{ upvotes }}
        </span>
        <span class="queue-row__vote queue-row__vote--down">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
          {{ downvotes }}
        </span>
      </div>
      <span class="queue-row__date">{{ dateLabel }}</span>
    </div>
  </div>
</template>

<style scoped>
.queue-row {
  display: grid;
  grid-template-columns: 80px 1fr auto;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  cursor: pointer;
  min-height: 88px;
  transition: border-color 120ms ease, transform 150ms ease, box-shadow 150ms ease;
}

.queue-row:hover {
  border-color: var(--text-tertiary);
  transform: scale(1.005);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.queue-row:focus-visible {
  outline: none;
  border-color: var(--row-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--row-accent) 30%, transparent);
}

.queue-row__cover {
  flex-shrink: 0;
}

.queue-row__info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.queue-row__title-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
  min-width: 0;
}

.queue-row__song {
  font-size: var(--text-card-title);
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-row__subname {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-row__meta {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  min-width: 0;
}

.queue-row__artist {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-row__mapper strong {
  color: var(--text-primary);
  font-weight: 500;
}

.queue-row__sep {
  color: var(--text-tertiary);
}

.queue-row__pills {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-wrap: wrap;
  font-size: var(--text-caption);
}

.queue-row__diff {
  font-weight: 600;
}

.queue-row__dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--text-tertiary);
}

.queue-row__category {
  color: var(--text-secondary);
  font-weight: 500;
}

.queue-row__criteria {
  font-weight: 500;
}

.queue-row__criteria--passed {
  color: var(--success);
}

.queue-row__criteria--failed {
  color: var(--error);
}

.queue-row__criteria--pending {
  color: var(--text-tertiary);
}

.queue-row__criteria--unavailable {
  color: var(--warning);
}

.queue-row__criteria--auto {
  opacity: 0.8;
  font-style: italic;
}

.queue-row__right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
  min-width: 90px;
}

.queue-row__rating-block {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
}

.queue-row__rating {
  font-family: var(--font-mono);
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1;
}

.queue-row__rating--positive {
  color: var(--success);
}

.queue-row__rating--negative {
  color: var(--error);
}

.queue-row__rating--neutral {
  color: var(--text-tertiary);
}

.queue-row__rating-label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.queue-row__votes {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.queue-row__vote {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  font-weight: 500;
}

.queue-row__vote--up {
  color: var(--success);
}

.queue-row__vote--down {
  color: var(--error);
}

.queue-row__date {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  white-space: nowrap;
}

@media (max-width: 767px) {
  .queue-row {
    grid-template-columns: 56px 1fr;
    grid-template-rows: auto auto;
    gap: var(--space-sm);
    min-height: 0;
    padding: var(--space-sm);
  }

  .queue-row__cover :deep(.glow-image) {
    width: 56px !important;
    height: 56px !important;
  }

  .queue-row__right {
    grid-column: 1 / -1;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    min-width: 0;
    padding-top: var(--space-xs);
    border-top: 1px solid var(--bg-overlay);
  }

  .queue-row__rating-block {
    align-items: center;
  }

  .queue-row__rating {
    font-size: 1.15rem;
  }
}
</style>
