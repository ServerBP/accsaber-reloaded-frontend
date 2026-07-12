<script setup lang="ts">
import { EVENT_STATUS_COLOR, type EventStatus } from '@/utils/events'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    status: EventStatus
    size?: 'sm' | 'lg'
  }>(),
  { size: 'sm' },
)

const accent = computed(() => EVENT_STATUS_COLOR[props.status])
</script>

<template>
  <div class="glyph" :class="`glyph--${size}`" :style="{ '--glyph-accent': accent }" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
      stroke-linejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
    </svg>
  </div>
</template>

<style scoped>
.glyph {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: var(--glyph-accent);
  background: color-mix(in srgb, var(--glyph-accent) 15%, var(--bg-surface));
}

.glyph svg {
  width: 22px;
  height: 22px;
}

.glyph--lg svg {
  width: 52px;
  height: 52px;
}
</style>
