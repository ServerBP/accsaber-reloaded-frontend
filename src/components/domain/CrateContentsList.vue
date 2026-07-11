<script setup lang="ts">
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import ItemPreview from '@/components/domain/ItemPreview.vue'
import type { CrateContentResponse } from '@/types/api/items'
import { groupCrateContentsByRarity, rarityClass } from '@/utils/items'
import { formatChancePercent } from '@/utils/modifiers'
import { computed } from 'vue'

const props = defineProps<{
  contents: CrateContentResponse[]
  loading?: boolean
  ownedItemIds?: Set<string>
}>()

function isOwned(itemId: string): boolean {
  return props.ownedItemIds?.has(itemId) ?? false
}

const groups = computed(() => groupCrateContentsByRarity(props.contents))
</script>

<template>
  <section class="crate-contents">
    <div class="crate-contents__head">
      <span class="crate-contents__title">Contents</span>
      <span v-if="!loading && contents.length" class="crate-contents__count">
        {{ contents.length }} {{ contents.length === 1 ? 'item' : 'items' }}
      </span>
    </div>

    <div v-if="loading" class="crate-contents__list">
      <SkeletonLoader v-for="i in 4" :key="i" variant="table-row" />
    </div>

    <p v-else-if="!contents.length" class="crate-contents__mystery">
      Its contents are a mystery for now.
    </p>

    <div v-else class="crate-contents__list">
      <div
        v-for="group in groups"
        :key="group.rarity"
        class="crate-contents__group"
        :class="rarityClass(group.rarity)"
      >
        <div class="crate-contents__group-head">
          <span class="crate-contents__group-rarity">{{ group.rarity }}</span>
          <span class="crate-contents__group-chance">{{ formatChancePercent(group.chance) }}</span>
        </div>
        <ul class="crate-contents__items">
          <li v-for="c in group.items" :key="c.rewardItem.id" class="crate-contents__row">
            <span class="crate-contents__art">
              <ItemPreview :item="c.rewardItem" />
            </span>
            <span class="crate-contents__name">{{ c.rewardItem.name }}</span>
            <span
              v-if="isOwned(c.rewardItem.id)"
              class="crate-contents__owned"
              title="You own this"
              role="img"
              aria-label="You own this"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.crate-contents {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.crate-contents__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-sm);
}

.crate-contents__title {
  font-size: var(--text-caption);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.crate-contents__count {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.crate-contents__mystery {
  margin: 0;
  padding: var(--space-md);
  text-align: center;
  color: var(--text-tertiary);
  font-size: var(--text-caption);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
}

.crate-contents__list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  overflow: hidden;
}

.crate-contents__group {
  --rarity-color: var(--text-tertiary);
}

.crate-contents__group + .crate-contents__group {
  border-top: 1px solid var(--bg-overlay);
}

.crate-contents__group.rarity--uncommon { --rarity-color: var(--success); }
.crate-contents__group.rarity--rare { --rarity-color: var(--info); }
.crate-contents__group.rarity--epic { --rarity-color: var(--tier-apex); }
.crate-contents__group.rarity--legendary { --rarity-color: var(--tier-gold); }
.crate-contents__group.rarity--mythic { --rarity-color: var(--error); }

.crate-contents__group-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  background: var(--bg-elevated);
}

.crate-contents__group-rarity {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--rarity-color);
}

.crate-contents__group-chance {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}

.crate-contents__items {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.crate-contents__row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
}

.crate-contents__row + .crate-contents__row {
  border-top: 1px solid color-mix(in srgb, var(--bg-overlay) 60%, transparent);
}

.crate-contents__art {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  background: var(--bg-base);
  border: 1px solid color-mix(in srgb, var(--rarity-color) 35%, var(--bg-overlay));
  border-radius: var(--radius-input);
  overflow: hidden;
}

.crate-contents__name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: var(--text-caption);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.crate-contents__owned {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--success);
}
</style>
