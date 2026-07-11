<script setup lang="ts">
import FragmentedItem from '@/components/domain/FragmentedItem.vue'
import ItemPreview from '@/components/domain/ItemPreview.vue'
import ModifierCompositions from '@/components/domain/ModifierCompositions.vue'
import { useModifierColor } from '@/composables/useModifierColor'
import { useItemModifierStore } from '@/stores/itemModifiers'
import type { ItemModifierRef, UserItemResponse } from '@/types/api/items'
import {
  buildEffectLayers,
  displayItemName,
  rarityClass,
  readFragmentSpec,
  sortModifiersByKey,
  userItemTokenContext,
} from '@/utils/items'
import { computed, onMounted } from 'vue'

const props = defineProps<{
  userItem: UserItemResponse
  selected?: boolean
  equipped?: boolean
  locked?: boolean
}>()

defineEmits<{
  select: [linkId: string]
}>()

const modifierStore = useItemModifierStore()

const item = computed(() => props.userItem.item)
const modifiers = computed<ItemModifierRef[]>(() => sortModifiersByKey(props.userItem.modifiers ?? []))
const effectLayers = computed(() =>
  buildEffectLayers(props.userItem.modifiers, props.userItem.unusualEffect),
)
const fragmentSpec = computed(() => readFragmentSpec(props.userItem.unusualEffect))
const tokenCtx = computed(() => userItemTokenContext(props.userItem))
const quantity = computed(() => props.userItem.quantity ?? 1)

const { accent } = useModifierColor(modifiers)

const cellAccentStyle = computed(() => (accent.value ? { '--cell-accent': accent.value } : undefined))
const itemNameStyle = computed(() => (accent.value ? { color: accent.value } : undefined))
const fullItemName = computed(() => displayItemName(modifiers.value, item.value.name))

onMounted(() => {
  modifierStore.fetchModifiers()
})
</script>

<template>
  <div class="inventory-cell-wrap">
    <button
      type="button"
      class="inventory-cell"
      :class="[
        rarityClass(item.rarity),
        {
          'inventory-cell--selected': selected,
          'inventory-cell--equipped': equipped,
          'inventory-cell--deprecated': item.deprecated,
          'inventory-cell--locked': locked,
          'inventory-cell--title-fx': item.typeKey === 'title',
        },
      ]"
      :style="cellAccentStyle"
      :aria-label="item.name"
      :aria-pressed="selected"
      @click="$emit('select', userItem.linkId)"
    >
      <span class="inventory-cell__art">
        <FragmentedItem v-if="fragmentSpec" :item="item" :spec="fragmentSpec" :selected="selected" />
        <ItemPreview v-else :item="item" :selected="selected" />
      </span>

      <ModifierCompositions
        v-for="layer in effectLayers"
        :key="layer.key"
        :spec="layer.spec"
        :context="tokenCtx"
        :type-key="item.typeKey"
        measure-selector=".title-renderer, .item-preview > *"
      />

      <span v-if="equipped && !locked" class="inventory-cell__equipped" aria-hidden="true">EQUIPPED</span>
      <span v-if="!locked && quantity > 1" class="inventory-cell__qty">x{{ quantity }}</span>
      <span v-if="!locked && userItem.serialNumber != null" class="inventory-cell__serial">#{{ userItem.serialNumber }}</span>

      <span v-if="locked" class="inventory-cell__lock" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </span>
    </button>

    <div class="inventory-cell-tooltip" role="tooltip" :style="cellAccentStyle">
      <span class="inventory-cell-tooltip__name" :style="itemNameStyle">{{ fullItemName }}</span>
      <p v-if="item.description" class="inventory-cell-tooltip__desc">{{ item.description }}</p>
      <span class="inventory-cell-tooltip__meta">
        <span class="inventory-cell-tooltip__rarity" :class="rarityClass(item.rarity)">{{ item.rarity }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.inventory-cell-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  container-type: inline-size;
  container-name: inv-cell;
}

.inventory-cell-wrap:hover .inventory-cell-tooltip {
  opacity: 1;
  transform: translate(-50%, 0);
}

.inventory-cell-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translate(-50%, 4px);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 180px;
  max-width: 260px;
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

.inventory-cell-tooltip__name {
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--text-primary);
}

.inventory-cell-tooltip__desc {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  line-height: 1.4;
}

.inventory-cell-tooltip__meta {
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

.inventory-cell-tooltip__rarity {
  color: var(--rarity-color);
}

.inventory-cell-tooltip__rarity.rarity--common { --rarity-color: var(--text-tertiary); }
.inventory-cell-tooltip__rarity.rarity--uncommon { --rarity-color: var(--success); }
.inventory-cell-tooltip__rarity.rarity--rare { --rarity-color: var(--info); }
.inventory-cell-tooltip__rarity.rarity--epic { --rarity-color: var(--tier-apex); }
.inventory-cell-tooltip__rarity.rarity--legendary { --rarity-color: var(--tier-gold); }
.inventory-cell-tooltip__rarity.rarity--mythic { --rarity-color: var(--error); }

.inventory-cell {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 0;
  box-sizing: border-box;
  background: var(--bg-surface);
  border: 1px solid var(--cell-accent, var(--rarity-color));
  border-radius: var(--radius-card);
  cursor: pointer;
  overflow: hidden;
  transition: border-color 120ms ease, transform 120ms ease;
  --rarity-color: var(--text-tertiary);
  --cell-accent: var(--rarity-color);
}

.inventory-cell.rarity--common { --rarity-color: var(--text-tertiary); }
.inventory-cell.rarity--uncommon { --rarity-color: var(--success); }
.inventory-cell.rarity--rare { --rarity-color: var(--info); }
.inventory-cell.rarity--epic { --rarity-color: var(--tier-apex); }
.inventory-cell.rarity--legendary { --rarity-color: var(--tier-gold); }
.inventory-cell.rarity--mythic { --rarity-color: var(--error); }

.inventory-cell:hover {
  border-color: var(--cell-accent);
  transform: scale(1.02);
}

.inventory-cell--selected {
  border-color: var(--cell-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--cell-accent) 35%, transparent);
}

.inventory-cell--equipped::before {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid color-mix(in srgb, var(--accent) 60%, transparent);
  border-radius: inherit;
  pointer-events: none;
}

.inventory-cell--deprecated {
  opacity: 0.55;
}

.inventory-cell--locked {
  opacity: 0.5;
}

.inventory-cell--locked .inventory-cell__art {
  filter: grayscale(0.6);
}

.inventory-cell__lock {
  position: absolute;
  bottom: var(--space-xs);
  left: var(--space-xs);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: var(--text-tertiary);
  background: color-mix(in srgb, var(--bg-base) 75%, transparent);
  border-radius: var(--radius-pill);
  pointer-events: none;
}

.inventory-cell__art {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.inventory-cell--title-fx .inventory-cell__art {
  position: relative;
  z-index: 1;
}

.inventory-cell__equipped {
  position: absolute;
  top: var(--space-xs);
  left: var(--space-xs);
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--accent);
  background: color-mix(in srgb, var(--bg-base) 75%, transparent);
  padding: 2px 6px;
  border-radius: var(--radius-pill);
}

.inventory-cell__serial {
  position: absolute;
  top: var(--space-xs);
  right: var(--space-xs);
  font-family: var(--font-mono);
  font-size: 0.5625rem;
  color: var(--text-tertiary);
}

.inventory-cell__qty {
  position: absolute;
  top: var(--space-xs);
  right: var(--space-xs);
  padding: 2px 6px;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 700;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--bg-base) 80%, transparent);
  border: 1px solid var(--cell-accent, var(--bg-overlay));
  border-radius: var(--radius-pill);
  pointer-events: none;
}
</style>
