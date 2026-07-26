<script setup lang="ts">
import BaseSelect from '@/components/common/BaseSelect.vue'
import { PLUGIN_ZERO_BOUND_NOTE } from '@/utils/campaignPlugin'
import CampaignBoundsField from './CampaignBoundsField.vue'
import CampaignFieldHint from './CampaignFieldHint.vue'
import type { CampaignTargetRow } from './useCampaignEditor'

const props = defineProps<{
  row: CampaignTargetRow
  typeOptions: Array<{ value: string; label: string }>
  multi: boolean
  disabled: boolean
}>()

const emit = defineEmits<{
  type: [value: string]
  'update:lower': [value: number | null]
  'update:upper': [value: number | null]
  commit: []
  remove: []
  move: [delta: number]
  grab: []
  enter: []
  drop: []
}>()

function onDragStart(event: DragEvent) {
  event.dataTransfer?.setData('text/plain', String(props.row.index))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  emit('grab')
}
</script>

<template>
  <li
    class="target-row"
    :class="{ 'target-row--flagged': row.unreadable || row.invalid }"
    @dragover.prevent
    @dragenter.prevent="emit('enter')"
    @drop.prevent="emit('drop')"
  >
    <div class="target-row__head">
      <button
        v-if="multi"
        type="button"
        class="target-row__handle"
        :draggable="!disabled"
        :disabled="disabled"
        :aria-label="`Objective ${row.index + 1}. Use arrow up and down to reorder.`"
        @dragstart="onDragStart"
        @dragend="emit('drop')"
        @keydown.up.prevent="emit('move', -1)"
        @keydown.down.prevent="emit('move', 1)"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="9" cy="5" r="1.7" />
          <circle cx="15" cy="5" r="1.7" />
          <circle cx="9" cy="12" r="1.7" />
          <circle cx="15" cy="12" r="1.7" />
          <circle cx="9" cy="19" r="1.7" />
          <circle cx="15" cy="19" r="1.7" />
        </svg>
        <span class="target-row__ordinal">{{ row.index + 1 }}</span>
      </button>

      <BaseSelect
        class="target-row__type"
        :model-value="row.requirementType"
        :options="typeOptions"
        @update:model-value="emit('type', $event)"
      />

      <CampaignFieldHint :text="row.hint" />

      <button
        v-if="multi"
        type="button"
        class="target-row__remove"
        :disabled="disabled"
        aria-label="Remove this objective"
        @click="emit('remove')"
      >
        <svg
          width="12"
          height="12"
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
    </div>

    <CampaignBoundsField
      v-if="row.hasBounds"
      :lower="row.lower"
      :upper="row.upper"
      :min="row.bounds.min"
      :max="row.bounds.max"
      :step="row.bounds.step"
      :number-min="row.numberBounds.min"
      :number-max="row.numberBounds.max"
      :unit="row.bounds.unit"
      :disabled="disabled"
      @update:lower="emit('update:lower', $event)"
      @update:upper="emit('update:upper', $event)"
      @commit="emit('commit')"
    />

    <p v-if="row.equivalents.length" class="target-row__equiv">
      <span class="target-row__equiv-approx" aria-hidden="true">≈</span>
      <template v-for="(e, i) in row.equivalents" :key="e.key">
        <span v-if="i > 0" class="target-row__equiv-sep" aria-hidden="true">·</span>
        <span>{{ e.text }}</span>
      </template>
    </p>

    <p v-if="row.invalid" class="target-row__invalid" role="alert">
      This objective needs at least one bound, and the lower bound cannot exceed the upper one. It
      will not save until you fix it.
    </p>
    <p v-else-if="row.zeroBound" class="target-row__soft">{{ PLUGIN_ZERO_BOUND_NOTE }}</p>
  </li>
</template>

<style scoped>
.target-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-sm);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
}

.target-row--flagged {
  border-color: color-mix(in srgb, var(--error) 45%, transparent);
}

.target-row__head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.target-row__type {
  flex: 1;
  min-width: 0;
}

.target-row__handle {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  padding: 5px 6px;
  color: var(--text-tertiary);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 2px;
  cursor: grab;
  transition:
    color 120ms ease,
    border-color 120ms ease;
}

.target-row__handle:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--bg-overlay);
}

.target-row__handle:active:not(:disabled) {
  cursor: grabbing;
}

.target-row__handle:focus-visible {
  outline: 2px solid var(--page-accent);
  outline-offset: 1px;
}

.target-row__ordinal {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 600;
}

.target-row__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  padding: 0;
  color: var(--text-tertiary);
  background: transparent;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  transition:
    color 120ms ease,
    background 120ms ease;
}

.target-row__remove:hover:not(:disabled) {
  color: var(--error);
  background: color-mix(in srgb, var(--error) 12%, transparent);
}

.target-row__equiv {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px;
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--text-secondary);
}

.target-row__equiv-approx,
.target-row__equiv-sep {
  color: var(--text-tertiary);
}

.target-row__soft {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  line-height: 1.4;
}

.target-row__invalid {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--error);
  line-height: 1.4;
}
</style>
