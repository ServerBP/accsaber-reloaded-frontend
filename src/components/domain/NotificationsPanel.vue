<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import NotificationRow from '@/components/domain/NotificationRow.vue'
import type { NotificationResponse } from '@/types/api/notifications'

defineProps<{
  notifications: NotificationResponse[]
  loading: boolean
  unreadCount: number
  degraded: boolean
}>()

defineEmits<{
  select: [notification: NotificationResponse]
  markAll: []
  navigate: []
}>()
</script>

<template>
  <div class="notifications-panel">
    <header class="notifications-panel__header">
      <h2 class="notifications-panel__title">Notifications</h2>
      <button type="button" class="notifications-panel__mark-all" :disabled="unreadCount === 0"
        @click="$emit('markAll')">
        Mark all as read
      </button>
    </header>

    <p v-if="degraded" class="notifications-panel__degraded">
      Reconnecting. New notifications may be delayed.
    </p>

    <div class="notifications-panel__list">
      <template v-if="loading && notifications.length === 0">
        <div v-for="i in 4" :key="i" class="notifications-panel__skeleton">
          <SkeletonLoader variant="text" :lines="2" />
        </div>
      </template>
      <EmptyState v-else-if="notifications.length === 0" message="You're all caught up. Nothing new here." />
      <template v-else>
        <NotificationRow v-for="notification in notifications" :key="notification.id"
          :notification="notification" @select="$emit('select', $event)" />
      </template>
    </div>

    <router-link to="/notifications" class="notifications-panel__footer" @click="$emit('navigate')">
      View all notifications
    </router-link>
  </div>
</template>

<style scoped>
.notifications-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.notifications-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding: var(--space-md);
  border-bottom: 1px solid var(--bg-overlay);
  flex-shrink: 0;
}

.notifications-panel__title {
  margin: 0;
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--text-primary);
}

.notifications-panel__mark-all {
  padding: 0;
  background: none;
  border: none;
  color: var(--accent);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 500;
  cursor: pointer;
  transition: color 120ms ease;
}

.notifications-panel__mark-all:hover:not(:disabled) {
  color: var(--text-primary);
}

.notifications-panel__mark-all:disabled {
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.notifications-panel__degraded {
  margin: 0;
  padding: var(--space-xs) var(--space-md);
  color: var(--text-tertiary);
  font-size: var(--text-caption);
  border-bottom: 1px solid var(--bg-overlay);
  flex-shrink: 0;
}

.notifications-panel__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--space-xs) 0;
}

.notifications-panel__skeleton {
  padding: 10px var(--space-md);
}

.notifications-panel__footer {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-sm) var(--space-md);
  border-top: 1px solid var(--bg-overlay);
  color: var(--text-secondary);
  font-size: var(--text-caption);
  font-weight: 500;
  text-decoration: none;
  transition: color 120ms ease, background 120ms ease;
  flex-shrink: 0;
}

.notifications-panel__footer:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--bg-overlay) 45%, transparent);
}
</style>
