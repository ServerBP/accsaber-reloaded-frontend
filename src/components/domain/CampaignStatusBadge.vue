<script setup lang="ts">
import type { CampaignResponse } from '@/types/api/campaigns'
import { campaignBadges, type CampaignBadge, type CampaignBadgeKind } from '@/utils/campaignBadges'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    campaign: CampaignResponse
    size?: 'sm' | 'md'
  }>(),
  { size: 'sm' },
)

const GLYPHS: Record<CampaignBadgeKind, string> = {
  official: 'M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z',
  curated: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  loved:
    'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
}

const badges = computed(() => campaignBadges(props.campaign))

function badgeTitle(badge: CampaignBadge): string {
  const parts = [badge.title]
  if (badge.by) parts.push(`Picked by ${badge.by.username}.`)
  const stamp = badge.at ? new Date(badge.at) : null
  if (stamp && !Number.isNaN(stamp.getTime())) {
    parts.push(
      `Since ${stamp.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}.`,
    )
  }
  return parts.join(' ')
}
</script>

<template>
  <span v-if="badges.length > 0" class="campaign-badges">
    <span
      v-for="badge in badges"
      :key="badge.kind"
      class="campaign-badge"
      :class="[`campaign-badge--${badge.kind}`, `campaign-badge--${size}`]"
      :title="badgeTitle(badge)"
      :aria-label="badge.title"
    >
      <svg class="campaign-badge__glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path :d="GLYPHS[badge.kind]" />
      </svg>
      {{ badge.label }}
    </span>
  </span>
</template>

<style scoped>
.campaign-badges {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.campaign-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  font-family: var(--font-sans);
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  white-space: nowrap;
  border: 1px solid;
  border-radius: 2px;
}

.campaign-badge--sm {
  font-size: 0.5625rem;
}

.campaign-badge--md {
  font-size: 0.625rem;
}

.campaign-badge--curated {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 10%, transparent);
  border-color: color-mix(in srgb, var(--success) 45%, transparent);
}

.campaign-badge--official {
  color: var(--tier-gold);
  background: color-mix(in srgb, var(--tier-gold) 12%, transparent);
  border-color: color-mix(in srgb, var(--tier-gold) 55%, transparent);
}

.campaign-badge--loved {
  color: var(--campaign-loved);
  background: transparent;
  border-color: color-mix(in srgb, var(--campaign-loved) 45%, transparent);
}

.campaign-badge__glyph {
  width: 9px;
  height: 9px;
  flex-shrink: 0;
}
</style>
