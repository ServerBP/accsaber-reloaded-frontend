<script setup lang="ts">
import type { UserItemResponse } from '@/types/api/items'
import { pickAssetUrl, readBadgeValue } from '@/utils/items'
import { computed } from 'vue'

const props = defineProps<{
  badges: UserItemResponse[]
  primaryLinkId?: string | null
}>()

interface Rendered {
  linkId: string
  name: string
  imageUrl: string | null
  altText: string
  description: string | null
  tint: string | null
  primary: boolean
}

const rendered = computed<Rendered[]>(() => {
  const mapped = props.badges
    .filter((u) => u.item.typeKey === 'badge')
    .map((u) => {
      const badgeValue = readBadgeValue(u.item.value)
      const assetUrl = badgeValue ? pickAssetUrl(badgeValue.asset) : null
      return {
        linkId: u.linkId,
        name: u.item.name,
        imageUrl: assetUrl ?? u.item.iconUrl ?? null,
        altText: badgeValue?.asset.altText ?? u.item.name,
        description: u.item.description,
        tint: badgeValue?.tint ?? null,
        primary: u.linkId === props.primaryLinkId,
      }
    })

  const primaryIndex = mapped.findIndex((b) => b.primary)
  if (primaryIndex > 0) {
    const [primary] = mapped.splice(primaryIndex, 1)
    mapped.unshift(primary)
  }
  return mapped
})
</script>

<template>
  <div v-if="rendered.length" class="badges-row" aria-label="Owned badges">
    <span
      v-for="b in rendered"
      :key="b.linkId"
      class="badges-row__badge"
      :class="{ 'badges-row__badge--primary': b.primary }"
      tabindex="0"
      :aria-label="`${b.primary ? 'Primary badge, ' : ''}${b.description ? `${b.name}: ${b.description}` : b.name}`"
      :style="b.tint ? { color: b.tint } : undefined"
    >
      <img v-if="b.imageUrl" :src="b.imageUrl" :alt="b.altText" loading="lazy" decoding="async" />
      <span v-else class="badges-row__placeholder">{{ b.name.charAt(0).toUpperCase() }}</span>

      <span class="badges-row__tooltip" role="tooltip">
        <span v-if="b.primary" class="badges-row__tooltip-tag">Primary badge</span>
        <span class="badges-row__tooltip-name">{{ b.name }}</span>
        <span v-if="b.description" class="badges-row__tooltip-desc">{{ b.description }}</span>
      </span>
    </span>
  </div>
</template>

<style scoped>
.badges-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  max-width: 480px;
}

.badges-row__badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-btn);
  background: color-mix(in srgb, var(--bg-base) 60%, transparent);
  border: 1px solid var(--bg-overlay);
  overflow: visible;
  transition: transform 120ms ease;
  cursor: help;
}

.badges-row__badge--primary {
  width: 48px;
  height: 48px;
  border-color: var(--page-accent, var(--accent));
}

.badges-row__badge:hover,
.badges-row__badge:focus-visible {
  transform: scale(1.1);
  outline: none;
  border-color: var(--text-tertiary);
}

.badges-row__badge--primary:hover,
.badges-row__badge--primary:focus-visible {
  border-color: var(--page-accent, var(--accent));
}

.badges-row__badge img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: inherit;
}

.badges-row__placeholder {
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.badges-row__tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 140px;
  max-width: 240px;
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  text-align: center;
  pointer-events: none;
  opacity: 0;
  transition: opacity 120ms ease;
  z-index: 20;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  white-space: normal;
}

.badges-row__tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: var(--bg-overlay);
}

.badges-row__badge:hover .badges-row__tooltip,
.badges-row__badge:focus-visible .badges-row__tooltip {
  opacity: 1;
}

.badges-row__tooltip-tag {
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--page-accent, var(--accent));
}

.badges-row__tooltip-name {
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-primary);
}

.badges-row__tooltip-desc {
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  line-height: 1.4;
}
</style>
