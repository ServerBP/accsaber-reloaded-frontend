<script setup lang="ts">
import { parseApiError } from '@/api/client'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import NotificationRow from '@/components/domain/NotificationRow.vue'
import UserPicker from '@/components/domain/UserPicker.vue'
import type {
  NotificationResponse,
  NotificationType,
  TestNotificationResponse,
} from '@/types/api/notifications'
import { NOTIFICATION_TYPE_LABELS, NOTIFICATION_TYPES } from '@/utils/notifications'
import { computed, ref } from 'vue'

const TYPE_OPTIONS = NOTIFICATION_TYPES.map((type) => ({
  value: type,
  label: NOTIFICATION_TYPE_LABELS[type],
  description: type,
}))

const userId = ref<string | null>(null)
const type = ref<NotificationType>('trade_offer')
const customize = ref(false)
const customTitle = ref('')
const customLink = ref('')

const sending = ref(false)
const result = ref<TestNotificationResponse | null>(null)
const sentAt = ref('')
const userError = ref<string | null>(null)
const titleError = ref<string | null>(null)
const linkError = ref<string | null>(null)
const generalError = ref<string | null>(null)

const canSend = computed(() => userId.value !== null && !sending.value)

const echoNotification = computed<NotificationResponse | null>(() => {
  if (!result.value || !result.value.delivered) return null
  return {
    id: 'test-fire-echo',
    type: result.value.type,
    title: result.value.title,
    linkTo: result.value.linkTo,
    read: false,
    createdAt: sentAt.value,
  }
})

function clearErrors() {
  userError.value = null
  titleError.value = null
  linkError.value = null
  generalError.value = null
}

async function send() {
  if (!canSend.value || !userId.value) return
  sending.value = true
  clearErrors()
  result.value = null
  try {
    const { sendTestNotification } = await import('@/api/admin/notifications')
    const title = customize.value ? customTitle.value.trim() : ''
    const linkTo = customize.value ? customLink.value.trim() : ''
    result.value = await sendTestNotification({
      userId: userId.value,
      type: type.value,
      ...(title ? { title } : {}),
      ...(linkTo ? { linkTo } : {}),
    })
    sentAt.value = new Date().toISOString()
  } catch (err) {
    const parsed = parseApiError(err, 'Test fire failed.')
    if (parsed.status === 404) {
      userError.value = 'No player found for that account.'
    } else {
      for (const fieldError of parsed.fieldErrors) {
        if (fieldError.field === 'userId') userError.value = fieldError.message
        else if (fieldError.field === 'title') titleError.value = fieldError.message
        else if (fieldError.field === 'linkTo') linkError.value = fieldError.message
      }
      if (parsed.fieldErrors.length === 0) generalError.value = parsed.message
    }
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="test-fire">
    <header class="test-fire__header">
      <h3 class="test-fire__title">Test fire</h3>
      <p class="test-fire__desc">
        Sends one real notification to one player. This verifies the delivery pipeline
        (preferences, storage, live push) but not that the trade, market, or item triggers fire;
        those need a real trade or purchase.
      </p>
    </header>

    <div class="test-fire__field">
      <span class="test-fire__label">Player</span>
      <UserPicker v-model="userId" :disabled="sending" />
      <span v-if="userError" class="test-fire__field-error">{{ userError }}</span>
    </div>

    <div class="test-fire__field">
      <BaseSelect :model-value="type" :options="TYPE_OPTIONS" label="Type"
        @update:model-value="(v) => (type = v as NotificationType)" />
    </div>

    <button type="button" class="test-fire__customize" :aria-expanded="customize"
      @click="customize = !customize">
      <svg class="test-fire__customize-chevron" :class="{ 'test-fire__customize-chevron--open': customize }"
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="9 18 15 12 9 6" />
      </svg>
      Customize
    </button>

    <div v-if="customize" class="test-fire__overrides">
      <BaseInput v-model="customTitle" label="Title override"
        placeholder="Leave empty to use the server default"
        :error="titleError ?? undefined" :disabled="sending" />
      <BaseInput v-model="customLink" label="Link override"
        placeholder="Leave empty to use the server default"
        :error="linkError ?? undefined" :disabled="sending" />
    </div>

    <p v-if="generalError" class="test-fire__error">{{ generalError }}</p>

    <div class="test-fire__actions">
      <BaseButton size="sm" :disabled="!canSend" :loading="sending" @click="send">
        Send test notification
      </BaseButton>
    </div>

    <div v-if="result" class="test-fire__result"
      :class="result.delivered ? 'test-fire__result--ok' : 'test-fire__result--suppressed'">
      <template v-if="result.delivered">
        <span class="test-fire__result-line">Delivered to {{ result.userName }}.</span>
        <div class="test-fire__echo">
          <NotificationRow v-if="echoNotification" :notification="echoNotification"
            :interactive="false" />
        </div>
        <span class="test-fire__result-note">
          This is what was sent. Compare it against what appears in their bell.
        </span>
      </template>
      <template v-else>
        <span class="test-fire__result-line">Not delivered to {{ result.userName }}.</span>
        <span class="test-fire__result-reason">{{ result.suppressedReason }}</span>
        <span class="test-fire__result-note">
          Nothing is broken. The player has this notification category turned off.
        </span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.test-fire {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-lg);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
}

.test-fire__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.test-fire__title {
  margin: 0;
  font-size: var(--text-card-title);
  font-weight: 600;
  color: var(--text-primary);
}

.test-fire__desc {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--text-caption);
  line-height: 1.5;
}

.test-fire__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.test-fire__label {
  color: var(--text-secondary);
  font-size: var(--text-caption);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.test-fire__field-error {
  color: var(--error);
  font-size: var(--text-caption);
}

.test-fire__customize {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  align-self: flex-start;
  padding: 0;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 500;
  cursor: pointer;
  transition: color 120ms ease;
}

.test-fire__customize:hover {
  color: var(--text-primary);
}

.test-fire__customize-chevron {
  transition: transform 150ms ease;
}

.test-fire__customize-chevron--open {
  transform: rotate(90deg);
}

.test-fire__overrides {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.test-fire__error {
  margin: 0;
  color: var(--error);
  font-size: var(--text-caption);
}

.test-fire__actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--space-sm);
  border-top: 1px solid var(--bg-overlay);
}

.test-fire__result {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-md);
  border-radius: var(--radius-card);
}

.test-fire__result--ok {
  background: color-mix(in srgb, var(--success) 6%, var(--bg-surface));
  border: 1px solid color-mix(in srgb, var(--success) 35%, transparent);
}

.test-fire__result--suppressed {
  background: color-mix(in srgb, var(--warning) 6%, var(--bg-surface));
  border: 1px solid color-mix(in srgb, var(--warning) 35%, transparent);
}

.test-fire__result-line {
  color: var(--text-primary);
  font-size: var(--text-body);
  font-weight: 600;
}

.test-fire__result-reason {
  color: var(--warning);
  font-size: var(--text-body);
  font-weight: 500;
}

.test-fire__result-note {
  color: var(--text-secondary);
  font-size: var(--text-caption);
  line-height: 1.5;
}

.test-fire__echo {
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  overflow: hidden;
}

@media (prefers-reduced-motion: reduce) {
  .test-fire__customize-chevron {
    transition: none;
  }
}
</style>
