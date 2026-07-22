import {
  clearAllNotifications as apiClearAll,
  getNotifications as apiGetNotifications,
  getUnreadNotificationCount as apiGetUnreadCount,
  markAllNotificationsRead as apiMarkAllRead,
  markNotificationRead as apiMarkRead,
} from '@/api/notifications'
import type { NotificationResponse } from '@/types/api/notifications'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const FEED_SIZE = 30

export const useNotificationsStore = defineStore('notifications', () => {
  const unreadCount = ref(0)
  const feed = ref<NotificationResponse[]>([])
  const feedLoading = ref(false)
  const degraded = ref(false)

  const badgeLabel = computed(() => (unreadCount.value > 99 ? '99+' : String(unreadCount.value)))

  async function fetchUnreadCount(): Promise<void> {
    try {
      unreadCount.value = (await apiGetUnreadCount()).count
    } catch {
    }
  }

  async function fetchFeed(): Promise<void> {
    if (feedLoading.value) return
    feedLoading.value = true
    try {
      const page = await apiGetNotifications({ page: 0, size: FEED_SIZE, unreadOnly: true })
      feed.value = page.content
    } catch {
    } finally {
      feedLoading.value = false
    }
  }

  async function refresh(): Promise<void> {
    await Promise.all([fetchUnreadCount(), fetchFeed()])
  }

  function ingest(notification: NotificationResponse): void {
    if (notification.read || feed.value.some((n) => n.id === notification.id)) return
    feed.value = [notification, ...feed.value].slice(0, FEED_SIZE)
    unreadCount.value++
  }

  async function markRead(id: string): Promise<boolean> {
    const target = feed.value.find((n) => n.id === id)
    if (target?.read) return true
    if (target) target.read = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
    try {
      await apiMarkRead(id)
      feed.value = feed.value.filter((n) => n.id !== id)
      return true
    } catch {
      if (target) target.read = false
      unreadCount.value++
      return false
    }
  }

  async function markAllRead(): Promise<boolean> {
    feed.value = []
    unreadCount.value = 0
    try {
      await apiMarkAllRead()
      return true
    } catch {
      await refresh()
      return false
    }
  }

  async function clearAll(): Promise<boolean> {
    try {
      await apiClearAll()
      feed.value = []
      unreadCount.value = 0
      return true
    } catch {
      return false
    }
  }

  function setDegraded(value: boolean): void {
    degraded.value = value
  }

  function reset(): void {
    unreadCount.value = 0
    feed.value = []
    feedLoading.value = false
    degraded.value = false
  }

  return {
    unreadCount,
    feed,
    feedLoading,
    degraded,
    badgeLabel,
    fetchUnreadCount,
    refresh,
    ingest,
    markRead,
    markAllRead,
    clearAll,
    setDegraded,
    reset,
  }
})
