<script setup lang="ts">
import BaseBanner from '@/components/common/BaseBanner.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import DisintegrateDialog from '@/components/domain/DisintegrateDialog.vue'
import InventoryDetailPanel from '@/components/domain/InventoryDetailPanel.vue'
import InventoryItemCell from '@/components/domain/InventoryItemCell.vue'
import { useCrateContents } from '@/composables/useCrateContents'
import { useCrateModifiers } from '@/composables/useCrateModifiers'
import { useOwnedItemIds } from '@/composables/useOwnedItemIds'
import { usePageableRoute } from '@/composables/usePageableRoute'
import { disintegrateItem, getItems, getUserInventory, getUserItems } from '@/api/items'
import { parseApiError } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { useEssenceStore } from '@/stores/essence'
import { useInventoryStore } from '@/stores/inventory'
import { useItemModifierStore } from '@/stores/itemModifiers'
import { useItemTypeStore } from '@/stores/itemTypes'
import { useThemeStore } from '@/stores/theme'
import type { DisintegrationResponse, ItemRarity, ItemResponse, ItemTypeKey, UserItemResponse } from '@/types/api/items'
import type { Page } from '@/types/pagination'
import { ESSENCE_GLYPH, formatEssence, formatEssenceAmount } from '@/utils/essence'
import { RARITY_ORDER, readThemeValue } from '@/utils/items'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

const props = defineProps<{
  userId: string
}>()

const authStore = useAuthStore()
const essenceStore = useEssenceStore()
const inventoryStore = useInventoryStore()
const itemTypeStore = useItemTypeStore()
const itemModifierStore = useItemModifierStore()
const themeStore = useThemeStore()

const route = useRoute()
const router = useRouter()

const isOwnProfile = computed(() => authStore.isLoggedIn && authStore.userId === props.userId)
const canOfferTrade = computed(() => authStore.isLoggedIn && !!authStore.userId && authStore.userId !== props.userId)

const typeKey = ref<string>('')
const rarity = ref<string>('')
const modifierKey = ref<string>('')
const search = ref('')
const CATALOG_PAGE_SIZE = 20

const showUnowned = computed<boolean>({
  get: () => route.query.unowned === '1',
  set: (val) => {
    const query = { ...route.query }
    if (val) query.unowned = '1'
    else delete query.unowned
    delete query.page
    router.replace({ query })
  },
})

const { currentPage, sortState, paginationParams, setPage, setSort, resetPage } = usePageableRoute({
  defaultSort: 'date',
  defaultOrder: 'desc',
  defaultSize: 20,
  sortFieldMap: {
    date: 'awardedAt',
    name: 'item.name',
    type: 'item.type.key',
    serial: 'serialNumber',
    quantity: 'quantity',
    rarity: 'rarity',
  },
  secondarySort: null,
})

const sortOptions = [
  { value: 'date', label: 'Newest' },
  { value: 'name', label: 'Name' },
  { value: 'type', label: 'Type' },
  { value: 'rarity', label: 'Rarity' },
  { value: 'quantity', label: 'Quantity' },
]

const typeOptions = computed(() => [
  { value: '', label: 'All types' },
  ...itemTypeStore.itemTypes
    .filter((t) => t.active && !t.parentTypeId)
    .map((t) => ({ value: t.key, label: t.name })),
])

const rarityOptions = computed(() => [
  { value: '', label: 'All rarities' },
  ...RARITY_ORDER.map((r) => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) })),
])

const modifierOptions = computed(() => [
  { value: '', label: 'All modifiers' },
  ...itemModifierStore.modifiers.filter((m) => m.active).map((m) => ({ value: m.key, label: m.name })),
])

const data = ref<Page<UserItemResponse> | null>(null)
const loading = ref(false)
const selectedLinkId = ref<string | null>(null)
const actionBusy = ref(false)
const mobileDetailOpen = ref(false)
const disintegrateTarget = ref<UserItemResponse | null>(null)
const feedback = ref<{ variant: 'success' | 'error'; message: string } | null>(null)
let feedbackTimer: ReturnType<typeof setTimeout> | null = null

const catalogAllItems = ref<ItemResponse[]>([])
const catalogOwnedItems = ref<UserItemResponse[]>([])
const catalogLoading = ref(false)

function isLockedLink(linkId: string | null | undefined): boolean {
  return !!linkId && linkId.startsWith('locked:')
}

function syntheticLockedEntry(it: ItemResponse): UserItemResponse {
  return {
    linkId: `locked:${it.id}`,
    item: it,
    modifiers: [],
    unusualEffect: null,
    serialNumber: null,
    quantity: 0,
    source: 'manual',
    sourceId: null,
    awardedByStaffId: null,
    reason: null,
    awardedAt: '',
  }
}

function compareCatalog(a: UserItemResponse, b: UserItemResponse, key: string): number {
  switch (key) {
    case 'name':
      return a.item.name.localeCompare(b.item.name)
    case 'type':
      return a.item.typeKey.localeCompare(b.item.typeKey)
    case 'rarity':
      return RARITY_ORDER.indexOf(a.item.rarity) - RARITY_ORDER.indexOf(b.item.rarity)
    case 'quantity':
      return (a.quantity ?? 0) - (b.quantity ?? 0)
    case 'date':
    default: {
      if (!a.awardedAt && !b.awardedAt) return 0
      if (!a.awardedAt) return -1
      if (!b.awardedAt) return 1
      return a.awardedAt.localeCompare(b.awardedAt)
    }
  }
}

const catalogMerged = computed<UserItemResponse[]>(() => {
  if (!showUnowned.value) return []
  const ownedIds = new Set(catalogOwnedItems.value.map((u) => u.item.id))
  const locked: UserItemResponse[] = []
  for (const it of catalogAllItems.value) {
    if (!it.visible || !it.active) continue
    if (ownedIds.has(it.id)) continue
    locked.push(syntheticLockedEntry(it))
  }
  return [...catalogOwnedItems.value, ...locked]
})

const catalogFiltered = computed<UserItemResponse[]>(() => {
  if (!showUnowned.value) return []
  const q = search.value.trim().toLowerCase()
  const modKey = modifierKey.value
  return catalogMerged.value.filter((u) => {
    if (typeKey.value && u.item.typeKey !== typeKey.value) return false
    if (rarity.value && u.item.rarity !== rarity.value) return false
    if (modKey) {
      if (isLockedLink(u.linkId)) return false
      if (!u.modifiers.some((m) => m.key === modKey)) return false
    }
    if (q && !u.item.name.toLowerCase().includes(q)) return false
    return true
  })
})

const catalogSorted = computed<UserItemResponse[]>(() => {
  if (!showUnowned.value) return []
  const arr = [...catalogFiltered.value]
  const dir = sortState.value.direction === 'asc' ? 1 : -1
  arr.sort((a, b) => dir * compareCatalog(a, b, sortState.value.key))
  return arr
})

const items = computed<UserItemResponse[]>(() => {
  if (showUnowned.value) {
    const start = (currentPage.value - 1) * CATALOG_PAGE_SIZE
    return catalogSorted.value.slice(start, start + CATALOG_PAGE_SIZE)
  }
  return data.value?.content ?? []
})

const totalPages = computed(() => {
  if (showUnowned.value) {
    return Math.max(1, Math.ceil(catalogSorted.value.length / CATALOG_PAGE_SIZE))
  }
  return data.value?.totalPages ?? 0
})

const selectedItem = computed<UserItemResponse | null>(() => {
  if (!selectedLinkId.value) return null
  if (showUnowned.value) {
    return catalogMerged.value.find((u) => u.linkId === selectedLinkId.value) ?? null
  }
  return items.value.find((u) => u.linkId === selectedLinkId.value) ?? null
})

const { contents: crateContents, loading: crateContentsLoading } = useCrateContents(
  () => selectedItem.value?.item ?? null,
)

const { modifiers: crateModifiers, loading: crateModifiersLoading } = useCrateModifiers(
  () => selectedItem.value?.item ?? null,
)

const isCrateSelected = computed(() => selectedItem.value?.item.typeKey === 'crate')
const { ownedIds } = useOwnedItemIds(() => props.userId, isCrateSelected)

const isSelectedLocked = computed(() => isLockedLink(selectedLinkId.value))

const isSelectedEquipped = computed(() => {
  const it = selectedItem.value
  return !!it && isEquipped(it)
})

const selectedEquippedVariantKey = computed<string | null>(() => {
  if (!isSelectedEquipped.value) return null
  const it = selectedItem.value?.item
  if (!it) return null
  return inventoryStore.equipped[it.typeKey]?.variantKey ?? null
})

function isEquipped(userItem: UserItemResponse): boolean {
  if (!isOwnProfile.value) return false
  if (isLockedLink(userItem.linkId)) return false
  const slot = inventoryStore.equipped[userItem.item.typeKey]
  return !!slot && slot.linkId === userItem.linkId
}

async function fetchInventory() {
  loading.value = true
  try {
    const params = {
      ...paginationParams.value,
      typeKey: (typeKey.value || undefined) as ItemTypeKey | undefined,
      rarity: (rarity.value || undefined) as ItemRarity | undefined,
      modifierKey: modifierKey.value || undefined,
      search: search.value.trim() || undefined,
    }
    data.value = await getUserInventory(props.userId, params)
    if (selectedLinkId.value && !data.value.content.some((u) => u.linkId === selectedLinkId.value)) {
      selectedLinkId.value = data.value.content[0]?.linkId ?? null
    } else if (!selectedLinkId.value && data.value.content.length > 0) {
      selectedLinkId.value = data.value.content[0].linkId
    }
  } catch {
    data.value = null
  } finally {
    loading.value = false
  }
}

async function fetchCatalog() {
  catalogLoading.value = true
  try {
    const [all, owned] = await Promise.all([
      getItems(),
      getUserItems(props.userId),
    ])
    catalogAllItems.value = all
    catalogOwnedItems.value = owned
  } catch {
    catalogAllItems.value = []
    catalogOwnedItems.value = []
  } finally {
    catalogLoading.value = false
  }
}

function toggleShowUnowned() {
  showUnowned.value = !showUnowned.value
  selectedLinkId.value = null
  if (showUnowned.value && catalogAllItems.value.length === 0) {
    fetchCatalog()
  }
}

function selectItem(linkId: string) {
  selectedLinkId.value = linkId
  if (window.matchMedia('(max-width: 1023px)').matches) {
    mobileDetailOpen.value = true
  }
}

async function handleEquip(linkId: string) {
  if (isLockedLink(linkId)) return
  const target = items.value.find((u) => u.linkId === linkId)
  if (!target) return
  actionBusy.value = true
  try {
    await inventoryStore.equip(target.linkId, props.userId)
    if (target.item.typeKey === 'theme') {
      const theme = readThemeValue(target.item.value)
      if (theme) themeStore.setThemeFromTokens(`item:${target.item.id}`, theme.tokens)
    }
  } catch {
  } finally {
    actionBusy.value = false
  }
}

async function handleSelectVariant(linkId: string, variantKey: string) {
  const target = items.value.find((u) => u.linkId === linkId)
  if (!target) return
  actionBusy.value = true
  try {
    await inventoryStore.equip(target.linkId, props.userId, variantKey)
  } catch {
  } finally {
    actionBusy.value = false
  }
}

async function handleUnequip(typeKeyArg: string) {
  actionBusy.value = true
  try {
    await inventoryStore.unequip(typeKeyArg as ItemTypeKey, props.userId)
  } catch {
  } finally {
    actionBusy.value = false
  }
}

async function handleApplyThemeMode(linkId: string, alt: boolean) {
  if (isLockedLink(linkId)) return
  const target = items.value.find((u) => u.linkId === linkId)
  if (!target) return
  const theme = readThemeValue(target.item.value)
  const tokens = alt ? theme?.altTokens : theme?.tokens
  if (!tokens) return
  actionBusy.value = true
  try {
    if (!isEquipped(target)) {
      await inventoryStore.equip(target.linkId, props.userId)
    }
    themeStore.setThemeFromTokens(`item:${target.item.id}`, tokens)
  } catch {
  } finally {
    actionBusy.value = false
  }
}

function showFeedback(variant: 'success' | 'error', message: string) {
  feedback.value = { variant, message }
  if (feedbackTimer) clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => {
    feedback.value = null
  }, 4000)
}

function mutateLink(linkId: string, nextQuantity: number | null) {
  const removed = nextQuantity === null
  const apply = (list: UserItemResponse[]): UserItemResponse[] =>
    nextQuantity === null
      ? list.filter((u) => u.linkId !== linkId)
      : list.map((u) => (u.linkId === linkId ? { ...u, quantity: nextQuantity } : u))

  catalogOwnedItems.value = apply(catalogOwnedItems.value)

  if (data.value) {
    const inPage = data.value.content.some((u) => u.linkId === linkId)
    data.value = {
      ...data.value,
      content: apply(data.value.content),
      totalElements:
        removed && inPage ? Math.max(0, data.value.totalElements - 1) : data.value.totalElements,
    }
  }

  if (removed && selectedLinkId.value === linkId) {
    selectedLinkId.value = items.value[0]?.linkId ?? null
  }
}

function handleDisintegrateRequest(linkId: string) {
  if (isLockedLink(linkId)) return
  const target =
    selectedItem.value?.linkId === linkId
      ? selectedItem.value
      : items.value.find((u) => u.linkId === linkId) ?? null
  if (target) disintegrateTarget.value = target
}

function handleDisintegrateCancel() {
  if (actionBusy.value) return
  disintegrateTarget.value = null
}

function applyDisintegration(res: DisintegrationResponse) {
  essenceStore.setBalance(res.balance)
  mutateLink(res.linkId, res.remainingQuantity)
  showFeedback('success', `+${formatEssence(res.essenceGained)} essence`)
}

async function handleDisintegrateConfirm(quantity: number) {
  const target = disintegrateTarget.value
  if (!target) return
  const linkId = target.linkId
  actionBusy.value = true
  try {
    applyDisintegration(await disintegrateItem(linkId, quantity))
  } catch (err) {
    const parsed = parseApiError(err, 'Could not disintegrate item.')
    if (parsed.status === 404) {
      mutateLink(linkId, null)
    } else if (parsed.status === 409 && isOwnProfile.value && authStore.userId) {
      await inventoryStore.fetchEquipped(authStore.userId, true)
    }
    showFeedback('error', parsed.fieldErrors[0]?.message ?? parsed.message)
  } finally {
    disintegrateTarget.value = null
    actionBusy.value = false
  }
}

watch([typeKey, rarity, modifierKey, search], () => {
  resetPage()
  selectedLinkId.value = null
})

watch(
  [() => props.userId, paginationParams, typeKey, rarity, modifierKey, search],
  () => {
    if (!showUnowned.value) fetchInventory()
  },
  { immediate: true },
)

watch(() => props.userId, () => {
  if (showUnowned.value) fetchCatalog()
})

watch(showUnowned, (on) => {
  if (on) {
    if (catalogAllItems.value.length === 0) fetchCatalog()
  } else {
    fetchInventory()
  }
})

watch(
  [showUnowned, catalogSorted, currentPage],
  () => {
    if (!showUnowned.value) return
    if (selectedLinkId.value && catalogSorted.value.some((u) => u.linkId === selectedLinkId.value)) return
    selectedLinkId.value = items.value[0]?.linkId ?? null
  },
)

watch(() => props.userId, (id) => {
  if (id && isOwnProfile.value) {
    inventoryStore.fetchEquipped(id)
    essenceStore.fetchBalance(true)
  }
}, { immediate: true })

watch([totalPages, currentPage], () => {
  if (loading.value || catalogLoading.value) return
  if (totalPages.value >= 1 && currentPage.value > totalPages.value) {
    setPage(totalPages.value)
  }
})

onMounted(() => {
  itemTypeStore.fetchItemTypes()
  itemModifierStore.fetchModifiers()
  if (showUnowned.value && catalogAllItems.value.length === 0) fetchCatalog()
})

onUnmounted(() => {
  if (feedbackTimer) clearTimeout(feedbackTimer)
})
</script>

<template>
  <div class="inv-tab">
    <BaseBanner v-if="feedback" :variant="feedback.variant" role="status" @close="feedback = null">
      {{ feedback.message }}
    </BaseBanner>

    <div class="inv-tab__filters">
      <SearchBox v-model="search" placeholder="Search items..." class="inv-tab__search" />
      <BaseSelect v-model="typeKey" :options="typeOptions" placeholder="All types" />
      <BaseSelect v-model="rarity" :options="rarityOptions" placeholder="All rarities" />
      <BaseSelect v-model="modifierKey" :options="modifierOptions" placeholder="All modifiers" />
      <BaseSelect
        :model-value="sortState.key"
        :options="sortOptions"
        placeholder="Sort"
        @update:model-value="setSort"
      />
      <button
        type="button"
        class="inv-tab__unowned-toggle"
        :class="{ 'inv-tab__unowned-toggle--active': showUnowned }"
        :aria-pressed="showUnowned"
        aria-label="Show unowned items"
        @click="toggleShowUnowned"
      >
        <span class="inv-tab__unowned-track">
          <span class="inv-tab__unowned-thumb" />
        </span>
        <span class="inv-tab__unowned-label">Unowned</span>
      </button>
      <span
        v-if="isOwnProfile && essenceStore.balance !== null"
        class="inv-tab__wallet"
        :aria-label="`Essence balance: ${formatEssenceAmount(essenceStore.balance)}`"
        title="Item essence"
      >
        <span class="inv-tab__wallet-glyph" aria-hidden="true">{{ ESSENCE_GLYPH }}</span>
        <span class="inv-tab__wallet-amount">{{ formatEssenceAmount(essenceStore.balance) }}</span>
      </span>
      <RouterLink v-if="isOwnProfile" :to="{ name: 'trade-offers' }" custom v-slot="{ navigate, href }">
        <BaseButton variant="primary" :href="href" @click="(e: MouseEvent) => { e.preventDefault(); navigate() }">
          Trade Offers
        </BaseButton>
      </RouterLink>
      <RouterLink
        v-else-if="canOfferTrade"
        :to="{ name: 'trade-new', query: { to: userId } }"
        custom
        v-slot="{ navigate, href }"
      >
        <BaseButton variant="primary" :href="href" @click="(e: MouseEvent) => { e.preventDefault(); navigate() }">
          Offer Trade
        </BaseButton>
      </RouterLink>
    </div>

    <div class="inv-tab__layout">
      <div class="inv-tab__main">
        <div v-if="loading || (showUnowned && catalogLoading)" class="inv-tab__grid">
          <SkeletonLoader v-for="i in 12" :key="i" variant="card" />
        </div>

        <EmptyState v-else-if="items.length === 0" message="No items found." />

        <div v-else class="inv-tab__grid">
          <InventoryItemCell
            v-for="userItem in items"
            :key="userItem.linkId"
            :user-item="userItem"
            :selected="userItem.linkId === selectedLinkId"
            :equipped="isEquipped(userItem)"
            :locked="isLockedLink(userItem.linkId)"
            @select="selectItem"
          />
        </div>

        <PaginationControls
          v-if="totalPages > 1"
          :page="currentPage"
          :total-pages="totalPages"
          @update:page="setPage"
        />
      </div>

      <aside class="inv-tab__detail">
        <InventoryDetailPanel
          :user-item="selectedItem"
          :is-own-profile="isOwnProfile"
          :equipped="isSelectedEquipped"
          :equipped-variant-key="selectedEquippedVariantKey"
          :busy="actionBusy"
          :locked="isSelectedLocked"
          :crate-contents="crateContents"
          :crate-contents-loading="crateContentsLoading"
          :crate-modifiers="crateModifiers"
          :crate-modifiers-loading="crateModifiersLoading"
          :owned-item-ids="ownedIds"
          @equip="handleEquip"
          @apply-theme-mode="handleApplyThemeMode"
          @select-variant="handleSelectVariant"
          @unequip="handleUnequip"
          @disintegrate="handleDisintegrateRequest"
        />
      </aside>
    </div>

    <BaseModal :open="mobileDetailOpen" :title="selectedItem?.item.name" @close="mobileDetailOpen = false">
      <InventoryDetailPanel
        :user-item="selectedItem"
        :is-own-profile="isOwnProfile"
        :equipped="isSelectedEquipped"
        :equipped-variant-key="selectedEquippedVariantKey"
        :busy="actionBusy"
        :locked="isSelectedLocked"
        :crate-contents="crateContents"
        :crate-contents-loading="crateContentsLoading"
        :crate-modifiers="crateModifiers"
        :crate-modifiers-loading="crateModifiersLoading"
        :owned-item-ids="ownedIds"
        @equip="handleEquip"
        @apply-theme-mode="handleApplyThemeMode"
        @select-variant="handleSelectVariant"
        @unequip="handleUnequip"
        @disintegrate="handleDisintegrateRequest"
      />
    </BaseModal>

    <DisintegrateDialog
      :open="disintegrateTarget !== null"
      :user-item="disintegrateTarget"
      :busy="actionBusy"
      @confirm="handleDisintegrateConfirm"
      @cancel="handleDisintegrateCancel"
    />
  </div>
</template>

<style scoped>
.inv-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.inv-tab__filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  align-items: center;
}

.inv-tab__filters :deep(.base-select__trigger) {
  min-width: 0;
  padding: var(--space-xs) var(--space-sm);
}

.inv-tab__search {
  flex: 1 1 160px;
  min-width: 140px;
}

.inv-tab__unowned-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
}

.inv-tab__unowned-track {
  position: relative;
  width: 28px;
  height: 16px;
  border-radius: 8px;
  background: var(--bg-overlay);
  border: 1px solid var(--text-tertiary);
  transition: background 120ms ease, border-color 120ms ease;
}

.inv-tab__unowned-toggle--active .inv-tab__unowned-track {
  background: color-mix(in srgb, var(--accent) 40%, transparent);
  border-color: var(--accent);
}

.inv-tab__unowned-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-tertiary);
  transition: transform 120ms ease, background 120ms ease;
}

.inv-tab__unowned-toggle--active .inv-tab__unowned-thumb {
  transform: translateX(12px);
  background: var(--accent);
}

.inv-tab__unowned-label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  user-select: none;
}

.inv-tab__wallet {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  background: var(--bg-surface);
  white-space: nowrap;
}

.inv-tab__wallet-glyph {
  color: var(--tier-gold);
  font-size: var(--text-body);
  line-height: 1;
}

.inv-tab__wallet-amount {
  font-family: var(--font-mono);
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.inv-tab__layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: var(--space-lg);
  align-items: start;
}

.inv-tab__main {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  min-width: 0;
}

.inv-tab__grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--space-md);
}

@media (max-width: 1023px) {
  .inv-tab__grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 639px) {
  .inv-tab__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.inv-tab__detail {
  position: sticky;
  top: calc(var(--navbar-height, 64px) + var(--space-md));
}

@media (max-width: 1023px) {
  .inv-tab__layout {
    grid-template-columns: 1fr;
  }

  .inv-tab__detail {
    display: none;
  }
}
</style>
