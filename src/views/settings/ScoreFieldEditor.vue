<script setup lang="ts">
import type { ScoreRowField } from '@/types/api/settings'
import { ALL_SCORE_ROW_FIELDS, SCORE_ROW_FIELD_LABELS } from '@/utils/scoreRowFields'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: ScoreRowField[]
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: ScoreRowField[]] }>()

const order = ref<ScoreRowField[]>([])
const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

const visible = computed(() => new Set(props.modelValue))

watch(
  () => props.modelValue,
  (fields) => {
    order.value = [...fields, ...ALL_SCORE_ROW_FIELDS.filter((f) => !fields.includes(f))]
  },
  { immediate: true, deep: true },
)

function commit(next: ScoreRowField[]) {
  order.value = next
  const projected = next.filter((f) => visible.value.has(f))
  if (projected.join() === props.modelValue.join()) return
  emit('update:modelValue', projected)
}

function toggle(field: ScoreRowField) {
  if (props.disabled) return
  const next = new Set(visible.value)
  if (next.has(field)) next.delete(field)
  else next.add(field)
  emit('update:modelValue', order.value.filter((f) => next.has(f)))
}

function move(from: number, to: number) {
  if (props.disabled || to < 0 || to >= order.value.length || from === to) return
  const next = [...order.value]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  commit(next)
}

function onDragStart(index: number) {
  if (props.disabled) return
  dragIndex.value = index
}

function onDragOver(index: number) {
  if (dragIndex.value === null) return
  dragOverIndex.value = index
}

function onDrop(index: number) {
  if (dragIndex.value === null) return
  move(dragIndex.value, index)
  dragIndex.value = null
  dragOverIndex.value = null
}

function onDragEnd() {
  dragIndex.value = null
  dragOverIndex.value = null
}
</script>

<template>
  <ul class="field-editor" role="list">
    <li v-for="(field, index) in order" :key="field" class="field-editor__row" :class="{
      'field-editor__row--hidden': !visible.has(field),
      'field-editor__row--dragging': dragIndex === index,
      'field-editor__row--over': dragOverIndex === index && dragIndex !== index,
    }" :draggable="!disabled" @dragstart="onDragStart(index)" @dragover.prevent="onDragOver(index)"
      @drop.prevent="onDrop(index)" @dragend="onDragEnd">
      <span class="field-editor__handle" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <line x1="4" y1="9" x2="20" y2="9" />
          <line x1="4" y1="15" x2="20" y2="15" />
        </svg>
      </span>

      <span class="field-editor__label">{{ SCORE_ROW_FIELD_LABELS[field] }}</span>

      <span class="field-editor__actions">
        <button type="button" class="field-editor__btn" :disabled="disabled || index === 0"
          :aria-label="`Move ${SCORE_ROW_FIELD_LABELS[field]} up`" @click="move(index, index - 1)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
        <button type="button" class="field-editor__btn" :disabled="disabled || index === order.length - 1"
          :aria-label="`Move ${SCORE_ROW_FIELD_LABELS[field]} down`" @click="move(index, index + 1)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <button type="button" class="field-editor__btn field-editor__btn--toggle"
          :class="{ 'field-editor__btn--on': visible.has(field) }" :disabled="disabled"
          :aria-pressed="visible.has(field)"
          :aria-label="`${visible.has(field) ? 'Hide' : 'Show'} ${SCORE_ROW_FIELD_LABELS[field]}`"
          @click="toggle(field)">
          <svg v-if="visible.has(field)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        </button>
      </span>
    </li>
  </ul>
</template>

<style scoped>
.field-editor {
  display: flex;
  flex-direction: column;
  gap: 2px;
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
}

.field-editor__row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  background: var(--bg-base);
  cursor: grab;
  transition: border-color 120ms ease, background-color 120ms ease, opacity 120ms ease;
}

.field-editor__row--hidden {
  opacity: 0.5;
}

.field-editor__row--dragging {
  cursor: grabbing;
  border-color: var(--page-accent);
}

.field-editor__row--over {
  background: var(--bg-elevated);
  border-color: var(--text-tertiary);
}

.field-editor__handle {
  display: flex;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.field-editor__label {
  flex: 1;
  min-width: 0;
  color: var(--text-primary);
  font-size: var(--text-caption);
}

.field-editor__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.field-editor__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-btn);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease;
}

.field-editor__btn:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--bg-overlay);
}

.field-editor__btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.field-editor__btn--on {
  color: var(--page-accent);
}
</style>
