<script setup lang="ts">
import {
  deactivateEvent,
  deleteEventBackground,
  deleteEventIcon,
  getAdminEvent,
  getAdminEventMissions,
  rolloutEventMissions,
  updateEvent,
  uploadEventBackground,
  uploadEventIcon,
} from '@/api/admin/events'
import { getApiErrorMessage } from '@/api/client'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ImageUploader from '@/components/common/ImageUploader.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import { useNow } from '@/composables/useNow'
import type {
  EventBonusItem,
  EventRequest,
  EventResponse,
  MissionTemplateResponse,
} from '@/types/api/events'
import type { ItemResponse } from '@/types/api/items'
import {
  EVENT_TIMING_COLOR,
  EVENT_TIMING_LABEL,
  eventTiming,
  isoToLocalInput,
  localInputToIso,
} from '@/utils/events'
import EventItemPicker from '@/views/staff/admin/events/EventItemPicker.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const now = useNow(30000)

const eventId = computed(() => String(route.params.eventId))

const event = ref<EventResponse | null>(null)
const missions = ref<MissionTemplateResponse[]>([])
const loading = ref(true)
const errorMsg = ref<string | null>(null)

const metaSaving = ref(false)
const statusBusy = ref(false)
const rolloutBusy = ref(false)
const rolloutDone = ref(false)
const bonusBusy = ref(false)
const pickerOpen = ref(false)

const form = ref({
  title: '',
  description: '',
  startsAt: '',
  endsAt: '',
  bonusXp: '',
})

const timing = computed(() => (event.value ? eventTiming(event.value, now.value) : 'upcoming'))

const bonusItems = computed<EventBonusItem[]>(() => event.value?.bonusItems ?? [])
const bonusItemIds = computed(() => bonusItems.value.map((i) => i.id))

function syncForm() {
  if (!event.value) return
  form.value = {
    title: event.value.title,
    description: event.value.description ?? '',
    startsAt: isoToLocalInput(event.value.startsAt),
    endsAt: isoToLocalInput(event.value.endsAt),
    bonusXp: event.value.bonusXp != null ? String(event.value.bonusXp) : '',
  }
}

async function refresh() {
  loading.value = true
  errorMsg.value = null
  try {
    const [detail, missionTemplates] = await Promise.all([
      getAdminEvent(eventId.value),
      getAdminEventMissions(eventId.value),
    ])
    event.value = detail
    missions.value = missionTemplates
    syncForm()
  } catch (e) {
    errorMsg.value = getApiErrorMessage(e, 'Failed to load event')
  } finally {
    loading.value = false
  }
}

onMounted(refresh)
watch(eventId, refresh)

async function saveMetadata() {
  if (!event.value) return
  const startIso = localInputToIso(form.value.startsAt)
  const endIso = localInputToIso(form.value.endsAt)
  if (!form.value.title.trim()) {
    errorMsg.value = 'Title is required.'
    return
  }
  if (!startIso || !endIso) {
    errorMsg.value = 'Start and end dates are required.'
    return
  }
  if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
    errorMsg.value = 'End must be after start.'
    return
  }
  metaSaving.value = true
  errorMsg.value = null
  try {
    const req: EventRequest = {
      title: form.value.title.trim(),
      description: form.value.description.trim(),
      startsAt: startIso,
      endsAt: endIso,
      bonusXp: form.value.bonusXp.trim() ? Math.max(0, Number.parseInt(form.value.bonusXp, 10) || 0) : 0,
    }
    event.value = await updateEvent(eventId.value, req)
    syncForm()
  } catch (e) {
    errorMsg.value = getApiErrorMessage(e, 'Failed to save event')
  } finally {
    metaSaving.value = false
  }
}

async function uploadBackground(file: File) {
  event.value = await uploadEventBackground(eventId.value, file)
}

async function removeBackground() {
  event.value = await deleteEventBackground(eventId.value)
}

async function uploadIcon(file: File) {
  event.value = await uploadEventIcon(eventId.value, file)
}

async function removeIcon() {
  event.value = await deleteEventIcon(eventId.value)
}

async function commitBonusItems(ids: string[]) {
  bonusBusy.value = true
  errorMsg.value = null
  try {
    event.value = await updateEvent(eventId.value, { bonusItemIds: ids })
  } catch (e) {
    errorMsg.value = getApiErrorMessage(e, 'Failed to update bonus items')
  } finally {
    bonusBusy.value = false
  }
}

function onPickItem(item: ItemResponse) {
  if (bonusItemIds.value.includes(item.id)) return
  pickerOpen.value = false
  commitBonusItems([...bonusItemIds.value, item.id])
}

function removeBonusItem(id: string) {
  commitBonusItems(bonusItemIds.value.filter((x) => x !== id))
}

async function toggleActive() {
  if (!event.value) return
  if (event.value.active) {
    if (!confirm('Deactivate this event? It will drop out of public lists.')) return
    statusBusy.value = true
    errorMsg.value = null
    try {
      await deactivateEvent(eventId.value)
      event.value = await getAdminEvent(eventId.value)
      syncForm()
    } catch (e) {
      errorMsg.value = getApiErrorMessage(e, 'Failed to deactivate event')
    } finally {
      statusBusy.value = false
    }
  } else {
    statusBusy.value = true
    errorMsg.value = null
    try {
      event.value = await updateEvent(eventId.value, { active: true })
      syncForm()
    } catch (e) {
      errorMsg.value = getApiErrorMessage(e, 'Failed to reactivate event')
    } finally {
      statusBusy.value = false
    }
  }
}

async function rollout() {
  rolloutBusy.value = true
  rolloutDone.value = false
  errorMsg.value = null
  try {
    await rolloutEventMissions(eventId.value)
    rolloutDone.value = true
  } catch (e) {
    errorMsg.value = getApiErrorMessage(e, 'Failed to roll out missions')
  } finally {
    rolloutBusy.value = false
  }
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function missionWindow(m: MissionTemplateResponse): string {
  const start = m.unlocksAt ? dateFmt.format(new Date(m.unlocksAt)) : 'Event start'
  const end = m.completableUntil ? dateFmt.format(new Date(m.completableUntil)) : 'Event end'
  return `${start} → ${end}`
}

function missionXp(m: MissionTemplateResponse): string {
  return m.fixedXp != null ? `${m.fixedXp.toLocaleString()} XP` : '-'
}
</script>

<template>
  <div class="event-editor">
    <header class="event-editor__header">
      <BaseButton size="sm" @click="router.push({ name: 'admin', query: { tab: 'events' } })">
        &larr; Back to events
      </BaseButton>
      <div class="event-editor__title">{{ event?.title || 'Event editor' }}</div>
      <div class="event-editor__spacer" />
      <div v-if="event" class="event-editor__status-group">
        <span class="event-editor__badge"
          :style="{ color: EVENT_TIMING_COLOR[timing], borderColor: EVENT_TIMING_COLOR[timing] }">
          {{ EVENT_TIMING_LABEL[timing] }}
        </span>
        <span class="event-editor__badge"
          :style="event.active ? { color: 'var(--success)', borderColor: 'var(--success)' } : { color: 'var(--text-tertiary)' }">
          {{ event.active ? 'Active' : 'Inactive' }}
        </span>
        <BaseButton size="sm" :variant="event.active ? 'destructive' : 'primary'" :loading="statusBusy"
          @click="toggleActive">
          {{ event.active ? 'Deactivate' : 'Reactivate' }}
        </BaseButton>
      </div>
    </header>

    <div v-if="errorMsg" class="event-editor__error">{{ errorMsg }}</div>

    <div v-if="event && !event.active" class="event-editor__banner">
      INACTIVE - not visible to players
    </div>

    <section v-if="loading" class="event-editor__loading">
      <SkeletonLoader variant="card" />
      <SkeletonLoader variant="card" />
      <SkeletonLoader variant="card" />
    </section>

    <template v-else-if="event">
      <section class="event-editor__panel">
        <h2 class="event-editor__panel-title">Details</h2>
        <div class="event-editor__grid">
          <BaseInput v-model="form.title" label="Title" />
          <BaseInput v-model="form.bonusXp" type="number" min="0" step="1" label="Completion bonus XP" />
          <BaseInput v-model="form.startsAt" type="datetime-local" label="Starts at" />
          <BaseInput v-model="form.endsAt" type="datetime-local" label="Ends at" />
          <div class="event-editor__field event-editor__field--full">
            <label class="event-editor__label">Description</label>
            <textarea v-model="form.description" class="event-editor__textarea" rows="3"
              placeholder="Short summary shown on the event card" />
          </div>
        </div>
        <div class="event-editor__meta-info">
          <span>Weeks: <span class="mono">{{ event.totalWeeks }}</span></span>
          <span v-if="event.live && event.currentWeek">
            Current week: <span class="mono">{{ event.currentWeek }}</span>
          </span>
        </div>
        <div class="event-editor__panel-actions">
          <BaseButton variant="primary" size="sm" :loading="metaSaving" @click="saveMetadata">
            Save details
          </BaseButton>
        </div>
      </section>

      <section class="event-editor__panel">
        <h2 class="event-editor__panel-title">Images</h2>
        <div class="event-editor__image-row">
          <ImageUploader label="Background" hint="16:9 hero, stored as WEBP" :image-url="event.backgroundUrl ?? null"
            :upload-handler="uploadBackground" :remove-handler="removeBackground" />
          <ImageUploader label="Icon" hint="Square, stored as PNG" aspect-ratio="1 / 1"
            :image-url="event.iconUrl ?? null" :upload-handler="uploadIcon" :remove-handler="removeIcon" />
        </div>
      </section>

      <section class="event-editor__panel">
        <header class="event-editor__panel-header">
          <h2 class="event-editor__panel-title">Completion bonus items</h2>
          <div class="event-editor__totals">
            <span class="mono">{{ bonusItems.length }}</span> selected
          </div>
        </header>
        <p class="event-editor__hint">
          Items granted alongside the bonus XP when a player completes the event.
        </p>
        <div v-if="bonusItems.length" class="event-editor__chips">
          <span v-for="item in bonusItems" :key="item.id" class="event-editor__chip">
            {{ item.name }}
            <button type="button" class="event-editor__chip-remove" :disabled="bonusBusy"
              :aria-label="`Remove ${item.name}`" @click="removeBonusItem(item.id)">
              &times;
            </button>
          </span>
        </div>
        <div v-else class="event-editor__pool-empty">
          <EmptyState message="No bonus items. Add one below." />
        </div>
        <div class="event-editor__panel-actions">
          <BaseButton size="sm" :loading="bonusBusy" @click="pickerOpen = true">+ Add item</BaseButton>
        </div>
      </section>

      <section class="event-editor__panel">
        <header class="event-editor__panel-header">
          <h2 class="event-editor__panel-title">Missions</h2>
          <div class="event-editor__totals">
            <span class="mono">{{ missions.length }}</span> templates
          </div>
        </header>
        <p class="event-editor__hint">
          Authored mission templates for this event. Roll out after unlocking or adding missions to
          create per-player progress.
        </p>

        <div class="event-editor__rollout">
          <BaseButton size="sm" variant="primary" :loading="rolloutBusy" @click="rollout">
            Roll out to players
          </BaseButton>
          <span v-if="rolloutDone" class="event-editor__rollout-done">
            Rollout started. Progress is created in the background.
          </span>
        </div>

        <div v-if="missions.length === 0" class="event-editor__pool-empty">
          <EmptyState message="No mission templates for this event yet." />
        </div>
        <table v-else class="event-editor__table">
          <thead>
            <tr>
              <th>Mission</th>
              <th>Type</th>
              <th>Window</th>
              <th class="right">XP</th>
              <th>Reward</th>
              <th class="right">Repeat</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in missions" :key="m.id">
              <td>
                <div class="event-editor__mission-name">{{ m.name }}</div>
                <div class="event-editor__mission-code">{{ m.code }}</div>
              </td>
              <td class="muted">{{ m.type }}</td>
              <td class="muted mono">{{ missionWindow(m) }}</td>
              <td class="right mono">{{ missionXp(m) }}</td>
              <td class="muted">{{ m.awardsItemName ?? '-' }}</td>
              <td class="right muted">
                {{ m.repeatable ? (m.maxCompletions ? `×${m.maxCompletions}` : 'Yes') : 'No' }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>

    <EventItemPicker v-if="pickerOpen" :exclude-ids="bonusItemIds" @close="pickerOpen = false"
      @pick="onPickItem" />
  </div>
</template>

<style scoped>
.event-editor {
  padding: var(--space-xl);
  max-width: 1080px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.event-editor__header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.event-editor__title {
  font-size: var(--text-page-title);
  font-weight: 700;
  color: var(--text-primary);
}

.event-editor__spacer {
  flex: 1;
}

.event-editor__status-group {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.event-editor__badge {
  padding: 2px var(--space-sm);
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
  border: 1px solid var(--bg-overlay);
  color: var(--text-secondary);
}

.event-editor__banner {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--warning);
  background: color-mix(in srgb, var(--warning) 12%, transparent);
  color: var(--warning);
  border-radius: var(--radius-card);
  font-size: var(--text-caption);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 600;
}

.event-editor__error {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--error);
  background: color-mix(in srgb, var(--error) 12%, transparent);
  color: var(--error);
  border-radius: var(--radius-card);
  font-size: var(--text-body);
}

.event-editor__loading {
  display: grid;
  gap: var(--space-md);
}

.event-editor__panel {
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.event-editor__panel-title {
  margin: 0;
  font-size: var(--text-section-heading);
  font-weight: 600;
  color: var(--text-primary);
}

.event-editor__panel-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.event-editor__totals {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.mono {
  font-family: var(--font-mono);
}

.event-editor__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-md);
}

.event-editor__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.event-editor__field--full {
  grid-column: 1 / -1;
}

.event-editor__label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.event-editor__textarea {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  line-height: 1.5;
  resize: vertical;
  outline: none;
  transition: border-color 120ms ease-in, box-shadow 120ms ease-in;
}

.event-editor__textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent);
}

.event-editor__meta-info {
  display: flex;
  gap: var(--space-lg);
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.event-editor__panel-actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 720px) {
  .event-editor__grid {
    grid-template-columns: 1fr;
  }
}

.event-editor__image-row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: var(--space-lg);
}

@media (max-width: 720px) {
  .event-editor__image-row {
    grid-template-columns: 1fr;
  }
}

.event-editor__hint {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.event-editor__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.event-editor__chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 4px 6px 4px 10px;
  font-size: var(--text-caption);
  color: var(--text-primary);
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-pill);
}

.event-editor__chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  border-radius: var(--radius-btn);
  transition: color 100ms ease, background-color 100ms ease;
}

.event-editor__chip-remove:hover:not(:disabled) {
  color: var(--error);
  background: color-mix(in srgb, var(--error) 10%, transparent);
}

.event-editor__chip-remove:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.event-editor__pool-empty {
  padding: var(--space-md);
  color: var(--text-tertiary);
  text-align: center;
}

.event-editor__rollout {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.event-editor__rollout-done {
  font-size: var(--text-caption);
  color: var(--success);
}

.event-editor__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-body);
}

.event-editor__table th {
  text-align: left;
  font-size: var(--text-caption);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--bg-overlay);
}

.event-editor__table th.right,
.event-editor__table td.right {
  text-align: right;
}

.event-editor__table td {
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--bg-overlay);
  vertical-align: middle;
}

.event-editor__table td.muted {
  color: var(--text-secondary);
}

.event-editor__table td.mono {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
}

.event-editor__table tr:last-child td {
  border-bottom: none;
}

.event-editor__mission-name {
  font-weight: 500;
  color: var(--text-primary);
}

.event-editor__mission-code {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  font-family: var(--font-mono);
}
</style>
