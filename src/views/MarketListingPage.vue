<script setup lang="ts">
import Breadcrumbs, { type Crumb } from '@/components/common/Breadcrumbs.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import ModifierChip from '@/components/domain/ModifierChip.vue'
import { parseApiError } from '@/api/client'
import { useMarketListingSocket } from '@/composables/useMarketListingSocket'
import { usePageMeta } from '@/composables/usePageMeta'
import { useSharedNow } from '@/composables/useSharedNow'
import { useAuthStore } from '@/stores/auth'
import { useEssenceStore } from '@/stores/essence'
import { useItemTypeStore } from '@/stores/itemTypes'
import { useModifierColor } from '@/composables/useModifierColor'
import type { ItemModifierRef } from '@/types/api/items'
import type {
  MarketBidResponse,
  MarketListingEvent,
  MarketListingResponse,
} from '@/types/api/market'
import { formatRelativeDate } from '@/utils/formatters'
import {
  displayItemName,
  itemVariantPreviews,
  rarityClass,
  readFragmentSpec,
  sortModifiersByKey,
  visibleModifiers,
} from '@/utils/items'
import { formatEssence } from '@/utils/essence'
import { isAuction, isSameMarketUser, listingPrice } from '@/utils/market'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import EssenceAmount from '@/components/domain/EssenceAmount.vue'
import ListingCountdown from './market/ListingCountdown.vue'
import MarketBidHistory from './market/MarketBidHistory.vue'
import MarketBidPanel from './market/MarketBidPanel.vue'
import MarketItemTile from './market/MarketItemTile.vue'
import MarketUserChip from './market/MarketUserChip.vue'

const route = useRoute()
const authStore = useAuthStore()
const essenceStore = useEssenceStore()
const itemTypeStore = useItemTypeStore()

const listingId = computed(() => String(route.params.listingId ?? ''))

const listing = ref<MarketListingResponse | null>(null)
const bids = ref<MarketBidResponse[]>([])
const loading = ref(true)
const notFound = ref(false)
const actionBusy = ref(false)
const amountError = ref<string | null>(null)
const formError = ref<string | null>(null)
const cancelArmed = ref(false)
let cancelArmTimer: ReturnType<typeof setTimeout> | null = null
let syntheticBidCounter = 0

const now = useSharedNow()

const viewerId = computed(() => authStore.userId)
const active = computed(() => listing.value?.status === 'active')
const awaitingSettlement = computed(
  () =>
    active.value &&
    listing.value?.endsAt != null &&
    new Date(listing.value.endsAt).getTime() <= now.value,
)
const auction = computed(() => (listing.value ? isAuction(listing.value) : false))
const price = computed(() => (listing.value ? listingPrice(listing.value) : null))
const isSeller = computed(() => isSameMarketUser(listing.value?.seller, viewerId.value))
const canCancel = computed(
  () => isSeller.value && active.value && (listing.value?.bidCount ?? 0) === 0,
)

const modifiers = computed<ItemModifierRef[]>(() =>
  sortModifiersByKey(listing.value?.item.modifiers ?? []),
)
const chipModifiers = computed(() => visibleModifiers(modifiers.value))
const { accent } = useModifierColor(modifiers)
const itemName = computed(() =>
  listing.value ? displayItemName(modifiers.value, listing.value.item.item.name) : '',
)
const itemNameStyle = computed(() => (accent.value ? { color: accent.value } : undefined))
const typeLabel = computed(() => {
  const typeKey = listing.value?.item.item.typeKey
  if (!typeKey) return ''
  return itemTypeStore.byKey.get(typeKey)?.name ?? typeKey.replace(/_/g, ' ')
})

const avatarUrl = computed(() => authStore.userProfile?.avatarUrl ?? null)

const variantPreviews = computed(() =>
  listing.value ? itemVariantPreviews(listing.value.item.item) : null,
)
const activeVariantKey = ref<string | null>(null)

watch(
  () => [listing.value?.id, variantPreviews.value] as const,
  () => {
    const previews = variantPreviews.value
    if (!previews) {
      activeVariantKey.value = null
      return
    }
    const preferred = listing.value?.item.variantKey
    activeVariantKey.value =
      preferred && previews.some((v) => v.key === preferred) ? preferred : previews[0].key
  },
  { immediate: true },
)

const previewItem = computed(() => {
  const previews = variantPreviews.value
  if (!previews) return null
  return (previews.find((v) => v.key === activeVariantKey.value) ?? previews[0]).item
})

const composedBorder = computed(() => {
  const current = listing.value
  if (!current || readFragmentSpec(current.item.unusualEffect)) return false
  const typeKey = current.item.item.typeKey
  return typeKey === 'profile_border_shape' || typeKey === 'profile_border_color'
})

const metaTitle = computed(() =>
  listing.value ? `${listing.value.title} | Market | AccSaber` : 'Market | AccSaber',
)
const metaDescription = computed(() => {
  const l = listing.value
  if (!l) return undefined
  const p = listingPrice(l)
  const priceText = p.amount != null ? `${p.label} ${formatEssence(p.amount)}` : p.label
  return `${itemName.value} on the AccSaber market. ${priceText}.`
})
const metaImage = computed(() => listing.value?.item.item.iconUrl ?? undefined)

usePageMeta({ title: metaTitle, description: metaDescription, image: metaImage })

const breadcrumbs = computed<Crumb[]>(() => [
  { label: 'Market Hub', to: { name: 'market' } },
  { label: listing.value?.title ?? 'Listing' },
])

async function fetchAll(background = false) {
  if (!listingId.value) return
  if (!background) loading.value = true
  try {
    const { getMarketListing, getMarketListingBids } = await import('@/api/market')
    const [detail, history] = await Promise.all([
      getMarketListing(listingId.value),
      getMarketListingBids(listingId.value),
    ])
    listing.value = detail
    bids.value = history
    notFound.value = false
  } catch {
    if (!background) {
      notFound.value = true
      listing.value = null
    }
  }
  if (!background) loading.value = false
}

function onSocketEvent(event: MarketListingEvent) {
  const current = listing.value
  if (!current || event.listingId !== current.id) return
  current.endsAt = event.endsAt
  current.status = event.status
  if (event.type === 'bid' && event.amount != null) {
    current.currentBid = event.amount
    current.currentBidder = event.actor
    current.minimumNextBid = event.amount + current.minIncrement
    current.bidCount += 1
    if (event.actor && !bids.value.some((b) => b.amount === event.amount && b.bidder.id === event.actor?.id)) {
      bids.value = [
        {
          id: `live-${current.id}-${++syntheticBidCounter}`,
          listingId: current.id,
          bidder: event.actor,
          amount: event.amount,
          buyout: false,
          createdAt: new Date().toISOString(),
        },
        ...bids.value,
      ]
    }
    fetchAll(true)
  } else if (event.type === 'sold') {
    current.winner = event.actor
    current.finalPrice = event.amount
    fetchAll(true)
  } else if (event.type === 'expired' || event.type === 'cancelled') {
    fetchAll(true)
  }
}

const { status: socketStatus } = useMarketListingSocket(
  () => (listing.value && active.value ? listingId.value : null),
  {
    onEvent: onSocketEvent,
    onReconnect: () => fetchAll(true),
  },
)

async function handleBid(amount: number) {
  if (!listing.value) return
  actionBusy.value = true
  amountError.value = null
  formError.value = null
  try {
    const { placeMarketBid } = await import('@/api/market')
    listing.value = await placeMarketBid(listing.value.id, amount)
    const { getMarketListingBids } = await import('@/api/market')
    const [history] = await Promise.all([
      getMarketListingBids(listing.value.id),
      essenceStore.fetchBalance(true),
    ])
    bids.value = history
  } catch (e) {
    const parsed = parseApiError(e, 'Could not place that bid.')
    const field = parsed.fieldErrors.find((f) => f.field === 'amount')
    if (field) amountError.value = field.message
    else formError.value = parsed.fieldErrors[0]?.message ?? parsed.message
  } finally {
    actionBusy.value = false
  }
}

async function handleBuy() {
  if (!listing.value) return
  actionBusy.value = true
  amountError.value = null
  formError.value = null
  try {
    const { buyMarketListing, getMarketListingBids } = await import('@/api/market')
    listing.value = await buyMarketListing(listing.value.id)
    const [history] = await Promise.all([
      getMarketListingBids(listing.value.id),
      essenceStore.fetchBalance(true),
    ])
    bids.value = history
  } catch (e) {
    const parsed = parseApiError(e, 'Could not complete the purchase.')
    formError.value = parsed.fieldErrors[0]?.message ?? parsed.message
  } finally {
    actionBusy.value = false
  }
}

async function handleCancel() {
  if (!listing.value || actionBusy.value) return
  if (!cancelArmed.value) {
    cancelArmed.value = true
    if (cancelArmTimer) clearTimeout(cancelArmTimer)
    cancelArmTimer = setTimeout(() => {
      cancelArmed.value = false
    }, 4000)
    return
  }
  cancelArmed.value = false
  actionBusy.value = true
  formError.value = null
  try {
    const { cancelMarketListing } = await import('@/api/market')
    listing.value = await cancelMarketListing(listing.value.id)
  } catch (e) {
    const parsed = parseApiError(e, 'Could not cancel this listing.')
    formError.value = parsed.message
  } finally {
    actionBusy.value = false
  }
}

watch(listingId, () => fetchAll(), { immediate: true })

watch(
  () => authStore.isLoggedIn,
  (loggedIn) => {
    if (loggedIn) essenceStore.fetchBalance()
  },
  { immediate: true },
)

itemTypeStore.fetchItemTypes()

onUnmounted(() => {
  if (cancelArmTimer) clearTimeout(cancelArmTimer)
})
</script>

<template>
  <div class="listing-page" :style="{ '--page-accent': 'var(--accent-overall)' }">
    <Breadcrumbs :crumbs="breadcrumbs" />

    <div v-if="loading" class="listing-page__layout">
      <div class="listing-page__item">
        <SkeletonLoader variant="card" />
        <SkeletonLoader variant="text" :lines="4" />
      </div>
      <div class="listing-page__panel">
        <SkeletonLoader variant="text" :lines="2" />
        <SkeletonLoader variant="stat-block" />
        <SkeletonLoader variant="text" :lines="3" />
      </div>
    </div>

    <EmptyState v-else-if="notFound || !listing" message="This listing doesn't exist or was removed." />

    <template v-else>
      <div class="listing-page__layout">
        <section class="listing-page__item" aria-label="Item details">
          <MarketItemTile
            :user-item="listing.item"
            :quantity="listing.quantity"
            :item-override="previewItem"
            compose-borders
            :avatar-url="avatarUrl"
            class="listing-page__tile"
          />

          <div v-if="variantPreviews" class="listing-page__variants">
            <button
              v-for="variant in variantPreviews"
              :key="variant.key"
              type="button"
              class="listing-page__variant"
              :class="{ 'listing-page__variant--active': variant.key === activeVariantKey }"
              @click="activeVariantKey = variant.key"
            >
              {{ variant.label }}
            </button>
          </div>

          <p v-if="composedBorder && !avatarUrl" class="listing-page__preview-note">
            Log in to preview this on your profile picture.
          </p>

          <div class="listing-page__item-meta">
            <p class="listing-page__item-kind">
              <span class="listing-page__rarity" :class="rarityClass(listing.item.item.rarity)">
                {{ listing.item.item.rarity }}
              </span>
              <span class="listing-page__type">{{ typeLabel }}</span>
            </p>
            <h2 class="listing-page__item-name" :style="itemNameStyle">{{ itemName }}</h2>
            <p v-if="listing.item.item.description" class="listing-page__item-desc">
              {{ listing.item.item.description }}
            </p>
            <div v-if="chipModifiers.length > 0 || listing.item.unusualEffect" class="listing-page__chips">
              <ModifierChip v-for="m in chipModifiers" :key="m.id" :modifier="m" />
              <span v-if="listing.item.unusualEffect" class="listing-page__unusual">
                ★ {{ listing.item.unusualEffect.name }}
              </span>
            </div>
            <dl class="listing-page__facts">
              <template v-if="listing.item.serialNumber != null">
                <dt>Serial</dt>
                <dd>#{{ listing.item.serialNumber }}</dd>
              </template>
              <dt>Quantity</dt>
              <dd>{{ listing.quantity }}</dd>
              <dt>Listed</dt>
              <dd>{{ formatRelativeDate(listing.createdAt) }}</dd>
            </dl>
          </div>
        </section>

        <section class="listing-page__panel" aria-label="Listing">
          <h1 class="listing-page__title">{{ listing.title }}</h1>

          <p class="listing-page__seller">
            Listed by
            <MarketUserChip :user="listing.seller" link />
          </p>

          <p v-if="listing.description" class="listing-page__description">{{ listing.description }}</p>

          <div class="listing-page__status">
            <div v-if="price" class="listing-page__price">
              <span class="listing-page__price-label">{{ price.label }}</span>
              <EssenceAmount
                v-if="price.amount != null"
                :amount="price.amount"
                class="listing-page__price-value"
              />
              <span v-if="auction" class="listing-page__bid-count">
                {{ listing.bidCount }} {{ listing.bidCount === 1 ? 'bid' : 'bids' }}
              </span>
            </div>

            <div v-if="active" class="listing-page__timer">
              <ListingCountdown v-if="listing.endsAt" :ends-at="listing.endsAt" size="lg" />
              <span v-else class="listing-page__no-limit">
                <span class="listing-page__infinity" aria-hidden="true">∞</span> No time limit
              </span>
              <span v-if="socketStatus === 'reconnecting'" class="listing-page__stale">
                Live updates paused, reconnecting
              </span>
            </div>
          </div>

          <p v-if="active && listing.currentBidder" class="listing-page__leader">
            Highest bidder:
            <MarketUserChip :user="listing.currentBidder" link />
          </p>

          <div v-if="awaitingSettlement" class="listing-page__banner listing-page__banner--neutral">
            This listing has ended and is being settled.
          </div>

          <div v-else-if="listing.status === 'sold'" class="listing-page__banner listing-page__banner--sold">
            <span>
              Sold
              <template v-if="listing.finalPrice != null">
                for <EssenceAmount :amount="listing.finalPrice" />
              </template>
              <template v-if="listing.winner"> to </template>
            </span>
            <MarketUserChip v-if="listing.winner" :user="listing.winner" link />
            <span v-if="listing.settledAt" class="listing-page__banner-time">
              {{ formatRelativeDate(listing.settledAt) }}
            </span>
          </div>

          <div v-else-if="listing.status === 'expired'" class="listing-page__banner listing-page__banner--neutral">
            This listing expired without a sale.
          </div>

          <div v-else-if="listing.status === 'cancelled'" class="listing-page__banner listing-page__banner--neutral">
            This listing was cancelled by the seller.
          </div>

          <MarketBidPanel
            v-if="active && !awaitingSettlement"
            :listing="listing"
            :viewer-id="viewerId"
            :logged-in="authStore.isLoggedIn"
            :balance="essenceStore.balance"
            :reserved="essenceStore.reserved"
            :busy="actionBusy"
            :amount-error="amountError"
            :form-error="formError"
            @bid="handleBid"
            @buy="handleBuy"
          />

          <template v-if="canCancel">
            <BaseButton variant="destructive" size="sm" :loading="actionBusy" @click="handleCancel">
              {{ cancelArmed ? 'Confirm cancellation' : 'Cancel listing' }}
            </BaseButton>
            <p class="listing-page__cancel-hint">
              A listing can only be cancelled while it has no bids.
            </p>
          </template>

          <p v-if="formError && !active" class="listing-page__error" role="alert">{{ formError }}</p>
        </section>
      </div>

      <MarketBidHistory :bids="bids" :viewer-id="viewerId" />
    </template>
  </div>
</template>

<style scoped>
.listing-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 1100px;
  margin: 0 auto;
  width: 100%;
}

.listing-page__layout {
  display: grid;
  grid-template-columns: minmax(0, 380px) minmax(0, 1fr);
  gap: var(--space-xl);
  align-items: start;
}

.listing-page__item {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.listing-page__tile {
  max-width: 380px;
}

.listing-page__variants {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  max-width: 380px;
}

.listing-page__variant {
  padding: 4px 12px;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 500;
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
}

.listing-page__variant:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.listing-page__variant--active {
  border-color: var(--page-accent, var(--accent));
  color: var(--text-primary);
  background: color-mix(in srgb, var(--page-accent, var(--accent)) 12%, transparent);
}

.listing-page__preview-note {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.listing-page__item-meta {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.listing-page__item-kind {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.listing-page__rarity {
  color: var(--rarity-color, var(--text-tertiary));
}

.listing-page__rarity.rarity--common { --rarity-color: var(--text-tertiary); }
.listing-page__rarity.rarity--uncommon { --rarity-color: var(--success); }
.listing-page__rarity.rarity--rare { --rarity-color: var(--info); }
.listing-page__rarity.rarity--epic { --rarity-color: var(--tier-apex); }
.listing-page__rarity.rarity--legendary { --rarity-color: var(--tier-gold); }
.listing-page__rarity.rarity--mythic { --rarity-color: var(--error); }

.listing-page__type {
  color: var(--text-tertiary);
  text-transform: capitalize;
}

.listing-page__item-name {
  margin: 0;
  font-size: var(--text-section-heading);
  font-weight: 600;
  color: var(--text-primary);
}

.listing-page__item-desc {
  margin: 0;
  font-size: var(--text-body);
  color: var(--text-secondary);
  line-height: 1.5;
  max-width: 65ch;
}

.listing-page__chips {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-wrap: wrap;
}

.listing-page__unusual {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  color: var(--tier-gold);
  border: 1px solid color-mix(in srgb, var(--tier-gold) 45%, transparent);
}

.listing-page__facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-xs) var(--space-md);
  margin: 0;
  font-size: var(--text-body);
}

.listing-page__facts dt {
  color: var(--text-tertiary);
}

.listing-page__facts dd {
  margin: 0;
  color: var(--text-primary);
  font-family: var(--font-mono);
}

.listing-page__panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-lg);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
}

.listing-page__title {
  margin: 0;
  font-size: var(--text-page-title);
  font-weight: 700;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.listing-page__seller {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin: 0;
  font-size: var(--text-body);
  color: var(--text-secondary);
}

.listing-page__description {
  margin: 0;
  font-size: var(--text-body);
  color: var(--text-secondary);
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-width: 65ch;
}

.listing-page__status {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
  padding: var(--space-md) 0;
  border-top: 1px solid var(--bg-overlay);
  border-bottom: 1px solid var(--bg-overlay);
}

.listing-page__price {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.listing-page__price-label {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.listing-page__price-value {
  font-size: 1.5rem;
  color: var(--text-primary);
}

.listing-page__bid-count {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.listing-page__timer {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-xs);
}

.listing-page__no-limit {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-body);
  color: var(--text-secondary);
  white-space: nowrap;
}

.listing-page__infinity {
  font-size: 1.25rem;
  line-height: 1;
  color: var(--text-tertiary);
}

.listing-page__stale {
  font-size: var(--text-caption);
  color: var(--warning);
}

.listing-page__leader {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin: 0;
  font-size: var(--text-body);
  color: var(--text-secondary);
}

.listing-page__banner {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-wrap: wrap;
  padding: var(--space-md);
  border-radius: var(--radius-card);
  font-size: var(--text-body);
}

.listing-page__banner--sold {
  border: 1px solid color-mix(in srgb, var(--success) 40%, transparent);
  background: color-mix(in srgb, var(--success) 8%, var(--bg-surface));
  color: var(--text-primary);
}

.listing-page__banner--neutral {
  border: 1px solid var(--bg-overlay);
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.listing-page__banner-time {
  margin-left: auto;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.listing-page__cancel-hint {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.listing-page__error {
  margin: 0;
  font-size: var(--text-body);
  color: var(--error);
}

@media (max-width: 900px) {
  .listing-page__layout {
    grid-template-columns: 1fr;
  }

  .listing-page__tile {
    max-width: 320px;
  }
}
</style>
