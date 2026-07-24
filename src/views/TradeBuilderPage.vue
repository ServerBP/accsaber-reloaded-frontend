<script setup lang="ts">
import { parseApiError } from '@/api/client'
import { getUserInventory } from '@/api/items'
import { getTrades } from '@/api/trades'
import { getUser } from '@/api/users'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import Breadcrumbs, { type Crumb } from '@/components/common/Breadcrumbs.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import PageHeaderBleed from '@/components/common/PageHeaderBleed.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import InventoryItemCell from '@/components/domain/InventoryItemCell.vue'
import TradeBuilderSlot from '@/components/domain/TradeBuilderSlot.vue'
import UserPicker from '@/components/domain/UserPicker.vue'
import { useDebouncedRef } from '@/composables/useDebouncedRef'
import { usePageMeta } from '@/composables/usePageMeta'
import { useAuthStore } from '@/stores/auth'
import { useEssenceStore } from '@/stores/essence'
import { useTradeStore } from '@/stores/trades'
import type { UserItemResponse } from '@/types/api/items'
import { TRADE_MAX_ITEMS_PER_SIDE } from '@/types/api/trades'
import { ESSENCE_GLYPH, formatEssenceAmount, formatEssenceNet } from '@/utils/essence'
import { digitsOnly } from '@/utils/formatters'
import { sanitizeEssenceInput } from '@/utils/market'
import type { UserResponse } from '@/types/api/users'
import type { Page } from '@/types/pagination'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

usePageMeta({
  title: 'New Trade Offer | AccSaber',
})

const authStore = useAuthStore()
const essenceStore = useEssenceStore()
const tradeStore = useTradeStore()
const route = useRoute()
const router = useRouter()

const PAGE_SIZE = 24

const recipientUserId = ref<string | null>((route.query.to as string) || null)
const recipientUser = ref<UserResponse | null>(null)
const recipientLoading = ref(false)

const message = ref('')
const submitting = ref(false)
const errorMsg = ref<string | null>(null)

type Tab = 'mine' | 'theirs'
const activeTab = ref<Tab>('mine')

const myInvPage = ref<Page<UserItemResponse> | null>(null)
const myInvLoading = ref(false)
const myInvCurrentPage = ref(1)
const mySearch = ref('')
const myDebouncedSearch = useDebouncedRef(mySearch, 250)

const theirInvPage = ref<Page<UserItemResponse> | null>(null)
const theirInvLoading = ref(false)
const theirInvCurrentPage = ref(1)
const theirSearch = ref('')
const theirDebouncedSearch = useDebouncedRef(theirSearch, 250)

interface DraftEntry {
  linkId: string
  quantity: number
}

const offeredEntries = ref<DraftEntry[]>([])
const requestedEntries = ref<DraftEntry[]>([])
const itemCache = new Map<string, UserItemResponse>()

const offeredEssenceInput = ref('')
const requestedEssenceInput = ref('')
const offeredEssence = computed(() => sanitizeEssenceInput(offeredEssenceInput.value) ?? 0)
const requestedEssence = computed(() => sanitizeEssenceInput(requestedEssenceInput.value) ?? 0)

const essenceNet = computed(() => requestedEssence.value - offeredEssence.value)

const insufficientEssence = computed(
  () =>
    offeredEssence.value > 0 &&
    essenceStore.balance != null &&
    offeredEssence.value > essenceStore.balance,
)

const lockedLinkIds = ref<Set<string>>(new Set())

const isLoggedIn = computed(() => authStore.isLoggedIn)
const myUserId = computed(() => authStore.userId)

const isSelfRecipient = computed(
  () => !!recipientUserId.value && recipientUserId.value === myUserId.value,
)

const breadcrumbs = computed<Crumb[]>(() => [
  { label: 'Market Hub', to: { name: 'market' } },
  { label: 'Trade Offers', to: { name: 'trade-offers' } },
  { label: 'New Offer' },
])

interface DraftSlot {
  entry: DraftEntry
  userItem: UserItemResponse
}

function buildDraftSlots(entries: DraftEntry[]): DraftSlot[] {
  const out: DraftSlot[] = []
  for (const entry of entries) {
    const ui = itemCache.get(entry.linkId)
    if (!ui) continue
    out.push({
      entry,
      userItem: { ...ui, quantity: entry.quantity },
    })
  }
  return out
}

const offeredDrafts = computed<DraftSlot[]>(() => buildDraftSlots(offeredEntries.value))
const requestedDrafts = computed<DraftSlot[]>(() => buildDraftSlots(requestedEntries.value))

const myInvItems = computed<UserItemResponse[]>(() => myInvPage.value?.content ?? [])
const theirInvItems = computed<UserItemResponse[]>(() => theirInvPage.value?.content ?? [])

const myInvTotalPages = computed(() => myInvPage.value?.totalPages ?? 0)
const theirInvTotalPages = computed(() => theirInvPage.value?.totalPages ?? 0)

const canSubmit = computed(
  () =>
    !!recipientUserId.value
    && !isSelfRecipient.value
    && (
      offeredEntries.value.length > 0
      || requestedEntries.value.length > 0
      || offeredEssence.value > 0
      || requestedEssence.value > 0
    )
    && !insufficientEssence.value
    && !submitting.value,
)

function isLocked(linkId: string): boolean {
  return lockedLinkIds.value.has(linkId)
}

function isInDraft(linkId: string): boolean {
  return (
    offeredEntries.value.some((e) => e.linkId === linkId)
    || requestedEntries.value.some((e) => e.linkId === linkId)
  )
}

function isUnavailable(linkId: string): boolean {
  return isLocked(linkId) || isInDraft(linkId)
}

function stackQuantity(linkId: string): number {
  return itemCache.get(linkId)?.quantity ?? 1
}

function isStackable(linkId: string): boolean {
  return !!itemCache.get(linkId)?.item.stackable
}

async function loadMyInventory() {
  if (!myUserId.value) return
  myInvLoading.value = true
  try {
    myInvPage.value = await getUserInventory(myUserId.value, {
      page: myInvCurrentPage.value - 1,
      size: PAGE_SIZE,
      sort: 'awardedAt,desc',
      tradeable: true,
      search: myDebouncedSearch.value.trim() || undefined,
    })
    for (const ui of myInvPage.value.content) itemCache.set(ui.linkId, ui)
  } catch {
    myInvPage.value = null
  } finally {
    myInvLoading.value = false
  }
}

async function loadTheirInventory() {
  if (!recipientUserId.value || isSelfRecipient.value) return
  theirInvLoading.value = true
  try {
    theirInvPage.value = await getUserInventory(recipientUserId.value, {
      page: theirInvCurrentPage.value - 1,
      size: PAGE_SIZE,
      sort: 'awardedAt,desc',
      tradeable: true,
      search: theirDebouncedSearch.value.trim() || undefined,
    })
    for (const ui of theirInvPage.value.content) itemCache.set(ui.linkId, ui)
  } catch {
    theirInvPage.value = null
  } finally {
    theirInvLoading.value = false
  }
}

async function loadPendingLockouts() {
  if (!myUserId.value) return
  try {
    const page = await getTrades({ direction: 'both', status: ['pending'], size: 200 })
    const set = new Set<string>()
    for (const t of page.content) {
      for (const ref of t.offeredItems) set.add(ref.linkId)
      for (const ref of t.requestedItems) set.add(ref.linkId)
    }
    lockedLinkIds.value = set
  } catch {
  }
}

async function loadRecipient(id: string) {
  recipientLoading.value = true
  try {
    recipientUser.value = await getUser(id)
  } catch {
    recipientUser.value = null
  } finally {
    recipientLoading.value = false
  }
}

function handleInventoryClick(ui: UserItemResponse) {
  if (isUnavailable(ui.linkId)) return
  itemCache.set(ui.linkId, ui)
  const entry: DraftEntry = { linkId: ui.linkId, quantity: 1 }
  if (activeTab.value === 'mine') {
    if (offeredEntries.value.length >= TRADE_MAX_ITEMS_PER_SIDE) return
    offeredEntries.value = [...offeredEntries.value, entry]
  } else {
    if (requestedEntries.value.length >= TRADE_MAX_ITEMS_PER_SIDE) return
    requestedEntries.value = [...requestedEntries.value, entry]
  }
}

function removeOffered(linkId: string) {
  offeredEntries.value = offeredEntries.value.filter((e) => e.linkId !== linkId)
}

function removeRequested(linkId: string) {
  requestedEntries.value = requestedEntries.value.filter((e) => e.linkId !== linkId)
}

function clampQuantity(linkId: string, value: number): number {
  const max = stackQuantity(linkId)
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.min(max, Math.floor(value)))
}

function setOfferedQty(linkId: string, value: number) {
  const qty = clampQuantity(linkId, value)
  offeredEntries.value = offeredEntries.value.map((e) =>
    e.linkId === linkId ? { ...e, quantity: qty } : e,
  )
}

function setRequestedQty(linkId: string, value: number) {
  const qty = clampQuantity(linkId, value)
  requestedEntries.value = requestedEntries.value.map((e) =>
    e.linkId === linkId ? { ...e, quantity: qty } : e,
  )
}

function setTab(tab: Tab) {
  if (tab === 'theirs' && (!recipientUserId.value || isSelfRecipient.value)) return
  activeTab.value = tab
}

async function submit() {
  if (!recipientUserId.value || !canSubmit.value) return
  submitting.value = true
  errorMsg.value = null
  try {
    await tradeStore.createTrade({
      toUserId: recipientUserId.value,
      offeredItems: offeredEntries.value.map((e) => ({
        userItemLinkId: e.linkId,
        quantity: clampQuantity(e.linkId, e.quantity),
      })),
      requestedItems: requestedEntries.value.map((e) => ({
        userItemLinkId: e.linkId,
        quantity: clampQuantity(e.linkId, e.quantity),
      })),
      offeredEssence: offeredEssence.value,
      requestedEssence: requestedEssence.value,
      message: message.value.trim() || undefined,
    })
    if (offeredEssence.value > 0) essenceStore.fetchBalance(true)
    router.push({ name: 'trade-offers' })
  } catch (e) {
    const parsed = parseApiError(e, 'Failed to create trade')
    errorMsg.value = parsed.fieldErrors[0]?.message ?? parsed.message
  } finally {
    submitting.value = false
  }
}

watch(myInvCurrentPage, loadMyInventory)
watch(theirInvCurrentPage, loadTheirInventory)
watch(myDebouncedSearch, () => {
  myInvCurrentPage.value = 1
  loadMyInventory()
})
watch(theirDebouncedSearch, () => {
  theirInvCurrentPage.value = 1
  loadTheirInventory()
})

watch(recipientUserId, async (id) => {
  requestedEntries.value = []
  theirInvPage.value = null
  theirInvCurrentPage.value = 1
  theirSearch.value = ''
  recipientUser.value = null
  if (!id || isSelfRecipient.value) {
    activeTab.value = 'mine'
    return
  }
  loadRecipient(id)
  loadTheirInventory()
})

onMounted(() => {
  if (!isLoggedIn.value) return
  loadMyInventory()
  loadPendingLockouts()
  essenceStore.fetchBalance()
  if (recipientUserId.value && !isSelfRecipient.value) {
    loadRecipient(recipientUserId.value)
    loadTheirInventory()
  }
})
</script>

<template>
  <div class="trade-builder" :style="{ '--page-accent': 'var(--accent-overall)' }">
    <Breadcrumbs class="trade-builder__breadcrumbs" :crumbs="breadcrumbs" />

    <PageHeaderBleed
      title="New Trade Offer"
      subtitle="Build an offer with up to 8 items on each side."
    />

    <div v-if="!isLoggedIn" class="trade-builder__gate">
      <EmptyState message="Sign in to create a trade offer." />
    </div>

    <template v-else>
      <section class="trade-builder__field">
        <label class="trade-builder__label">Send to</label>
        <UserPicker v-model="recipientUserId" placeholder="Search players by name..." />
        <p v-if="isSelfRecipient" class="trade-builder__hint trade-builder__hint--warn">
          You can't send a trade offer to yourself.
        </p>
      </section>

      <header class="trade-builder__banner">
        <div class="trade-builder__banner-main">
          <span class="trade-builder__banner-label">This trade:</span>
          <span class="trade-builder__banner-text">
            <template v-if="recipientUser">
              You are trading with
              <router-link
                class="trade-builder__banner-user"
                :to="{ name: 'player-profile', params: { userId: recipientUser.id } }"
              >{{ recipientUser.name }}</router-link>
            </template>
            <template v-else-if="recipientLoading">Loading recipient...</template>
            <template v-else>Pick a player to start an offer.</template>
          </span>
        </div>
      </header>

      <div class="trade-builder__layout">
        <section class="trade-builder__inventory-panel">
          <div class="trade-builder__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              class="trade-builder__tab"
              :class="{ 'trade-builder__tab--active': activeTab === 'mine' }"
              :aria-selected="activeTab === 'mine'"
              @click="setTab('mine')"
            >Your inventory</button>
            <button
              type="button"
              role="tab"
              class="trade-builder__tab"
              :class="{
                'trade-builder__tab--active': activeTab === 'theirs',
                'trade-builder__tab--disabled': !recipientUser || isSelfRecipient,
              }"
              :aria-selected="activeTab === 'theirs'"
              :disabled="!recipientUser || isSelfRecipient"
              @click="setTab('theirs')"
            >Their inventory</button>
          </div>

          <div v-if="activeTab === 'mine'" class="trade-builder__pane">
            <SearchBox v-model="mySearch" placeholder="Search your tradeable items..." />

            <div v-if="myInvLoading" class="trade-builder__grid">
              <SkeletonLoader v-for="i in 12" :key="i" variant="card" />
            </div>

            <EmptyState
              v-else-if="myInvItems.length === 0"
              message="No tradeable items in your inventory."
            />

            <div v-else class="trade-builder__grid">
              <div
                v-for="ui in myInvItems"
                :key="ui.linkId"
                class="trade-builder__inv-cell"
                :class="{ 'trade-builder__inv-cell--locked': isUnavailable(ui.linkId) }"
              >
                <InventoryItemCell
                  :user-item="ui"
                  :selected="isInDraft(ui.linkId)"
                  @select="() => handleInventoryClick(ui)"
                />
                <span v-if="isLocked(ui.linkId)" class="trade-builder__lock-badge">In trade</span>
                <span v-else-if="isInDraft(ui.linkId)" class="trade-builder__lock-badge">Added</span>
              </div>
            </div>

            <PaginationControls
              v-if="myInvTotalPages > 1"
              :page="myInvCurrentPage"
              :total-pages="myInvTotalPages"
              @update:page="(p) => myInvCurrentPage = p"
            />

            <p class="trade-builder__hint">Displaying tradable items only.</p>
          </div>

          <div v-else-if="activeTab === 'theirs'" class="trade-builder__pane">
            <SearchBox v-model="theirSearch" placeholder="Search their tradeable items..." />

            <div v-if="theirInvLoading" class="trade-builder__grid">
              <SkeletonLoader v-for="i in 12" :key="i" variant="card" />
            </div>

            <EmptyState
              v-else-if="theirInvItems.length === 0"
              :message="recipientUser ? `${recipientUser.name} has no tradeable items.` : 'Pick a player to view their inventory.'"
            />

            <div v-else class="trade-builder__grid">
              <div
                v-for="ui in theirInvItems"
                :key="ui.linkId"
                class="trade-builder__inv-cell"
                :class="{ 'trade-builder__inv-cell--locked': isUnavailable(ui.linkId) }"
              >
                <InventoryItemCell
                  :user-item="ui"
                  :selected="isInDraft(ui.linkId)"
                  @select="() => handleInventoryClick(ui)"
                />
                <span v-if="isLocked(ui.linkId)" class="trade-builder__lock-badge">In trade</span>
                <span v-else-if="isInDraft(ui.linkId)" class="trade-builder__lock-badge">Added</span>
              </div>
            </div>

            <PaginationControls
              v-if="theirInvTotalPages > 1"
              :page="theirInvCurrentPage"
              :total-pages="theirInvTotalPages"
              @update:page="(p) => theirInvCurrentPage = p"
            />

            <p class="trade-builder__hint">Displaying tradable items only.</p>
          </div>
        </section>

        <aside class="trade-builder__offer-panel">
          <section class="trade-builder__offer-side">
            <header class="trade-builder__offer-head">
              <span class="trade-builder__offer-title">Your items</span>
              <span class="trade-builder__offer-count">{{ offeredEntries.length }} / {{ TRADE_MAX_ITEMS_PER_SIDE }}</span>
            </header>
            <div class="trade-builder__slots">
              <template v-for="i in TRADE_MAX_ITEMS_PER_SIDE" :key="`o-${i}`">
                <div class="trade-builder__slot">
                  <TradeBuilderSlot
                    v-if="offeredDrafts[i - 1]"
                    :user-item="offeredDrafts[i - 1].userItem"
                    :quantity="offeredDrafts[i - 1].entry.quantity"
                    :stack-max="stackQuantity(offeredDrafts[i - 1].entry.linkId)"
                    :stackable="isStackable(offeredDrafts[i - 1].entry.linkId)"
                    @remove="removeOffered"
                    @update:quantity="setOfferedQty"
                  />
                </div>
              </template>
            </div>
            <p v-if="offeredEntries.length === 0" class="trade-builder__offer-hint">
              Click items in your inventory to add them.
            </p>
            <div class="trade-builder__essence-row">
              <span class="trade-builder__essence-glyph" aria-hidden="true">{{ ESSENCE_GLYPH }}</span>
              <input
                class="trade-builder__essence-input"
                type="text"
                inputmode="numeric"
                placeholder="0"
                aria-label="Essence you offer"
                :value="offeredEssenceInput"
                @input="offeredEssenceInput = digitsOnly(($event.target as HTMLInputElement).value)"
              />
              <span class="trade-builder__essence-label">essence you add</span>
            </div>
            <p class="trade-builder__hint" :class="{ 'trade-builder__hint--warn': insufficientEssence }">
              <template v-if="insufficientEssence">
                You only have {{ formatEssenceAmount(essenceStore.balance ?? 0) }} {{ ESSENCE_GLYPH }} available.
              </template>
              <template v-else-if="essenceStore.balance != null">
                {{ formatEssenceAmount(essenceStore.balance) }} available ·
                {{ formatEssenceAmount(essenceStore.reserved ?? 0) }} reserved in offers
              </template>
            </p>
          </section>

          <div class="trade-builder__swap" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </div>

          <section class="trade-builder__offer-side">
            <header class="trade-builder__offer-head">
              <span class="trade-builder__offer-title">
                <template v-if="recipientUser">{{ recipientUser.name }}'s items</template>
                <template v-else>Their items</template>
              </span>
              <span class="trade-builder__offer-count">{{ requestedEntries.length }} / {{ TRADE_MAX_ITEMS_PER_SIDE }}</span>
            </header>
            <div class="trade-builder__slots">
              <template v-for="i in TRADE_MAX_ITEMS_PER_SIDE" :key="`r-${i}`">
                <div class="trade-builder__slot">
                  <TradeBuilderSlot
                    v-if="requestedDrafts[i - 1]"
                    :user-item="requestedDrafts[i - 1].userItem"
                    :quantity="requestedDrafts[i - 1].entry.quantity"
                    :stack-max="stackQuantity(requestedDrafts[i - 1].entry.linkId)"
                    :stackable="isStackable(requestedDrafts[i - 1].entry.linkId)"
                    @remove="removeRequested"
                    @update:quantity="setRequestedQty"
                  />
                </div>
              </template>
            </div>
            <p v-if="requestedEntries.length === 0" class="trade-builder__offer-hint">
              <template v-if="recipientUser">Switch to "Their inventory" to request items.</template>
              <template v-else>Pick a player first.</template>
            </p>
            <div class="trade-builder__essence-row">
              <span class="trade-builder__essence-glyph" aria-hidden="true">{{ ESSENCE_GLYPH }}</span>
              <input
                class="trade-builder__essence-input"
                type="text"
                inputmode="numeric"
                placeholder="0"
                aria-label="Essence you request"
                :value="requestedEssenceInput"
                @input="requestedEssenceInput = digitsOnly(($event.target as HTMLInputElement).value)"
              />
              <span class="trade-builder__essence-label">essence you request</span>
            </div>
          </section>

          <BaseInput v-model="message" label="Message (optional)" />

          <p
            v-if="offeredEssence > 0 || requestedEssence > 0"
            class="trade-builder__net"
            :class="{ 'trade-builder__net--negative': essenceNet < 0 }"
          >
            {{ formatEssenceNet(essenceNet) }}
          </p>

          <div v-if="errorMsg" class="trade-builder__error">{{ errorMsg }}</div>

          <BaseButton
            variant="primary"
            size="lg"
            :disabled="!canSubmit"
            :loading="submitting"
            @click="submit"
          >Send Trade Offer</BaseButton>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.trade-builder {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 1280px;
  margin: 0 auto;
  width: 100%;
}

.trade-builder__gate {
  padding: var(--space-2xl) 0;
}

.trade-builder__breadcrumbs {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
}

.trade-builder__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  max-width: 480px;
}

.trade-builder__label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.trade-builder__hint {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.trade-builder__hint--warn {
  color: var(--warning);
}

.trade-builder__banner {
  display: flex;
  align-items: center;
  padding: var(--space-md) var(--space-lg);
  background: color-mix(in srgb, var(--page-accent) 10%, var(--bg-surface));
  border: 1px solid color-mix(in srgb, var(--page-accent) 30%, var(--bg-overlay));
  border-radius: var(--radius-card);
}

.trade-builder__banner-main {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.trade-builder__banner-label {
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--page-accent);
}

.trade-builder__banner-text {
  font-size: var(--text-body);
  color: var(--text-primary);
}

.trade-builder__banner-user {
  color: var(--page-accent);
  font-weight: 600;
  text-decoration: none;
}

.trade-builder__banner-user:hover {
  text-decoration: underline;
}

.trade-builder__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: var(--space-xl);
  align-items: start;
}

.trade-builder__inventory-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  min-width: 0;
}

.trade-builder__tabs {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid var(--bg-overlay);
}

.trade-builder__tab {
  padding: var(--space-sm) var(--space-md);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease;
}

.trade-builder__tab:hover:not(:disabled) {
  color: var(--text-primary);
}

.trade-builder__tab--active {
  color: var(--page-accent);
  border-bottom-color: var(--page-accent);
}

.trade-builder__tab--disabled,
.trade-builder__tab:disabled {
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.trade-builder__pane {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.trade-builder__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: var(--space-sm);
}

.trade-builder__inv-cell {
  position: relative;
}

.trade-builder__inv-cell--locked {
  opacity: 0.45;
  cursor: not-allowed;
}

.trade-builder__inv-cell--locked :deep(.inventory-cell) {
  cursor: not-allowed;
}

.trade-builder__lock-badge {
  position: absolute;
  bottom: var(--space-xs);
  right: var(--space-xs);
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--warning);
  background: color-mix(in srgb, var(--bg-base) 85%, transparent);
  padding: 2px 6px;
  border-radius: var(--radius-pill);
  pointer-events: none;
  z-index: 2;
}

.trade-builder__offer-panel {
  position: sticky;
  top: calc(var(--navbar-height, 64px) + var(--space-md));
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-lg);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
}

.trade-builder__offer-side {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.trade-builder__offer-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-sm);
}

.trade-builder__offer-title {
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--text-primary);
}

.trade-builder__offer-count {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.trade-builder__slots {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-xs);
}

.trade-builder__slot {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: var(--bg-base);
  border: 1px dashed var(--bg-overlay);
  border-radius: var(--radius-card);
  overflow: visible;
}

.trade-builder__slot:has(> *) {
  border-style: solid;
  border-color: transparent;
}

.trade-builder__offer-hint {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  text-align: center;
}

.trade-builder__swap {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  padding: var(--space-xs) 0;
  transform: rotate(90deg);
}

.trade-builder__essence-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.trade-builder__essence-glyph {
  color: var(--tier-gold);
  font-size: var(--text-body);
  line-height: 1;
  flex-shrink: 0;
}

.trade-builder__essence-input {
  width: 96px;
  padding: var(--space-xs) var(--space-sm);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--text-body);
}

.trade-builder__essence-input:focus {
  outline: none;
  border-color: var(--page-accent, var(--accent));
}

.trade-builder__essence-input:disabled {
  color: var(--text-tertiary);
  cursor: not-allowed;
  background: var(--bg-surface);
}

.trade-builder__essence-label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.trade-builder__net {
  margin: 0;
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--success);
}

.trade-builder__net--negative {
  color: var(--warning);
}

.trade-builder__error {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid color-mix(in srgb, var(--error) 30%, transparent);
  background: color-mix(in srgb, var(--error) 10%, transparent);
  border-radius: var(--radius-card);
  color: var(--error);
  font-size: var(--text-caption);
}

@media (max-width: 1023px) {
  .trade-builder__layout {
    grid-template-columns: 1fr;
  }

  .trade-builder__offer-panel {
    position: static;
  }
}
</style>
