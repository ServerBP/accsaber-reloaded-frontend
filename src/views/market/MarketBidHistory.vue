<script setup lang="ts">
import type { MarketBidResponse } from '@/types/api/market'
import { formatRelativeDate } from '@/utils/formatters'
import { isSameMarketUser } from '@/utils/market'
import EssenceAmount from '@/components/domain/EssenceAmount.vue'
import MarketUserChip from './MarketUserChip.vue'

defineProps<{
  bids: MarketBidResponse[]
  viewerId: string | null
}>()
</script>

<template>
  <div class="bid-history">
    <h2 class="bid-history__heading">Bid history</h2>
    <p v-if="bids.length === 0" class="bid-history__empty">No bids yet.</p>
    <ol v-else class="bid-history__list">
      <li
        v-for="(bid, index) in bids"
        :key="bid.id"
        class="bid-history__row"
        :class="{ 'bid-history__row--top': index === 0 }"
      >
        <MarketUserChip :user="bid.bidder" link class="bid-history__bidder" />
        <span v-if="bid.buyout" class="bid-history__buyout">Buyout</span>
        <span v-else-if="isSameMarketUser(bid.bidder, viewerId)" class="bid-history__you">You</span>
        <time class="bid-history__time" :datetime="bid.createdAt">
          {{ formatRelativeDate(bid.createdAt) }}
        </time>
        <EssenceAmount :amount="bid.amount" class="bid-history__amount" />
      </li>
    </ol>
  </div>
</template>

<style scoped>
.bid-history__heading {
  margin: 0 0 var(--space-md);
  font-size: var(--text-section-heading);
  font-weight: 600;
  color: var(--text-primary);
}

.bid-history__empty {
  margin: 0;
  font-size: var(--text-body);
  color: var(--text-tertiary);
}

.bid-history__list {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  overflow: hidden;
}

.bid-history__row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  min-height: 48px;
  padding: var(--space-xs) var(--space-md);
}

.bid-history__row:nth-child(odd) {
  background: var(--bg-surface);
}

.bid-history__row:nth-child(even) {
  background: var(--bg-elevated);
}

.bid-history__bidder {
  min-width: 0;
  flex: 1;
}

.bid-history__row--top .bid-history__amount {
  color: var(--page-accent, var(--accent));
}

.bid-history__buyout,
.bid-history__you {
  padding: 1px 6px;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
}

.bid-history__buyout {
  color: var(--tier-gold);
  border: 1px solid color-mix(in srgb, var(--tier-gold) 45%, transparent);
}

.bid-history__you {
  color: var(--info);
  border: 1px solid color-mix(in srgb, var(--info) 45%, transparent);
}

.bid-history__time {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.bid-history__amount {
  font-size: var(--text-body);
  color: var(--text-primary);
  flex-shrink: 0;
  min-width: 72px;
  justify-content: flex-end;
}
</style>
