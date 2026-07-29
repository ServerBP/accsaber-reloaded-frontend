<script setup lang="ts">
import { useDebouncedRef } from '@/composables/useDebouncedRef'
import { useFloatingPanel } from '@/composables/useFloatingPanel'
import { computed, ref, watch } from 'vue'

export interface PickerOption {
  id: string
  label: string
  hint?: string | null
  imageUrl?: string | null
}

const props = withDefaults(
  defineProps<{
    modelValue: string | string[] | null
    search: (query: string) => Promise<PickerOption[]>
    resolve: (id: string) => Promise<PickerOption | null>
    multiple?: boolean
    placeholder?: string
    disabled?: boolean
  }>(),
  { placeholder: 'Search...' },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | string[] | null]
}>()

const { isOpen, containerRef, triggerRef, panelRef, panelStyle, open, close } = useFloatingPanel()

const query = ref('')
const debounced = useDebouncedRef(query, 200)
const results = ref<PickerOption[]>([])
const loading = ref(false)
const focusedIndex = ref(-1)
const selected = ref<PickerOption[]>([])

let searchId = 0

const ids = computed<string[]>(() => {
  const value = props.modelValue
  if (value === null || value === undefined) return []
  return Array.isArray(value) ? value : [value]
})

const showInput = computed(() => props.multiple || selected.value.length === 0)

async function runSearch(text: string) {
  const id = ++searchId
  loading.value = true
  try {
    const options = await props.search(text)
    if (id !== searchId) return
    results.value = options
    focusedIndex.value = options.length > 0 ? 0 : -1
  } catch {
    if (id === searchId) results.value = []
  } finally {
    if (id === searchId) loading.value = false
  }
}

function emitIds(next: string[]) {
  if (props.multiple) emit('update:modelValue', next)
  else emit('update:modelValue', next[0] ?? null)
}

function pick(option: PickerOption) {
  if (ids.value.includes(option.id)) return
  const next = props.multiple ? [...ids.value, option.id] : [option.id]
  selected.value = props.multiple ? [...selected.value, option] : [option]
  query.value = ''
  results.value = []
  emitIds(next)
  if (!props.multiple) close()
}

function remove(id: string) {
  selected.value = selected.value.filter((o) => o.id !== id)
  emitIds(ids.value.filter((v) => v !== id))
}

function onFocus() {
  open()
  if (results.value.length === 0 && !loading.value) runSearch(query.value.trim())
}

function onKeydown(e: KeyboardEvent) {
  if (!isOpen.value) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    focusedIndex.value = Math.min(results.value.length - 1, focusedIndex.value + 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    focusedIndex.value = Math.max(0, focusedIndex.value - 1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const choice = results.value[focusedIndex.value]
    if (choice) pick(choice)
  }
}

watch(debounced, (text) => {
  if (!isOpen.value) return
  runSearch(text.trim())
})

watch(
  ids,
  async (next) => {
    const known = new Map(selected.value.map((o) => [o.id, o]))
    const hydrated = await Promise.all(
      next.map(async (id) => {
        const existing = known.get(id)
        if (existing) return existing
        try {
          return (await props.resolve(id)) ?? { id, label: id }
        } catch {
          return { id, label: id }
        }
      }),
    )
    selected.value = hydrated
  },
  { immediate: true },
)
</script>

<template>
  <div ref="containerRef" class="resource-picker">
    <div v-if="selected.length > 0" class="resource-picker__chips">
      <span v-for="option in selected" :key="option.id" class="resource-picker__chip">
        <img v-if="option.imageUrl" class="resource-picker__thumb" :src="option.imageUrl" :alt="option.label"
          loading="lazy" decoding="async" />
        <span class="resource-picker__chip-label">{{ option.label }}</span>
        <span v-if="option.hint" class="resource-picker__chip-hint">{{ option.hint }}</span>
        <button type="button" class="resource-picker__clear" :disabled="disabled"
          :aria-label="`Remove ${option.label}`" @click="remove(option.id)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </span>
    </div>

    <div v-if="showInput" ref="triggerRef" class="resource-picker__field">
      <input v-model="query" type="text" class="resource-picker__input" :placeholder="placeholder" :disabled="disabled"
        @focus="onFocus" @keydown="onKeydown" />
    </div>

    <Teleport to="body">
      <div v-if="isOpen && showInput" ref="panelRef" class="resource-picker__panel" :style="panelStyle">
        <div v-if="loading" class="resource-picker__status">Searching...</div>
        <div v-else-if="results.length === 0" class="resource-picker__status">No matches</div>
        <button v-for="(option, i) in results" :key="option.id" type="button" class="resource-picker__option"
          :class="{ 'resource-picker__option--focused': i === focusedIndex }" @mouseenter="focusedIndex = i"
          @click="pick(option)">
          <img v-if="option.imageUrl" class="resource-picker__thumb" :src="option.imageUrl" :alt="option.label"
            loading="lazy" decoding="async" />
          <span class="resource-picker__option-label">{{ option.label }}</span>
          <span v-if="option.hint" class="resource-picker__option-hint">{{ option.hint }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.resource-picker {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  width: 100%;
}

.resource-picker__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.resource-picker__chip {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  max-width: 100%;
  padding: 4px var(--space-sm);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  background: var(--bg-base);
  font-size: var(--text-caption);
  color: var(--text-primary);
}

.resource-picker__chip-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-picker__chip-hint {
  font-family: var(--font-mono);
  color: var(--text-tertiary);
}

.resource-picker__clear {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: color 120ms ease;
}

.resource-picker__clear:hover:not(:disabled) {
  color: var(--text-primary);
}

.resource-picker__field {
  display: flex;
}

.resource-picker__input {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  outline: none;
  transition: border-color 120ms ease;
}

.resource-picker__input:focus {
  border-color: var(--accent);
}

.resource-picker__input::placeholder {
  color: var(--text-tertiary);
}

.resource-picker__thumb {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-avatar);
  object-fit: cover;
  flex-shrink: 0;
}
</style>

<style>
.resource-picker__panel {
  z-index: 1000;
  max-height: 320px;
  overflow-y: auto;
  background: var(--bg-elevated);
  border: 1px solid var(--text-tertiary);
  border-radius: var(--radius-card);
}

.resource-picker__status {
  padding: var(--space-md);
  color: var(--text-tertiary);
  font-size: var(--text-caption);
  text-align: center;
}

.resource-picker__option {
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
  text-align: left;
  cursor: pointer;
  transition: background-color 80ms ease;
}

.resource-picker__option--focused,
.resource-picker__option:hover {
  background: var(--bg-overlay);
}

.resource-picker__option-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-picker__option-hint {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  flex-shrink: 0;
}
</style>
