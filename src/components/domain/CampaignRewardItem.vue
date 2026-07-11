<script setup lang="ts">
import ItemPreview from '@/components/domain/ItemPreview.vue'
import type { ItemResponse } from '@/types/api/items'
import { rarityClass } from '@/utils/items'
import { computed } from 'vue'

const props = defineProps<{
  name: string
  quantity: number
  item?: ItemResponse | null
}>()

const displayName = computed(() => props.item?.name ?? props.name)

const typeLabel = computed(() => (props.item ? props.item.typeKey.replace(/_/g, ' ') : null))

const initial = computed(() => displayName.value.charAt(0).toUpperCase())
</script>

<template>
  <div class="reward-item">
    <span class="reward-item__art"
      :class="item ? rarityClass(item.rarity) : 'reward-item__art--plain'">
      <ItemPreview v-if="item" :item="item" />
      <span v-else class="reward-item__initial">{{ initial }}</span>
    </span>

    <span class="reward-item__meta">
      <span class="reward-item__name">{{ displayName }}</span>
      <span v-if="typeLabel" class="reward-item__type">{{ typeLabel }}</span>
    </span>

    <span class="reward-item__qty">×{{ quantity }}</span>

    <slot name="action" />
  </div>
</template>

<style scoped>
.reward-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  min-width: 0;
}

.reward-item__art {
  --rarity-color: var(--text-tertiary);
  --cell-accent: var(--rarity-color);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  background: var(--bg-base);
  border: 1px solid var(--rarity-color);
  border-radius: var(--radius-card);
  overflow: hidden;
}

.reward-item__art.rarity--common { --rarity-color: var(--text-tertiary); }
.reward-item__art.rarity--uncommon { --rarity-color: var(--success); }
.reward-item__art.rarity--rare { --rarity-color: var(--info); }
.reward-item__art.rarity--epic { --rarity-color: var(--tier-apex); }
.reward-item__art.rarity--legendary { --rarity-color: var(--tier-gold); }
.reward-item__art.rarity--mythic { --rarity-color: var(--error); }

.reward-item__initial {
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--text-secondary);
}

.reward-item__meta {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.reward-item__name {
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reward-item__type {
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.reward-item__qty {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  font-weight: 500;
  color: var(--page-accent, var(--accent));
}
</style>
