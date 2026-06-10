<script setup lang="ts">
import { getUserLevel, getUserOverallStatistics } from '@/api/users';
import CountryFlag from '@/components/domain/CountryFlag.vue';
import RelationActions from '@/components/domain/RelationActions.vue';
import { onAvatarError } from '@/composables/useAvatarFallback';
import type { LevelResponse, UserCategoryStatisticsResponse } from '@/types/api/users';
import { computed, onMounted, ref } from 'vue';

const props = defineProps<{
  userId: string
  userName: string
  avatarUrl: string
  avatarFallbackUrl?: string | null
  country: string
}>()

const handleAvatarError = (e: Event) => onAvatarError(props.avatarFallbackUrl)(e)

const stats = ref<UserCategoryStatisticsResponse | null>(null)
const level = ref<LevelResponse | null>(null)
const loading = ref(true)

const tierKey = computed(() => {
  if (level.value?.title) return level.value.title.toLowerCase().replace(/\s+/g, '-')
  return null
})

const borderColor = computed(() =>
  tierKey.value ? `var(--tier-${tierKey.value})` : undefined,
)

onMounted(async () => {
  const [statsRes, levelRes] = await Promise.allSettled([
    getUserOverallStatistics(props.userId),
    getUserLevel(props.userId),
  ])
  if (statsRes.status === 'fulfilled') stats.value = statsRes.value
  if (levelRes.status === 'fulfilled') level.value = levelRes.value
  loading.value = false
})
</script>

<template>
  <div class="player-tooltip" :style="borderColor ? { '--level-color': borderColor } : undefined">
    <div class="player-tooltip__content">
      <img :src="avatarUrl" :alt="userName" class="player-tooltip__avatar" loading="lazy" decoding="async"
        @error="handleAvatarError" />
      <div class="player-tooltip__info">
        <span class="player-tooltip__name">{{ userName }}</span>
        <span class="player-tooltip__country">
          <CountryFlag :country="country" />
        </span>
      </div>

      <div v-if="loading" class="player-tooltip__stats">
        <div class="player-tooltip__stat player-tooltip__stat--loading" />
        <div class="player-tooltip__stat player-tooltip__stat--loading" />
        <div class="player-tooltip__stat player-tooltip__stat--loading" />
      </div>
      <div v-else-if="stats" class="player-tooltip__stats">
        <div class="player-tooltip__stat">
          <span class="player-tooltip__stat-label">Total AP</span>
          <span class="player-tooltip__stat-value">{{ stats.ap.toFixed(2) }}</span>
        </div>
        <div class="player-tooltip__stat">
          <span class="player-tooltip__stat-label">Global</span>
          <span class="player-tooltip__stat-value">#{{ stats.ranking }}</span>
        </div>
        <div class="player-tooltip__stat">
          <span class="player-tooltip__stat-label">Country</span>
          <span class="player-tooltip__stat-value">#{{ stats.countryRanking }}</span>
        </div>
      </div>

      <RelationActions
        :target-user-id="userId"
        :target-name="userName"
        show-snipe
        dense
        class="player-tooltip__actions"
        @click.stop
      />
    </div>
  </div>
</template>

<style scoped>
.player-tooltip {
  width: 240px;
  border-radius: var(--radius-card);
  border: 1px solid var(--level-color, var(--bg-overlay));
  background: var(--bg-surface);
}

.player-tooltip__content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
}

.player-tooltip__avatar {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-avatar);
  object-fit: cover;
  border: 2px solid var(--level-color, var(--bg-overlay));
}

.player-tooltip__info {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.player-tooltip__name {
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.player-tooltip__country {
  flex-shrink: 0;
}

.player-tooltip__stats {
  display: flex;
  gap: var(--space-xs);
  width: 100%;
}

.player-tooltip__stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-xs);
  background: var(--bg-elevated);
  border-radius: var(--radius-btn);
}

.player-tooltip__stat--loading {
  height: 36px;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    opacity: 0.5;
  }

  50% {
    opacity: 0.8;
  }

  100% {
    opacity: 0.5;
  }
}

.player-tooltip__stat-label {
  font-size: 0.625rem;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.player-tooltip__stat-value {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  font-weight: 500;
  color: var(--text-primary);
}

.player-tooltip__actions {
  justify-content: center;
  width: 100%;
  margin-top: 2px;
}
</style>
