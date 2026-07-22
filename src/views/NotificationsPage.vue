<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseTabs from '@/components/common/BaseTabs.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import PageHeaderBleed from '@/components/common/PageHeaderBleed.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import NotificationRow from '@/components/domain/NotificationRow.vue'
import PseudoLoginModal from '@/components/domain/PseudoLoginModal.vue'
import { usePageMeta } from '@/composables/usePageMeta'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import type { NotificationResponse } from '@/types/api/notifications'
import type { Tab } from '@/types/display'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

usePageMeta({
  title: 'Notifications | AccSaber',
  description: 'Your recent trades, market activity, drops, and announcements.',
})

const PAGE_SIZE = 30

const FILTER_TABS: Tab[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
]

const authStore = useAuthStore()
const store = useNotificationsStore()
const route = useRoute()
const router = useRouter()

const filter = computed<'all' | 'unread'>(() =>
  route.query.filter === 'unread' ? 'unread' : 'all',
)

const currentPage = computed(() => {
  const p = Number(route.query.page)
  return p > 0 ? p : 1
})

const items = ref<NotificationResponse[]>([])
const totalPages = ref(0)
const totalElements = ref(0)
const loading = ref(true)
const error = ref<string | null>(null)

const markingAll = ref(false)
const clearConfirm = ref(false)
const clearing = ref(false)
const loginModalOpen = ref(false)

const canClear = computed(
  () => !loading.value && !(filter.value === 'all' && totalElements.value === 0),
)

const emptyMessage = computed(() =>
  filter.value === 'unread'
    ? 'No unread notifications.'
    : 'Nothing here yet. Trades, market activity, drops, and announcements will show up as they happen.',
)

async function fetchPage() {
  if (!authStore.isLoggedIn) {
    loading.value = false
    return
  }
  loading.value = true
  error.value = null
  try {
    const { getNotifications } = await import('@/api/notifications')
    const page = await getNotifications({
      page: currentPage.value - 1,
      size: PAGE_SIZE,
      ...(filter.value === 'unread' ? { unreadOnly: true } : {}),
    })
    items.value = page.content
    totalPages.value = page.totalPages
    totalElements.value = page.totalElements
  } catch {
    error.value = "Couldn't load notifications. Try again in a moment."
  } finally {
    loading.value = false
  }
}

function setFilter(key: string) {
  const query = { ...route.query }
  delete query.page
  if (key === 'unread') query.filter = 'unread'
  else delete query.filter
  router.replace({ query })
}

function setPage(page: number) {
  const query = { ...route.query }
  if (page <= 1) delete query.page
  else query.page = String(page)
  router.push({ query })
}

function onSelect(notification: NotificationResponse) {
  if (!notification.read) {
    notification.read = true
    void store.markRead(notification.id).then((ok) => {
      if (!ok) notification.read = false
    })
  }
  if (notification.linkTo) void router.push(notification.linkTo)
}

async function markAll() {
  if (markingAll.value || store.unreadCount === 0) return
  markingAll.value = true
  await store.markAllRead()
  await fetchPage()
  markingAll.value = false
}

async function confirmClear() {
  if (clearing.value) return
  clearing.value = true
  const ok = await store.clearAll()
  clearing.value = false
  clearConfirm.value = false
  if (ok) await fetchPage()
  else error.value = "Couldn't clear notifications. Try again in a moment."
}

onMounted(fetchPage)

watch([filter, currentPage, () => authStore.isLoggedIn], fetchPage)
</script>

<template>
  <div class="notifications-page" :style="{ '--page-accent': 'var(--accent-overall)' }">
    <PageHeaderBleed title="Notifications"
      subtitle="Trades, market activity, drops, and announcements" />

    <template v-if="authStore.isLoggedIn">
      <div class="notifications-page__toolbar">
        <BaseTabs :tabs="FILTER_TABS" :model-value="filter" @update:model-value="setFilter" />
        <div class="notifications-page__actions">
          <BaseButton size="sm" :disabled="store.unreadCount === 0" :loading="markingAll"
            @click="markAll">
            Mark all as read
          </BaseButton>
          <BaseButton size="sm" variant="destructive" :disabled="!canClear"
            @click="clearConfirm = true">
            Clear all
          </BaseButton>
        </div>
      </div>

      <p v-if="error" class="notifications-page__error">{{ error }}</p>

      <div v-if="loading" class="notifications-page__list">
        <div v-for="i in 6" :key="i" class="notifications-page__skeleton">
          <SkeletonLoader variant="text" :lines="2" />
        </div>
      </div>
      <EmptyState v-else-if="items.length === 0" :message="emptyMessage" />
      <div v-else class="notifications-page__list">
        <NotificationRow v-for="notification in items" :key="notification.id"
          :notification="notification" size="md" @select="onSelect" />
      </div>

      <PaginationControls v-if="totalPages > 1" :page="currentPage" :total-pages="totalPages"
        @update:page="setPage" />
    </template>

    <template v-else>
      <EmptyState message="Sign in to see your notifications." action-label="Sign in"
        @action="loginModalOpen = true" />
    </template>

    <BaseModal :open="clearConfirm" title="Clear All Notifications" max-width="400px"
      @close="clearConfirm = false">
      <p class="notifications-page__confirm-msg">
        This permanently deletes every notification, read and unread. There is no way to get them
        back.
      </p>
      <template #footer>
        <div class="notifications-page__confirm-actions">
          <BaseButton @click="clearConfirm = false">Cancel</BaseButton>
          <BaseButton variant="destructive" :loading="clearing" @click="confirmClear">
            Clear all
          </BaseButton>
        </div>
      </template>
    </BaseModal>

    <PseudoLoginModal :open="loginModalOpen" @close="loginModalOpen = false" />
  </div>
</template>

<style scoped>
.notifications-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 760px;
  margin: 0 auto;
  width: 100%;
}

.notifications-page__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.notifications-page__actions {
  display: flex;
  gap: var(--space-sm);
}

.notifications-page__error {
  margin: 0;
  color: var(--error);
  font-size: var(--text-caption);
}

.notifications-page__list {
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  overflow: hidden;
}

.notifications-page__list > * + * {
  border-top: 1px solid var(--bg-overlay);
}

.notifications-page__skeleton {
  padding: var(--space-md) var(--space-lg);
}

.notifications-page__confirm-msg {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--text-body);
  line-height: 1.5;
}

.notifications-page__confirm-actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
}
</style>
