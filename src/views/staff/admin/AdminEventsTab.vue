<script setup lang="ts">
import { getApiErrorMessage } from '@/api/client'
import AdminTable from '@/components/admin/AdminTable.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import { useNow } from '@/composables/useNow'
import type { EventResponse } from '@/types/api/events'
import { EVENT_TIMING_COLOR, EVENT_TIMING_LABEL, eventTiming, type EventTiming } from '@/utils/events'
import EventCreateModal from '@/views/staff/admin/events/EventCreateModal.vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const now = useNow(30000)

const events = ref<EventResponse[]>([])
const loading = ref(false)
const errorMessage = ref('')
const showCreate = ref(false)
const actionLoading = ref<Record<string, boolean>>({})

const timingFilter = ref<EventTiming | ''>('')
const activeFilter = ref<'active' | 'inactive' | ''>('')

const TIMING_OPTIONS = [
  { value: '', label: 'All timings' },
  { value: 'live', label: 'Live' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Ended' },
]

const ACTIVE_OPTIONS = [
  { value: '', label: 'Active + inactive' },
  { value: 'active', label: 'Active only' },
  { value: 'inactive', label: 'Inactive only' },
]

const rows = computed(() => {
  return events.value
    .map((e) => ({ event: e, timing: eventTiming(e, now.value) }))
    .filter(({ event, timing }) => {
      if (timingFilter.value && timing !== timingFilter.value) return false
      if (activeFilter.value === 'active' && !event.active) return false
      if (activeFilter.value === 'inactive' && event.active) return false
      return true
    })
})

async function fetchEvents() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { listAllEvents } = await import('@/api/admin/events')
    events.value = await listAllEvents()
  } catch (e) {
    errorMessage.value = getApiErrorMessage(e, 'Failed to load events.')
  } finally {
    loading.value = false
  }
}

onMounted(fetchEvents)

function openEditor(id: string) {
  router.push({ name: 'admin-event-editor', params: { eventId: id } })
}

function onCreated(event: EventResponse) {
  showCreate.value = false
  events.value = [event, ...events.value]
  openEditor(event.id)
}

async function deactivate(event: EventResponse) {
  if (!confirm(`Deactivate "${event.title}"? It will drop out of public lists.`)) return
  actionLoading.value[event.id] = true
  errorMessage.value = ''
  try {
    const { deactivateEvent } = await import('@/api/admin/events')
    await deactivateEvent(event.id)
    events.value = events.value.map((e) =>
      e.id === event.id ? { ...e, active: false, live: false } : e,
    )
  } catch (e) {
    errorMessage.value = getApiErrorMessage(e, 'Failed to deactivate the event.')
  } finally {
    delete actionLoading.value[event.id]
  }
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatDate(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
}

function bonusSummary(event: EventResponse): string {
  const parts: string[] = []
  if (event.bonusXp) parts.push(`${event.bonusXp.toLocaleString()} XP`)
  if (event.bonusItems.length) {
    parts.push(`${event.bonusItems.length} item${event.bonusItems.length === 1 ? '' : 's'}`)
  }
  return parts.length ? parts.join(' + ') : '-'
}
</script>

<template>
  <div class="events-mgmt">
    <div class="events-mgmt__header">
      <div>
        <h2 class="events-mgmt__title">Events</h2>
        <p class="events-mgmt__meta">{{ events.length }} total</p>
      </div>
      <div class="events-mgmt__actions">
        <BaseSelect v-model="timingFilter" :options="TIMING_OPTIONS" style="width: 150px" />
        <BaseSelect v-model="activeFilter" :options="ACTIVE_OPTIONS" style="width: 170px" />
        <BaseButton variant="primary" @click="showCreate = true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Event
        </BaseButton>
      </div>
    </div>

    <p v-if="errorMessage" class="events-mgmt__error">{{ errorMessage }}</p>

    <AdminTable :items="rows" :loading="loading" :loading-rows="6" empty-message="No events found">
      <template #head>
        <th>Title</th>
        <th style="width: 110px">Timing</th>
        <th style="width: 90px">State</th>
        <th class="mono" style="width: 170px">Starts</th>
        <th class="mono" style="width: 170px">Ends</th>
        <th style="width: 90px" class="right">Weeks</th>
        <th style="width: 130px">Bonus</th>
        <th class="right" style="width: 150px" />
      </template>
      <template #default="{ item }">
        <td>
          <button type="button" class="events-mgmt__name-btn" @click="openEditor(item.event.id)">
            {{ item.event.title }}
          </button>
        </td>
        <td>
          <span class="events-mgmt__badge"
            :style="{ color: EVENT_TIMING_COLOR[item.timing], borderColor: EVENT_TIMING_COLOR[item.timing] }">
            {{ EVENT_TIMING_LABEL[item.timing] }}
          </span>
        </td>
        <td>
          <span class="events-mgmt__badge" :class="{ 'events-mgmt__badge--muted': !item.event.active }"
            :style="item.event.active ? { color: 'var(--success)', borderColor: 'var(--success)' } : {}">
            {{ item.event.active ? 'Active' : 'Inactive' }}
          </span>
        </td>
        <td class="mono muted">{{ formatDate(item.event.startsAt) }}</td>
        <td class="mono muted">{{ formatDate(item.event.endsAt) }}</td>
        <td class="right mono muted">
          <template v-if="item.event.live && item.event.currentWeek">
            {{ item.event.currentWeek }} / {{ item.event.totalWeeks }}
          </template>
          <template v-else>
            {{ item.event.totalWeeks }}
          </template>
        </td>
        <td class="muted">{{ bonusSummary(item.event) }}</td>
        <td class="right">
          <div class="events-mgmt__row-actions">
            <BaseButton size="sm" @click="openEditor(item.event.id)">Edit</BaseButton>
            <BaseButton v-if="item.event.active" size="sm" variant="destructive"
              :loading="actionLoading[item.event.id]" @click="deactivate(item.event)">
              Deactivate
            </BaseButton>
          </div>
        </td>
      </template>
    </AdminTable>

    <EventCreateModal :open="showCreate" @close="showCreate = false" @created="onCreated" />
  </div>
</template>

<style scoped>
.events-mgmt {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.events-mgmt__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-lg);
  flex-wrap: wrap;
}

.events-mgmt__title {
  font-size: var(--text-section-heading);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.events-mgmt__meta {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  margin: 2px 0 0;
}

.events-mgmt__actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.events-mgmt__error {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--error);
}

.events-mgmt__name-btn {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: color 120ms ease;
}

.events-mgmt__name-btn:hover {
  color: var(--page-accent, var(--accent));
}

.events-mgmt__badge {
  display: inline-block;
  font-size: var(--text-caption);
  font-family: var(--font-mono);
  font-weight: 500;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--bg-overlay);
  color: var(--text-secondary);
  background: transparent;
  white-space: nowrap;
}

.events-mgmt__badge--muted {
  color: var(--text-tertiary);
  border-color: var(--bg-overlay);
}

.events-mgmt__row-actions {
  display: inline-flex;
  gap: var(--space-xs);
  justify-content: flex-end;
}
</style>
