<script setup lang="ts">
import BaseInput from '@/components/common/BaseInput.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import ResourcePicker from '@/components/domain/ResourcePicker.vue'
import type { JobFieldKind, JobFieldResponse, JobFieldValue } from '@/types/api/jobs'
import { computed } from 'vue'
import { LEADERBOARD_PLATFORMS, RESOURCE_SOURCES } from './resourceSources'

type ControlKind = 'resource' | 'instant' | 'platform' | 'flag'

const CONTROL_BY_KIND: Record<JobFieldKind, ControlKind> = {
  USER: 'resource',
  CAMPAIGN: 'resource',
  MAP_DIFFICULTY: 'resource',
  MILESTONE: 'resource',
  INSTANT: 'instant',
  PLATFORM: 'platform',
  FLAG: 'flag',
}

const props = defineProps<{
  field: JobFieldResponse
  modelValue: JobFieldValue
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: JobFieldValue]
}>()

const source = computed(() => RESOURCE_SOURCES[props.field.kind] ?? null)

const control = computed<ControlKind | null>(() => {
  const resolved = CONTROL_BY_KIND[props.field.kind]
  if (!resolved) return null
  if (resolved === 'resource' && !source.value) return null
  return resolved
})

const resourceValue = computed<string | string[] | null>(() => {
  if (Array.isArray(props.modelValue)) return props.modelValue
  return typeof props.modelValue === 'string' ? props.modelValue : null
})

const instantValue = computed(() => {
  if (typeof props.modelValue !== 'string' || !props.modelValue) return ''
  const parsed = new Date(props.modelValue)
  if (Number.isNaN(parsed.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
})

const platformValue = computed(() =>
  typeof props.modelValue === 'string' ? props.modelValue : '',
)

const platformOptions = computed(() => {
  const options = LEADERBOARD_PLATFORMS.map((platform) => ({ value: platform, label: platform }))
  return props.field.required ? options : [{ value: '', label: 'Any' }, ...options]
})

function onInstantInput(value: string | number) {
  const text = String(value)
  if (!text) {
    emit('update:modelValue', null)
    return
  }
  const parsed = new Date(text)
  emit('update:modelValue', Number.isNaN(parsed.getTime()) ? null : parsed.toISOString())
}

function onPlatformInput(value: string) {
  emit('update:modelValue', value || null)
}

function onFlagInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).checked)
}
</script>

<template>
  <div class="job-field">
    <label class="job-field__label">
      {{ field.label }}
      <span v-if="field.required" class="job-field__required">required</span>
    </label>

    <ResourcePicker v-if="control === 'resource' && source" :model-value="resourceValue" :search="source.search"
      :resolve="source.resolve" :multiple="field.multiple" :placeholder="source.placeholder" :disabled="disabled"
      @update:model-value="emit('update:modelValue', $event)" />

    <BaseInput v-else-if="control === 'instant'" :model-value="instantValue" type="datetime-local"
      :disabled="disabled" @update:model-value="onInstantInput" />

    <BaseSelect v-else-if="control === 'platform'" :model-value="platformValue" :options="platformOptions"
      @update:model-value="onPlatformInput" />

    <label v-else-if="control === 'flag'" class="job-field__flag">
      <input type="checkbox" :checked="modelValue === true" :disabled="disabled" @change="onFlagInput" />
      <span>{{ field.description ?? 'Enabled' }}</span>
    </label>

    <p v-else class="job-field__unsupported">
      This build cannot render a "{{ field.kind }}" input, so {{ field.key }} has to be left empty.
    </p>

    <p v-if="field.description && control !== 'flag'" class="job-field__desc">{{ field.description }}</p>
  </div>
</template>

<style scoped>
.job-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.job-field__label {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.job-field__required {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--warning);
  text-transform: uppercase;
}

.job-field__flag {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--text-body);
  color: var(--text-primary);
  cursor: pointer;
}

.job-field__desc {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  line-height: 1.5;
}

.job-field__unsupported {
  margin: 0;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid color-mix(in srgb, var(--warning) 30%, var(--bg-overlay));
  border-radius: var(--radius-input);
  font-size: var(--text-caption);
  color: var(--warning);
}
</style>
