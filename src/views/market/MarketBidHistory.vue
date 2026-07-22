<script setup lang="ts">
import EssenceAmount from '@/components/domain/EssenceAmount.vue'
import CountryFlag from '@/components/domain/CountryFlag.vue'
import { onAvatarError, pickAvatarFallback, pickAvatarUrl } from '@/composables/useAvatarFallback'
import type { MarketBidResponse, MarketListingResponse } from '@/types/api/market'
import { formatRelativeDate } from '@/utils/formatters'
import { isSameMarketUser } from '@/utils/market'
import { computed } from 'vue'

const props = defineProps<{
  listing: MarketListingResponse
  bids: MarketBidResponse[]
  viewerId: string | null
}>()

interface ChatMessage {
  bid: MarketBidResponse
  right: boolean
  mine: boolean
  latest: boolean
  drift: number
  text: string
}

function drift(id: string): number {
  let hash = 5381
  for (let i = 0; i < id.length; i++) hash = (hash * 33) ^ id.charCodeAt(i)
  return Math.abs(hash) % 44
}

const leaderId = computed(() => {
  const leader = props.listing.winner ?? props.listing.currentBidder
  return leader ? String(leader.id) : null
})

const messages = computed<ChatMessage[]>(() => {
  const chronological = [...props.bids].reverse()
  return chronological.map((bid, index) => ({
    bid,
    right: leaderId.value !== null && String(bid.bidder.id) === leaderId.value,
    mine: isSameMarketUser(bid.bidder, props.viewerId),
    latest: index === chronological.length - 1 && props.listing.status === 'active',
    drift: drift(bid.id),
    text: bid.buyout ? 'Buyout!' : index === 0 ? 'Opens at' : 'Raise to',
  }))
})

const closingLine = computed(() => {
  if (props.listing.status === 'sold' && props.listing.winner) {
    return { text: `Sold to ${props.listing.winner.name} for`, amount: props.listing.finalPrice }
  }
  if (props.listing.status === 'expired') return { text: 'Expired without a sale', amount: null }
  if (props.listing.status === 'cancelled') return { text: 'Cancelled by the seller', amount: null }
  return null
})
</script>

<template>
  <div class="bid-chat">
    <h2 class="bid-chat__heading">Bid history</h2>

    <p v-if="bids.length === 0 && !closingLine" class="bid-chat__empty">
      No bids yet. The floor is quiet.
    </p>

    <ol v-else class="bid-chat__feed">
      <li v-if="listing.startingBid != null" class="bid-chat__system">
        Bidding opened at <EssenceAmount :amount="listing.startingBid" />
      </li>

      <li
        v-for="msg in messages"
        :key="msg.bid.id"
        class="bid-chat__msg"
        :class="{
          'bid-chat__msg--right': msg.right,
          'bid-chat__msg--buyout': msg.bid.buyout,
          'bid-chat__msg--latest': msg.latest,
        }"
        :style="{ '--drift': `${msg.drift}px` }"
      >
        <img
          v-if="pickAvatarUrl(msg.bid.bidder)"
          class="bid-chat__avatar"
          :src="pickAvatarUrl(msg.bid.bidder)"
          :alt="`${msg.bid.bidder.name} avatar`"
          loading="lazy"
          decoding="async"
          @error="onAvatarError(pickAvatarFallback(msg.bid.bidder))($event)"
        />
        <span v-else class="bid-chat__avatar bid-chat__avatar--initial" aria-hidden="true">
          {{ msg.bid.bidder.name.slice(0, 1).toUpperCase() }}
        </span>

        <div class="bid-chat__bubble">
          <header class="bid-chat__head">
            <span class="bid-chat__name">{{ msg.bid.bidder.name }}</span>
            <CountryFlag v-if="msg.bid.bidder.country" :country="msg.bid.bidder.country" />
            <span v-if="msg.mine" class="bid-chat__you">You</span>
            <time class="bid-chat__time" :datetime="msg.bid.createdAt">
              {{ formatRelativeDate(msg.bid.createdAt) }}
            </time>
          </header>
          <p class="bid-chat__text">
            {{ msg.text }}
            <span class="bid-chat__amount"><EssenceAmount :amount="msg.bid.amount" /></span><template v-if="!msg.bid.buyout && messages[0] !== msg">!</template>
          </p>
        </div>
      </li>

      <li v-if="closingLine" class="bid-chat__system bid-chat__system--closing">
        {{ closingLine.text }}
        <EssenceAmount v-if="closingLine.amount != null" :amount="closingLine.amount" />
      </li>
    </ol>
  </div>
</template>

<style scoped>
.bid-chat__heading {
  margin: 0 0 var(--space-md);
  font-size: var(--text-section-heading);
  font-weight: 600;
  color: var(--text-primary);
}

.bid-chat__empty {
  margin: 0;
  font-size: var(--text-body);
  color: var(--text-tertiary);
}

.bid-chat__feed {
  margin: 0;
  padding: var(--space-md);
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  background: var(--bg-base);
}

.bid-chat__system {
  align-self: center;
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-xs);
  padding: 2px 10px;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.bid-chat__system--closing {
  color: var(--text-secondary);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-pill);
  padding: var(--space-xs) var(--space-md);
  margin-top: var(--space-xs);
}

.bid-chat__msg {
  display: flex;
  align-items: flex-end;
  gap: var(--space-sm);
  max-width: 72%;
  align-self: flex-start;
  margin-left: var(--drift, 0px);
}

.bid-chat__msg--right {
  align-self: flex-end;
  flex-direction: row-reverse;
  margin-left: 0;
  margin-right: var(--drift, 0px);
}

.bid-chat__avatar {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-card);
  object-fit: cover;
  flex-shrink: 0;
}

.bid-chat__avatar--initial {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  color: var(--text-secondary);
  font-size: var(--text-caption);
  font-weight: 700;
}

.bid-chat__bubble {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-xs) var(--space-md) var(--space-sm);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: 10px;
  border-bottom-left-radius: 3px;
  min-width: 0;
}

.bid-chat__msg--right .bid-chat__bubble {
  border-radius: 10px;
  border-bottom-right-radius: 3px;
  background: var(--bg-elevated);
}

.bid-chat__msg--latest .bid-chat__bubble {
  border-color: color-mix(in srgb, var(--page-accent, var(--accent)) 55%, transparent);
}

.bid-chat__msg--buyout .bid-chat__bubble {
  border-color: color-mix(in srgb, var(--tier-gold) 55%, transparent);
  background: color-mix(in srgb, var(--tier-gold) 7%, var(--bg-surface));
}

.bid-chat__head {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  font-size: var(--text-caption);
}

.bid-chat__name {
  font-weight: 600;
  color: var(--text-primary);
}

.bid-chat__you {
  padding: 0 5px;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--info);
  border: 1px solid color-mix(in srgb, var(--info) 45%, transparent);
  border-radius: var(--radius-pill);
}

.bid-chat__time {
  color: var(--text-tertiary);
  margin-left: var(--space-xs);
}

.bid-chat__text {
  margin: 0;
  font-size: var(--text-body);
  color: var(--text-secondary);
  line-height: 1.6;
}

.bid-chat__amount {
  display: inline-flex;
  padding: 0 6px;
  margin: 0 1px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--tier-gold) 12%, transparent);
  color: var(--text-primary);
  font-size: var(--text-body);
  vertical-align: baseline;
}

.bid-chat__msg--buyout .bid-chat__text {
  color: var(--text-primary);
  font-weight: 600;
}

@media (max-width: 640px) {
  .bid-chat__msg {
    max-width: 92%;
  }

  .bid-chat__msg,
  .bid-chat__msg--right {
    --drift: 0px;
  }
}
</style>
