<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import { useNow } from '@/composables/useNow'
import EventStatusGlyph from '@/views/news/EventStatusGlyph.vue'
import NewsTypeGlyph from '@/views/news/NewsTypeGlyph.vue'
import RailListCard from '@/views/news/RailListCard.vue'
import type { EventResponse, EventState } from '@/types/api/events'
import type { PublicNewsResponse } from '@/types/api/news'
import type { NewsType } from '@/types/enums'
import {
  EVENT_STATE_ACCENT,
  EVENT_STATE_LABELS,
  EVENT_STATE_ORDER,
  NEWS_TYPE_ACCENT,
  NEWS_TYPE_LABELS,
  NEWS_TYPE_ORDER,
} from '@/utils/constants'
import { EVENT_STATUS_COLOR, EVENT_STATUS_LABEL, eventCountdown, eventStatus } from '@/utils/events'
import { formatRelativeDate } from '@/utils/formatters'
import { computed, ref } from 'vue'

const props = defineProps<{
  events: EventResponse[]
  news: PublicNewsResponse[]
  loadingEvents: boolean
  loadingNews: boolean
  eventFilter: EventState | null
  newsFilter: NewsType | null
  search: string
  activeKind: 'event' | 'news' | null
  activeId: string | null
  newsPage: number
  totalNewsPages: number
}>()

const emit = defineEmits<{
  'select-event': [id: string]
  'select-news': [slug: string]
  'update:eventFilter': [value: EventState | null]
  'update:newsFilter': [value: NewsType | null]
  'update:search': [value: string]
  'update:newsPage': [value: number]
}>()

const now = useNow()
const filtersOpen = ref(false)

const query = computed(() => props.search.trim().toLowerCase())

function matches(...fields: (string | null | undefined)[]): boolean {
  if (!query.value) return true
  return fields.some((f) => !!f && f.toLowerCase().includes(query.value))
}

const filteredNews = computed(() => props.news.filter((n) => matches(n.title, n.description)))

const filterActive = computed(() => props.eventFilter !== null || props.newsFilter !== null)

const eventCards = computed(() =>
  props.events
    .filter((e) => matches(e.title, e.description))
    .map((event) => {
      const status = eventStatus(event, now.value)
      return {
        event,
        status,
        badge: EVENT_STATUS_LABEL[status],
        color: EVENT_STATUS_COLOR[status],
        meta: eventCountdown(event, now.value),
      }
    }),
)

const eventStateChoices = computed(() => [
  { key: null as EventState | null, label: 'All', accent: 'var(--accent)' },
  ...EVENT_STATE_ORDER.map((s) => ({ key: s, label: EVENT_STATE_LABELS[s], accent: EVENT_STATE_ACCENT[s] })),
])

const newsTypeChoices = computed(() => [
  { key: null as NewsType | null, label: 'All', accent: 'var(--accent)' },
  ...NEWS_TYPE_ORDER.map((t) => ({ key: t, label: NEWS_TYPE_LABELS[t], accent: NEWS_TYPE_ACCENT[t] })),
])
</script>

<template>
  <aside class="rail">
    <div class="rail__tools">
      <SearchBox
        :model-value="search"
        placeholder="Search events & news"
        @update:model-value="emit('update:search', $event)"
      />
      <button
        type="button"
        class="rail__filter-btn"
        :class="{ 'rail__filter-btn--on': filtersOpen || filterActive }"
        :aria-expanded="filtersOpen"
        aria-label="Filters"
        @click="filtersOpen = !filtersOpen"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
      </button>
    </div>

    <div v-if="filtersOpen" class="rail__filters">
      <div class="rail__filter-group">
        <span class="rail__filter-label">Events</span>
        <div class="rail__chips">
          <button
            v-for="choice in eventStateChoices"
            :key="choice.key ?? 'all'"
            type="button"
            class="rail__chip"
            :class="{ 'rail__chip--active': eventFilter === choice.key }"
            :style="{ '--chip-accent': choice.accent }"
            @click="emit('update:eventFilter', choice.key)"
          >
            {{ choice.label }}
          </button>
        </div>
      </div>

      <div class="rail__filter-group">
        <span class="rail__filter-label">News</span>
        <div class="rail__chips">
          <button
            v-for="choice in newsTypeChoices"
            :key="choice.key ?? 'all'"
            type="button"
            class="rail__chip"
            :class="{ 'rail__chip--active': newsFilter === choice.key }"
            :style="{ '--chip-accent': choice.accent }"
            @click="emit('update:newsFilter', choice.key)"
          >
            {{ choice.label }}
          </button>
        </div>
      </div>
    </div>

    <section class="rail__section">
      <h2 class="rail__heading">Events</h2>
      <div v-if="loadingEvents" class="rail__list">
        <SkeletonLoader v-for="i in 2" :key="i" variant="card" style="height: 72px" />
      </div>
      <p v-else-if="!eventCards.length" class="rail__empty">No events right now.</p>
      <div v-else class="rail__list">
        <RailListCard
          v-for="card in eventCards"
          :key="card.event.id"
          :title="card.event.title"
          :image-url="card.event.iconUrl ?? card.event.backgroundUrl"
          :meta="card.meta"
          :badge="card.badge"
          :badge-accent="card.color"
          :accent="card.color"
          :active="activeKind === 'event' && activeId === card.event.slug"
          @select="emit('select-event', card.event.slug)"
        >
          <template #fallback>
            <EventStatusGlyph :status="card.status" />
          </template>
        </RailListCard>
      </div>
    </section>

    <section class="rail__section">
      <h2 class="rail__heading">News</h2>
      <div v-if="loadingNews" class="rail__list">
        <SkeletonLoader v-for="i in 4" :key="i" variant="card" style="height: 72px" />
      </div>
      <EmptyState v-else-if="!filteredNews.length" message="No news yet." />
      <div v-else class="rail__list">
        <RailListCard
          v-for="item in filteredNews"
          :key="item.id"
          :title="item.title"
          :image-url="item.imageUrl"
          :meta="item.publishedAt ? formatRelativeDate(item.publishedAt) : null"
          :badge="NEWS_TYPE_LABELS[item.type]"
          :badge-accent="NEWS_TYPE_ACCENT[item.type]"
          :accent="NEWS_TYPE_ACCENT[item.type]"
          :pinned="item.pinned"
          :active="activeKind === 'news' && activeId === item.slug"
          @select="emit('select-news', item.slug)"
        >
          <template #fallback>
            <NewsTypeGlyph :type="item.type" />
          </template>
        </RailListCard>
      </div>
      <PaginationControls
        v-if="totalNewsPages > 1"
        :page="newsPage"
        :total-pages="totalNewsPages"
        :sibling-count="0"
        @update:page="emit('update:newsPage', $event)"
      />
    </section>
  </aside>
</template>

<style scoped>
.rail {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.rail__tools {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.rail__tools :deep(.search-box) {
  flex: 1;
}

.rail__filter-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  background: var(--bg-base);
  color: var(--text-secondary);
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease;
}

.rail__filter-btn:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.rail__filter-btn--on {
  color: var(--accent);
  border-color: var(--accent);
}

.rail__filters {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-sm);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  background: var(--bg-surface);
}

.rail__filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.rail__filter-label {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
}

.rail__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.rail__chip {
  padding: 3px 10px;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: 0.72rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
}

.rail__chip:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.rail__chip--active {
  border-color: var(--chip-accent);
  color: var(--chip-accent);
  background: color-mix(in srgb, var(--chip-accent) 12%, transparent);
}

.rail__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.rail__heading {
  margin: 0;
  padding-bottom: var(--space-xs);
  border-bottom: 1px solid var(--bg-overlay);
  font-size: var(--text-caption);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
}

.rail__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.rail__empty {
  margin: 0;
  padding: var(--space-sm) 0;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}
</style>
