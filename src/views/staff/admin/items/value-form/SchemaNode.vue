<script setup lang="ts">
import BaseInput from '@/components/common/BaseInput.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import { computed, ref } from 'vue'
import {
  defaultForSchema,
  detectUnion,
  humanizeKey,
  isColorProp,
  isObject,
  isStringMap,
  isUnitRange,
  objectEntries,
  schemaType,
  variantEntries,
  type JsonSchema,
  type SchemaEntry,
} from './schemaUtils'

defineOptions({ name: 'SchemaNode' })

const props = defineProps<{
  schema: JsonSchema
  modelValue: unknown
  fieldKey?: string
  required?: boolean
  depth?: number
}>()

const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

const depth = computed(() => props.depth ?? 0)

const union = computed(() => detectUnion(props.schema))

const kind = computed(() => {
  if (Array.isArray(props.schema.enum)) return 'enum'
  if (union.value) return 'union'
  const t = schemaType(props.schema)
  if (t === 'boolean') return 'boolean'
  if (t === 'integer' || t === 'number') return 'number'
  if (t === 'array') return 'array'
  if (t === 'object') return isStringMap(props.schema) ? 'map' : 'object'
  if (t === 'string') return isColorProp(props.fieldKey) ? 'color' : 'string'
  if (props.schema.properties) return 'object'
  return 'string'
})

const multiline = computed(
  () => props.fieldKey === 'd' || props.fieldKey === 'svg' || props.fieldKey === 'avatarMask',
)

const enumOptions = computed(() => {
  const opts = (props.schema.enum ?? []).map((v) => ({ value: String(v), label: String(v) }))
  if (!props.required) return [{ value: '', label: '- none -' }, ...opts]
  return opts
})

const activeConst = computed(() =>
  union.value && isObject(props.modelValue)
    ? String((props.modelValue as Record<string, unknown>)[union.value.discriminator] ?? '')
    : '',
)

const variantOptions = computed(() =>
  union.value ? union.value.variants.map((v) => ({ value: v.const, label: humanizeKey(v.const) })) : [],
)

const entries = computed<SchemaEntry[]>(() => {
  if (kind.value === 'object') return objectEntries(props.schema)
  if (kind.value === 'union' && union.value && activeConst.value) {
    return variantEntries(union.value, activeConst.value)
  }
  return []
})

const objectModel = computed<Record<string, unknown>>(() =>
  isObject(props.modelValue) ? (props.modelValue as Record<string, unknown>) : {},
)

function setChild(key: string, value: unknown) {
  const next = { ...objectModel.value }
  if (value === undefined) delete next[key]
  else next[key] = value
  emit('update:modelValue', next)
}

function setVariant(constValue: string) {
  if (!union.value) return
  emit('update:modelValue', { [union.value.discriminator]: constValue })
}

const arrayModel = computed<unknown[]>(() =>
  Array.isArray(props.modelValue) ? (props.modelValue as unknown[]) : [],
)

function addItem() {
  const items = props.schema.items as JsonSchema | undefined
  emit('update:modelValue', [...arrayModel.value, items ? defaultForSchema(items) : undefined])
}

function updateItem(index: number, value: unknown) {
  const next = [...arrayModel.value]
  next[index] = value
  emit('update:modelValue', next)
}

function removeItem(index: number) {
  const next = [...arrayModel.value]
  next.splice(index, 1)
  emit('update:modelValue', next)
}

function setBoolean(checked: boolean) {
  emit('update:modelValue', checked)
}

function setString(value: string) {
  emit('update:modelValue', value === '' ? undefined : value)
}

function setNumber(raw: string) {
  if (raw.trim() === '') {
    emit('update:modelValue', undefined)
    return
  }
  const n = Number(raw)
  emit('update:modelValue', Number.isFinite(n) ? n : undefined)
}

function setEnum(value: string) {
  emit('update:modelValue', value === '' ? undefined : value)
}

const colorSwatch = computed(() => {
  const v = props.modelValue
  return typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : '#000000'
})

interface MapRow {
  id: number
  key: string
  value: string
}
let rowSeq = 0
function initMapRows(): MapRow[] {
  const src = isObject(props.modelValue) ? (props.modelValue as Record<string, unknown>) : {}
  return Object.entries(src).map(([key, value]) => ({ id: rowSeq++, key, value: String(value ?? '') }))
}
const mapRowsState = ref<MapRow[]>(initMapRows())

function emitMap() {
  const obj: Record<string, string> = {}
  for (const row of mapRowsState.value) {
    if (row.key.trim()) obj[row.key.trim()] = row.value
  }
  emit('update:modelValue', obj)
}

function addRow() {
  mapRowsState.value = [...mapRowsState.value, { id: rowSeq++, key: '', value: '#000000' }]
}

function removeRow(id: number) {
  mapRowsState.value = mapRowsState.value.filter((r) => r.id !== id)
  emitMap()
}

function updateRowKey(id: number, key: string) {
  mapRowsState.value = mapRowsState.value.map((r) => (r.id === id ? { ...r, key } : r))
  emitMap()
}

function updateRowValue(id: number, value: string) {
  mapRowsState.value = mapRowsState.value.map((r) => (r.id === id ? { ...r, value } : r))
  emitMap()
}

const label = computed(() => (props.fieldKey ? humanizeKey(props.fieldKey) : ''))
</script>

<template>
  <label v-if="kind === 'boolean'" class="schema-node__check">
    <input
      type="checkbox"
      :checked="modelValue === true"
      @change="setBoolean(($event.target as HTMLInputElement).checked)"
    />
    <span>{{ label }}<span v-if="schema.description" class="schema-node__desc"> - {{ schema.description }}</span></span>
  </label>

  <div v-else-if="kind === 'enum'" class="schema-node__field">
    <BaseSelect
      :model-value="typeof modelValue === 'string' ? modelValue : ''"
      :options="enumOptions"
      :label="label + (required ? ' *' : '')"
      @update:model-value="setEnum"
    />
  </div>

  <div v-else-if="kind === 'color'" class="schema-node__field">
    <label class="schema-node__label">{{ label }}<span v-if="required"> *</span></label>
    <div class="schema-node__color-row">
      <input
        type="color"
        :value="colorSwatch"
        class="schema-node__color"
        @input="setString(($event.target as HTMLInputElement).value)"
      />
      <input
        type="text"
        class="schema-node__color-text"
        placeholder="#rrggbb"
        :value="typeof modelValue === 'string' ? modelValue : ''"
        @input="setString(($event.target as HTMLInputElement).value)"
      />
    </div>
  </div>

  <div v-else-if="kind === 'number'" class="schema-node__field">
    <label class="schema-node__label">
      {{ label }}<span v-if="required"> *</span>
      <span v-if="isUnitRange(schema)" class="schema-node__readout">{{
        typeof modelValue === 'number' ? modelValue : '-'
      }}</span>
    </label>
    <input
      v-if="isUnitRange(schema)"
      type="range"
      min="0"
      max="1"
      step="0.01"
      class="schema-node__range"
      :value="typeof modelValue === 'number' ? modelValue : 0"
      @input="setNumber(($event.target as HTMLInputElement).value)"
    />
    <input
      v-else
      type="number"
      class="schema-node__input"
      :min="schema.minimum"
      :max="schema.maximum"
      :step="schemaType(schema) === 'integer' ? 1 : 'any'"
      :value="typeof modelValue === 'number' ? modelValue : ''"
      @input="setNumber(($event.target as HTMLInputElement).value)"
    />
  </div>

  <div v-else-if="kind === 'string'" class="schema-node__field">
    <template v-if="multiline">
      <label class="schema-node__label">{{ label }}<span v-if="required"> *</span></label>
      <textarea
        class="schema-node__textarea"
        rows="2"
        spellcheck="false"
        :value="typeof modelValue === 'string' ? modelValue : ''"
        @input="setString(($event.target as HTMLTextAreaElement).value)"
      />
    </template>
    <BaseInput
      v-else
      :model-value="typeof modelValue === 'string' ? modelValue : ''"
      :label="label + (required ? ' *' : '')"
      @update:model-value="(v) => setString(String(v))"
    />
  </div>

  <fieldset v-else-if="kind === 'map'" class="schema-node__group">
    <legend class="schema-node__legend">{{ label }}<span v-if="required"> *</span></legend>
    <p class="schema-node__map-note">
      This is the one place you enter keys directly (e.g. a CSS variable like
      <code>--accent</code>). The value is a colour.
    </p>
    <div v-for="row in mapRowsState" :key="row.id" class="schema-node__map-row">
      <input
        type="text"
        class="schema-node__map-key"
        placeholder="--token"
        :value="row.key"
        @input="updateRowKey(row.id, ($event.target as HTMLInputElement).value)"
      />
      <input
        type="color"
        class="schema-node__color"
        :value="/^#[0-9a-fA-F]{3,8}$/.test(row.value) ? row.value : '#000000'"
        @input="updateRowValue(row.id, ($event.target as HTMLInputElement).value)"
      />
      <input
        type="text"
        class="schema-node__map-val"
        :value="row.value"
        @input="updateRowValue(row.id, ($event.target as HTMLInputElement).value)"
      />
      <button type="button" class="schema-node__icon-btn" aria-label="Remove" @click="removeRow(row.id)">
        ×
      </button>
    </div>
    <button type="button" class="schema-node__add" @click="addRow">+ Add token</button>
  </fieldset>

  <fieldset v-else-if="kind === 'array'" class="schema-node__group">
    <legend class="schema-node__legend">
      {{ label }}<span v-if="required"> *</span>
      <span v-if="schema.minItems" class="schema-node__hint">(min {{ schema.minItems }})</span>
    </legend>
    <div
      v-for="(item, index) in arrayModel"
      :key="index"
      class="schema-node__array-item"
    >
      <div class="schema-node__array-head">
        <span class="schema-node__array-index">#{{ index + 1 }}</span>
        <button type="button" class="schema-node__icon-btn" aria-label="Remove" @click="removeItem(index)">
          ×
        </button>
      </div>
      <SchemaNode
        :schema="(schema.items as JsonSchema)"
        :model-value="item"
        :depth="depth + 1"
        @update:model-value="(v) => updateItem(index, v)"
      />
    </div>
    <button type="button" class="schema-node__add" @click="addItem">+ Add item</button>
  </fieldset>

  <fieldset v-else-if="kind === 'union'" class="schema-node__group">
    <legend v-if="label" class="schema-node__legend">{{ label }}<span v-if="required"> *</span></legend>
    <BaseSelect
      :model-value="activeConst"
      :options="variantOptions"
      :label="union ? humanizeKey(union.discriminator) : 'Variant'"
      @update:model-value="setVariant"
    />
    <div v-if="activeConst" class="schema-node__nested">
      <SchemaNode
        v-for="entry in entries"
        :key="entry.key"
        :schema="entry.schema"
        :field-key="entry.key"
        :required="entry.required"
        :model-value="objectModel[entry.key]"
        :depth="depth + 1"
        @update:model-value="(v) => setChild(entry.key, v)"
      />
    </div>
  </fieldset>

  <fieldset v-else-if="kind === 'object'" class="schema-node__group" :class="{ 'schema-node__group--root': depth === 0 }">
    <legend v-if="label" class="schema-node__legend">{{ label }}<span v-if="required"> *</span></legend>
    <SchemaNode
      v-for="entry in entries"
      :key="entry.key"
      :schema="entry.schema"
      :field-key="entry.key"
      :required="entry.required"
      :model-value="objectModel[entry.key]"
      :depth="depth + 1"
      @update:model-value="(v) => setChild(entry.key, v)"
    />
  </fieldset>
</template>

<style scoped>
.schema-node__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.schema-node__label {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.schema-node__readout {
  font-family: var(--font-mono);
  text-transform: none;
  color: var(--text-tertiary);
}

.schema-node__check {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-body);
  color: var(--text-primary);
  cursor: pointer;
}

.schema-node__desc {
  color: var(--text-tertiary);
  font-size: var(--text-caption);
}

.schema-node__input,
.schema-node__textarea,
.schema-node__color-text,
.schema-node__map-key,
.schema-node__map-val {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  outline: none;
}

.schema-node__input:focus,
.schema-node__textarea:focus,
.schema-node__color-text:focus,
.schema-node__map-key:focus,
.schema-node__map-val:focus {
  border-color: var(--accent);
}

.schema-node__textarea {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  resize: vertical;
}

.schema-node__color-row {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.schema-node__color {
  width: 44px;
  height: 36px;
  padding: 2px;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  background: var(--bg-base);
  cursor: pointer;
  flex-shrink: 0;
}

.schema-node__range {
  width: 100%;
  accent-color: var(--accent);
}

.schema-node__group {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  padding: var(--space-md);
  margin: 0;
  min-width: 0;
}

.schema-node__group--root {
  border: none;
  padding: 0;
}

.schema-node__legend {
  padding: 0 var(--space-xs);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
}

.schema-node__hint {
  margin-left: var(--space-xs);
  color: var(--text-tertiary);
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
}

.schema-node__nested {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.schema-node__array-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  padding: var(--space-md);
  background: var(--bg-base);
}

.schema-node__array-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.schema-node__array-index {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.schema-node__map-note {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.schema-node__map-note code {
  font-family: var(--font-mono);
  color: var(--text-secondary);
}

.schema-node__map-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px minmax(0, 1fr) auto;
  gap: var(--space-sm);
  align-items: center;
}

.schema-node__add {
  align-self: flex-start;
  padding: var(--space-xs) var(--space-md);
  border: 1px dashed var(--bg-overlay);
  border-radius: var(--radius-btn);
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease;
}

.schema-node__add:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.schema-node__icon-btn {
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  padding: 2px var(--space-xs);
  border-radius: var(--radius-btn);
  transition: color 120ms ease, background-color 120ms ease;
}

.schema-node__icon-btn:hover {
  color: var(--error);
  background: color-mix(in srgb, var(--error) 10%, transparent);
}
</style>
