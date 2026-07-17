<script setup lang="ts">
import type { CampaignResponse } from '@/types/api/campaigns'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    campaign: CampaignResponse
    size?: 'sm' | 'md'
  }>(),
  { size: 'sm' },
)

const variant = computed<'official' | 'curated' | null>(() => {
  if (props.campaign.official) return 'official'
  if (props.campaign.status === 'CURATED') return 'curated'
  return null
})

const title = computed(() =>
  variant.value === 'official' ? 'Official AccSaber campaign' : 'Curated campaign',
)
</script>

<template>
  <span
    v-if="variant"
    class="campaign-badge"
    :class="[`campaign-badge--${variant}`, `campaign-badge--${size}`]"
    :title="title"
    :aria-label="title"
  >
    <svg
      v-if="variant === 'official'"
      class="campaign-badge__glyph"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z" />
    </svg>
    {{ variant === 'official' ? 'Official' : 'Curated' }}
  </span>
</template>

<style scoped>
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

.campaign-badge__glyph {
  width: 9px;
  height: 9px;
  flex-shrink: 0;
}
</style>
