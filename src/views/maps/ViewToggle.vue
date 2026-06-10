<script setup lang="ts">
type ViewMode = 'grid' | 'list' | 'batch'

defineProps<{ modelValue: ViewMode }>()
const emit = defineEmits<{ 'update:modelValue': [value: ViewMode] }>()
</script>

<template>
  <div class="view-toggle" role="radiogroup" aria-label="View mode">
    <button class="view-toggle__btn" :class="{ 'view-toggle__btn--active': modelValue === 'grid' }"
      aria-label="Grid view" @click="emit('update:modelValue', 'grid')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
      <span class="view-toggle__label">Grid</span>
    </button>
    <button class="view-toggle__btn" :class="{ 'view-toggle__btn--active': modelValue === 'list' }"
      aria-label="List view" @click="emit('update:modelValue', 'list')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
      <span class="view-toggle__label">List</span>
    </button>
    <button class="view-toggle__btn" :class="{ 'view-toggle__btn--active': modelValue === 'batch' }"
      aria-label="Batch view" @click="emit('update:modelValue', 'batch')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
      <span class="view-toggle__label">Batches</span>
    </button>
  </div>
</template>

<style scoped>
.view-toggle {
  display: flex;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  overflow: hidden;
}

.view-toggle__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.view-toggle__label {
  font-size: var(--text-caption);
  font-weight: 500;
}

.view-toggle__btn:hover {
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.view-toggle__btn--active {
  background: var(--bg-elevated);
  color: var(--text-primary);
}
</style>
