<script setup lang="ts">
import { getApiErrorMessage } from '@/api/client'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import PageHeaderBleed from '@/components/common/PageHeaderBleed.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import CampaignRow from '@/components/domain/CampaignRow.vue'
import { usePageableRoute } from '@/composables/usePageableRoute'
import { useAuthStore } from '@/stores/auth'
import { useCategoryStore } from '@/stores/categories'
import type {
  CampaignCollaboratorResponse,
  CampaignDetailResponse,
  CampaignProgressSummary,
  CampaignResponse,
  CampaignTagResponse,
} from '@/types/api/campaigns'
import type { Page } from '@/types/pagination'
import type { CampaignStatus } from '@/types/enums'
import { isAdminSubdomain } from '@/utils/subdomain'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

type Pane = 'all' | 'mine' | 'started' | 'review' | 'drafts' | 'invites'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const categoryStore = useCategoryStore()

const isCurator = computed(() => auth.hasRole('CAMPAIGN_CURATOR'))
const canReview = computed(() => isCurator.value && isAdminSubdomain)

const pane = computed<Pane>(() => {
  const v = (route.query.pane as string | undefined) ?? 'all'
  if (v === 'mine' || v === 'started') return v
  if (v === 'invites' && auth.isLoggedIn) return 'invites'
  if ((v === 'review' || v === 'drafts') && canReview.value) return v
  return 'all'
})

const curatedOnly = computed(() => route.query.curated === '1')

const officialOnly = computed(() => route.query.official === '1')

const searchTerm = computed(() => {
  const raw = route.query.q
  return typeof raw === 'string' ? raw.trim() : ''
})

const selectedTagIds = computed<string[]>(() => {
  const raw = route.query.tags
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter(Boolean) as string[]
  return String(raw).split(',').filter(Boolean)
})

const tags = ref<CampaignTagResponse[]>([])
const tagsOpen = ref(false)
const rulesOpen = ref(false)

const CAMPAIGN_RULES = [
  {
    title: 'No impersonation.',
    text: 'Do not use aliases to pass yourself off as another person.',
  },
  {
    title: 'Keep artwork clean.',
    text: 'No NSFW or questionable imagery in campaign icons or backgrounds.',
  },
  {
    title: 'No discriminatory language.',
    text: 'Anywhere: names, summaries, descriptions, or text labels.',
  },
  {
    title: 'No harassment.',
    text: 'Do not use a campaign to target, call out, or shame other players.',
  },
  {
    title: 'No spam or advertising.',
    text: 'Campaigns are for playing, not for promoting unrelated services or links.',
  },
  {
    title: 'No plagiarism.',
    text: "Do not republish another creator's campaign or artwork as your own.",
  },
]

function goToNewCampaign() {
  router.push({ name: 'campaign-new' })
}

const items = ref<CampaignResponse[]>([])
const totalPages = ref(1)
const loading = ref(false)
const error = ref<string | null>(null)

const progressMap = ref(new Map<string, CampaignProgressSummary>())

const pendingInvites = ref<CampaignCollaboratorResponse[]>([])
const invitesLoading = ref(false)
const respondingId = ref<string | null>(null)
const mineCollabs = ref<CampaignDetailResponse[]>([])

const { currentPage, paginationParams, setPage, sortState } = usePageableRoute({
  defaultSort: 'createdAt',
  defaultSize: 20,
  secondarySort: null,
})

const SORT_OPTIONS = [
  { key: 'createdAt', order: 'desc', label: 'Newest' },
  { key: 'voteScore', order: 'desc', label: 'Top rated' },
  { key: 'name', order: 'asc', label: 'A-Z' },
] as const

function setSortOption(option: (typeof SORT_OPTIONS)[number]) {
  const query = { ...route.query }
  if (option.key === 'createdAt') {
    delete query.sort
    delete query.order
  } else {
    query.sort = option.key
    query.order = option.order
  }
  delete query.page
  router.replace({ query })
}

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

async function loadInvites() {
  if (!auth.isLoggedIn) {
    pendingInvites.value = []
    return
  }
  invitesLoading.value = true
  try {
    const { getMyCollaborations } = await import('@/api/campaigns')
    const page = await getMyCollaborations({ status: 'PENDING', size: 50 })
    pendingInvites.value = page.content
  } catch {
    pendingInvites.value = []
  } finally {
    invitesLoading.value = false
  }
}

async function acceptInvite(inv: CampaignCollaboratorResponse) {
  respondingId.value = inv.id
  error.value = null
  try {
    const { acceptCampaignCollaboration } = await import('@/api/campaigns')
    await acceptCampaignCollaboration(inv.campaignId)
    pendingInvites.value = pendingInvites.value.filter((i) => i.id !== inv.id)
  } catch (err) {
    error.value = getApiErrorMessage(err, 'Failed to accept invite')
  } finally {
    respondingId.value = null
  }
}

async function declineInvite(inv: CampaignCollaboratorResponse) {
  respondingId.value = inv.id
  error.value = null
  try {
    const { declineCampaignCollaboration } = await import('@/api/campaigns')
    await declineCampaignCollaboration(inv.campaignId)
    pendingInvites.value = pendingInvites.value.filter((i) => i.id !== inv.id)
  } catch (err) {
    error.value = getApiErrorMessage(err, 'Failed to decline invite')
  } finally {
    respondingId.value = null
  }
}

async function loadMineCollabs() {
  if (!auth.isLoggedIn) {
    mineCollabs.value = []
    return
  }
  try {
    const { getMyCollaborations, getCampaign } = await import('@/api/campaigns')
    const page = await getMyCollaborations({ status: 'ACCEPTED', size: 50 })
    const details = await Promise.all(
      page.content.map((c) => getCampaign(c.campaignId).catch(() => null)),
    )
    mineCollabs.value = details.filter((c): c is CampaignDetailResponse => !!c)
  } catch {
    mineCollabs.value = []
  }
}

async function loadCampaigns() {
  if (pane.value === 'invites') {
    void loadInvites()
    return
  }
  loading.value = true
  error.value = null
  mineCollabs.value = []
  try {
    if (pane.value === 'started') {
      if (!auth.isLoggedIn) {
        items.value = []
        totalPages.value = 1
        return
      }
      const { getMyCampaigns } = await import('@/api/campaigns')
      const page = await getMyCampaigns({
        page: paginationParams.value.page,
        size: paginationParams.value.size,
        sort: 'createdAt,desc',
      })
      totalPages.value = page.totalPages || 1
      items.value = page.content.map((c) => c.campaign)
      const nextMap = new Map(progressMap.value)
      for (const c of page.content) nextMap.set(c.campaign.id, c)
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
        sort: 'createdAt,desc',
        creatorId: auth.userId,
      })
      items.value = page.content
      totalPages.value = page.totalPages || 1
      if (currentPage.value === 1) await loadMineCollabs()
    } else if (pane.value === 'review') {
      if (!canReview.value) {
        items.value = []
        totalPages.value = 1
        return
      }
      const { getCurationQueue } = await import('@/api/campaigns')
      const page = await getCurationQueue({
        page: paginationParams.value.page,
        size: paginationParams.value.size,
        sort: 'createdAt,desc',
      })
      items.value = page.content
      totalPages.value = page.totalPages || 1
    } else if (pane.value === 'drafts') {
      if (!canReview.value) {
        items.value = []
        totalPages.value = 1
        return
      }
      const { getCampaigns: fetchCampaigns } = await import('@/api/campaigns')
      const page: Page<CampaignResponse> = await fetchCampaigns({
        page: paginationParams.value.page,
        size: paginationParams.value.size,
        sort: 'createdAt,desc',
        status: ['DRAFT'],
        search: searchTerm.value || undefined,
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
        search: searchTerm.value || undefined,
        official: officialOnly.value || undefined,
      })
      items.value = page.content
      totalPages.value = page.totalPages || 1

      if (auth.isLoggedIn && items.value.length > 0) {
        const ids = items.value.map((c) => c.id)
        const progressList = await getMyCampaignProgressBulk(ids)
        const nextMap = new Map(progressMap.value)
        for (const p of progressList) nextMap.set(p.campaign.id, p)
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

function setSearch(value: string) {
  const trimmed = value.trim()
  const query = { ...route.query }
  if (trimmed) query.q = trimmed
  else delete query.q
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

function toggleOfficialOnly() {
  const query = { ...route.query }
  if (officialOnly.value) {
    delete query.official
  } else {
    query.official = '1'
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
  void loadInvites()
})

watch(
  () => [
    pane.value,
    curatedOnly.value,
    officialOnly.value,
    selectedTagIds.value.join(','),
    searchTerm.value,
    paginationParams.value.page,
    String(paginationParams.value.sort),
  ],
  () => {
    void loadCampaigns()
  },
)

watch(
  () => auth.isLoggedIn,
  (next, prev) => {
    if (next !== prev) {
      void loadCampaigns()
      void loadInvites()
    }
  },
)
</script>

<template>
  <div class="campaigns-page" style="--page-accent: var(--accent-overall);">
    <PageHeaderBleed title="Campaigns" subtitle="custom journeys through ranked maps" />

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
        <button v-if="auth.isLoggedIn" class="campaigns-page__pane"
          :class="{ 'campaigns-page__pane--active': pane === 'invites' }" @click="setPane('invites')">
          Invites
          <span v-if="pendingInvites.length > 0" class="campaigns-page__pane-badge">
            {{ pendingInvites.length }}
          </span>
        </button>
        <button v-if="canReview" class="campaigns-page__pane"
          :class="{ 'campaigns-page__pane--active': pane === 'review' }" @click="setPane('review')">
          Review
        </button>
        <button v-if="canReview" class="campaigns-page__pane"
          :class="{ 'campaigns-page__pane--active': pane === 'drafts' }" @click="setPane('drafts')">
          Drafts
        </button>
      </nav>

      <SearchBox v-if="pane === 'all' || pane === 'drafts'" class="campaigns-page__search" :model-value="searchTerm"
        placeholder="Search title or creator..." @update:model-value="setSearch" />

      <div class="campaigns-page__bar-actions">
        <button type="button" class="campaigns-page__rules-btn" @click="rulesOpen = true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Rules
        </button>
        <button v-if="auth.isLoggedIn || isCurator" type="button" class="campaigns-page__new"
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

    <div v-if="pane === 'all'" class="campaigns-page__toolbar">
      <div class="campaigns-page__sort" role="radiogroup" aria-label="Sort campaigns">
        <button v-for="option in SORT_OPTIONS" :key="option.key" type="button" role="radio"
          class="campaigns-page__sort-btn"
          :class="{ 'campaigns-page__sort-btn--active': sortState.key === option.key }"
          :aria-checked="sortState.key === option.key" @click="setSortOption(option)">
          {{ option.label }}
        </button>
      </div>

      <div class="campaigns-page__toolbar-right">
        <button type="button" class="campaigns-page__chip campaigns-page__chip--toggle"
          :class="{ 'campaigns-page__chip--active': officialOnly }" @click="toggleOfficialOnly">
          Official only
        </button>

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
      </div>
    </div>

    <div v-if="error" class="campaigns-page__error" role="alert">{{ error }}</div>

    <template v-if="pane === 'invites'">
      <EmptyState v-if="!auth.isLoggedIn" message="Sign in to see your collaboration invites." />
      <div v-else-if="invitesLoading" class="campaigns-page__list">
        <SkeletonLoader v-for="i in 3" :key="i" variant="card" />
      </div>
      <EmptyState v-else-if="pendingInvites.length === 0"
        message="No pending invites. When someone invites you to collaborate, it lands here." />
      <ul v-else class="campaigns-page__invites">
        <li v-for="inv in pendingInvites" :key="inv.id" class="campaigns-page__invite">
          <router-link class="campaigns-page__invite-main"
            :to="{ name: 'campaign-detail', params: { campaignId: inv.campaignSlug || inv.campaignId } }">
            <span class="campaigns-page__invite-name">{{ inv.campaignName }}</span>
            <span class="campaigns-page__invite-sub">Invitation to collaborate</span>
          </router-link>
          <div class="campaigns-page__invite-actions">
            <BaseButton size="sm" variant="primary" :loading="respondingId === inv.id"
              @click="acceptInvite(inv)">
              Accept
            </BaseButton>
            <BaseButton size="sm" :disabled="respondingId === inv.id" @click="declineInvite(inv)">
              Decline
            </BaseButton>
          </div>
        </li>
      </ul>
    </template>

    <template v-else>
      <div v-if="loading" class="campaigns-page__list">
        <SkeletonLoader v-for="i in 4" :key="i" variant="card" />
      </div>

      <EmptyState v-else-if="pane === 'started' && !auth.isLoggedIn"
        message="Sign in to track campaigns you've started." />

      <EmptyState v-else-if="pane === 'started' && items.length === 0"
        message="You haven't started any campaigns yet. Browse the catalogue to begin one." />

      <EmptyState v-else-if="pane === 'mine' && !auth.isLoggedIn"
        message="Sign in to see your created campaigns." />

      <EmptyState v-else-if="pane === 'mine' && items.length === 0 && mineCollabs.length === 0"
        message="You haven't drafted any campaigns yet. Use New campaign to start one." />

      <EmptyState v-else-if="pane === 'review' && items.length === 0"
        message="Nothing in the curation queue right now." />

      <EmptyState v-else-if="pane === 'drafts' && items.length === 0"
        message="No draft campaigns match this search." />

      <EmptyState v-else-if="pane !== 'mine' && items.length === 0"
        message="No campaigns match these filters." />

      <div v-else class="campaigns-page__list">
        <CampaignRow v-for="c in (pane === 'mine' ? mineCollabs : [])" :key="`collab-${c.id}`"
          :campaign="c" :editor-link="true" collab />
        <CampaignRow v-for="campaign in items" :key="campaign.id" :campaign="campaign"
          :progress="progressMap.get(campaign.id) ?? null"
          :editor-link="pane === 'mine' || pane === 'review' || pane === 'drafts'" />
      </div>

      <div v-if="totalPages > 1 && !loading" class="campaigns-page__pagination">
        <PaginationControls :page="currentPage" :total-pages="totalPages" @update:page="setPage" />
      </div>
    </template>

    <BaseModal :open="rulesOpen" title="Campaign rules" max-width="480px" @close="rulesOpen = false">
      <div class="campaigns-page__rules">
        <p class="campaigns-page__rules-lead">
          Campaigns are player-made and public. Keep yours within these rules:
        </p>
        <ol class="campaigns-page__rules-list">
          <li v-for="(rule, i) in CAMPAIGN_RULES" :key="rule.title" class="campaigns-page__rule">
            <span class="campaigns-page__rule-num" aria-hidden="true">{{ i + 1 }}</span>
            <span class="campaigns-page__rule-text">
              <strong>{{ rule.title }}</strong> {{ rule.text }}
            </span>
          </li>
        </ol>
        <p class="campaigns-page__rules-note">
          By creating a campaign, you agree to these rules. Breaking them results in an automatic,
          indefinite suspension from every AccSaber feature.
        </p>
      </div>
    </BaseModal>
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
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-md);
}

.campaigns-page__panes {
  display: flex;
  gap: 2px;
  padding: 2px;
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 4px;
  grid-column: 1;
  justify-self: start;
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
  display: inline-flex;
  align-items: center;
  gap: 6px;
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

.campaigns-page__pane-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--page-accent);
  background: color-mix(in srgb, var(--page-accent) 16%, transparent);
  border-radius: 999px;
}

.campaigns-page__pane:hover {
  color: var(--text-primary);
}

.campaigns-page__pane--active {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.campaigns-page__bar-actions {
  grid-column: 3;
  justify-self: end;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-sm);
}

.campaigns-page__search {
  grid-column: 2;
  justify-self: center;
  width: 320px;
  max-width: 100%;
}

.campaigns-page__chip--toggle {
  padding: 6px 12px;
  font-size: 0.6875rem;
}

.campaigns-page__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-top: calc(-1 * var(--space-sm));
}

.campaigns-page__toolbar-right {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.campaigns-page__sort {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
}

.campaigns-page__sort-btn {
  padding: 4px 10px;
  background: transparent;
  border: none;
  border-radius: 2px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: color 120ms ease, background 120ms ease;
}

.campaigns-page__sort-btn:hover {
  color: var(--text-primary);
}

.campaigns-page__sort-btn--active {
  color: var(--text-primary);
  background: var(--bg-elevated);
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
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
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

.campaigns-page__invites {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.campaigns-page__invite {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: 4px;
}

.campaigns-page__invite-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  text-decoration: none;
  color: inherit;
}

.campaigns-page__invite-name {
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 120ms ease;
}

.campaigns-page__invite-main:hover .campaigns-page__invite-name {
  color: var(--page-accent);
}

.campaigns-page__invite-sub {
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.campaigns-page__invite-actions {
  display: inline-flex;
  gap: var(--space-sm);
  flex-shrink: 0;
}

@media (max-width: 860px) {
  .campaigns-page__bar {
    grid-template-columns: 1fr;
  }

  .campaigns-page__panes {
    grid-column: 1;
    justify-self: start;
  }

  .campaigns-page__search,
  .campaigns-page__bar-actions {
    grid-column: 1;
    justify-self: stretch;
  }

  .campaigns-page__search {
    width: 100%;
  }

  .campaigns-page__bar-actions {
    justify-content: flex-start;
  }
}

.campaigns-page__rules-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: transparent;
  border: none;
  border-radius: 3px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: color 120ms ease;
}

.campaigns-page__rules-btn:hover {
  color: var(--text-primary);
}

.campaigns-page__rules {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.campaigns-page__rules-lead {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-secondary);
}

.campaigns-page__rules-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.campaigns-page__rule {
  display: flex;
  gap: var(--space-sm);
  align-items: baseline;
}

.campaigns-page__rule-num {
  flex-shrink: 0;
  min-width: 16px;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-tertiary);
  text-align: right;
}

.campaigns-page__rule-text {
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-secondary);
}

.campaigns-page__rule-text strong {
  font-weight: 600;
  color: var(--text-primary);
}

.campaigns-page__rules-note {
  margin: var(--space-sm) 0 0;
  padding: var(--space-md);
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--error) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--error) 40%, transparent);
  border-radius: 4px;
}

@media (max-width: 560px) {
  .campaigns-page__invite {
    flex-direction: column;
    align-items: stretch;
  }

  .campaigns-page__invite-actions {
    justify-content: flex-end;
  }
}
</style>
