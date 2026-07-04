<script setup lang="ts">
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import ItemPreview from '@/components/domain/ItemPreview.vue'
import type { CrateContentResponse } from '@/types/api/items'
import { RARITY_ORDER, rarityClass } from '@/utils/items'
import { computed } from 'vue'

const props = defineProps<{
  contents: CrateContentResponse[]
  loading?: boolean
}>()

const sorted = computed(() =>
  [...props.contents].sort(
    (a, b) => RARITY_ORDER.indexOf(b.rewardItem.rarity) - RARITY_ORDER.indexOf(a.rewardItem.rarity),
  ),
)
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

    <ul v-else class="crate-contents__list">
      <li
        v-for="c in sorted"
        :key="c.rewardItem.id"
        class="crate-contents__row"
        :class="rarityClass(c.rewardItem.rarity)"
      >
        <span class="crate-contents__art">
          <ItemPreview :item="c.rewardItem" />
        </span>
        <span class="crate-contents__name">{{ c.rewardItem.name }}</span>
        <span class="crate-contents__rarity">{{ c.rewardItem.rarity }}</span>
      </li>
    </ul>
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

.crate-contents__row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  --rarity-color: var(--text-tertiary);
}

.crate-contents__row + .crate-contents__row {
  border-top: 1px solid var(--bg-overlay);
}

.crate-contents__row.rarity--uncommon { --rarity-color: var(--success); }
.crate-contents__row.rarity--rare { --rarity-color: var(--info); }
.crate-contents__row.rarity--epic { --rarity-color: var(--accent-overall); }
.crate-contents__row.rarity--legendary { --rarity-color: var(--tier-gold); }
.crate-contents__row.rarity--mythic { --rarity-color: var(--error); }

.crate-contents__art {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
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

.crate-contents__rarity {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--rarity-color);
}

.crate-contents__rarity::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--rarity-color);
}
</style>
