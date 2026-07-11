<script setup lang="ts">
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import ModifierChip from '@/components/domain/ModifierChip.vue'
import UnusualEffectsPopover from '@/components/domain/UnusualEffectsPopover.vue'
import type { CrateModifierResponse } from '@/types/api/items'
import { formatChancePercent } from '@/utils/modifiers'

defineProps<{
  modifiers: CrateModifierResponse[]
  crateId: string
  loading?: boolean
}>()
</script>

<template>
  <section v-if="loading || modifiers.length" class="crate-modifiers">
    <span class="crate-modifiers__title">Modifiers</span>

    <div v-if="loading" class="crate-modifiers__list">
      <SkeletonLoader v-for="i in 2" :key="i" variant="table-row" />
    </div>

    <ul v-else class="crate-modifiers__list crate-modifiers__list--bordered">
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

.crate-modifiers__title {
  font-size: var(--text-caption);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
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
