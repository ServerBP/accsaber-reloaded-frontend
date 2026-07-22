<script setup lang="ts">
import NotificationTypeIcon from '@/components/domain/NotificationTypeIcon.vue'
import { useSharedNow } from '@/composables/useSharedNow'
import type { NotificationResponse } from '@/types/api/notifications'
import { formatRelativeDate } from '@/utils/formatters'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    notification: NotificationResponse
    size?: 'sm' | 'md'
    interactive?: boolean
  }>(),
  { size: 'sm', interactive: true },
)

const emit = defineEmits<{
  select: [notification: NotificationResponse]
}>()

const now = useSharedNow()

const timestamp = computed(() => formatRelativeDate(props.notification.createdAt, now.value))

const hasLink = computed(() => props.notification.linkTo !== null)

const clickable = computed(
  () => props.interactive && (hasLink.value || !props.notification.read),
)

function onSelect() {
  if (clickable.value) emit('select', props.notification)
}
</script>

<template>
  <component :is="clickable ? 'button' : 'div'" :type="clickable ? 'button' : undefined"
    class="notification-row" :class="[
      `notification-row--${size}`,
      {
        'notification-row--unread': !notification.read,
        'notification-row--link': interactive && hasLink,
      },
    ]" @click="onSelect">
    <NotificationTypeIcon :type="notification.type" />
    <span class="notification-row__content">
      <span class="notification-row__title">{{ notification.title }}</span>
      <span class="notification-row__time">{{ timestamp }}</span>
    </span>
    <span v-if="!notification.read" class="notification-row__dot" aria-label="Unread"></span>
  </component>
</template>

<style scoped>
.notification-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  width: 100%;
  padding: 10px var(--space-md);
  background: transparent;
  border: none;
  border-radius: 0;
  font-family: var(--font-sans);
  text-align: left;
  cursor: default;
  transition: background 120ms ease;
}

.notification-row--md {
  padding: var(--space-md) var(--space-lg);
  gap: var(--space-md);
}

.notification-row--link {
  cursor: pointer;
}

.notification-row--link:hover {
  background: color-mix(in srgb, var(--bg-overlay) 45%, transparent);
}

.notification-row--unread {
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}

.notification-row--unread.notification-row--link:hover {
  background: color-mix(in srgb, var(--accent) 11%, transparent);
}

.notification-row:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--accent) 40%, transparent);
}

.notification-row .notification-type-icon {
  margin-top: 1px;
}

.notification-row__content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.notification-row__title {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: var(--text-body);
  font-weight: 400;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.notification-row--unread .notification-row__title {
  color: var(--text-primary);
  font-weight: 500;
}

.notification-row__time {
  color: var(--text-tertiary);
  font-size: var(--text-caption);
}

.notification-row__dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  margin-top: 7px;
  border-radius: 50%;
  background: var(--accent);
}
</style>
