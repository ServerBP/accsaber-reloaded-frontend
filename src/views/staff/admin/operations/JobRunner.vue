<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import type { JobFieldValue, JobTypeResponse, RunJobRequest } from '@/types/api/jobs'
import { computed, ref, watch } from 'vue'
import JobFieldControl from './JobFieldControl.vue'

const props = defineProps<{
  types: JobTypeResponse[]
  loading: boolean
  runningTypes: string[]
  submitting: boolean
  error: string | null
  notice: string | null
}>()

const emit = defineEmits<{
  submit: [request: RunJobRequest]
}>()

const selectedType = ref<string | null>(null)
const values = ref<Record<string, JobFieldValue>>({})
const armed = ref(false)

const groups = computed(() => {
  const byGroup = new Map<string, JobTypeResponse[]>()
  for (const type of props.types) {
    const bucket = byGroup.get(type.group)
    if (bucket) bucket.push(type)
    else byGroup.set(type.group, [type])
  }
  return [...byGroup.entries()]
})

const selected = computed(() => props.types.find((t) => t.type === selectedType.value) ?? null)

const alreadyRunning = computed(
  () => !!selectedType.value && props.runningTypes.includes(selectedType.value),
)

function isFilled(value: JobFieldValue): boolean {
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'string') return value.trim().length > 0
  return typeof value === 'boolean'
}

const canRun = computed(() => {
  const job = selected.value
  if (!job) return false
  return job.fields.every((field) => !field.required || isFilled(values.value[field.key] ?? null))
})

function humanize(value: string): string {
  const words = value.toLowerCase().split('_').join(' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function select(type: JobTypeResponse) {
  selectedType.value = type.type
}

watch(selected, (job) => {
  armed.value = false
  const next: Record<string, JobFieldValue> = {}
  for (const field of job?.fields ?? []) {
    next[field.key] = field.kind === 'FLAG' ? false : null
  }
  values.value = next
})

watch(
  () => props.submitting,
  (busy) => {
    if (busy) armed.value = false
  },
)

function run() {
  const job = selected.value
  if (!job || !canRun.value || props.submitting) return
  if (alreadyRunning.value && !armed.value) {
    armed.value = true
    return
  }
  armed.value = false
  const request: RunJobRequest = { type: job.type }
  for (const field of job.fields) {
    const value = values.value[field.key] ?? null
    if (isFilled(value)) request[field.key] = value
  }
  emit('submit', request)
}
</script>

<template>
  <section class="runner">
    <div class="runner__catalogue">
      <template v-if="loading && types.length === 0">
        <SkeletonLoader v-for="n in 6" :key="n" variant="text" />
      </template>
      <div v-for="[group, jobs] in groups" :key="group" class="runner__group">
        <h4 class="runner__group-title">{{ humanize(group) }}</h4>
        <button v-for="job in jobs" :key="job.type" type="button" class="runner__job"
          :class="{ 'runner__job--active': job.type === selectedType }" @click="select(job)">
          <span class="runner__job-label">{{ job.label }}</span>
          <span v-if="runningTypes.includes(job.type)" class="runner__job-running">running</span>
        </button>
      </div>
    </div>

    <div class="runner__form">
      <p v-if="!selected" class="runner__placeholder">
        Pick a job on the left to see what it does and what it needs.
      </p>
      <template v-else>
        <div class="runner__head">
          <h3 class="runner__title">{{ selected.label }}</h3>
          <span class="runner__type">{{ selected.type }}</span>
        </div>
        <p class="runner__desc">{{ selected.description }}</p>

        <JobFieldControl v-for="field in selected.fields" :key="field.key" :field="field"
          :model-value="values[field.key] ?? null" :disabled="submitting"
          @update:model-value="values[field.key] = $event" />

        <p v-if="alreadyRunning" class="runner__warning">
          A job of this type is already running. Nothing is queued, so starting it again runs it twice.
        </p>
        <p v-if="error" class="result result--err">{{ error }}</p>
        <p v-else-if="notice" class="result result--ok">{{ notice }}</p>

        <div class="runner__actions">
          <BaseButton :variant="armed ? 'destructive' : 'primary'" :loading="submitting" :disabled="!canRun"
            @click="run">
            {{ armed ? 'Run it anyway' : 'Run job' }}
          </BaseButton>
          <BaseButton v-if="armed" size="sm" @click="armed = false">Cancel</BaseButton>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.runner {
  display: grid;
  grid-template-columns: minmax(0, 260px) minmax(0, 1fr);
  gap: var(--space-lg);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  padding: var(--space-lg);
}

.runner__catalogue {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  max-height: 520px;
  overflow-y: auto;
  padding-right: var(--space-xs);
  border-right: 1px solid var(--bg-overlay);
}

.runner__group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.runner__group-title {
  margin: 0 0 var(--space-xs);
  font-size: var(--text-caption);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
}

.runner__job {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--space-sm);
  border: 1px solid transparent;
  border-radius: var(--radius-input);
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  text-align: left;
  cursor: pointer;
  transition: background-color 100ms ease, color 100ms ease;
}

.runner__job:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.runner__job--active {
  border-color: var(--accent);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.runner__job-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.runner__job-running {
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--info);
  flex-shrink: 0;
}

.runner__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  min-width: 0;
}

.runner__placeholder {
  margin: 0;
  color: var(--text-tertiary);
  font-size: var(--text-caption);
}

.runner__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-md);
}

.runner__title {
  margin: 0;
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--text-primary);
}

.runner__type {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.runner__desc {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-secondary);
  line-height: 1.6;
}

.runner__warning {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--warning);
}

.runner__actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-top: auto;
}

.result {
  margin: 0;
  font-size: var(--text-caption);
  font-family: var(--font-mono);
  overflow-wrap: anywhere;
}

.result--ok {
  color: var(--success);
}

.result--err {
  color: var(--error);
}

@media (max-width: 900px) {
  .runner {
    grid-template-columns: minmax(0, 1fr);
  }

  .runner__catalogue {
    max-height: 240px;
    border-right: none;
    border-bottom: 1px solid var(--bg-overlay);
    padding-bottom: var(--space-md);
  }
}
</style>
