<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue'
import GlowImage from '@/components/common/GlowImage.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import ComplexityBadge from '@/components/domain/ComplexityBadge.vue'
import { usePageMeta } from '@/composables/usePageMeta'
import { useCategoryStore } from '@/stores/categories'
import type { VoteResponse } from '@/types/api/maps'
import { formatRelativeDate, truncate } from '@/utils/formatters'
import { formatDifficulty } from '@/utils/mappers'
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const categoryStore = useCategoryStore()

usePageMeta({
  title: 'Vote Activity | AccSaber Ranking',
  description: 'Recent voting activity across the ranking queue.',
})

const votes = ref<VoteResponse[]>([])
const totalPages = ref(0)
const page = ref(1)
const loading = ref(true)

async function fetchActivity() {
  loading.value = true
  try {
    const { getVoteActivity } = await import('@/api/ranking/voting')
    const res = await getVoteActivity({
      page: page.value - 1,
      size: 20,
      sort: 'updatedAt,desc',
    })
    votes.value = res.content
    totalPages.value = res.totalPages
  } catch {
    votes.value = []
    totalPages.value = 0
  }
  loading.value = false
}

watch(page, fetchActivity, { immediate: true })

function goToMap(difficultyId: string) {
  router.push({ name: 'ranking-map-detail', params: { difficultyId } })
}

function voteColor(vote: string): string {
  if (vote === 'UPVOTE') return 'var(--success)'
  if (vote === 'DOWNVOTE') return 'var(--error)'
  return 'var(--text-tertiary)'
}

function voteLabel(vote: string): string {
  if (vote === 'UPVOTE') return 'Upvote'
  if (vote === 'DOWNVOTE') return 'Downvote'
  return 'Neutral'
}

function criteriaLabel(vote: string): string {
  if (vote === 'UPVOTE') return 'Pass'
  if (vote === 'DOWNVOTE') return 'Fail'
  return 'Neutral'
}
</script>

<template>
  <div class="activity-page">
    <h1 class="activity-page__title">Vote Activity</h1>

    <div v-if="loading" class="activity-page__loading">
      <SkeletonLoader v-for="i in 6" :key="i" variant="card" />
    </div>

    <EmptyState v-else-if="votes.length === 0" message="No recent activity" />

    <div v-else class="activity-page__list">
      <div
        v-for="vote in votes"
        :key="vote.id"
        class="activity-card"
      >
        <div class="activity-card__header">
          <img
            v-if="vote.staffAvatarUrl"
            :src="vote.staffAvatarUrl"
            alt=""
            class="activity-card__avatar"
            loading="lazy"
            decoding="async"
          />
          <div v-else class="activity-card__avatar activity-card__avatar--placeholder">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <span class="activity-card__username">{{ vote.staffUsername ?? 'Unknown' }}</span>
          <span class="activity-card__vote-badge" :style="{ color: voteColor(vote.vote), borderColor: voteColor(vote.vote) }">
            {{ voteLabel(vote.vote) }}
          </span>
          <span class="activity-card__action-badge">{{ vote.type }}</span>
          <span class="activity-card__date">{{ formatRelativeDate(vote.updatedAt) }}</span>
        </div>

        <div
          v-if="vote.songName"
          class="activity-card__map"
          @click="goToMap(vote.mapDifficultyId)"
        >
          <GlowImage v-if="vote.cdnCoverUrl || vote.coverUrl"
            :src="vote.cdnCoverUrl ?? vote.coverUrl ?? ''" alt="" :size="48"
            :fallback-src="vote.cdnCoverUrl && vote.coverUrl && vote.cdnCoverUrl !== vote.coverUrl ? vote.coverUrl : null" />
          <div class="activity-card__map-info">
            <div class="activity-card__map-title-row">
              <span
                v-if="vote.categoryId"
                class="activity-card__cat-dot"
                :style="{ background: categoryStore.getAccent(categoryStore.getCategoryCode(vote.categoryId) ?? 'overall') }"
              />
              <span class="activity-card__map-name">{{ truncate(vote.songName, 30) }}</span>
            </div>
            <span class="activity-card__map-artist">{{ truncate(vote.songAuthor ?? '', 25) }}</span>
            <span class="activity-card__map-meta">
              <span v-if="vote.mapAuthor">{{ vote.mapAuthor }}</span>
              <span v-if="vote.difficulty" class="activity-card__map-diff">{{ formatDifficulty(vote.difficulty) }}</span>
            </span>
          </div>
        </div>

        <div class="activity-card__details">
          <span v-if="vote.complexity != null" class="activity-card__detail">
            <span class="activity-card__detail-label">Current</span>
            <ComplexityBadge :complexity="vote.complexity" />
          </span>

          <span v-if="vote.suggestedComplexity != null" class="activity-card__detail">
            <span class="activity-card__detail-label">Suggested</span>
            <ComplexityBadge :complexity="vote.suggestedComplexity" />
          </span>

          <span v-if="vote.criteriaVote" class="activity-card__detail">
            <span class="activity-card__detail-label">Criteria</span>
            <span class="activity-card__criteria" :style="{ color: voteColor(vote.criteriaVote) }">
              {{ criteriaLabel(vote.criteriaVote) }}
            </span>
          </span>

          <span v-if="vote.criteriaVoteOverride" class="activity-card__override">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Override
          </span>
        </div>

        <p v-if="vote.reason" class="activity-card__reason">{{ vote.reason }}</p>
      </div>
    </div>

    <PaginationControls
      v-if="totalPages > 1"
      :page="page"
      :total-pages="totalPages"
      @update:page="page = $event"
    />
  </div>
</template>

<style scoped>
.activity-page {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-xl) var(--space-xl) var(--space-3xl);
}

.activity-page__title {
  font-size: var(--text-page-title);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 var(--space-lg);
}

.activity-page__loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.activity-page__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.activity-page :deep(.pagination) {
  margin-top: var(--space-lg);
}

.activity-card {
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.activity-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.activity-card__avatar {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}

.activity-card__avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-overlay);
  color: var(--text-tertiary);
}

.activity-card__username {
  font-weight: 600;
  color: var(--text-primary);
  font-size: var(--text-body);
}

.activity-card__vote-badge {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  border: 1px solid;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.activity-card__action-badge {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  background: var(--bg-elevated);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.activity-card__date {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  margin-left: auto;
}

.activity-card__map {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm);
  border-radius: var(--radius-card);
  background: var(--bg-elevated);
  border: 1px solid transparent;
  cursor: pointer;
  transition: border-color 150ms ease, background 120ms ease;
}

.activity-card__map:hover {
  border-color: var(--text-tertiary);
}

.activity-card__map-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.activity-card__map-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.activity-card__cat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.activity-card__map-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: var(--text-body);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activity-card__map-artist {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.activity-card__map-meta {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.activity-card__map-diff {
  font-size: 0.65rem;
  padding: 1px 5px;
  border-radius: var(--radius-pill);
  background: var(--bg-overlay);
  font-weight: 600;
}

.activity-card__details {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.activity-card__details:empty {
  display: none;
}

.activity-card__detail {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.activity-card__detail-label {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.activity-card__criteria {
  font-size: var(--text-caption);
  font-weight: 600;
}

.activity-card__override {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--warning);
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--warning) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning) 30%, transparent);
}

.activity-card__reason {
  font-size: var(--text-body);
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
  padding: var(--space-xs) var(--space-sm);
  background: var(--bg-elevated);
  border-radius: var(--radius-btn);
  border-left: 2px solid var(--bg-overlay);
}

@media (max-width: 767px) {
  .activity-page {
    padding: var(--space-md) var(--space-md) var(--space-2xl);
  }

  .activity-card__date {
    margin-left: 0;
    width: 100%;
  }
}
</style>
