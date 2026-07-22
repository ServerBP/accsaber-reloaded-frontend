<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import FilterButton from '@/components/common/FilterButton.vue'
import FilterPopover from '@/components/common/FilterPopover.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import { usePageMeta } from '@/composables/usePageMeta'
import { useRefetchOnFocus } from '@/composables/useRefetchOnFocus'
import { useAuthStore } from '@/stores/auth'
import { useEssenceStore } from '@/stores/essence'
import { useTradeStore } from '@/stores/trades'
import { useItemModifierStore } from '@/stores/itemModifiers'
import { useItemTypeStore } from '@/stores/itemTypes'
import { modifierAccentHex } from '@/utils/items'
import type { ItemRarity, UnusualEffectGroupsResponse } from '@/types/api/items'
import type {
  MarketBrowseParams,
  MarketKind,
  MarketListingResponse,
  MarketSortOption,
} from '@/types/api/market'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { EffectCrateGroup, EffectOption } from './market/MarketEffectFilter.vue'
import MarketFilterPanel, {
  type MarketModifierOption,
  type MarketTypeOption,
} from './market/MarketFilterPanel.vue'
import MarketListingCard from './market/MarketListingCard.vue'
import MarketWallet from './market/MarketWallet.vue'

usePageMeta({
  title: 'Market Hub | AccSaber',
  description: 'Buy, sell, bid on, and trade AccSaber items.',
})

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const essenceStore = useEssenceStore()
const itemTypeStore = useItemTypeStore()
const itemModifierStore = useItemModifierStore()
const tradeStore = useTradeStore()

const SORT_OPTIONS: { value: MarketSortOption; label: string }[] = [
  { value: 'ending_soon', label: 'Ending soon' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
]

const KIND_OPTIONS: { value: MarketKind | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'auction', label: 'Auctions' },
  { value: 'shop', label: 'Buy now' },
]

function queryList(key: string): string[] {
  const value = route.query[key]
  if (!value) return []
  return (Array.isArray(value) ? value : [value]).filter((v): v is string => typeof v === 'string')
}

function replaceQuery(patch: Record<string, string | string[] | undefined>) {
  const query: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(route.query)) {
    if (value != null) query[key] = value as string | string[]
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || (Array.isArray(value) && value.length === 0) || value === '') {
      delete query[key]
    } else {
      query[key] = value
    }
  }
  delete query.page
  router.replace({ query })
}

const search = computed<string>({
  get: () => (route.query.search as string) ?? '',
  set: (value) => replaceQuery({ search: value.trim() || undefined }),
})

const rarities = computed<ItemRarity[]>({
  get: () => queryList('rarity') as ItemRarity[],
  set: (value) => replaceQuery({ rarity: value }),
})

const typeKeys = computed<string[]>({
  get: () => queryList('type'),
  set: (value) => replaceQuery({ type: value }),
})

const modifierKeys = computed<string[]>({
  get: () => queryList('modifier'),
  set: (value) => replaceQuery({ modifier: value }),
})

const effectKeys = computed<string[]>({
  get: () => queryList('effect'),
  set: (value) => replaceQuery({ effect: value }),
})

const kind = computed<MarketKind | ''>({
  get: () => {
    const value = route.query.kind
    return value === 'auction' || value === 'shop' ? value : ''
  },
  set: (value) => replaceQuery({ kind: value || undefined }),
})

const minPrice = computed<number | null>({
  get: () => {
    const value = Number(route.query.min)
    return Number.isSafeInteger(value) && value > 0 ? value : null
  },
  set: (value) => replaceQuery({ min: value != null ? String(value) : undefined }),
})

const maxPrice = computed<number | null>({
  get: () => {
    const value = Number(route.query.max)
    return Number.isSafeInteger(value) && value > 0 ? value : null
  },
  set: (value) => replaceQuery({ max: value != null ? String(value) : undefined }),
})

const sortBy = computed<MarketSortOption>({
  get: () => {
    const value = route.query.sort
    return SORT_OPTIONS.some((o) => o.value === value) ? (value as MarketSortOption) : 'ending_soon'
  },
  set: (value) => replaceQuery({ sort: value === 'ending_soon' ? undefined : value }),
})

const currentPage = computed<number>(() => {
  const page = Number(route.query.page)
  return page > 0 ? page : 1
})

function setPage(page: number) {
  const query = { ...route.query }
  if (page <= 1) delete query.page
  else query.page = String(page)
  router.push({ query })
}

const hasActiveFilters = computed(
  () =>
    rarities.value.length > 0 ||
    typeKeys.value.length > 0 ||
    modifierKeys.value.length > 0 ||
    effectKeys.value.length > 0 ||
    kind.value !== '' ||
    minPrice.value != null ||
    maxPrice.value != null,
)

function clearFilters() {
  replaceQuery({
    rarity: undefined,
    type: undefined,
    modifier: undefined,
    effect: undefined,
    kind: undefined,
    min: undefined,
    max: undefined,
  })
}

const typeOptions = computed<MarketTypeOption[]>(() =>
  itemTypeStore.itemTypes
    .filter((t) => t.active && t.parentTypeId == null)
    .map((t) => ({ key: t.key, label: t.name })),
)

const modifierOptions = computed<MarketModifierOption[]>(() =>
  itemModifierStore.modifiers
    .filter((m) => m.active)
    .map((m) => ({ key: m.key, label: m.name, colorHex: modifierAccentHex(m) })),
)

const effectGroupsData = ref<UnusualEffectGroupsResponse | null>(null)

const effectGroups = computed<EffectCrateGroup[]>(() =>
  (effectGroupsData.value?.groups ?? [])
    .map((g) => ({
      crateId: g.crateId,
      crateName: g.crateName,
      crateIconUrl: g.crateIconUrl,
      effects: g.effects
        .filter((e) => e.active)
        .map((e) => ({ id: e.id, key: e.key, label: e.name })),
    }))
    .filter((g) => g.effects.length > 0),
)

const ungroupedEffects = computed<EffectOption[]>(() =>
  (effectGroupsData.value?.ungrouped ?? [])
    .filter((e) => e.active)
    .map((e) => ({ id: e.id, key: e.key, label: e.name })),
)

async function fetchUnusualEffects() {
  try {
    const { getUnusualEffectGroups } = await import('@/api/items')
    effectGroupsData.value = await getUnusualEffectGroups()
  } catch {
    effectGroupsData.value = null
  }
}

const filtersOpen = ref(false)
const listings = ref<MarketListingResponse[]>([])
const totalPages = ref(0)
const totalElements = ref(0)
const loading = ref(true)
let requestId = 0

const browseParams = computed<MarketBrowseParams>(() => ({
  search: search.value || undefined,
  rarity: rarities.value.length > 0 ? rarities.value : undefined,
  typeKey: typeKeys.value.length > 0 ? typeKeys.value : undefined,
  modifierKey: modifierKeys.value.length > 0 ? modifierKeys.value : undefined,
  effectKey: effectKeys.value.length > 0 ? effectKeys.value : undefined,
  kind: kind.value || undefined,
  minPrice: minPrice.value ?? undefined,
  maxPrice: maxPrice.value ?? undefined,
  sortBy: sortBy.value,
  page: currentPage.value - 1,
  size: 30,
}))

async function fetchListings(background = false) {
  const id = ++requestId
  if (!background) loading.value = true
  try {
    const { getMarketListings } = await import('@/api/market')
    const page = await getMarketListings(browseParams.value)
    if (id !== requestId) return
    listings.value = page.content
    totalPages.value = page.totalPages
    totalElements.value = page.totalElements
  } catch {
    if (id !== requestId) return
    listings.value = []
    totalPages.value = 0
    totalElements.value = 0
  }
  if (id === requestId) loading.value = false
}

watch(browseParams, () => fetchListings(), { immediate: true })
useRefetchOnFocus(() => fetchListings(true))

watch(
  () => authStore.isLoggedIn,
  (loggedIn) => {
    if (loggedIn) {
      essenceStore.fetchBalance()
      tradeStore.refreshIncomingCount()
    }
  },
  { immediate: true },
)

itemTypeStore.fetchItemTypes()
itemModifierStore.fetchModifiers()
fetchUnusualEffects()
</script>

<template>
  <div class="market-page" :style="{ '--page-accent': 'var(--accent-overall)' }">
    <div class="market-page__header">
      <div>
        <h1 class="market-page__title">Market Hub</h1>
        <p v-if="!loading" class="market-page__subtitle">
          {{ totalElements.toLocaleString() }} active {{ totalElements === 1 ? 'listing' : 'listings' }}
        </p>
      </div>
      <div class="market-page__header-actions">
        <MarketWallet
          v-if="authStore.isLoggedIn && essenceStore.balance !== null"
          :balance="essenceStore.balance"
          :reserved="essenceStore.reserved ?? 0"
        />
        <BaseButton v-if="authStore.isLoggedIn" @click="router.push({ name: 'trade-offers' })">
          Trade offers{{ tradeStore.pendingIncomingCount > 0 ? ` (${tradeStore.pendingIncomingCount})` : '' }}
        </BaseButton>
        <BaseButton v-if="authStore.isLoggedIn" @click="router.push({ name: 'market-activity' })">
          My activity
        </BaseButton>
        <BaseButton
          v-if="authStore.isLoggedIn"
          variant="primary"
          @click="router.push({ name: 'market-new' })"
        >
          List an item
        </BaseButton>
      </div>
    </div>

    <div class="market-page__controls">
      <div class="market-page__controls-left">
        <div class="market-page__kind" role="group" aria-label="Listing kind">
          <button
            v-for="option in KIND_OPTIONS"
            :key="option.value"
            type="button"
            class="market-page__kind-btn"
            :class="{ 'market-page__kind-btn--active': kind === option.value }"
            @click="kind = option.value"
          >
            {{ option.label }}
          </button>
        </div>
        <SearchBox v-model="search" placeholder="Search titles or item names..." />
      </div>
      <div class="market-page__controls-right">
        <BaseSelect
          :options="SORT_OPTIONS"
          :model-value="sortBy"
          @update:model-value="sortBy = $event as MarketSortOption"
        />
        <FilterPopover :open="filtersOpen" @update:open="filtersOpen = $event">
          <template #trigger>
            <FilterButton :active="filtersOpen || hasActiveFilters" :has-indicator="hasActiveFilters" />
          </template>
          <MarketFilterPanel
            :rarities="rarities"
            :type-keys="typeKeys"
            :type-options="typeOptions"
            :modifier-keys="modifierKeys"
            :modifier-options="modifierOptions"
            :effect-keys="effectKeys"
            :effect-groups="effectGroups"
            :ungrouped-effects="ungroupedEffects"
            :min-price="minPrice"
            :max-price="maxPrice"
            :has-active-filters="hasActiveFilters"
            @update:rarities="rarities = $event"
            @update:type-keys="typeKeys = $event"
            @update:modifier-keys="modifierKeys = $event"
            @update:effect-keys="effectKeys = $event"
            @update:min-price="minPrice = $event"
            @update:max-price="maxPrice = $event"
            @clear="clearFilters"
          />
        </FilterPopover>
      </div>
    </div>

    <div v-if="loading" class="market-page__grid">
      <SkeletonLoader v-for="i in 12" :key="i" variant="card" />
    </div>

    <EmptyState
      v-else-if="listings.length === 0 && hasActiveFilters"
      message="No listings match your filters."
      action-label="Clear filters"
      @action="clearFilters"
    />

    <EmptyState
      v-else-if="listings.length === 0 && search"
      message="No listings match your search. Search covers listing titles and item names."
    />

    <EmptyState
      v-else-if="listings.length === 0"
      message="Nothing is listed right now. Be the first to put something up."
      :action-label="authStore.isLoggedIn ? 'List an item' : undefined"
      @action="router.push({ name: 'market-new' })"
    />

    <template v-else>
      <div class="market-page__grid">
        <MarketListingCard v-for="listing in listings" :key="listing.id" :listing="listing" />
      </div>

      <PaginationControls :page="currentPage" :total-pages="totalPages" @update:page="setPage" />
    </template>
  </div>
</template>

<style scoped>
.market-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.market-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.market-page__title {
  font-size: var(--text-page-title);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.market-page__subtitle {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  margin: var(--space-xs) 0 0;
}

.market-page__header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.market-page__controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
}

.market-page__controls-left {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
  min-width: 0;
  flex: 1;
}

.market-page__controls-left :deep(.search-box) {
  min-width: 280px;
  flex: 1 1 280px;
  max-width: 420px;
}

.market-page__controls-right {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.market-page__kind {
  display: inline-flex;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  overflow: hidden;
}

.market-page__kind-btn {
  padding: var(--space-xs) var(--space-md);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.market-page__kind-btn + .market-page__kind-btn {
  border-left: 1px solid var(--bg-overlay);
}

.market-page__kind-btn:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.market-page__kind-btn--active {
  background: color-mix(in srgb, var(--page-accent) 12%, var(--bg-surface));
  color: var(--page-accent);
  font-weight: 600;
}

.market-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-md);
}

@media (max-width: 767px) {
  .market-page__grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }

  .market-page__controls {
    flex-wrap: wrap;
  }

  .market-page__controls-left {
    width: 100%;
  }

  .market-page__controls-left :deep(.search-box) {
    min-width: 0;
    flex: 1 1 100%;
    max-width: none;
  }
}
</style>
