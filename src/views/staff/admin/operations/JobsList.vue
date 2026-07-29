<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import type { JobResponse } from '@/types/api/jobs'
import { formatRelativeDate } from '@/utils/formatters'

const props = defineProps<{
  jobs: JobResponse[]
  labels: Record<string, string>
  loading: boolean
  error: string | null
}>()

defineEmits<{
  refresh: []
}>()

function label(job: JobResponse): string {
  return props.labels[job.type] ?? job.type
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function duration(job: JobResponse): string {
  const end = job.finishedAt ? Date.parse(job.finishedAt) : Date.now()
  const seconds = Math.max(0, Math.round((end - Date.parse(job.startedAt)) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
</script>

<template>
  <section class="jobs">
    <div class="jobs__header">
      <div class="jobs__heading">
        <h3 class="jobs__title">Jobs</h3>
        <p class="jobs__note">
          Held in memory, not in the database. A backend restart clears this list and kills whatever
          was running.
        </p>
      </div>
      <BaseButton size="sm" :loading="loading" @click="$emit('refresh')">Refresh</BaseButton>
    </div>

    <p v-if="error" class="jobs__error">{{ error }}</p>
    <p v-else-if="jobs.length === 0" class="jobs__empty">No jobs have run since the last restart.</p>
    <ul v-else class="jobs__list">
      <li v-for="job in jobs" :key="job.id" class="job" :class="`job--${job.status.toLowerCase()}`">
        <span class="job__label">{{ label(job) }}</span>
        <span class="job__status">{{ job.status }}</span>
        <span class="job__detail">{{ job.detail || '-' }}</span>
        <span class="job__times">
          {{ clockTime(job.startedAt) }} &middot; {{ duration(job) }}
          <template v-if="!job.finishedAt"> &middot; {{ formatRelativeDate(job.startedAt) }}</template>
        </span>
        <span v-if="job.error" class="job__error">{{ job.error }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.jobs {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.jobs__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
}

.jobs__heading {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.jobs__title {
  margin: 0;
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--text-primary);
}

.jobs__note,
.jobs__empty {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.jobs__error {
  margin: 0;
  font-size: var(--text-caption);
  font-family: var(--font-mono);
  color: var(--error);
}

.jobs__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.job {
  display: grid;
  grid-template-columns: minmax(0, 2fr) 92px minmax(0, 3fr) minmax(0, 140px);
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  font-size: var(--text-caption);
}

.job--running {
  border-color: color-mix(in srgb, var(--info) 35%, var(--bg-overlay));
}

.job--failed {
  border-color: color-mix(in srgb, var(--error) 35%, var(--bg-overlay));
}

.job__label {
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.job__status {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--text-secondary);
}

.job--running .job__status {
  color: var(--info);
}

.job--succeeded .job__status {
  color: var(--success);
}

.job--failed .job__status {
  color: var(--error);
}

.job__detail {
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.job__times {
  font-family: var(--font-mono);
  color: var(--text-tertiary);
  text-align: right;
}

.job__error {
  grid-column: 1 / -1;
  color: var(--error);
  font-family: var(--font-mono);
  overflow-wrap: anywhere;
}

@media (max-width: 768px) {
  .job {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .job__detail,
  .job__times {
    grid-column: 1 / -1;
    text-align: left;
  }
}
</style>
