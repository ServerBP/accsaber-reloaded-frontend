<script setup lang="ts">
import ItemPreview from '@/components/domain/ItemPreview.vue'
import UnusualEffectTile from '@/components/domain/UnusualEffectTile.vue'
import { useFloatingPanel } from '@/composables/useFloatingPanel'
import type { ItemResponse, UnusualEffectResponse } from '@/types/api/items'
import { computed, nextTick, ref } from 'vue'

interface Opt {
  value: string
  label: string
  rarity: string | null
  item: ItemResponse | null
  effect: UnusualEffectResponse | null
}

const props = defineProps<{
  modelValue: string
  placeholder?: string
  items?: ItemResponse[]
  effects?: UnusualEffectResponse[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const noneLabel = computed(() => props.placeholder ?? 'None')

const options = computed<Opt[]>(() => {
  const none: Opt = { value: '', label: noneLabel.value, rarity: null, item: null, effect: null }
  if (props.items) {
    return [
      none,
      ...props.items.map((i) => ({
        value: i.id,
        label: i.name || 'Untitled',
        rarity: i.rarity,
        item: i,
        effect: null,
      })),
    ]
  }
  return [
    none,
    ...(props.effects ?? []).map((e) => ({
      value: e.id,
      label: e.name || e.key,
      rarity: null,
      item: null,
      effect: e,
    })),
  ]
})

const selected = computed(() => options.value.find((o) => o.value === props.modelValue) ?? options.value[0])

const { isOpen, containerRef, triggerRef, panelRef, panelStyle, toggle: togglePanel, close } =
  useFloatingPanel({ minWidth: 240 })

const search = ref('')
const searchRef = ref<HTMLInputElement | null>(null)

const filteredOptions = computed(() => {
  if (!search.value) return options.value
  const q = search.value.toLowerCase()
  return options.value.filter((o) => o.label.toLowerCase().includes(q))
})

function toggle() {
  togglePanel()
  if (isOpen.value) {
    search.value = ''
    nextTick(() => searchRef.value?.focus())
  }
}

function pick(value: string) {
  emit('update:modelValue', value)
  close()
}
</script>

<template>
  <div ref="containerRef" class="preview-picker">
    <button ref="triggerRef" type="button" class="preview-picker__trigger" @click="toggle">
      <span class="preview-picker__thumb">
        <ItemPreview v-if="selected.item" :item="selected.item" />
        <UnusualEffectTile v-else-if="selected.effect" :name="selected.effect.name || selected.effect.key"
          :effect-spec="selected.effect.effectSpec" :size="30" />
      </span>
      <span class="preview-picker__label">{{ selected.label }}</span>
      <svg class="preview-picker__chevron" :class="{ 'preview-picker__chevron--open': isOpen }" width="12" height="12"
        viewBox="0 0 12 12" fill="none">
        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
          stroke-linejoin="round" />
      </svg>
    </button>

    <Teleport to="body">
      <div v-if="isOpen" ref="panelRef" class="preview-picker__panel" :style="panelStyle">
        <input ref="searchRef" v-model="search" class="preview-picker__search" placeholder="Search..." @click.stop />
        <div class="preview-picker__options">
          <button v-for="opt in filteredOptions" :key="opt.value" type="button" class="preview-picker__option"
            :class="{ 'preview-picker__option--selected': opt.value === modelValue }" @click="pick(opt.value)">
            <span class="preview-picker__thumb">
              <ItemPreview v-if="opt.item" :item="opt.item" />
              <UnusualEffectTile v-else-if="opt.effect" :name="opt.effect.name || opt.effect.key"
                :effect-spec="opt.effect.effectSpec" :size="30" />
            </span>
            <span class="preview-picker__option-label">{{ opt.label }}</span>
            <span v-if="opt.rarity" class="preview-picker__rarity" :class="`rarity--${opt.rarity}`">{{ opt.rarity }}</span>
          </button>
          <div v-if="filteredOptions.length === 0" class="preview-picker__empty">No results</div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.preview-picker {
  position: relative;
}

.preview-picker__trigger {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  min-width: 160px;
  padding: 5px var(--space-sm);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  cursor: pointer;
  text-align: left;
  transition: border-color 120ms ease;
}

.preview-picker__trigger:hover {
  border-color: var(--text-tertiary);
}

.preview-picker__thumb {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: var(--radius-input);
  overflow: hidden;
  background: var(--bg-surface);
}

.preview-picker__thumb:empty {
  background: transparent;
}

.preview-picker__label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-picker__chevron {
  color: var(--text-secondary);
  transition: transform 150ms ease;
  flex-shrink: 0;
}

.preview-picker__chevron--open {
  transform: rotate(180deg);
}
</style>

<style>
.preview-picker__panel {
  z-index: 1000;
  max-height: 320px;
  display: flex;
  flex-direction: column;
  background: var(--bg-elevated);
  border: 1px solid var(--text-tertiary);
  border-radius: var(--radius-card);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.preview-picker__search {
  display: block;
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: none;
  border-bottom: 1px solid var(--bg-overlay);
  background: transparent;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  outline: none;
}

.preview-picker__options {
  overflow-y: auto;
}

.preview-picker__option {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: 6px var(--space-sm);
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  cursor: pointer;
  text-align: left;
}

.preview-picker__option:hover {
  background: var(--bg-surface);
}

.preview-picker__option--selected {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.preview-picker__option-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-picker__rarity {
  font-size: var(--text-caption);
  text-transform: capitalize;
  font-weight: 500;
  color: var(--rarity-color, var(--text-tertiary));
  flex-shrink: 0;
}

.preview-picker__rarity.rarity--common { --rarity-color: var(--text-tertiary); }
.preview-picker__rarity.rarity--uncommon { --rarity-color: var(--success); }
.preview-picker__rarity.rarity--rare { --rarity-color: var(--info); }
.preview-picker__rarity.rarity--epic { --rarity-color: var(--tier-apex); }
.preview-picker__rarity.rarity--legendary { --rarity-color: var(--tier-gold); }
.preview-picker__rarity.rarity--mythic { --rarity-color: var(--error); }

.preview-picker__empty {
  padding: var(--space-md);
  text-align: center;
  color: var(--text-tertiary);
  font-size: var(--text-caption);
}
</style>
