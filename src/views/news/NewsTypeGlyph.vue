<script setup lang="ts">
import type { NewsType } from '@/types/enums'
import { NEWS_TYPE_ACCENT } from '@/utils/constants'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    type: NewsType
    size?: 'sm' | 'lg'
  }>(),
  { size: 'sm' },
)

const accent = computed(() => NEWS_TYPE_ACCENT[props.type])
</script>

<template>
  <div class="glyph" :class="`glyph--${size}`" :style="{ '--glyph-accent': accent }" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
      stroke-linejoin="round">
      <template v-if="type === 'BATCH'">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </template>
      <template v-else-if="type === 'CAMPAIGN'">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </template>
      <template v-else-if="type === 'MILESTONE_SET'">
        <circle cx="12" cy="8" r="6" />
        <polyline points="8.21 13.89 7 22 12 19 17 22 15.79 13.88" />
      </template>
      <template v-else-if="type === 'ITEMS'">
        <polyline points="20 12 20 22 4 22 4 12" />
        <rect x="2" y="7" width="20" height="5" />
        <line x1="12" y1="22" x2="12" y2="7" />
        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
      </template>
      <template v-else-if="type === 'PLUGIN'">
        <path
          d="M14 7h3a1 1 0 0 1 1 1v3a2 2 0 1 1 0 4v3a1 1 0 0 1-1 1h-3a2 2 0 1 0-4 0H7a1 1 0 0 1-1-1v-3a2 2 0 1 1 0-4V8a1 1 0 0 1 1-1h3a2 2 0 1 1 4 0z" />
      </template>
      <template v-else-if="type === 'CURVE'">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </template>
      <template v-else>
        <path d="M3 11l18-5v12L3 14v-3z" />
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
      </template>
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
  width: 48px;
  height: 48px;
}
</style>
