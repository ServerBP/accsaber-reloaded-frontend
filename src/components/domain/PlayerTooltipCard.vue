<script setup lang="ts">
import CountryFlag from '@/components/domain/CountryFlag.vue';
import LevelBadge from '@/components/domain/LevelBadge.vue';
import RelationActions from '@/components/domain/RelationActions.vue';
import ThumbnailSceneRenderer from '@/components/domain/ThumbnailSceneRenderer.vue';
import { useEquippedRenderProps } from '@/composables/useEquippedRenderProps';
import { useMiniProfile } from '@/composables/useMiniProfile';
import { fillToCss, pickAssetUrl } from '@/utils/items';
import { computed } from 'vue';

const props = defineProps<{
  userId: string
  userName: string
  avatarUrl: string
  avatarFallbackUrl?: string | null
  country: string
}>()

const { profile, loading } = useMiniProfile(() => props.userId)

const stats = computed(() => profile.value?.stats ?? null)
const level = computed(() => profile.value?.level ?? null)

const {
  titleValue: equippedTitle,
  borderShapeValue: equippedBorderShape,
  borderColorValue: equippedBorderColor,
  titleEffects: equippedTitleEffects,
  borderEffects: equippedBorderEffects,
  thumbnailValue: equippedThumbnail,
} = useEquippedRenderProps(() => profile.value?.equipped)

const thumbScene = computed(() => equippedThumbnail.value?.scene ?? null)
const thumbImageUrl = computed(() => pickAssetUrl(equippedThumbnail.value?.asset))
const hasThumb = computed(() => !!thumbScene.value || !!thumbImageUrl.value)
const thumbLayerStyle = computed<Record<string, string> | undefined>(() => {
  const opacity = equippedThumbnail.value?.opacity
  return opacity != null ? { opacity: String(opacity) } : undefined
})
const thumbInk = computed(() => thumbScene.value?.ink ?? null)
const thumbBase = computed<'light' | 'dark'>(() => thumbScene.value?.base ?? 'dark')

const tierKey = computed(() => {
  if (level.value?.title) return level.value.title.toLowerCase().replace(/\s+/g, '-')
  return null
})

function flatten(value: string): string {
  return `linear-gradient(${value}, ${value})`
}

const cardBorder = computed(() => {
  const fill = equippedBorderColor.value?.states?.[0]?.fill
  if (fill) {
    const css = fillToCss(fill)
    return fill.type === 'solid' ? flatten(css) : css
  }
  if (tierKey.value) return flatten(`var(--tier-${tierKey.value})`)
  return undefined
})
</script>

<template>
  <div
    class="player-tooltip"
    :class="hasThumb ? ['player-tooltip--themed', `player-tooltip--themed-${thumbBase}`] : undefined"
    :style="{
      ...(cardBorder ? { '--tooltip-border': cardBorder } : undefined),
      ...(thumbInk ? { '--thumb-ink': thumbInk } : undefined),
    }"
  >
    <div v-if="hasThumb" class="player-tooltip__thumb-bg" :style="thumbLayerStyle" aria-hidden="true">
      <ThumbnailSceneRenderer v-if="thumbScene" :scene="thumbScene" />
      <img v-else-if="thumbImageUrl" class="player-tooltip__thumb-img" :src="thumbImageUrl" alt="" />
    </div>
    <div class="player-tooltip__content">
      <div v-if="loading" class="player-tooltip__badge-skeleton" aria-hidden="true">
        <div class="player-tooltip__badge-skeleton-stack" />
        <div class="player-tooltip__badge-skeleton-line" />
      </div>
      <div v-else class="player-tooltip__badge">
        <LevelBadge
          :level="level?.level ?? 0"
          :current-xp="level?.xpForCurrentLevel ?? 0"
          :required-xp="level?.xpForNextLevel ?? 1"
          :avatar-url="avatarUrl"
          :avatar-fallback-url="avatarFallbackUrl"
          :fallback-title="level?.title"
          hide-progress
          :equipped-title="equippedTitle"
          :equipped-border-shape="equippedBorderShape"
          :equipped-border-color="equippedBorderColor"
          :title-effects="equippedTitleEffects"
          :border-effects="equippedBorderEffects"
        />
      </div>

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
  position: relative;
  width: 240px;
  border-radius: var(--radius-card);
  border: 1px solid transparent;
  overflow: hidden;
  background:
    linear-gradient(var(--bg-surface), var(--bg-surface)) padding-box,
    var(--tooltip-border, linear-gradient(var(--bg-overlay), var(--bg-overlay))) border-box;
}

.player-tooltip__thumb-bg {
  position: absolute;
  inset: 0;
}

.player-tooltip__thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.player-tooltip--themed-dark {
  --text-primary: #f2f0f7;
  --text-secondary: #b9b4c9;
  --text-tertiary: #8d879e;
}

.player-tooltip--themed-light {
  --text-primary: #241826;
  --text-secondary: #5d4a5c;
  --text-tertiary: #8a7389;
}

.player-tooltip--themed .player-tooltip__stat {
  background: color-mix(in srgb, var(--thumb-ink, #0b0710) 62%, transparent);
}

.player-tooltip__content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
}

.player-tooltip__badge :deep(.level-badge) {
  gap: var(--space-sm);
}

.player-tooltip__badge :deep(.level-badge__stack) {
  width: 96px;
  height: 96px;
}

.player-tooltip__badge :deep(.level-badge__avatar-wrap) {
  width: 85px;
  height: 85px;
}

.player-tooltip__badge :deep(.level-badge__title-line) {
  justify-content: center;
  flex-wrap: wrap;
  white-space: normal;
  max-width: 208px;
}

.player-tooltip__badge :deep(.level-badge__level) {
  font-size: var(--text-caption);
}

.player-tooltip__badge-skeleton {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  animation: shimmer 1.5s infinite;
}

.player-tooltip__badge-skeleton-stack {
  width: 96px;
  height: 96px;
  border-radius: var(--radius-avatar);
  background: var(--bg-elevated);
}

.player-tooltip__badge-skeleton-line {
  width: 104px;
  height: 18px;
  border-radius: var(--radius-btn);
  background: var(--bg-elevated);
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

@media (prefers-reduced-motion: reduce) {

  .player-tooltip__badge-skeleton,
  .player-tooltip__stat--loading {
    animation: none;
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
