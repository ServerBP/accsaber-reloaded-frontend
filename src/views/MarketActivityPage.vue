<script setup lang="ts">
import BaseBanner from '@/components/common/BaseBanner.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseTabs from '@/components/common/BaseTabs.vue'
import Breadcrumbs, { type Crumb } from '@/components/common/Breadcrumbs.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import { usePageMeta } from '@/composables/usePageMeta'
import { useRefetchOnFocus } from '@/composables/useRefetchOnFocus'
import { useAuthStore } from '@/stores/auth'
import { useEssenceStore } from '@/stores/essence'
import type { MarketListingResponse } from '@/types/api/market'
import type { Tab } from '@/types/display'
import { isSameMarketUser } from '@/utils/market'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MarketListingCard, { type ListingCardTag } from './market/MarketListingCard.vue'
import MarketWallet from './market/MarketWallet.vue'

usePageMeta({
  title: 'My Market Activity | AccSaber',
  description: 'Track what you are selling, bidding on, and have won on the AccSaber market.',
})

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const essenceStore = useEssenceStore()

type TabKey = 'selling' | 'bidding' | 'won'

const involvement = ref<MarketListingResponse[]>([])
const outbidListings = ref<MarketListingResponse[]>([])
const loading = ref(true)
let requestId = 0

const viewerId = computed(() => authStore.userId)

const activeTab = computed<TabKey>({
  get: () => {
    const tab = route.query.tab
    return tab === 'bidding' || tab === 'won' ? tab : 'selling'
  },
  set: (value) => {
    const query = { ...route.query }
    if (value === 'selling') delete query.tab
    else query.tab = value
    router.replace({ query })
  },
})

const listingEndsMs = (l: MarketListingResponse) =>
  l.endsAt ? new Date(l.endsAt).getTime() : Number.POSITIVE_INFINITY

const settledMs = (l: MarketListingResponse) =>
  new Date(l.settledAt ?? l.endsAt ?? l.createdAt).getTime()

const endsSoonestFirst = (a: MarketListingResponse, b: MarketListingResponse) =>
  listingEndsMs(a) - listingEndsMs(b)

const settledLatestFirst = (a: MarketListingResponse, b: MarketListingResponse) =>
  settledMs(b) - settledMs(a)

const selling = computed(() => {
  const mine = involvement.value.filter((l) => isSameMarketUser(l.seller, viewerId.value))
  const open = mine.filter((l) => l.status === 'active').sort(endsSoonestFirst)
  const closed = mine.filter((l) => l.status !== 'active').sort(settledLatestFirst)
  return [...open, ...closed]
})

const winning = computed(() =>
  involvement.value
    .filter(
      (l) =>
        l.status === 'active' &&
        !isSameMarketUser(l.seller, viewerId.value) &&
        isSameMarketUser(l.currentBidder, viewerId.value),
    )
    .sort(endsSoonestFirst),
)

const outbid = computed(() =>
  outbidListings.value.filter((l) => l.status === 'active').sort(endsSoonestFirst),
)

const lost = computed(() =>
  outbidListings.value.filter((l) => l.status !== 'active').sort(settledLatestFirst),
)

const bidding = computed(() => [...outbid.value, ...winning.value, ...lost.value])

const won = computed(() =>
  involvement.value
    .filter(
      (l) =>
        l.status === 'sold' &&
        isSameMarketUser(l.winner, viewerId.value) &&
        !isSameMarketUser(l.seller, viewerId.value),
    )
    .sort(settledLatestFirst),
)

const tabs = computed<Tab[]>(() => [
  { key: 'selling', label: `Selling (${selling.value.length})` },
  { key: 'bidding', label: `Bidding (${bidding.value.length})` },
  { key: 'won', label: `Won (${won.value.length})` },
])

const visibleListings = computed(() => {
  if (activeTab.value === 'bidding') return bidding.value
  if (activeTab.value === 'won') return won.value
  return selling.value
})

function tagFor(listing: MarketListingResponse): ListingCardTag | null {
  if (activeTab.value === 'selling') {
    if (listing.status === 'sold') return { label: 'Sold', tone: 'success' }
    if (listing.status === 'expired') return { label: 'Expired', tone: 'neutral' }
    if (listing.status === 'cancelled') return { label: 'Cancelled', tone: 'neutral' }
    return null
  }
  if (activeTab.value === 'won') return { label: 'Won', tone: 'gold' }
  if (listing.status !== 'active') return { label: 'Lost', tone: 'neutral' }
  return isSameMarketUser(listing.currentBidder, viewerId.value)
    ? { label: 'Winning', tone: 'success' }
    : { label: 'Outbid', tone: 'error' }
}

const emptyMessage = computed(() => {
  if (activeTab.value === 'bidding') return "You haven't bid on anything yet."
  if (activeTab.value === 'won') return "Nothing won yet. Go outbid someone."
  return "You're not selling anything right now."
})

async function fetchActivity(background = false) {
  if (!authStore.isLoggedIn) return
  const id = ++requestId
  if (!background) loading.value = true
  try {
    const { getMyMarketListings, getMyMarketBids, getMarketListing } = await import('@/api/market')
    const [involvedPage, bidsPage] = await Promise.all([
      getMyMarketListings({ page: 0, size: 100, sort: 'endsAt,desc' }),
      getMyMarketBids({ page: 0, size: 50 }),
    ])
    if (id !== requestId) return
    involvement.value = involvedPage.content
    const involvedIds = new Set(involvedPage.content.map((l) => l.id))
    const missingIds = [...new Set(bidsPage.content.map((b) => b.listingId))].filter(
      (listingId) => !involvedIds.has(listingId),
    )
    const extras = await Promise.all(
      missingIds.map((listingId) => getMarketListing(listingId).catch(() => null)),
    )
    if (id !== requestId) return
    outbidListings.value = extras.filter((l): l is MarketListingResponse => l !== null)
  } catch {
    if (id !== requestId) return
    if (!background) {
      involvement.value = []
      outbidListings.value = []
    }
  }
  if (id === requestId && !background) loading.value = false
}

watch(
  () => authStore.isLoggedIn,
  (loggedIn) => {
    if (loggedIn) {
      fetchActivity()
      essenceStore.fetchBalance()
    }
  },
  { immediate: true },
)

useRefetchOnFocus(() => fetchActivity(true))

const breadcrumbs: Crumb[] = [
  { label: 'Market Hub', to: { name: 'market' } },
  { label: 'My activity' },
]
</script>

<template>
  <div class="activity-page" :style="{ '--page-accent': 'var(--accent-overall)' }">
    <Breadcrumbs :crumbs="breadcrumbs" />

    <div class="activity-page__header">
      <div>
        <h1 class="activity-page__title">My Market Activity</h1>
        <p class="activity-page__subtitle">Selling, bidding, and wins in one place</p>
      </div>
      <div v-if="authStore.isLoggedIn" class="activity-page__header-actions">
        <MarketWallet
          v-if="essenceStore.balance !== null"
          :balance="essenceStore.balance"
          :reserved="essenceStore.reserved ?? 0"
        />
        <BaseButton variant="primary" @click="router.push({ name: 'market-new' })">
          List an item
        </BaseButton>
      </div>
    </div>

    <EmptyState v-if="!authStore.isLoggedIn" message="Sign in to see your market activity." />

    <template v-else>
      <BaseBanner
        v-if="!loading && outbid.length > 0"
        variant="error"
        role="alert"
        :dismissible="false"
      >
        You've been outbid on {{ outbid.length }}
        {{ outbid.length === 1 ? 'auction' : 'auctions' }}.
      </BaseBanner>

      <BaseTabs :tabs="tabs" :model-value="activeTab" @update:model-value="activeTab = $event as TabKey" />

      <div v-if="loading" class="activity-page__grid">
        <SkeletonLoader v-for="i in 8" :key="i" variant="card" />
      </div>

      <EmptyState
        v-else-if="visibleListings.length === 0"
        :message="emptyMessage"
        :action-label="activeTab === 'selling' ? 'List an item' : 'Browse the market'"
        @action="
          router.push({ name: activeTab === 'selling' ? 'market-new' : 'market' })
        "
      />

      <div v-else class="activity-page__grid">
        <MarketListingCard
          v-for="listing in visibleListings"
          :key="listing.id"
          :listing="listing"
          :tag="tagFor(listing)"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.activity-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.activity-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.activity-page__title {
  font-size: var(--text-page-title);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.activity-page__subtitle {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  margin: var(--space-xs) 0 0;
}

.activity-page__header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.activity-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-md);
}

@media (max-width: 767px) {
  .activity-page__grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }
}
</style>
