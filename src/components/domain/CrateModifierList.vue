<script setup lang="ts">
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import ModifierChip from '@/components/domain/ModifierChip.vue'
import UnusualEffectsPopover from '@/components/domain/UnusualEffectsPopover.vue'
import type { CrateModifierResponse } from '@/types/api/items'
import { formatChancePercent } from '@/utils/modifiers'
import { ref } from 'vue'

defineProps<{
  modifiers: CrateModifierResponse[]
  crateId: string
  loading?: boolean
}>()

const expanded = ref(false)
</script>

<template>
  <section v-if="loading || modifiers.length" class="crate-modifiers">
    <button
      type="button"
      class="crate-modifiers__head"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <span class="crate-modifiers__title">Modifiers</span>
      <span v-if="!loading && modifiers.length" class="crate-modifiers__count">
        {{ modifiers.length }}
      </span>
      <svg
        class="crate-modifiers__chevron"
        :class="{ 'crate-modifiers__chevron--open': expanded }"
        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <div v-if="expanded && loading" class="crate-modifiers__list">
      <SkeletonLoader v-for="i in 2" :key="i" variant="table-row" />
    </div>

    <ul v-else-if="expanded" class="crate-modifiers__list crate-modifiers__list--bordered">
      <li v-for="cm in modifiers" :key="cm.modifier.id" class="crate-modifiers__row">
        <ModifierChip :modifier="cm.modifier" />
        <UnusualEffectsPopover v-if="cm.modifier.key === 'unusual'" :crate-id="crateId" />
        <span class="crate-modifiers__chance">{{ formatChancePercent(cm.dropChance) }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.crate-modifiers {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.crate-modifiers__head {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: inherit;
}

.crate-modifiers__title {
  font-size: var(--text-caption);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.crate-modifiers__count {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.crate-modifiers__chevron {
  margin-left: auto;
  flex-shrink: 0;
  color: var(--text-tertiary);
  transition: transform 150ms ease;
}

.crate-modifiers__chevron--open {
  transform: rotate(180deg);
}

.crate-modifiers__head:hover .crate-modifiers__title,
.crate-modifiers__head:hover .crate-modifiers__chevron {
  color: var(--text-primary);
}

@media (prefers-reduced-motion: reduce) {
  .crate-modifiers__chevron {
    transition: none;
  }
}

.crate-modifiers__list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.crate-modifiers__list--bordered {
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
}

.crate-modifiers__row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
}

.crate-modifiers__row + .crate-modifiers__row {
  border-top: 1px solid var(--bg-overlay);
}

.crate-modifiers__chance {
  margin-left: auto;
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}
</style>
