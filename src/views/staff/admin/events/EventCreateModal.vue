<script setup lang="ts">
import { getApiErrorMessage, parseApiError } from '@/api/client'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import type { EventRequest, EventResponse } from '@/types/api/events'
import { localInputToIso, slugify } from '@/utils/events'
import { computed, ref, watch } from 'vue'

const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{
  close: []
  created: [event: EventResponse]
}>()

const title = ref('')
const slug = ref('')
const slugTouched = ref(false)
const description = ref('')
const startsAt = ref('')
const endsAt = ref('')
const bonusXp = ref('')

const submitting = ref(false)
const formError = ref('')
const slugError = ref('')

const slugPreview = computed(() => slugify(slug.value))

watch(title, (value) => {
  if (!slugTouched.value) slug.value = slugify(value)
})

function onSlugInput(value: string | number) {
  slug.value = String(value)
  slugTouched.value = true
  slugError.value = ''
}

function reset() {
  title.value = ''
  slug.value = ''
  slugTouched.value = false
  description.value = ''
  startsAt.value = ''
  endsAt.value = ''
  bonusXp.value = ''
  formError.value = ''
  slugError.value = ''
  submitting.value = false
}

watch(
  () => props.open,
  (open) => {
    if (open) reset()
  },
)

function buildPayload(): EventRequest | null {
  if (!title.value.trim()) {
    formError.value = 'Title is required.'
    return null
  }
  const startIso = localInputToIso(startsAt.value)
  const endIso = localInputToIso(endsAt.value)
  if (!startIso || !endIso) {
    formError.value = 'Start and end dates are required.'
    return null
  }
  if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
    formError.value = 'End must be after start.'
    return null
  }
  const payload: EventRequest = {
    title: title.value.trim(),
    startsAt: startIso,
    endsAt: endIso,
  }
  if (slug.value.trim()) payload.slug = slug.value.trim()
  if (description.value.trim()) payload.description = description.value.trim()
  const xp = Number.parseInt(bonusXp.value, 10)
  if (bonusXp.value.trim() && Number.isFinite(xp) && xp >= 0) payload.bonusXp = xp
  return payload
}

async function submit() {
  formError.value = ''
  slugError.value = ''
  const payload = buildPayload()
  if (!payload) return
  submitting.value = true
  try {
    const { createEvent } = await import('@/api/admin/events')
    const created = await createEvent(payload)
    emit('created', created)
  } catch (e) {
    const parsed = parseApiError(e, 'Failed to create the event.')
    const slugField = parsed.fieldErrors.find((f) => f.field === 'slug')
    if (slugField) {
      slugError.value = slugField.message
    } else if (parsed.status === 422 && /slug/i.test(parsed.message)) {
      slugError.value = parsed.message
    } else {
      formError.value = parsed.message
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal :open="open" title="New event" max-width="560px" @close="emit('close')">
    <div class="event-create">
      <BaseInput v-model="title" label="Title" placeholder="Event name" />

      <div class="event-create__field">
        <BaseInput :model-value="slug" label="Slug" placeholder="auto from title" :error="slugError"
          @update:model-value="onSlugInput" />
        <p class="event-create__hint">
          Public link <code class="event-create__code">/events/{{ slugPreview || '…' }}</code>
        </p>
      </div>

      <div class="event-create__field">
        <label class="event-create__label">Description (optional)</label>
        <textarea v-model="description" class="event-create__textarea" rows="3"
          placeholder="Short summary shown on the event card" />
      </div>

      <div class="event-create__row">
        <BaseInput v-model="startsAt" type="datetime-local" label="Starts at" />
        <BaseInput v-model="endsAt" type="datetime-local" label="Ends at" />
      </div>

      <BaseInput v-model="bonusXp" type="number" min="0" step="1" label="Completion bonus XP (optional)"
        placeholder="0" />

      <p class="event-create__hint">
        Create the event first, then upload images and set bonus items in the editor.
      </p>

      <p v-if="formError" class="event-create__error">{{ formError }}</p>
    </div>

    <template #footer>
      <BaseButton @click="emit('close')">Cancel</BaseButton>
      <BaseButton variant="primary" :loading="submitting" @click="submit">Create</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.event-create {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.event-create__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.event-create__label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.event-create__textarea {
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

.event-create__textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent);
}

.event-create__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

@media (max-width: 520px) {
  .event-create__row {
    grid-template-columns: 1fr;
  }
}

.event-create__hint {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.event-create__code {
  font-family: var(--font-mono);
  color: var(--text-secondary);
}

.event-create__error {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--error);
}
</style>
