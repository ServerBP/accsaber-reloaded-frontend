<script setup lang="ts">
import { useSharedNow } from '@/composables/useSharedNow'
import { formatCountdown } from '@/utils/market'
import { computed, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  endsAt: string
  size?: 'sm' | 'lg'
}>()

const now = useSharedNow()

const endsAtMs = computed(() => new Date(props.endsAt).getTime())
const remaining = computed(() => endsAtMs.value - now.value)
const text = computed(() => (remaining.value <= 0 ? 'Ending…' : formatCountdown(remaining.value)))
const urgency = computed(() => {
  if (remaining.value <= 0) return 'ending'
  if (remaining.value < 60_000) return 'critical'
  if (remaining.value < 300_000) return 'warning'
  return 'normal'
})

const extended = ref(false)
let extendedTimer: ReturnType<typeof setTimeout> | null = null

watch(endsAtMs, (next, prev) => {
  if (next > prev) {
    extended.value = true
    if (extendedTimer) clearTimeout(extendedTimer)
    extendedTimer = setTimeout(() => {
      extended.value = false
    }, 3000)
  }
})

onUnmounted(() => {
  if (extendedTimer) clearTimeout(extendedTimer)
})
</script>

<template>
  <span
    class="listing-countdown"
    :class="[`listing-countdown--${urgency}`, { 'listing-countdown--lg': size === 'lg' }]"
  >
    <svg
      class="listing-countdown__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
    <span class="listing-countdown__value">{{ text }}</span>
    <Transition name="countdown-ext">
      <span v-if="extended" class="listing-countdown__extended">Extended</span>
    </Transition>
  </span>
</template>

<style scoped>
.listing-countdown {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  white-space: nowrap;
}

.listing-countdown__icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.listing-countdown__value {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.listing-countdown--warning {
  color: var(--warning);
}

.listing-countdown--critical,
.listing-countdown--ending {
  color: var(--error);
}

.listing-countdown--critical .listing-countdown__value {
  font-weight: 700;
}

.listing-countdown--lg {
  font-size: var(--text-body);
}

.listing-countdown--lg .listing-countdown__icon {
  width: 16px;
  height: 16px;
}

.listing-countdown--lg .listing-countdown__value {
  font-size: 1.125rem;
  font-weight: 600;
}

.listing-countdown__extended {
  padding: 1px 6px;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning) 40%, transparent);
  border-radius: var(--radius-pill);
}

.countdown-ext-enter-active,
.countdown-ext-leave-active {
  transition: opacity 150ms ease-out;
}

.countdown-ext-enter-from,
.countdown-ext-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .countdown-ext-enter-active,
  .countdown-ext-leave-active {
    transition: none;
  }
}
</style>
