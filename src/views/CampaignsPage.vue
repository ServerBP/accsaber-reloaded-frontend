<script setup lang="ts">
import { getApiErrorMessage } from '@/api/client'
import EmptyState from '@/components/common/EmptyState.vue'
import PageHeaderBleed from '@/components/common/PageHeaderBleed.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import CampaignRow from '@/components/domain/CampaignRow.vue'
import { usePageableRoute } from '@/composables/usePageableRoute'
import { useAuthStore } from '@/stores/auth'
import { useCategoryStore } from '@/stores/categories'
import type {
  CampaignProgressResponse,
  CampaignResponse,
  CampaignTagResponse,
} from '@/types/api/campaigns'
import type { Page } from '@/types/pagination'
import type { CampaignStatus } from '@/types/enums'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

type Pane = 'all' | 'mine' | 'started'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const categoryStore = useCategoryStore()

const pane = computed<Pane>(() => {
  const v = (route.query.pane as string | undefined) ?? 'all'
  if (v === 'mine' || v === 'started') return v
  return 'all'
})

const curatedOnly = computed(() => route.query.curated === '1')

const selectedTagIds = computed<string[]>(() => {
  const raw = route.query.tags
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter(Boolean) as string[]
  return String(raw).split(',').filter(Boolean)
})

const tags = ref<CampaignTagResponse[]>([])
const tagsOpen = ref(false)

function goToNewCampaign() {
  router.push({ name: 'campaign-new' })
}

const items = ref<CampaignResponse[]>([])
const totalPages = ref(1)
const loading = ref(false)
const error = ref<string | null>(null)

const progressMap = ref(new Map<string, CampaignProgressResponse>())

const { currentPage, paginationParams, setPage } = usePageableRoute({
  defaultSort: 'createdAt',
  defaultSize: 20,
  secondarySort: null,
})

const statusFilter = computed<CampaignStatus[]>(() =>
  curatedOnly.value ? ['CURATED'] : ['PUBLISHED', 'CURATED'],
)

async function loadTags() {
  if (tags.value.length > 0) return
  try {
    const { getCampaignTags } = await import('@/api/campaigns')
    tags.value = await getCampaignTags()
  } catch {
  }
}

async function loadCampaigns() {
  loading.value = true
  error.value = null
  try {
    if (pane.value === 'started') {
      if (!auth.isLoggedIn) {
        items.value = []
        totalPages.value = 1
        return
      }
      const { getMyCampaigns, getCampaign, getMyCampaignProgressBulk } = await import('@/api/campaigns')
      const page = await getMyCampaigns({
        page: paginationParams.value.page,
        size: paginationParams.value.size,
        sort: paginationParams.value.sort,
      })
      const ids = page.content.map((c) => c.campaignId)
      totalPages.value = page.totalPages || 1
      if (ids.length === 0) {
        items.value = []
        return
      }
      const details = await Promise.all(
        ids.map((id) => getCampaign(id).catch(() => null)),
      )
      items.value = details.filter((c): c is CampaignResponse => !!c)
      const progressList = await getMyCampaignProgressBulk(ids)
      const nextMap = new Map(progressMap.value)
      for (const p of progressList) nextMap.set(p.campaignId, p)
      progressMap.value = nextMap
    } else if (pane.value === 'mine') {
      if (!auth.isLoggedIn || !auth.userId) {
        items.value = []
        totalPages.value = 1
        return
      }
      const { getCampaigns: fetchCampaigns } = await import('@/api/campaigns')
      const page: Page<CampaignResponse> = await fetchCampaigns({
        page: paginationParams.value.page,
        size: paginationParams.value.size,
        sort: paginationParams.value.sort,
        creatorId: auth.userId,
      })
      items.value = page.content
      totalPages.value = page.totalPages || 1
    } else {
      const { getCampaigns: fetchCampaigns, getMyCampaignProgressBulk } = await import('@/api/campaigns')
      const page: Page<CampaignResponse> = await fetchCampaigns({
        page: paginationParams.value.page,
        size: paginationParams.value.size,
        sort: paginationParams.value.sort,
        tagIds: selectedTagIds.value.length > 0 ? selectedTagIds.value : undefined,
        status: statusFilter.value,
      })
      items.value = page.content
      totalPages.value = page.totalPages || 1

      if (auth.isLoggedIn && items.value.length > 0) {
        const ids = items.value.map((c) => c.id)
        const progressList = await getMyCampaignProgressBulk(ids)
        const nextMap = new Map(progressMap.value)
        for (const p of progressList) nextMap.set(p.campaignId, p)
        progressMap.value = nextMap
      }
    }
  } catch (err) {
    error.value = getApiErrorMessage(err, 'Failed to load campaigns')
    items.value = []
  } finally {
    loading.value = false
  }
}

function setPane(next: Pane) {
  if (next === pane.value) return
  const query = { ...route.query }
  if (next === 'all') {
    delete query.pane
  } else {
    query.pane = next
  }
  delete query.page
  router.replace({ query })
}

function toggleCuratedOnly() {
  const query = { ...route.query }
  if (curatedOnly.value) {
    delete query.curated
  } else {
    query.curated = '1'
  }
  delete query.page
  router.replace({ query })
}

function toggleTag(id: string) {
  const current = new Set(selectedTagIds.value)
  if (current.has(id)) current.delete(id)
  else current.add(id)
  const query = { ...route.query }
  const next = Array.from(current)
  if (next.length === 0) {
    delete query.tags
  } else {
    query.tags = next.join(',')
  }
  delete query.page
  router.replace({ query })
}

function clearTags() {
  const query = { ...route.query }
  delete query.tags
  delete query.page
  router.replace({ query })
}

const themeTags = computed(() => tags.value.filter((t) => t.kind === 'THEME'))

const genreTags = computed(() => tags.value.filter((t) => t.kind === 'GENRE'))

const categoryTags = computed(() => tags.value.filter((t) => t.kind === 'CATEGORY'))

const difficultyTags = computed(() => tags.value.filter((t) => t.kind === 'DIFFICULTY'))

function tagAccent(tag: CampaignTagResponse): string | null {
  if (tag.kind !== 'CATEGORY' || !tag.categoryId) return null
  const code = categoryStore.getCategoryCode(tag.categoryId)
  if (!code) return null
  return categoryStore.getCategoryInfo(code)?.accent ?? null
}

onMounted(() => {
  void loadTags()
  void loadCampaigns()
})

watch(
  () => [
    pane.value,
    curatedOnly.value,
    selectedTagIds.value.join(','),
    paginationParams.value.page,
  ],
  () => {
    void loadCampaigns()
  },
)

watch(
  () => auth.isLoggedIn,
  (next, prev) => {
    if (next !== prev) void loadCampaigns()
  },
)
</script>

<template>
  <div class="campaigns-page" style="--page-accent: var(--accent-overall);">
    <PageHeaderBleed title="Campaigns" subtitle="curated journeys through ranked maps" />

    <div class="campaigns-page__bar">
      <nav class="campaigns-page__panes" aria-label="Campaign panes">
        <button class="campaigns-page__pane" :class="{ 'campaigns-page__pane--active': pane === 'all' }"
          @click="setPane('all')">
          Browse
        </button>
        <button v-if="auth.isLoggedIn" class="campaigns-page__pane"
          :class="{ 'campaigns-page__pane--active': pane === 'started' }" @click="setPane('started')">
          Started
        </button>
        <button v-if="auth.isLoggedIn" class="campaigns-page__pane"
          :class="{ 'campaigns-page__pane--active': pane === 'mine' }" @click="setPane('mine')">
          Mine
        </button>
      </nav>

      <div class="campaigns-page__bar-actions">
        <template v-if="pane === 'all'">
          <button type="button" class="campaigns-page__chip campaigns-page__chip--toggle"
            :class="{ 'campaigns-page__chip--active': curatedOnly }" @click="toggleCuratedOnly">
            Curated only
          </button>

          <details class="campaigns-page__tags-disclosure"
            :open="tagsOpen" @toggle="tagsOpen = ($event.target as HTMLDetailsElement).open">
            <summary>
              <span>Tags</span>
              <span v-if="selectedTagIds.length > 0" class="campaigns-page__tags-count">
                {{ selectedTagIds.length }}
              </span>
            </summary>
            <div class="campaigns-page__tags-panel">
              <div v-if="categoryTags.length > 0" class="campaigns-page__chip-group">
                <span class="campaigns-page__chip-label">Category</span>
                <button v-for="tag in categoryTags" :key="tag.id" type="button"
                  class="campaigns-page__chip campaigns-page__chip--category"
                  :class="{ 'campaigns-page__chip--active': selectedTagIds.includes(tag.id) }"
                  :style="{ '--chip-accent': tagAccent(tag) ?? 'var(--accent)' }" @click="toggleTag(tag.id)">
                  {{ tag.name }}
                </button>
              </div>
              <div v-if="difficultyTags.length > 0" class="campaigns-page__chip-group">
                <span class="campaigns-page__chip-label">Tier</span>
                <button v-for="tag in difficultyTags" :key="tag.id" type="button" class="campaigns-page__chip"
                  :class="{ 'campaigns-page__chip--active': selectedTagIds.includes(tag.id) }"
                  @click="toggleTag(tag.id)">
                  {{ tag.name }}
                </button>
              </div>
              <div v-if="themeTags.length > 0" class="campaigns-page__chip-group">
                <span class="campaigns-page__chip-label">Theme</span>
                <button v-for="tag in themeTags" :key="tag.id" type="button" class="campaigns-page__chip"
                  :class="{ 'campaigns-page__chip--active': selectedTagIds.includes(tag.id) }"
                  @click="toggleTag(tag.id)">
                  {{ tag.name }}
                </button>
              </div>
              <div v-if="genreTags.length > 0" class="campaigns-page__chip-group">
                <span class="campaigns-page__chip-label">Genre</span>
                <button v-for="tag in genreTags" :key="tag.id" type="button" class="campaigns-page__chip"
                  :class="{ 'campaigns-page__chip--active': selectedTagIds.includes(tag.id) }"
                  @click="toggleTag(tag.id)">
                  {{ tag.name }}
                </button>
              </div>
              <button v-if="selectedTagIds.length > 0" type="button" class="campaigns-page__clear"
                @click="clearTags">
                Clear tags
              </button>
            </div>
          </details>
        </template>

        <button v-if="auth.isLoggedIn" type="button" class="campaigns-page__new"
          @click="goToNewCampaign">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New campaign
        </button>
      </div>
    </div>

    <div v-if="error" class="campaigns-page__error" role="alert">{{ error }}</div>

    <div v-if="loading" class="campaigns-page__list">
      <SkeletonLoader v-for="i in 4" :key="i" variant="card" />
    </div>

    <EmptyState v-else-if="pane === 'started' && !auth.isLoggedIn"
      message="Sign in to track campaigns you've started." />

    <EmptyState v-else-if="pane === 'started' && items.length === 0"
      message="You haven't started any campaigns yet. Browse the catalogue to begin one." />

    <EmptyState v-else-if="pane === 'mine' && !auth.isLoggedIn"
      message="Sign in to see your created campaigns." />

    <EmptyState v-else-if="pane === 'mine' && items.length === 0"
      message="You haven't drafted any campaigns yet. Use New campaign to start one." />

    <EmptyState v-else-if="items.length === 0"
      message="No campaigns match these filters." />

    <div v-else class="campaigns-page__list">
      <CampaignRow v-for="campaign in items" :key="campaign.id" :campaign="campaign"
        :progress="progressMap.get(campaign.id) ?? null" />
    </div>

    <div v-if="totalPages > 1 && !loading" class="campaigns-page__pagination">
      <PaginationControls :page="currentPage" :total-pages="totalPages" @update:page="setPage" />
    </div>
  </div>
</template>

<style scoped>
.campaigns-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 var(--space-md) var(--space-2xl);
}

.campaigns-page__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.campaigns-page__panes {
  display: flex;
  gap: 2px;
  padding: 2px;
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 4px;
  align-self: flex-start;
}

.campaigns-page__new {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--page-accent);
  background: transparent;
  border: 1px solid var(--page-accent);
  border-radius: 3px;
  cursor: pointer;
  transition: color 120ms ease, background 120ms ease;
}

.campaigns-page__new:hover {
  background: color-mix(in srgb, var(--page-accent) 12%, transparent);
}

.campaigns-page__pane {
  padding: 6px var(--space-md);
  background: none;
  border: none;
  border-radius: 2px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 120ms ease, background 120ms ease;
}

.campaigns-page__pane:hover {
  color: var(--text-primary);
}

.campaigns-page__pane--active {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.campaigns-page__bar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-sm);
}

.campaigns-page__chip--toggle {
  padding: 6px 12px;
  font-size: 0.6875rem;
}

.campaigns-page__tags-disclosure {
  position: relative;
}

.campaigns-page__tags-disclosure > summary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  cursor: pointer;
  list-style: none;
  transition: color 120ms ease, border-color 120ms ease;
}

.campaigns-page__tags-disclosure > summary::-webkit-details-marker {
  display: none;
}

.campaigns-page__tags-disclosure > summary:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.campaigns-page__tags-disclosure[open] > summary {
  color: var(--page-accent);
  border-color: var(--page-accent);
}

.campaigns-page__tags-count {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--page-accent);
  letter-spacing: 0;
  text-transform: none;
}

.campaigns-page__tags-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 10;
  min-width: 320px;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.campaigns-page__chip-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.campaigns-page__chip-label {
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  margin-right: 4px;
}

.campaigns-page__chip {
  padding: 3px 8px;
  background: transparent;
  border: 1px solid var(--bg-overlay);
  border-radius: 2px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
  white-space: nowrap;
}

.campaigns-page__chip:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.campaigns-page__chip--active {
  color: var(--text-primary);
  border-color: var(--text-secondary);
  background: var(--bg-elevated);
}

.campaigns-page__chip--category.campaigns-page__chip--active {
  color: var(--chip-accent, var(--accent));
  border-color: var(--chip-accent, var(--accent));
  background: color-mix(in srgb, var(--chip-accent, var(--accent)) 12%, transparent);
}

.campaigns-page__clear {
  margin-left: auto;
  padding: 4px var(--space-sm);
  background: none;
  border: none;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: color 120ms ease;
}

.campaigns-page__clear:hover {
  color: var(--text-primary);
}

.campaigns-page__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-md);
}

.campaigns-page__pagination {
  display: flex;
  justify-content: center;
}

.campaigns-page__error {
  padding: var(--space-md);
  font-size: var(--text-caption);
  color: var(--error);
  background: color-mix(in srgb, var(--error) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--error) 40%, transparent);
  border-radius: 4px;
}
</style>
