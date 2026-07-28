<script setup lang="ts">
import BaseSelect from '@/components/common/BaseSelect.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import { pickAvatarFallback, pickAvatarUrl } from '@/composables/useAvatarFallback'
import { useItemModifierStore } from '@/stores/itemModifiers'
import { useItemTypeStore } from '@/stores/itemTypes'
import type { ItemResponse } from '@/types/api/items'
import type { ItemStatsPlayerRef } from '@/types/api/statistics'
import type { TableColumn } from '@/types/display'
import type { Page, PaginationParams } from '@/types/pagination'
import { loadStoredCountry, storeCountry } from '@/utils/statsCountry'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ItemStatsTable from './ItemStatsTable.vue'
import LeaderboardPicker from './LeaderboardPicker.vue'

defineProps<{
  accent: string
  countryOptions: { value: string; label: string }[]
}>()

type ItemStatsBoard =
  | 'most-items'
  | 'most-crates-opened'
  | 'most-valuable-inventory'
  | 'first-editions'
  | 'most-complete-collection'
  | 'biggest-traders'
  | 'rarest-unboxed'
  | 'first-edition-holders'
  | 'rarest-items'

type BoardFilter = 'type' | 'modifier' | 'crate'

type StatsApi = typeof import('@/api/statistics')

interface BoardQuery {
  country?: string
  type?: string
  modifier?: string
  crate?: string
}

interface BoardDef {
  key: ItemStatsBoard
  label: string
  icon: string
  description: string
  columns: TableColumn[]
  sort?: string
  country: boolean
  filters: BoardFilter[]
  fetch: (api: StatsApi, params: PaginationParams, q: BoardQuery) => Promise<Page<unknown>>
}

const rankCol: TableColumn = { key: 'rank', label: '#', align: 'right', mono: true, width: '60px' }
const playerCol: TableColumn = { key: 'player', label: 'Player', align: 'left' }
const itemCol: TableColumn = { key: 'item', label: 'Item', align: 'left' }

const BOARDS: BoardDef[] = [
  {
    key: 'most-items', label: 'Most Items', icon: 'package', description: 'Largest collections',
    columns: [rankCol, playerCol, { key: 'itemCount', label: 'Items', align: 'right', mono: true, width: '120px' }],
    sort: 'itemCount,desc', country: true, filters: ['type', 'modifier'],
    fetch: (api, params, q) => api.getMostItems(params, q.type, q.modifier, q.country),
  },
  {
    key: 'most-crates-opened', label: 'Most Crates Opened', icon: 'crate', description: 'Most crates unboxed',
    columns: [rankCol, playerCol, { key: 'crateCount', label: 'Crates', align: 'right', mono: true, width: '120px' }],
    sort: 'crateCount,desc', country: true, filters: ['crate'],
    fetch: (api, params, q) => api.getMostCratesOpened(params, q.crate, q.country),
  },
  {
    key: 'most-valuable-inventory', label: 'Most Valuable Inventory', icon: 'gem', description: 'Richest inventories',
    columns: [
      rankCol, playerCol,
      { key: 'itemsValue', label: 'Items', align: 'right', mono: true, width: '110px' },
      { key: 'essenceBalance', label: 'Essence', align: 'right', mono: true, width: '110px' },
      { key: 'totalValue', label: 'Total', align: 'right', mono: true, width: '120px' },
    ],
    sort: 'totalValue,desc', country: true, filters: [],
    fetch: (api, params, q) => api.getMostValuableInventory(params, q.country),
  },
  {
    key: 'first-editions', label: 'First Editions', icon: 'award', description: 'Most #1 serials',
    columns: [rankCol, playerCol, { key: 'firstEditionCount', label: 'First Editions', align: 'right', mono: true, width: '150px' }],
    sort: 'firstEditionCount,desc', country: true, filters: [],
    fetch: (api, params, q) => api.getFirstEditions(params, q.country),
  },
  {
    key: 'most-complete-collection', label: 'Most Complete Collection', icon: 'layers', description: 'Closest to complete',
    columns: [
      rankCol, playerCol,
      { key: 'ownedCount', label: 'Owned', align: 'right', mono: true, width: '100px' },
      { key: 'catalogTotal', label: 'Catalog', align: 'right', mono: true, width: '100px' },
      { key: 'completionPercent', label: 'Complete', align: 'right', mono: true, width: '110px' },
    ],
    sort: 'completionPercent,desc', country: true, filters: [],
    fetch: (api, params, q) => api.getMostCompleteCollection(params, q.country),
  },
  {
    key: 'biggest-traders', label: 'Biggest Traders', icon: 'swap', description: 'Most active traders',
    columns: [
      rankCol, playerCol,
      { key: 'tradeCount', label: 'Trades', align: 'right', mono: true, width: '110px' },
      { key: 'itemsTraded', label: 'Items Traded', align: 'right', mono: true, width: '140px' },
    ],
    sort: 'tradeCount,desc', country: true, filters: [],
    fetch: (api, params, q) => api.getBiggestTraders(params, q.country),
  },
  {
    key: 'rarest-unboxed', label: 'Rarest Items Unboxed', icon: 'gift', description: 'Rarest pulls',
    columns: [
      rankCol, itemCol,
      { key: 'modifiers', label: 'Modifiers', align: 'left' },
      { key: 'owner', label: 'Owner', align: 'left', width: '220px' },
    ],
    country: true, filters: [],
    fetch: (api, params, q) => api.getRarestUnboxed(params, q.country),
  },
  {
    key: 'first-edition-holders', label: 'First Edition Holders', icon: 'medal', description: 'Who holds serial #1',
    columns: [rankCol, itemCol, { key: 'owner', label: 'Holder', align: 'left', width: '220px' }],
    country: true, filters: [],
    fetch: (api, params, q) => api.getFirstEditionHolders(params, q.country),
  },
  {
    key: 'rarest-items', label: 'Item Scarcity', icon: 'gauge', description: 'Fewest copies',
    columns: [
      rankCol, itemCol,
      { key: 'ownerCount', label: 'Owners', align: 'right', mono: true, width: '110px' },
      { key: 'instanceCount', label: 'Count', align: 'right', mono: true, width: '110px' },
    ],
    sort: 'instanceCount,asc', country: false, filters: [],
    fetch: (api, params) => api.getRarestItems(params),
  },
]

const BOARD_MAP = new Map<ItemStatsBoard, BoardDef>(BOARDS.map((b) => [b.key, b]))

const pickerOptions = BOARDS.map((b) => ({ key: b.key, label: b.label, icon: b.icon, description: b.description }))

const route = useRoute()
const router = useRouter()
const itemTypeStore = useItemTypeStore()
const modifierStore = useItemModifierStore()

const activeBoard = computed<ItemStatsBoard>(() => {
  const board = route.query.board as ItemStatsBoard
  return BOARD_MAP.has(board) ? board : 'most-items'
})
const boardDef = computed(() => BOARD_MAP.get(activeBoard.value) as BoardDef)

const countryFilter = computed<string>(() => (route.query.country as string) || '')
const typeFilter = computed<string>(() => (route.query.type as string) || '')
const modifierFilter = computed<string>(() => (route.query.modifier as string) || '')
const crateFilter = computed<string>(() => (route.query.crate as string) || '')

const currentPage = computed<number>(() => {
  const p = Number(route.query.page)
  return p > 0 ? p : 1
})

function selectBoard(board: ItemStatsBoard) {
  const query = { ...route.query }
  query.board = board
  delete query.type
  delete query.modifier
  delete query.crate
  delete query.page
  router.replace({ query })
}

function setQueryParam(key: string, value: string) {
  const query = { ...route.query }
  if (value) {
    query[key] = value
  } else {
    delete query[key]
  }
  delete query.page
  if (key === 'country') storeCountry(value)
  router.replace({ query })
}

function setPage(page: number) {
  const query = { ...route.query }
  if (page <= 1) {
    delete query.page
  } else {
    query.page = String(page)
  }
  router.push({ query })
}

onMounted(() => {
  itemTypeStore.fetchItemTypes()
  modifierStore.fetchModifiers()
  if (!route.query.country) {
    const persisted = loadStoredCountry()
    if (persisted) router.replace({ query: { ...route.query, country: persisted } })
  }
})

const typeOptions = computed(() => [
  { value: '', label: 'All Types' },
  ...itemTypeStore.itemTypes.map((t) => ({ value: t.key, label: t.name })),
])

const modifierOptions = computed(() => [
  { value: '', label: 'All Modifiers' },
  ...modifierStore.modifiers.map((m) => ({ value: m.key, label: m.name })),
])

const crates = ref<ItemResponse[]>([])
const crateOptions = computed(() => [
  { value: '', label: 'All Crates' },
  ...crates.value.map((c) => ({ value: c.id, label: c.name })),
])

async function fetchCrates() {
  if (crates.value.length) return
  await itemTypeStore.fetchItemTypes()
  const crateTypeId = itemTypeStore.byKey.get('crate')?.id
  if (!crateTypeId) return
  try {
    const { getItems } = await import('@/api/items')
    crates.value = await getItems({ typeId: crateTypeId })
  } catch {
  }
}

const itemCatalog = ref<Map<string, ItemResponse>>(new Map())
let catalogRequested = false

async function fetchItemCatalog() {
  if (catalogRequested) return
  catalogRequested = true
  try {
    const { getItems } = await import('@/api/items')
    const all = await getItems()
    itemCatalog.value = new Map(all.map((item) => [item.id, item]))
  } catch {
    catalogRequested = false
  }
}

const loading = ref(false)
const pageData = ref<Page<unknown> | null>(null)

const totalPages = computed(() => pageData.value?.totalPages ?? 0)
const totalElements = computed(() => pageData.value?.totalElements ?? 0)

function withRank(item: Record<string, unknown>, index: number): Record<string, unknown> {
  return { ...item, rank: pageData.value!.number * pageData.value!.size + index + 1 }
}

function enrichItem(item: Record<string, unknown>): Record<string, unknown> {
  const catalogItem = itemCatalog.value.get(item.itemId as string)
  if (!catalogItem) return item
  return {
    ...item,
    itemValue: catalogItem.value,
    itemTypeId: catalogItem.typeId,
    iconUrl: item.iconUrl ?? catalogItem.iconUrl,
  }
}

const rows = computed<Record<string, unknown>[]>(() => {
  if (!pageData.value) return []
  return pageData.value.content.map((raw, i) => {
    const item = raw as Record<string, unknown>
    if (activeBoard.value === 'rarest-items') {
      return withRank(enrichItem(item), i)
    }
    if (activeBoard.value === 'rarest-unboxed' || activeBoard.value === 'first-edition-holders') {
      const owner = item as unknown as ItemStatsPlayerRef
      return withRank(enrichItem({
        ...item,
        ownerUserId: owner.userId,
        ownerUserName: owner.userName,
        ownerAvatarUrl: pickAvatarUrl(owner),
        ownerAvatarFallbackUrl: pickAvatarFallback(owner),
        ownerCountry: owner.country,
      }), i)
    }
    const player = item as unknown as ItemStatsPlayerRef
    return withRank({
      ...item,
      avatarUrl: pickAvatarUrl(player),
      avatarFallbackUrl: pickAvatarFallback(player),
    }, i)
  })
})

let requestId = 0

async function fetchData() {
  const def = boardDef.value
  const id = ++requestId
  loading.value = true
  try {
    const params: PaginationParams = { page: currentPage.value - 1, size: 50, sort: def.sort }
    const query: BoardQuery = {
      country: def.country ? countryFilter.value || undefined : undefined,
      type: typeFilter.value || undefined,
      modifier: modifierFilter.value || undefined,
      crate: crateFilter.value || undefined,
    }
    const api = await import('@/api/statistics')
    const result = await def.fetch(api, params, query)

    if (id !== requestId) return
    pageData.value = result
  } catch (error) {
    if (id !== requestId) return
    console.error('Failed to fetch item stats:', error)
    pageData.value = null
  }
  loading.value = false
}

watch(activeBoard, (board) => {
  if (board === 'most-crates-opened') fetchCrates()
  if (board === 'rarest-items' || board === 'rarest-unboxed') fetchItemCatalog()
}, { immediate: true })

watch(
  [activeBoard, countryFilter, typeFilter, modifierFilter, crateFilter, currentPage],
  () => fetchData(),
  { immediate: true },
)
</script>

<template>
  <div class="item-stats" :style="{ '--accent': accent }">
    <div class="item-stats__filters">
      <BaseSelect v-if="boardDef.country" :model-value="countryFilter" :options="countryOptions"
        placeholder="All Countries" searchable @update:model-value="setQueryParam('country', $event)" />
      <BaseSelect v-if="boardDef.filters.includes('type')" :model-value="typeFilter" :options="typeOptions"
        placeholder="All Types" searchable @update:model-value="setQueryParam('type', $event)" />
      <BaseSelect v-if="boardDef.filters.includes('modifier')" :model-value="modifierFilter" :options="modifierOptions"
        placeholder="All Modifiers" searchable @update:model-value="setQueryParam('modifier', $event)" />
      <BaseSelect v-if="boardDef.filters.includes('crate')" :model-value="crateFilter" :options="crateOptions"
        placeholder="All Crates" searchable @update:model-value="setQueryParam('crate', $event)" />
    </div>

    <LeaderboardPicker :model-value="activeBoard" :options="pickerOptions"
      @update:model-value="selectBoard($event as ItemStatsBoard)" />

    <p v-if="totalElements > 0" class="item-stats__count">{{ totalElements.toLocaleString() }} records</p>

    <div class="item-stats__table">
      <ItemStatsTable :columns="boardDef.columns" :rows="rows" :loading="loading" :board="activeBoard" />
    </div>

    <PaginationControls v-if="totalPages > 1" :page="currentPage" :total-pages="totalPages" @update:page="setPage" />
  </div>
</template>

<style scoped>
.item-stats {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  --page-accent: var(--accent);
}

.item-stats__filters {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.item-stats__count {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  letter-spacing: 0.02em;
  text-align: right;
  margin: 0;
}

.item-stats__table {
  --accent: var(--page-accent);
}
</style>
