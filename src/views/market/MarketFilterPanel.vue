<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import type { ItemRarity } from '@/types/api/items'
import { RARITY_ORDER } from '@/utils/items'
import { sanitizeEssenceInput } from '@/utils/market'
import MarketEffectFilter, {
  type EffectCrateGroup,
  type EffectOption,
} from './MarketEffectFilter.vue'

export interface MarketTypeOption {
  key: string
  label: string
}

export interface MarketTypeGroup {
  label: string | null
  options: MarketTypeOption[]
}

export interface MarketModifierOption {
  key: string
  label: string
  colorHex: string | null
}

const props = defineProps<{
  rarities: ItemRarity[]
  typeKeys: string[]
  typeGroups: MarketTypeGroup[]
  modifierKeys: string[]
  modifierOptions: MarketModifierOption[]
  effectKeys: string[]
  effectGroups: EffectCrateGroup[]
  ungroupedEffects: EffectOption[]
  minPrice: number | null
  maxPrice: number | null
  hasActiveFilters: boolean
}>()

const emit = defineEmits<{
  'update:rarities': [value: ItemRarity[]]
  'update:typeKeys': [value: string[]]
  'update:modifierKeys': [value: string[]]
  'update:effectKeys': [value: string[]]
  'update:minPrice': [value: number | null]
  'update:maxPrice': [value: number | null]
  clear: []
}>()

function toggled(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key]
}

function toggleRarity(rarity: ItemRarity) {
  emit('update:rarities', toggled(props.rarities, rarity) as ItemRarity[])
}

function toggleType(key: string) {
  emit('update:typeKeys', toggled(props.typeKeys, key))
}

function toggleModifier(key: string) {
  emit('update:modifierKeys', toggled(props.modifierKeys, key))
}

function toggleEffect(key: string) {
  emit('update:effectKeys', toggled(props.effectKeys, key))
}

function commitPrice(edge: 'min' | 'max', event: Event) {
  const raw = (event.target as HTMLInputElement).value
  const value = raw.trim() === '' ? null : sanitizeEssenceInput(raw)
  if (edge === 'min') emit('update:minPrice', value)
  else emit('update:maxPrice', value)
}
</script>

<template>
  <div class="market-filters">
    <fieldset class="market-filters__group">
      <legend class="market-filters__legend">Rarity</legend>
      <label
        v-for="rarity in RARITY_ORDER"
        :key="rarity"
        class="market-filters__option"
        :class="`rarity--${rarity}`"
      >
        <input
          type="checkbox"
          :checked="rarities.includes(rarity)"
          @change="toggleRarity(rarity)"
        />
        <span class="market-filters__option-label">{{ rarity }}</span>
      </label>
    </fieldset>

    <fieldset v-if="typeGroups.length > 0" class="market-filters__group">
      <legend class="market-filters__legend">Item type</legend>
      <template v-for="(group, index) in typeGroups" :key="group.label ?? `flat-${index}`">
        <span v-if="group.label" class="market-filters__subhead">{{ group.label }}</span>
        <label
          v-for="option in group.options"
          :key="option.key"
          class="market-filters__option"
          :class="{ 'market-filters__option--nested': group.label }"
        >
          <input
            type="checkbox"
            :checked="typeKeys.includes(option.key)"
            @change="toggleType(option.key)"
          />
          <span class="market-filters__option-label market-filters__option-label--plain">
            {{ option.label }}
          </span>
        </label>
      </template>
    </fieldset>

    <fieldset v-if="modifierOptions.length > 0" class="market-filters__group">
      <legend class="market-filters__legend">Modifier</legend>
      <div class="market-filters__columns">
        <label v-for="option in modifierOptions" :key="option.key" class="market-filters__option">
          <input
            type="checkbox"
            :checked="modifierKeys.includes(option.key)"
            @change="toggleModifier(option.key)"
          />
          <span
            class="market-filters__option-label market-filters__option-label--plain"
            :style="option.colorHex ? { color: option.colorHex } : undefined"
          >
            {{ option.label }}
          </span>
        </label>
      </div>
    </fieldset>

    <fieldset
      v-if="effectGroups.length > 0 || ungroupedEffects.length > 0"
      class="market-filters__group"
    >
      <legend class="market-filters__legend">Unusual effect</legend>
      <MarketEffectFilter
        :groups="effectGroups"
        :ungrouped="ungroupedEffects"
        :selected="effectKeys"
        @toggle="toggleEffect"
      />
    </fieldset>

    <fieldset class="market-filters__group">
      <legend class="market-filters__legend">Price</legend>
      <div class="market-filters__price-row">
        <input
          class="market-filters__price-input"
          type="text"
          inputmode="numeric"
          placeholder="Min"
          aria-label="Minimum price"
          :value="minPrice ?? ''"
          @change="commitPrice('min', $event)"
        />
        <span class="market-filters__price-dash" aria-hidden="true">-</span>
        <input
          class="market-filters__price-input"
          type="text"
          inputmode="numeric"
          placeholder="Max"
          aria-label="Maximum price"
          :value="maxPrice ?? ''"
          @change="commitPrice('max', $event)"
        />
      </div>
    </fieldset>

    <BaseButton v-if="hasActiveFilters" size="sm" @click="emit('clear')">Clear filters</BaseButton>
  </div>
</template>

<style scoped>
.market-filters {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  min-width: 260px;
  max-height: min(65vh, 560px);
  overflow-y: auto;
  padding-right: var(--space-xs);
}

.market-filters__columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-xs) var(--space-sm);
}

.market-filters__group {
  margin: 0;
  padding: 0;
  border: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.market-filters__legend {
  padding: 0;
  margin-bottom: var(--space-xs);
  font-size: var(--text-caption);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.market-filters__option {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
  font-size: var(--text-body);
}

.market-filters__option input {
  accent-color: var(--page-accent, var(--accent));
}

.market-filters__option-label {
  text-transform: capitalize;
  color: var(--rarity-color, var(--text-primary));
}

.market-filters__option-label--plain {
  color: var(--text-primary);
}

.market-filters__subhead {
  margin-top: var(--space-xs);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.market-filters__option--nested {
  margin-left: var(--space-md);
}

.market-filters__option.rarity--common { --rarity-color: var(--text-secondary); }
.market-filters__option.rarity--uncommon { --rarity-color: var(--success); }
.market-filters__option.rarity--rare { --rarity-color: var(--info); }
.market-filters__option.rarity--epic { --rarity-color: var(--tier-apex); }
.market-filters__option.rarity--legendary { --rarity-color: var(--tier-gold); }
.market-filters__option.rarity--mythic { --rarity-color: var(--error); }

.market-filters__price-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.market-filters__price-input {
  width: 0;
  flex: 1;
  padding: var(--space-xs) var(--space-sm);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--text-body);
}

.market-filters__price-input:focus {
  outline: none;
  border-color: var(--page-accent, var(--accent));
}

.market-filters__price-dash {
  color: var(--text-tertiary);
}
</style>
