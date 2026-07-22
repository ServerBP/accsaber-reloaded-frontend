<script setup lang="ts">
import { useClickOutside } from '@/composables/useClickOutside'
import { useNotificationsStore } from '@/stores/notifications'
import type { NotificationResponse } from '@/types/api/notifications'
import { defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const NotificationsPanel = defineAsyncComponent(
  () => import('@/components/domain/NotificationsPanel.vue'),
)

const store = useNotificationsStore()
const router = useRouter()

const open = ref(false)
const isSheet = ref(false)
const triggerRef = ref<HTMLButtonElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

function updatePosition() {
  const trigger = triggerRef.value
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  isSheet.value = window.matchMedia('(max-width: 600px)').matches
  if (isSheet.value) {
    panelStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      left: '0',
      right: '0',
      bottom: '0',
    }
  } else {
    panelStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      right: `${Math.max(window.innerWidth - rect.right, 8)}px`,
      width: 'min(400px, calc(100vw - 32px))',
    }
  }
}

function onViewportChange() {
  if (open.value) updatePosition()
}

useClickOutside(panelRef, open, () => {
  open.value = false
}, { ignoreRefs: [triggerRef] })

watch(open, async (value) => {
  if (!value) return
  await nextTick()
  updatePosition()
  void store.refresh()
})

onMounted(() => {
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
})

onUnmounted(() => {
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})

function toggle() {
  open.value = !open.value
}

function onSelect(notification: NotificationResponse) {
  open.value = false
  if (!notification.read) void store.markRead(notification.id)
  if (notification.linkTo) void router.push(notification.linkTo)
}
</script>

<template>
  <button ref="triggerRef" type="button" class="navbar__icon-btn notifications-trigger"
    :class="{ 'notifications-trigger--active': open }"
    :aria-label="store.unreadCount > 0 ? `Notifications, ${store.unreadCount} unread` : 'Notifications'"
    @click="toggle">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
    <span v-if="store.unreadCount > 0" class="notifications-trigger__badge">
      {{ store.badgeLabel }}
    </span>
  </button>

  <Teleport to="body">
    <Transition name="notifications-dropdown">
      <div v-if="open" ref="panelRef" class="notifications-dropdown-panel"
        :class="{ 'notifications-dropdown-panel--sheet': isSheet }" :style="panelStyle">
        <NotificationsPanel :notifications="store.feed" :loading="store.feedLoading"
          :unread-count="store.unreadCount" :degraded="store.degraded" @select="onSelect"
          @mark-all="store.markAllRead()" @navigate="open = false" />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.notifications-trigger {
  position: relative;
}

.notifications-trigger--active {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.notifications-trigger__badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  border-radius: var(--radius-btn);
  color: var(--bg-base);
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 1;
  pointer-events: none;
}
</style>

<style>
.notifications-dropdown-panel {
  z-index: 200;
  display: flex;
  flex-direction: column;
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
  max-height: min(480px, calc(100vh - var(--navbar-height) - 24px));
  overflow: hidden;
}

.notifications-dropdown-panel--sheet {
  border-left: none;
  border-right: none;
  border-bottom: none;
  border-radius: 0;
  max-height: none;
}

.notifications-dropdown-enter-active,
.notifications-dropdown-leave-active {
  transition: opacity 100ms ease, transform 100ms ease;
}

.notifications-dropdown-enter-from,
.notifications-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .notifications-dropdown-enter-active,
  .notifications-dropdown-leave-active {
    transition: none;
  }
}
</style>
