<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import EssenceAmount from '@/components/domain/EssenceAmount.vue'
import TradeOfferRowItem from '@/components/domain/TradeOfferRowItem.vue'
import { useItemModifierStore } from '@/stores/itemModifiers'
import type { TradeItemRef, TradeResponse } from '@/types/api/trades'
import { formatEssenceAmount, formatEssenceNet } from '@/utils/essence'
import { formatRelativeDate } from '@/utils/formatters'
import { computed, onMounted } from 'vue'

const props = defineProps<{
  trade: TradeResponse
  perspective: 'incoming' | 'outgoing'
  busy?: boolean
  spendableBalance?: number | null
}>()

defineEmits<{
  accept: [tradeId: string]
  decline: [tradeId: string]
  cancel: [tradeId: string]
}>()

const modifierStore = useItemModifierStore()

const counterpartUserId = computed(() =>
  props.perspective === 'incoming' ? props.trade.fromUserId : props.trade.toUserId,
)

const yourSide = computed<TradeItemRef[]>(() =>
  props.perspective === 'incoming' ? props.trade.requestedItems : props.trade.offeredItems,
)
const theirSide = computed<TradeItemRef[]>(() =>
  props.perspective === 'incoming' ? props.trade.offeredItems : props.trade.requestedItems,
)

const yourEssence = computed(() =>
  props.perspective === 'incoming' ? props.trade.requestedEssence : props.trade.offeredEssence,
)
const theirEssence = computed(() =>
  props.perspective === 'incoming' ? props.trade.offeredEssence : props.trade.requestedEssence,
)

const acceptCost = computed(() =>
  props.perspective === 'incoming' && props.trade.status === 'pending'
    ? props.trade.requestedEssence
    : 0,
)

const essenceInvolved = computed(
  () => props.trade.offeredEssence > 0 || props.trade.requestedEssence > 0,
)

const recipientNet = computed(() => props.trade.offeredEssence - props.trade.requestedEssence)

const cannotAffordAccept = computed(
  () =>
    acceptCost.value > 0 &&
    props.spendableBalance != null &&
    acceptCost.value > props.spendableBalance,
)

const showActions = computed(() => props.trade.status === 'pending')

onMounted(() => {
  modifierStore.fetchModifiers()
})
</script>

<template>
  <div class="trade-row">
    <header class="trade-row__head">
      <span class="trade-row__direction">
        {{ perspective === 'incoming' ? 'Offered by' : 'Sent to' }}
        <router-link class="trade-row__user-link" :to="{ name: 'player-profile', params: { userId: counterpartUserId } }">
          {{ counterpartUserId }}
        </router-link>
      </span>
      <span class="trade-row__head-spacer" />
      <span class="trade-row__status-pill" :class="`trade-row__status-pill--${trade.status}`">
        {{ trade.status }}
      </span>
    </header>

    <p v-if="trade.message" class="trade-row__message">{{ trade.message }}</p>

    <div class="trade-row__sides">
      <section class="trade-row__side">
        <span class="trade-row__side-label">
          {{ perspective === 'incoming' ? 'You give' : 'You offered' }}
          <span class="trade-row__count">({{ yourSide.length }})</span>
        </span>
        <div v-if="yourEssence > 0" class="trade-row__essence">
          <EssenceAmount :amount="yourEssence" />
          <span class="trade-row__essence-word">essence</span>
        </div>
        <div v-if="yourSide.length === 0 && yourEssence === 0" class="trade-row__side-empty">Nothing</div>
        <div v-else-if="yourSide.length > 0" class="trade-row__side-items">
          <TradeOfferRowItem
            v-for="ref in yourSide"
            :key="ref.linkId"
            :item-ref="ref"
          />
        </div>
      </section>

      <div class="trade-row__swap" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      </div>

      <section class="trade-row__side">
        <span class="trade-row__side-label">
          {{ perspective === 'incoming' ? 'You receive' : 'They give' }}
          <span class="trade-row__count">({{ theirSide.length }})</span>
        </span>
        <div v-if="theirEssence > 0" class="trade-row__essence">
          <EssenceAmount :amount="theirEssence" />
          <span class="trade-row__essence-word">essence</span>
        </div>
        <div v-if="theirSide.length === 0 && theirEssence === 0" class="trade-row__side-empty">Nothing</div>
        <div v-else-if="theirSide.length > 0" class="trade-row__side-items">
          <TradeOfferRowItem
            v-for="ref in theirSide"
            :key="ref.linkId"
            :item-ref="ref"
          />
        </div>
      </section>
    </div>

    <footer class="trade-row__foot">
      <span class="trade-row__date">{{ formatRelativeDate(trade.createdAt) }}</span>
      <div v-if="showActions" class="trade-row__actions">
        <template v-if="perspective === 'incoming'">
          <span
            v-if="cannotAffordAccept"
            class="trade-row__accept-cost trade-row__accept-cost--short"
          >
            Accepting costs {{ formatEssenceAmount(acceptCost) }} ✦, you only have
            {{ formatEssenceAmount(spendableBalance ?? 0) }} available
          </span>
          <span v-else-if="essenceInvolved" class="trade-row__accept-cost">
            {{ formatEssenceNet(recipientNet) }}
          </span>
          <BaseButton
            variant="primary"
            size="sm"
            :loading="busy"
            :disabled="cannotAffordAccept"
            @click="$emit('accept', trade.id)"
          >Accept</BaseButton>
          <BaseButton variant="destructive" size="sm" :loading="busy" @click="$emit('decline', trade.id)">Decline</BaseButton>
        </template>
        <template v-else>
          <BaseButton variant="destructive" size="sm" :loading="busy" @click="$emit('cancel', trade.id)">Cancel</BaseButton>
        </template>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.trade-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
}

.trade-row__head {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.trade-row__head-spacer {
  flex: 1;
}

.trade-row__direction {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.trade-row__user-link {
  color: var(--text-primary);
  text-decoration: none;
  font-weight: 500;
}

.trade-row__user-link:hover {
  color: var(--accent-overall);
}

.trade-row__status-pill {
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid currentColor;
}

.trade-row__status-pill--pending { color: var(--warning); }
.trade-row__status-pill--accepted { color: var(--success); }
.trade-row__status-pill--declined,
.trade-row__status-pill--cancelled,
.trade-row__status-pill--expired { color: var(--text-tertiary); }

.trade-row__message {
  margin: 0;
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-base);
  border-radius: var(--radius-card);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  font-style: italic;
}

.trade-row__sides {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: var(--space-md);
  align-items: stretch;
}

.trade-row__side {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-sm);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  min-width: 0;
}

.trade-row__side-label {
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
}

.trade-row__count {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  letter-spacing: 0;
  text-transform: none;
}

.trade-row__essence {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-xs);
  align-self: flex-start;
  padding: var(--space-xs) var(--space-sm);
  font-size: var(--text-body);
  color: var(--text-primary);
  background: color-mix(in srgb, var(--tier-gold) 7%, var(--bg-surface));
  border: 1px solid color-mix(in srgb, var(--tier-gold) 40%, transparent);
  border-radius: var(--radius-card);
}

.trade-row__essence-word {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.trade-row__accept-cost {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  align-self: center;
  text-align: right;
}

.trade-row__accept-cost--short {
  color: var(--error);
}

.trade-row__side-empty {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  padding: var(--space-sm) 0;
}

.trade-row__side-items {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.trade-row__swap {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  padding: 0 var(--space-xs);
}

.trade-row__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.trade-row__date {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.trade-row__actions {
  display: flex;
  gap: var(--space-xs);
}

@media (max-width: 640px) {
  .trade-row__sides {
    grid-template-columns: 1fr;
  }

  .trade-row__swap {
    transform: rotate(90deg);
    align-self: center;
  }
}
</style>
