<script setup lang="ts">
import FragmentedItem from '@/components/domain/FragmentedItem.vue'
import ItemPreview from '@/components/domain/ItemPreview.vue'
import ModifierCompositions from '@/components/domain/ModifierCompositions.vue'
import { useModifierColor } from '@/composables/useModifierColor'
import type { ItemModifierRef } from '@/types/api/items'
import type { TradeItemRef } from '@/types/api/trades'
import {
  buildEffectLayers,
  displayItemName,
  rarityClass,
  readFragmentSpec,
  sortModifiersByKey,
} from '@/utils/items'
import { computed } from 'vue'

const props = defineProps<{
  itemRef: TradeItemRef
}>()

const sortedModifiers = computed<ItemModifierRef[]>(() => sortModifiersByKey(props.itemRef.modifiers ?? []))
const effectLayers = computed(() =>
  buildEffectLayers(props.itemRef.modifiers, props.itemRef.unusualEffect),
)
const fragmentSpec = computed(() => readFragmentSpec(props.itemRef.unusualEffect))
const quantity = computed(() => props.itemRef.quantity ?? 1)
const name = computed(() => displayItemName(props.itemRef.modifiers, props.itemRef.item.name))

const { accent } = useModifierColor(sortedModifiers)
const accentStyle = computed(() => (accent.value ? { '--cell-accent': accent.value } : undefined))
</script>

<template>
  <div class="trade-row-item" :style="accentStyle">
    <div
      class="trade-row-item__tile"
      :class="rarityClass(itemRef.item.rarity)"
      tabindex="0"
      :aria-label="itemRef.item.name"
    >
      <FragmentedItem v-if="fragmentSpec" :item="itemRef.item" :spec="fragmentSpec" />
      <ItemPreview v-else :item="itemRef.item" :selected="false" />
      <ModifierCompositions
        v-for="layer in effectLayers"
        :key="layer.key"
        :spec="layer.spec"
        :context="{ serial: itemRef.serialNumber }"
        :type-key="itemRef.item.typeKey"
        measure-selector=".title-renderer, .item-preview > *"
      />
      <span v-if="itemRef.serialNumber != null" class="trade-row-item__serial">#{{ itemRef.serialNumber }}</span>
      <span v-if="quantity > 1" class="trade-row-item__qty">x{{ quantity }}</span>
    </div>
    <div class="trade-row-item__tooltip" role="tooltip">
      <span class="trade-row-item__tooltip-name">{{ name }}</span>
      <p v-if="itemRef.item.description" class="trade-row-item__tooltip-desc">{{ itemRef.item.description }}</p>
      <span class="trade-row-item__tooltip-meta">
        <span class="trade-row-item__tooltip-rarity" :class="rarityClass(itemRef.item.rarity)">{{ itemRef.item.rarity }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.trade-row-item {
  position: relative;
  width: 56px;
}

.trade-row-item__tile {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  background: var(--bg-surface);
  border: 1px solid var(--cell-accent, var(--rarity-color));
  border-radius: var(--radius-card);
  overflow: hidden;
  cursor: help;
  outline: none;
  --rarity-color: var(--text-tertiary);
  --cell-accent: var(--rarity-color);
}

.trade-row-item__tile.rarity--common { --rarity-color: var(--text-tertiary); }
.trade-row-item__tile.rarity--uncommon { --rarity-color: var(--success); }
.trade-row-item__tile.rarity--rare { --rarity-color: var(--info); }
.trade-row-item__tile.rarity--epic { --rarity-color: var(--tier-apex); }
.trade-row-item__tile.rarity--legendary { --rarity-color: var(--tier-gold); }
.trade-row-item__tile.rarity--mythic { --rarity-color: var(--error); }

.trade-row-item__tile:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--cell-accent, var(--accent-overall)) 60%, transparent);
  outline-offset: 2px;
}

.trade-row-item__serial {
  position: absolute;
  top: 2px;
  right: 4px;
  font-family: var(--font-mono);
  font-size: 0.5625rem;
  color: var(--text-tertiary);
}

.trade-row-item__qty {
  position: absolute;
  bottom: 2px;
  right: 4px;
  padding: 1px 4px;
  font-family: var(--font-mono);
  font-size: 0.5625rem;
  font-weight: 700;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--bg-base) 80%, transparent);
  border: 1px solid var(--cell-accent, var(--bg-overlay));
  border-radius: var(--radius-pill);
  line-height: 1;
}

.trade-row-item__tooltip {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translate(-50%, -4px);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 200px;
  max-width: 280px;
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-elevated);
  border: 1px solid var(--cell-accent, var(--bg-overlay));
  border-radius: var(--radius-card);
  pointer-events: none;
  opacity: 0;
  z-index: 30;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  transition: opacity 120ms ease, transform 120ms ease;
}

.trade-row-item:hover .trade-row-item__tooltip,
.trade-row-item:focus-within .trade-row-item__tooltip {
  opacity: 1;
  transform: translate(-50%, 0);
}

.trade-row-item__tooltip-name {
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--text-primary);
}

.trade-row-item__tooltip-desc {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  line-height: 1.4;
}

.trade-row-item__tooltip-meta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.trade-row-item__tooltip-rarity { color: var(--rarity-color); }
.trade-row-item__tooltip-rarity.rarity--common { --rarity-color: var(--text-tertiary); }
.trade-row-item__tooltip-rarity.rarity--uncommon { --rarity-color: var(--success); }
.trade-row-item__tooltip-rarity.rarity--rare { --rarity-color: var(--info); }
.trade-row-item__tooltip-rarity.rarity--epic { --rarity-color: var(--tier-apex); }
.trade-row-item__tooltip-rarity.rarity--legendary { --rarity-color: var(--tier-gold); }
.trade-row-item__tooltip-rarity.rarity--mythic { --rarity-color: var(--error); }
</style>
