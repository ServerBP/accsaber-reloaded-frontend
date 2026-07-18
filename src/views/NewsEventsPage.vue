<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue'
import NewsArticle from '@/components/domain/NewsArticle.vue'
import { usePageMeta } from '@/composables/usePageMeta'
import { useAuthStore } from '@/stores/auth'
import type { EventResponse, EventState } from '@/types/api/events'
import type { NewsListParams, PublicNewsResponse } from '@/types/api/news'
import type { NewsType } from '@/types/enums'
import EventDetailPane from '@/views/news/EventDetailPane.vue'
import NewsEventsRail from '@/views/news/NewsEventsRail.vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

usePageMeta({
  title: 'News & Events | AccSaber',
  description: 'Live events, missions, and the latest AccSaber announcements.',
})

const currentEvent = ref<EventResponse | null>(null)
const events = ref<EventResponse[]>([])
const news = ref<PublicNewsResponse[]>([])
const loadingEvents = ref(true)
const loadingNews = ref(true)

const eventFilter = ref<EventState | null>('live')
const newsFilter = ref<NewsType | null>(null)
const search = ref('')
const newsPage = ref(1)
const totalNewsPages = ref(0)

const isMobile = ref(false)
const mobileView = ref<'rail' | 'detail'>('rail')

function setQuery(key: 'event' | 'post', value: string | null, clearKey: 'event' | 'post') {
  const query = { ...route.query }
  delete query[clearKey]
  if (value) query[key] = value
  else delete query[key]
  router.replace({ query })
}

const selectedEventId = computed<string | null>({
  get: () => (route.query.event as string) || null,
  set: (value) => setQuery('event', value, 'post'),
})

const selectedNewsSlug = computed<string | null>({
  get: () => (route.query.post as string) || null,
  set: (value) => setQuery('post', value, 'event'),
})

type Selection = { kind: 'event'; id: string } | { kind: 'news'; slug: string } | null

const activeSelection = computed<Selection>(() => {
  if (selectedNewsSlug.value) return { kind: 'news', slug: selectedNewsSlug.value }
  if (selectedEventId.value) return { kind: 'event', id: selectedEventId.value }
  if (news.value.length) return { kind: 'news', slug: news.value[0].slug }
  if (currentEvent.value) return { kind: 'event', id: currentEvent.value.slug }
  if (events.value.length) return { kind: 'event', id: events.value[0].slug }
  return null
})

const activeKind = computed(() => activeSelection.value?.kind ?? null)
const activeId = computed(() => {
  const selection = activeSelection.value
  if (!selection) return null
  return selection.kind === 'event' ? selection.id : selection.slug
})

const selectedNews = computed(() => {
  const selection = activeSelection.value
  if (selection?.kind !== 'news') return null
  return news.value.find((n) => n.slug === selection.slug) ?? null
})

async function loadEvents() {
  loadingEvents.value = true
  try {
    const { getEvents } = await import('@/api/events')
    events.value = await getEvents(eventFilter.value ? { state: eventFilter.value } : undefined)
  } catch {
    events.value = []
  } finally {
    loadingEvents.value = false
  }
}

async function loadNews() {
  loadingNews.value = true
  try {
    const { getNews } = await import('@/api/news')
    const params: NewsListParams = { page: newsPage.value - 1, size: 20 }
    if (newsFilter.value) params.type = newsFilter.value
    const res = await getNews(params)
    news.value = res.content
    totalNewsPages.value = res.totalPages
  } catch {
    news.value = []
    totalNewsPages.value = 0
  } finally {
    loadingNews.value = false
  }
}

function onSelectEvent(id: string) {
  selectedEventId.value = id
  mobileView.value = 'detail'
}

function onSelectNews(slug: string) {
  selectedNewsSlug.value = slug
  mobileView.value = 'detail'
}

function onEventFilter(value: EventState | null) {
  eventFilter.value = value
  loadEvents()
}

function onNewsFilter(value: NewsType | null) {
  newsFilter.value = value
  newsPage.value = 1
  loadNews()
}

function onNewsPage(value: number) {
  newsPage.value = value
  loadNews()
}

function onResize() {
  isMobile.value = window.innerWidth < 960
}

onMounted(async () => {
  onResize()
  window.addEventListener('resize', onResize, { passive: true })
  try {
    const { getCurrentEvent } = await import('@/api/events')
    currentEvent.value = await getCurrentEvent()
  } catch {
    currentEvent.value = null
  }
  eventFilter.value = currentEvent.value ? 'live' : null
  await Promise.all([loadEvents(), loadNews()])
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <div class="hub">
    <NewsEventsRail
      v-show="!isMobile || mobileView === 'rail'"
      class="hub__rail"
      :events="events"
      :news="news"
      :loading-events="loadingEvents"
      :loading-news="loadingNews"
      :event-filter="eventFilter"
      :news-filter="newsFilter"
      :search="search"
      :active-kind="activeKind"
      :active-id="activeId"
      :news-page="newsPage"
      :total-news-pages="totalNewsPages"
      @select-event="onSelectEvent"
      @select-news="onSelectNews"
      @update:event-filter="onEventFilter"
      @update:news-filter="onNewsFilter"
      @update:search="search = $event"
      @update:news-page="onNewsPage"
    />

    <main v-show="!isMobile || mobileView === 'detail'" class="hub__main">
      <button v-if="isMobile" type="button" class="hub__back" @click="mobileView = 'rail'">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back
      </button>

      <EventDetailPane
        v-if="activeSelection?.kind === 'event'"
        :key="activeSelection.id"
        :event-id="activeSelection.id"
        :logged-in="authStore.isLoggedIn"
      />

      <div v-else-if="activeSelection?.kind === 'news' && selectedNews" class="hub__article">
        <NewsArticle :news="selectedNews" />
      </div>

      <EmptyState v-else message="Select an event or news post to get started." />
    </main>
  </div>
</template>

<style scoped>
.hub {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: var(--space-2xl);
  max-width: 1600px;
  margin: 0 auto;
  align-items: start;
}

.hub__rail {
  position: sticky;
  top: calc(64px + var(--space-md));
  align-self: start;
  max-height: calc(100vh - 64px - var(--space-lg));
  overflow-y: auto;
  padding-right: var(--space-lg);
  border-right: 1px solid var(--bg-overlay);
}

.hub__main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.hub__back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  align-self: flex-start;
  padding: 6px 12px;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 500;
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease;
}

.hub__back:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.hub__article {
  max-width: 760px;
}

@media (max-width: 959px) {
  .hub {
    grid-template-columns: 1fr;
    gap: var(--space-lg);
  }

  .hub__rail {
    position: static;
    max-height: none;
    overflow: visible;
    padding-right: 0;
    border-right: none;
  }
}
</style>
