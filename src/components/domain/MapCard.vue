<script setup lang="ts">
import { useTiltEffect } from '@/composables/useTiltEffect'
import { onImageError } from '@/composables/useAvatarFallback'
import type { MapDisplay } from '@/types/display'
import { computed, ref } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import CategoryBadge from './CategoryBadge.vue'
import ComplexityBadge from './ComplexityBadge.vue'
import DifficultyBadge from './DifficultyBadge.vue'

const props = defineProps<{
  map: MapDisplay
  to: RouteLocationRaw
}>()

const router = useRouter()
const cardRef = ref<HTMLElement | null>(null)
const { style: tiltStyle } = useTiltEffect(cardRef)

const href = computed(() => router.resolve(props.to).href)
const handleCoverError = (e: Event) => onImageError(props.map.coverFallbackUrl)(e)

function handleClick(event: MouseEvent) {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  router.push(props.to)
}
</script>

<template>
  <a ref="cardRef" class="map-card" :href="href" :style="tiltStyle" @click="handleClick">
    <div class="map-card__image-wrap">
      <img class="map-card__cover" :src="map.coverUrl" :alt="map.songName" loading="lazy" decoding="async"
        @error="handleCoverError" />
    </div>
    <div class="map-card__body">
      <CategoryBadge :category="map.categoryCode" size="sm" class="map-card__category" />
      <span class="map-card__song">{{ map.songName }}</span>
      <div class="map-card__primary">
        <DifficultyBadge :difficulty="map.difficulty" />
        <ComplexityBadge :complexity="map.complexity" />
      </div>
      <div class="map-card__secondary">
        <span class="map-card__artist">{{ map.artistName }}</span>
        <span class="map-card__mapper">{{ map.mapperName }}</span>
      </div>
    </div>
  </a>
</template>

<style scoped>
.map-card {
  display: block;
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  overflow: hidden;
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
  will-change: transform;
}

.map-card:hover {
  border-color: var(--text-tertiary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transform: scale(1.01);
}

.map-card__image-wrap {
  aspect-ratio: 1 / 1;
  overflow: hidden;
}

.map-card__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.map-card__body {
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.map-card__category {
  margin-bottom: -3px;
}

.map-card__song {
  font-size: var(--text-card-title);
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.map-card__primary {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.map-card__secondary {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.map-card__artist,
.map-card__mapper {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-card__artist {
  color: var(--text-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .map-card:hover {
    transform: none;
  }
}
</style>
