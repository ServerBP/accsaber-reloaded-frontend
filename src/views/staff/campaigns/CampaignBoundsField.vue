<script setup lang="ts">
import { computed } from 'vue'

type BoundKey = 'lower' | 'upper'

const props = withDefaults(
  defineProps<{
    lower: number | null
    upper: number | null
    min: number
    max: number
    step: number
    numberMin?: number
    numberMax?: number
    unit?: string
    singleLabel?: string
    disabled?: boolean
  }>(),
  {
    unit: '',
    singleLabel: 'Target',
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:lower': [value: number | null]
  'update:upper': [value: number | null]
  commit: []
}>()

const isRange = computed(() => props.lower != null && props.upper != null)

const inputMin = computed(() => props.numberMin ?? props.min)
const inputMax = computed(() => props.numberMax ?? props.max)

const stackedAtCeiling = computed(
  () => props.lower != null && props.lower === props.upper && props.upper >= props.max,
)

const bounds = computed(() =>
  (['lower', 'upper'] as BoundKey[]).map((key) => ({
    key,
    value: key === 'lower' ? props.lower : props.upper,
    label:
      key === 'upper' ? 'At most' : isRange.value ? 'At least' : props.singleLabel,
    addLabel: key === 'upper' ? 'Add upper bound' : 'Add lower bound',
    front: key === 'lower' && stackedAtCeiling.value,
  })),
)

function ratio(value: number): number {
  const span = props.max - props.min
  if (span <= 0) return 0
  return Math.min(100, Math.max(0, ((value - props.min) / span) * 100))
}

const fillStyle = computed(() => {
  const from = props.lower != null && props.upper != null ? ratio(props.lower) : 0
  const to = ratio(props.upper ?? props.lower ?? props.min)
  return { left: `${from}%`, right: `${100 - to}%` }
})

function clamp(key: BoundKey, value: number): number {
  const floor = key === 'upper' && props.lower != null ? props.lower : inputMin.value
  const ceiling = key === 'lower' && props.upper != null ? props.upper : inputMax.value
  return Math.min(Math.max(value, floor), ceiling)
}

function setBound(key: BoundKey, value: number | null) {
  if (key === 'lower') emit('update:lower', value)
  else emit('update:upper', value)
}

function onInput(key: BoundKey, raw: string) {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return
  setBound(key, clamp(key, parsed))
}

function onNumberChange(key: BoundKey, event: Event) {
  onInput(key, (event.target as HTMLInputElement).value)
  emit('commit')
}

function addBound(key: BoundKey) {
  setBound(key, key === 'upper' ? clamp(key, props.max) : clamp(key, props.min))
  emit('commit')
}

function removeBound(key: BoundKey) {
  setBound(key, null)
  emit('commit')
}
</script>

<template>
  <div class="bounds">
    <div class="bounds__track">
      <span class="bounds__fill" :style="fillStyle" aria-hidden="true" />
      <input
        v-for="b in bounds"
        v-show="b.value != null"
        :key="b.key"
        class="bounds__thumb"
        :class="{ 'bounds__thumb--front': b.front }"
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :value="b.value ?? min"
        :aria-label="b.label"
        :disabled="disabled"
        @input="onInput(b.key, ($event.target as HTMLInputElement).value)"
        @change="emit('commit')"
      />
    </div>

    <div class="bounds__fields">
      <template v-for="b in bounds" :key="b.key">
        <label v-if="b.value != null" class="bounds__field">
          <span class="bounds__label">
            {{ b.label }}
            <small v-if="unit">({{ unit }})</small>
          </span>
          <span class="bounds__entry">
            <input
              type="number"
              :min="inputMin"
              :max="inputMax"
              :step="step"
              :value="b.value"
              :disabled="disabled"
              @change="onNumberChange(b.key, $event)"
            />
            <button
              v-if="isRange"
              type="button"
              class="bounds__drop"
              :disabled="disabled"
              :aria-label="`Remove ${b.label} bound`"
              :title="`Remove the ${b.label.toLowerCase()} bound`"
              @click="removeBound(b.key)"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </span>
        </label>
        <button
          v-else
          type="button"
          class="bounds__add"
          :disabled="disabled"
          @click="addBound(b.key)"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {{ b.addLabel }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.bounds {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bounds__track {
  position: relative;
  height: 18px;
}

.bounds__track::before {
  content: '';
  position: absolute;
  inset: 8px 0 auto;
  height: 2px;
  background: var(--bg-overlay);
  border-radius: 1px;
}

.bounds__fill {
  position: absolute;
  top: 8px;
  height: 2px;
  background: var(--page-accent);
  border-radius: 1px;
}

.bounds__thumb {
  position: absolute;
  inset: 0;
  width: 100%;
  margin: 0;
  padding: 0;
  background: none;
  border: none;
  appearance: none;
  pointer-events: none;
}

.bounds__thumb--front {
  z-index: 1;
}

.bounds__thumb:focus-visible {
  outline: none;
}

.bounds__thumb::-webkit-slider-runnable-track {
  height: 2px;
  background: transparent;
  border: none;
}

.bounds__thumb::-moz-range-track {
  height: 2px;
  background: transparent;
  border: none;
}

.bounds__thumb::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 2px;
  background: var(--bg-base);
  border: 2px solid var(--page-accent);
  cursor: grab;
  pointer-events: auto;
}

.bounds__thumb::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 2px;
  background: var(--bg-base);
  border: 2px solid var(--page-accent);
  cursor: grab;
  pointer-events: auto;
}

.bounds__thumb:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--page-accent) 35%, transparent);
}

.bounds__thumb:focus-visible::-moz-range-thumb {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--page-accent) 35%, transparent);
}

.bounds__fields {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.bounds__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1 1 110px;
}

.bounds__label {
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.bounds__label small {
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  margin-left: 4px;
}

.bounds__entry {
  display: flex;
  align-items: center;
  gap: 4px;
}

.bounds__entry input {
  width: 100%;
  min-width: 0;
  padding: 8px 10px;
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-primary);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  outline: none;
  transition: border-color 120ms ease;
}

.bounds__entry input:focus {
  border-color: var(--page-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--page-accent) 20%, transparent);
}

.bounds__drop {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 2px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition:
    color 120ms ease,
    background 120ms ease;
}

.bounds__drop:hover:not(:disabled) {
  color: var(--error);
  background: color-mix(in srgb, var(--error) 12%, transparent);
}

.bounds__drop:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.bounds__add {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 8px 10px;
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
  background: transparent;
  border: 1px dashed var(--bg-overlay);
  border-radius: 3px;
  cursor: pointer;
  transition:
    color 120ms ease,
    border-color 120ms ease;
}

.bounds__add:hover:not(:disabled) {
  color: var(--page-accent);
  border-color: var(--page-accent);
}

.bounds__add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
