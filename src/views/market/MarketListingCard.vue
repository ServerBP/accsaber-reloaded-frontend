<script setup lang="ts">
import type { MarketListingResponse } from '@/types/api/market'
import { formatRelativeDate } from '@/utils/formatters'
import { displayItemName, rarityClass } from '@/utils/items'
import { isAuction, listingKind, listingPrice, MARKET_STATUS_LABEL } from '@/utils/market'
import { computed } from 'vue'
import EssenceAmount from '@/components/domain/EssenceAmount.vue'
import ListingCountdown from './ListingCountdown.vue'
import MarketItemTile from './MarketItemTile.vue'
import MarketUserChip from './MarketUserChip.vue'

export interface ListingCardTag {
  label: string
  tone: 'success' | 'error' | 'neutral' | 'gold'
}

const props = defineProps<{
  listing: MarketListingResponse
  tag?: ListingCardTag | null
}>()

const itemName = computed(() =>
  displayItemName(props.listing.item.modifiers ?? [], props.listing.item.item.name),
)

const active = computed(() => props.listing.status === 'active')
const price = computed(() => listingPrice(props.listing))
const kind = computed(() => listingKind(props.listing))
const auction = computed(() => isAuction(props.listing))
const settledLabel = computed(() => {
  const label = MARKET_STATUS_LABEL[props.listing.status]
  const when = props.listing.settledAt ? ` ${formatRelativeDate(props.listing.settledAt)}` : ''
  return `${label}${when}`
})
</script>

<template>
  <RouterLink
    class="market-card"
    :class="{
      'market-card--settled': !active,
      'market-card--alert': tag?.tone === 'error',
    }"
    :to="{ name: 'market-listing', params: { listingId: listing.id } }"
  >
    <div class="market-card__art">
      <MarketItemTile :user-item="listing.item" :quantity="listing.quantity" />
      <span v-if="tag" class="market-card__tag" :class="`market-card__tag--${tag.tone}`">
        {{ tag.label }}
      </span>
    </div>

    <div class="market-card__body">
      <span class="market-card__title">{{ listing.title }}</span>
      <div class="market-card__item-row">
        <span class="market-card__item-name">{{ itemName }}</span>
        <span class="market-card__rarity" :class="rarityClass(listing.item.item.rarity)">
          {{ listing.item.item.rarity }}
        </span>
      </div>

      <div class="market-card__price">
        <span class="market-card__price-label">{{ price.label }}</span>
        <EssenceAmount v-if="price.amount != null" :amount="price.amount" class="market-card__price-value" />
      </div>
      <div v-if="active && kind === 'auction_buyout' && listing.buyoutPrice != null" class="market-card__buyout">
        Buy now <EssenceAmount :amount="listing.buyoutPrice" />
      </div>

      <div class="market-card__meta">
        <MarketUserChip :user="listing.seller" compact class="market-card__seller" />
        <span class="market-card__meta-right">
          <span v-if="auction" class="market-card__bids">
            {{ listing.bidCount }} {{ listing.bidCount === 1 ? 'bid' : 'bids' }}
          </span>
          <ListingCountdown
            v-if="active && listing.endsAt"
            :ends-at="listing.endsAt"
            class="market-card__countdown"
          />
          <span v-else-if="active" class="market-card__no-limit">
            <span class="market-card__infinity" aria-hidden="true">∞</span> No time limit
          </span>
          <span v-else class="market-card__settled">{{ settledLabel }}</span>
        </span>
      </div>
    </div>
  </RouterLink>
</template>

<style scoped>
.market-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-sm);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  text-decoration: none;
  color: var(--text-primary);
  transition: border-color 150ms ease-out, transform 150ms ease-out;
}

.market-card:hover {
  border-color: var(--text-tertiary);
  transform: scale(1.01);
}

.market-card:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--page-accent, var(--accent)) 60%, transparent);
  outline-offset: 2px;
}

.market-card--settled .market-card__art {
  opacity: 0.6;
}

.market-card--alert {
  border-color: var(--error);
}

.market-card__art {
  position: relative;
}

.market-card__tag {
  position: absolute;
  top: var(--space-xs);
  left: var(--space-xs);
  padding: 2px 6px;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--bg-base) 82%, transparent);
  border: 1px solid var(--bg-overlay);
  color: var(--text-secondary);
  z-index: 2;
}

.market-card__tag--success {
  color: var(--success);
  border-color: color-mix(in srgb, var(--success) 45%, transparent);
}

.market-card__tag--error {
  color: var(--error);
  border-color: color-mix(in srgb, var(--error) 55%, transparent);
}

.market-card__tag--gold {
  color: var(--tier-gold);
  border-color: color-mix(in srgb, var(--tier-gold) 45%, transparent);
}

.market-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
}

.market-card__title {
  font-size: var(--text-card-title);
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.market-card__item-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-sm);
  min-width: 0;
}

.market-card__item-name {
  font-size: var(--text-caption);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.market-card__rarity {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--rarity-color, var(--text-tertiary));
  flex-shrink: 0;
}

.market-card__rarity.rarity--common { --rarity-color: var(--text-tertiary); }
.market-card__rarity.rarity--uncommon { --rarity-color: var(--success); }
.market-card__rarity.rarity--rare { --rarity-color: var(--info); }
.market-card__rarity.rarity--epic { --rarity-color: var(--tier-apex); }
.market-card__rarity.rarity--legendary { --rarity-color: var(--tier-gold); }
.market-card__rarity.rarity--mythic { --rarity-color: var(--error); }

.market-card__price {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
  margin-top: var(--space-xs);
}

.market-card__price-label {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.market-card__price-value {
  font-size: 1.125rem;
  color: var(--text-primary);
}

.market-card__buyout {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.market-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  border-top: 1px solid var(--bg-overlay);
  padding-top: var(--space-xs);
  min-height: 22px;
}

.market-card__seller {
  flex: 1;
  min-width: 0;
}

.market-card__meta-right {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

.market-card__bids {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.market-card__settled {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.market-card__no-limit {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  white-space: nowrap;
}

.market-card__infinity {
  font-size: 1rem;
  line-height: 1;
  color: var(--text-tertiary);
}

@media (prefers-reduced-motion: reduce) {
  .market-card {
    transition: none;
  }

  .market-card:hover {
    transform: none;
  }
}
</style>
