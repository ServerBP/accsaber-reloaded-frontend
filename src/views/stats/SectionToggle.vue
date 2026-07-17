<script setup lang="ts">
type SectionKey = 'leaderboards' | 'items' | 'platform'

defineProps<{ modelValue: SectionKey }>()
const emit = defineEmits<{ 'update:modelValue': [value: SectionKey] }>()
</script>

<template>
  <div class="section-toggle">
    <button class="section-toggle__btn" :class="{ 'section-toggle__btn--active': modelValue === 'leaderboards' }"
      @click="emit('update:modelValue', 'leaderboards')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
      Extra Leaderboards
    </button>
    <button class="section-toggle__btn" :class="{ 'section-toggle__btn--active': modelValue === 'items' }"
      @click="emit('update:modelValue', 'items')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.29 7 12 12 20.71 7" />
        <line x1="12" y1="22" x2="12" y2="12" />
      </svg>
      Item Stats
    </button>
    <button class="section-toggle__btn" :class="{ 'section-toggle__btn--active': modelValue === 'platform' }"
      @click="emit('update:modelValue', 'platform')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
        <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
        <path d="M22 12A10 10 0 0 0 12 2v10z" />
      </svg>
      Platform Stats
    </button>
  </div>
</template>

<style scoped>
.section-toggle {
  display: flex;
  justify-content: center;
  gap: var(--space-sm);
}

.section-toggle__btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-pill, 20px);
  border: 1px solid var(--bg-overlay);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: var(--text-body);
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms ease;
}

.section-toggle__btn:hover {
  border-color: var(--text-tertiary);
  background: var(--bg-elevated);
}

.section-toggle__btn--active {
  border-color: color-mix(in srgb, var(--page-accent) 50%, transparent);
  background: color-mix(in srgb, var(--page-accent) 8%, var(--bg-surface));
  color: var(--page-accent);
}

.section-toggle__btn--active:hover {
  border-color: var(--page-accent);
  background: color-mix(in srgb, var(--page-accent) 12%, var(--bg-surface));
}

.section-toggle__btn svg {
  flex-shrink: 0;
  opacity: 0.7;
}

.section-toggle__btn--active svg {
  opacity: 1;
}
</style>
