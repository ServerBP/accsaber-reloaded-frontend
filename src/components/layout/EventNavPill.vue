<script setup lang="ts">
import type { EventResponse } from '@/types/api/events'

defineProps<{
  event: EventResponse
  verb: string
  countdown: string
  variant?: 'bar' | 'drawer'
}>()

const emit = defineEmits<{
  navigate: []
}>()
</script>

<template>
  <router-link
    class="event-pill"
    :class="`event-pill--${variant ?? 'bar'}`"
    :to="{ path: '/news', query: { event: event.slug } }"
    :aria-label="`${event.title} event ${verb} in ${countdown}`"
    @click="emit('navigate')"
  >
    <span class="event-pill__tag">Event</span>
    <span class="event-pill__sep" aria-hidden="true">·</span>
    <span class="event-pill__title">{{ event.title }}</span>
    <span class="event-pill__sep event-pill__sep--time" aria-hidden="true">·</span>
    <span class="event-pill__time">{{ verb }} {{ countdown }}</span>
  </router-link>
</template>

<style scoped>
.event-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  max-width: 340px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--bg-overlay));
  border-radius: var(--radius-btn);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  color: var(--navbar-text-strong);
  text-decoration: none;
  font-size: var(--text-body);
  line-height: 1;
  white-space: nowrap;
  transition: border-color 120ms ease, background 120ms ease;
}

.event-pill:hover {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--bg-overlay));
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}

.event-pill__tag {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
  flex-shrink: 0;
}

.event-pill__sep {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.event-pill__title {
  font-weight: 600;
  color: var(--navbar-text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.event-pill__time {
  color: var(--navbar-text);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.event-pill--drawer {
  display: flex;
  height: 44px;
  max-width: none;
  padding: 0 var(--space-md);
  font-size: var(--text-body);
  color: var(--text-primary);
}

.event-pill--drawer .event-pill__title {
  color: var(--text-primary);
  flex: 1;
}

.event-pill--drawer .event-pill__time {
  color: var(--text-secondary);
}

@media (max-width: 767px) {
  .event-pill--bar {
    max-width: none;
    height: 34px;
    padding: 0 var(--space-sm);
  }

  .event-pill--bar .event-pill__title,
  .event-pill--bar .event-pill__sep--time {
    display: none;
  }
}
</style>
