<script setup lang="ts">
import BaseDropdown from '@/components/common/BaseDropdown.vue'
import { getUserNameHistory } from '@/api/users'
import { formatRelativeDate } from '@/utils/formatters'
import type { NameHistoryEntry } from '@/types/api/users'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  userId: string
  currentName: string
}>()

const open = ref(false)
const loading = ref(false)
const loaded = ref(false)
const entries = ref<NameHistoryEntry[]>([])

interface NameTransition {
  fromName: string
  toName: string
  changedAt: string
}

const transitions = computed<NameTransition[]>(() => {
  return entries.value.map((entry, i) => ({
    fromName: entry.name,
    toName: i === 0 ? props.currentName : entries.value[i - 1].name,
    changedAt: entry.changedAt,
  }))
})

async function load() {
  if (loaded.value || loading.value) return
  loading.value = true
  try {
    entries.value = await getUserNameHistory(props.userId)
  } catch {
    entries.value = []
  } finally {
    loading.value = false
    loaded.value = true
  }
}

watch(() => props.userId, () => {
  loaded.value = false
  entries.value = []
})

watch(open, (isOpen) => {
  if (isOpen) load()
})
</script>

<template>
  <BaseDropdown :open="open" position="bottom-left" @update:open="open = $event">
    <template #trigger>
      <button class="name-history__toggle" :class="{ 'name-history__toggle--open': open }"
        :aria-label="open ? 'Hide name history' : 'Show name history'" :aria-expanded="open" type="button">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </template>
    <div class="name-history__panel">
      <header class="name-history__header">Name history</header>
      <div v-if="loading" class="name-history__state">Loading...</div>
      <div v-else-if="transitions.length === 0" class="name-history__state">No prior names.</div>
      <ol v-else class="name-history__list">
        <li v-for="(t, i) in transitions" :key="i" class="name-history__row">
          <span class="name-history__date">{{ formatRelativeDate(t.changedAt) }}</span>
          <span class="name-history__pair">
            <span class="name-history__from">{{ t.fromName }}</span>
            <span class="name-history__arrow" aria-hidden="true">&rarr;</span>
            <span class="name-history__to">{{ t.toName }}</span>
          </span>
        </li>
      </ol>
    </div>
  </BaseDropdown>
</template>

<style scoped>
.name-history__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--bg-overlay);
  background: transparent;
  border-radius: var(--radius-btn);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease, transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.name-history__toggle:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.name-history__toggle--open {
  background: var(--bg-elevated);
  color: var(--text-primary);
  transform: rotate(180deg);
}

.name-history__panel {
  min-width: 280px;
  max-width: 420px;
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

@media (max-width: 380px) {
  .name-history__panel {
    min-width: 0;
    width: 100%;
  }
}

.name-history__header {
  font-size: 0.6875rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  padding: 2px var(--space-xs) var(--space-xs);
  border-bottom: 1px solid var(--bg-overlay);
}

.name-history__state {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  padding: var(--space-sm) var(--space-xs);
}

.name-history__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
}

.name-history__row {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-xs);
  font-size: var(--text-caption);
}

.name-history__row + .name-history__row {
  border-top: 1px dashed color-mix(in srgb, var(--bg-overlay) 60%, transparent);
}

.name-history__date {
  flex-shrink: 0;
  font-family: var(--font-mono);
  color: var(--text-tertiary);
  white-space: nowrap;
}

.name-history__pair {
  display: inline-flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}

.name-history__from {
  color: var(--text-secondary);
  text-decoration: line-through;
  text-decoration-thickness: 1px;
  text-decoration-color: var(--text-tertiary);
}

.name-history__arrow {
  color: var(--text-tertiary);
}

.name-history__to {
  color: var(--text-primary);
  font-weight: 500;
}
</style>
