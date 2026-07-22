<script setup lang="ts">
import { parseApiError } from '@/api/client'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import NotificationRow from '@/components/domain/NotificationRow.vue'
import type { NotificationResponse } from '@/types/api/notifications'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import NotificationTestFire from './notifications/NotificationTestFire.vue'

const TITLE_MAX = 200
const LINK_MAX = 500

const router = useRouter()

const title = ref('')
const linkTo = ref('')
const titleError = ref<string | null>(null)
const linkError = ref<string | null>(null)
const generalError = ref<string | null>(null)
const confirmOpen = ref(false)
const sending = ref(false)
const delivered = ref<number | null>(null)

const trimmedTitle = computed(() => title.value.trim())
const trimmedLink = computed(() => linkTo.value.trim())

const titleCounter = computed(() => `${title.value.length} / ${TITLE_MAX}`)
const titleOverLimit = computed(() => title.value.length > TITLE_MAX)

const linkInvalid = computed(
  () =>
    trimmedLink.value.length > 0 &&
    (!trimmedLink.value.startsWith('/') || trimmedLink.value.length > LINK_MAX),
)

const linkWarning = computed(() => {
  if (!trimmedLink.value || linkInvalid.value) return null
  try {
    const resolved = router.resolve(trimmedLink.value)
    if (resolved.name === 'not-found') {
      return 'This path does not match any known page. Every player who clicks it will land on a 404.'
    }
  } catch {
    return 'This path could not be resolved. Double-check it before sending.'
  }
  return null
})

const canSend = computed(
  () =>
    trimmedTitle.value.length > 0 &&
    !titleOverLimit.value &&
    !linkInvalid.value &&
    !sending.value,
)

const previewNotification = computed<NotificationResponse>(() => ({
  id: 'broadcast-preview',
  type: 'server',
  title: trimmedTitle.value || 'Your announcement will appear here',
  linkTo: trimmedLink.value || null,
  read: false,
  createdAt: new Date().toISOString(),
}))

function openConfirm() {
  if (!canSend.value) return
  titleError.value = null
  linkError.value = null
  generalError.value = null
  confirmOpen.value = true
}

async function send() {
  if (sending.value) return
  sending.value = true
  try {
    const { broadcastNotification } = await import('@/api/admin/notifications')
    const res = await broadcastNotification({
      title: trimmedTitle.value,
      linkTo: trimmedLink.value || null,
    })
    delivered.value = res.delivered
    title.value = ''
    linkTo.value = ''
  } catch (err) {
    const parsed = parseApiError(err, 'Broadcast failed.')
    for (const fieldError of parsed.fieldErrors) {
      if (fieldError.field === 'title') titleError.value = fieldError.message
      else if (fieldError.field === 'linkTo') linkError.value = fieldError.message
    }
    if (parsed.fieldErrors.length === 0) generalError.value = parsed.message
  } finally {
    sending.value = false
    confirmOpen.value = false
  }
}
</script>

<template>
  <div class="tab">
    <div class="tab__header">
      <h2 class="tab__title">Broadcast</h2>
      <p class="tab__subtitle">
        Push a one-line notification to every active player's bell. One sentence, one optional
        link. Nothing more.
      </p>
    </div>

    <div class="broadcast">
      <div class="broadcast__form">
        <div class="broadcast__field">
          <BaseInput v-model="title" label="Title" placeholder="Week 2 of Alpha's End is live!"
            :error="titleError ?? (titleOverLimit ? `Keep it under ${TITLE_MAX} characters.` : undefined)"
            :disabled="sending" />
          <span class="broadcast__counter" :class="{ 'broadcast__counter--over': titleOverLimit }">
            {{ titleCounter }}
          </span>
        </div>

        <div class="broadcast__field">
          <BaseInput v-model="linkTo" label="Link (optional)" placeholder="/events/alphas-end"
            :error="linkError ?? (linkInvalid ? 'Must be an in-app path starting with / and at most 500 characters.' : undefined)"
            :disabled="sending" />
          <span class="broadcast__hint">
            An in-app path like /events/alphas-end. Leave empty for a plain, non-clickable notice.
          </span>
          <span v-if="linkWarning" class="broadcast__warning">{{ linkWarning }}</span>
        </div>

        <div class="broadcast__preview">
          <span class="broadcast__preview-label">Preview</span>
          <div class="broadcast__preview-frame">
            <NotificationRow :notification="previewNotification" :interactive="false" />
          </div>
        </div>

        <p v-if="generalError" class="broadcast__error">{{ generalError }}</p>

        <div class="broadcast__actions">
          <BaseButton variant="primary" :disabled="!canSend" @click="openConfirm">
            Send broadcast
          </BaseButton>
        </div>
      </div>

      <div v-if="delivered !== null" class="broadcast__result">
        <span class="broadcast__result-line">
          Delivered to {{ delivered.toLocaleString() }} players.
        </span>
        <span class="broadcast__result-note">
          Players who turned off server announcements are skipped automatically, so this number is
          lower than the total player count. That is expected.
        </span>
      </div>

      <NotificationTestFire />
    </div>

    <BaseModal :open="confirmOpen" title="Send to Everyone" max-width="440px"
      @close="confirmOpen = false">
      <div class="broadcast__confirm">
        <p class="broadcast__confirm-msg">
          This goes to every active player at once. It cannot be undone, edited, or recalled.
        </p>
        <div class="broadcast__preview-frame">
          <NotificationRow :notification="previewNotification" :interactive="false" />
        </div>
      </div>
      <template #footer>
        <div class="broadcast__confirm-actions">
          <BaseButton :disabled="sending" @click="confirmOpen = false">Cancel</BaseButton>
          <BaseButton variant="primary" :loading="sending" @click="send">
            Send to everyone
          </BaseButton>
        </div>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 640px;
}

.tab__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.tab__title {
  margin: 0;
  font-size: var(--text-page-title);
  font-weight: 700;
  color: var(--text-primary);
}

.tab__subtitle {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--text-body);
  line-height: 1.5;
}

.broadcast {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.broadcast__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-lg);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
}

.broadcast__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.broadcast__counter {
  align-self: flex-end;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
}

.broadcast__counter--over {
  color: var(--error);
}

.broadcast__hint {
  color: var(--text-tertiary);
  font-size: var(--text-caption);
  line-height: 1.4;
}

.broadcast__warning {
  color: var(--warning);
  font-size: var(--text-caption);
  line-height: 1.4;
}

.broadcast__error {
  margin: 0;
  color: var(--error);
  font-size: var(--text-caption);
}

.broadcast__preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.broadcast__preview-label {
  color: var(--text-secondary);
  font-size: var(--text-caption);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.broadcast__preview-frame {
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  overflow: hidden;
}

.broadcast__actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--space-sm);
  border-top: 1px solid var(--bg-overlay);
}

.broadcast__result {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-md) var(--space-lg);
  background: color-mix(in srgb, var(--success) 6%, var(--bg-surface));
  border: 1px solid color-mix(in srgb, var(--success) 35%, transparent);
  border-radius: var(--radius-card);
}

.broadcast__result-line {
  color: var(--text-primary);
  font-size: var(--text-body);
  font-weight: 600;
}

.broadcast__result-note {
  color: var(--text-secondary);
  font-size: var(--text-caption);
  line-height: 1.5;
}

.broadcast__confirm {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.broadcast__confirm-msg {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--text-body);
  line-height: 1.5;
}

.broadcast__confirm-actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
}
</style>
