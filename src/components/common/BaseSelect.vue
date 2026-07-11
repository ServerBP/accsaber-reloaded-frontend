<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';

interface SelectOption {
  value: string
  label: string
  icon?: string
  description?: string
}

const props = defineProps<{
  modelValue: string
  options: SelectOption[]
  label?: string
  searchable?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)
const search = ref('')
const containerRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const searchRef = ref<HTMLInputElement | null>(null)

const panelStyle = ref<Record<string, string>>({})

const selectedLabel = computed(() => {
  const opt = props.options.find((o) => o.value === props.modelValue)
  return opt?.label ?? props.placeholder ?? 'Select...'
})

const filteredOptions = computed(() => {
  if (!search.value) return props.options
  const q = search.value.toLowerCase()
  return props.options.filter(
    (o) =>
      o.label.toLowerCase().includes(q) ||
      (o.description?.toLowerCase().includes(q) ?? false),
  )
})

function updatePanelPosition() {
  const trigger = triggerRef.value
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  panelStyle.value = {
    position: 'fixed',
    top: `${rect.bottom}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    minWidth: `${rect.width}px`,
  }
}

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    search.value = ''
    updatePanelPosition()
    nextTick(() => searchRef.value?.focus())
  }
}

function select(value: string) {
  emit('update:modelValue', value)
  isOpen.value = false
}

function onClickOutside(e: MouseEvent) {
  const target = e.target as Node
  if (containerRef.value?.contains(target)) return
  if (panelRef.value?.contains(target)) return
  isOpen.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') isOpen.value = false
}

function onReposition() {
  if (isOpen.value) updatePanelPosition()
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('scroll', onReposition, true)
  window.addEventListener('resize', onReposition)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', onReposition, true)
  window.removeEventListener('resize', onReposition)
})
</script>

<template>
  <div ref="containerRef" class="base-select">
    <label v-if="label" class="base-select__label">{{ label }}</label>
    <button ref="triggerRef" class="base-select__trigger" :class="{ 'base-select__trigger--open': isOpen }"
      @click="toggle">
      <span class="base-select__value">{{ selectedLabel }}</span>
      <svg class="base-select__chevron" :class="{ 'base-select__chevron--open': isOpen }" width="12" height="12"
        viewBox="0 0 12 12" fill="none">
        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
          stroke-linejoin="round" />
      </svg>
    </button>
    <Teleport to="body">
      <div v-if="isOpen" ref="panelRef" class="base-select__panel" :style="panelStyle">
        <input v-if="searchable" ref="searchRef" v-model="search" class="base-select__search" placeholder="Search..."
          @click.stop />
        <div class="base-select__options">
          <button v-for="opt in filteredOptions" :key="opt.value" class="base-select__option"
            :class="{ 'base-select__option--selected': opt.value === modelValue }" @click="select(opt.value)">
            <span v-if="opt.icon" class="base-select__option-icon">{{ opt.icon }}</span>
            <span class="base-select__option-text">
              <span class="base-select__option-label">{{ opt.label }}</span>
              <span v-if="opt.description" class="base-select__option-desc">{{ opt.description }}</span>
            </span>
          </button>
          <div v-if="filteredOptions.length === 0" class="base-select__empty">No results</div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.base-select {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.base-select__label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.base-select__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  cursor: pointer;
  transition: border-color 120ms ease-in;
  min-width: 140px;
  white-space: nowrap;
}

.base-select__trigger:focus {
  border-color: var(--accent);
  outline: none;
}

.base-select__trigger--open {
  border-color: var(--text-tertiary);
  outline: none;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-bottom-color: var(--bg-overlay);
}

.base-select__chevron {
  color: var(--text-secondary);
  transition: transform 150ms ease;
}

.base-select__chevron--open {
  transform: rotate(180deg);
}

</style>

<style>
.base-select__panel {
  padding-top: var(--space-xs);
  background: var(--bg-elevated);
  border: 1px solid var(--text-tertiary);
  border-top: 1px solid var(--bg-overlay);
  border-radius: 0 0 var(--radius-card) var(--radius-card);
  z-index: 1000;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.base-select__search {
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

.base-select__search::placeholder {
  color: var(--text-tertiary);
}

.base-select__options {
  max-height: 240px;
  overflow-y: auto;
}

.base-select__option {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  cursor: pointer;
  text-align: left;
  transition: background-color 80ms ease;
}

.base-select__option:hover {
  background: var(--bg-overlay);
}

.base-select__option--selected {
  color: var(--accent);
}

.base-select__option-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.base-select__option-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.base-select__option-desc {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  line-height: 1.3;
  white-space: normal;
}

.base-select__option--selected .base-select__option-desc {
  color: var(--text-secondary);
}

.base-select__empty {
  padding: var(--space-md);
  color: var(--text-tertiary);
  text-align: center;
  font-size: var(--text-caption);
}
</style>
