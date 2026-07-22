<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import type { MarketListingResponse } from '@/types/api/market'
import { formatEssence } from '@/utils/essence'
import { digitsOnly } from '@/utils/formatters'
import { isAuction, isSameMarketUser, sanitizeEssenceInput } from '@/utils/market'
import { computed, ref, watch } from 'vue'
import EssenceAmount from '@/components/domain/EssenceAmount.vue'

const props = defineProps<{
  listing: MarketListingResponse
  viewerId: string | null
  loggedIn: boolean
  balance: number | null
  reserved: number | null
  busy: boolean
  amountError: string | null
  formError: string | null
}>()

const emit = defineEmits<{
  bid: [amount: number]
  buy: []
}>()

const amount = ref('')
const armedBid = ref(false)
const armedBuy = ref(false)

const auction = computed(() => isAuction(props.listing))
const buyout = computed(() => props.listing.buyoutPrice)
const amountNumber = computed(() => sanitizeEssenceInput(amount.value))
const minimumBid = computed(() => props.listing.minimumNextBid ?? props.listing.startingBid ?? 1)

const willBuyout = computed(
  () => buyout.value != null && amountNumber.value != null && amountNumber.value >= buyout.value,
)

const disabledReason = computed(() => {
  if (!props.loggedIn) return 'Sign in to bid or buy on the market.'
  if (isSameMarketUser(props.listing.seller, props.viewerId)) return 'This is your listing.'
  if (isSameMarketUser(props.listing.currentBidder, props.viewerId))
    return "You're the highest bidder."
  return null
})

const bidLocked = computed(() => disabledReason.value !== null)
const buyLocked = computed(() => !props.loggedIn || isSameMarketUser(props.listing.seller, props.viewerId))

const overBalance = computed(
  () =>
    !bidLocked.value &&
    amountNumber.value != null &&
    props.balance != null &&
    amountNumber.value > props.balance,
)

const bidButtonLabel = computed(() => {
  if (armedBid.value && buyout.value != null) return `Confirm buyout · ${formatEssence(buyout.value)}`
  return 'Place bid'
})

const buyButtonLabel = computed(() => {
  if (buyout.value == null) return ''
  return armedBuy.value
    ? `Confirm · ${formatEssence(buyout.value)}`
    : `Buy now · ${formatEssence(buyout.value)}`
})

watch(
  () => props.listing.minimumNextBid,
  (next) => {
    if (next == null) return
    const current = amountNumber.value
    if (current == null || current < next) amount.value = String(next)
  },
  { immediate: true },
)

watch([amount, () => props.listing.id], () => {
  armedBid.value = false
  armedBuy.value = false
})

function onAmountInput(value: string | number) {
  amount.value = digitsOnly(value)
}

function submitBid() {
  const value = amountNumber.value
  if (bidLocked.value || props.busy || value == null) return
  if (willBuyout.value && !armedBid.value) {
    armedBid.value = true
    return
  }
  armedBid.value = false
  emit('bid', value)
}

function submitBuy() {
  if (buyLocked.value || props.busy) return
  if (!armedBuy.value) {
    armedBuy.value = true
    return
  }
  armedBuy.value = false
  emit('buy')
}
</script>

<template>
  <div class="bid-panel">
    <template v-if="auction">
      <div class="bid-panel__row">
        <BaseInput
          class="bid-panel__input"
          :model-value="amount"
          label="Your bid"
          inputmode="numeric"
          autocomplete="off"
          :disabled="bidLocked || busy"
          :error="amountError ?? undefined"
          @update:model-value="onAmountInput"
          @keydown.enter="submitBid"
        />
        <BaseButton
          class="bid-panel__submit"
          variant="primary"
          :disabled="bidLocked || amountNumber == null"
          :loading="busy"
          @click="submitBid"
        >
          {{ bidButtonLabel }}
        </BaseButton>
      </div>

      <p class="bid-panel__hint">
        Minimum bid <EssenceAmount :amount="minimumBid" />
      </p>

      <p v-if="willBuyout && !bidLocked && buyout != null" class="bid-panel__warning" role="alert">
        This meets the buyout price. Submitting will buy the item immediately for
        <EssenceAmount :amount="buyout" />.
      </p>

      <p v-else-if="overBalance" class="bid-panel__warning">
        That's more than your available balance.
      </p>
    </template>

    <BaseButton
      v-if="buyout != null"
      class="bid-panel__buy"
      :variant="auction ? 'default' : 'primary'"
      size="lg"
      :disabled="buyLocked"
      :loading="busy"
      @click="submitBuy"
    >
      {{ buyButtonLabel }}
    </BaseButton>

    <p v-if="disabledReason" class="bid-panel__reason">{{ disabledReason }}</p>
    <p v-if="formError" class="bid-panel__error" role="alert">{{ formError }}</p>

    <p v-if="loggedIn && balance != null" class="bid-panel__balance">
      Balance <EssenceAmount :amount="balance" />
      <template v-if="(reserved ?? 0) > 0">
        · <EssenceAmount :amount="reserved ?? 0" /> held in bids
      </template>
    </p>
  </div>
</template>

<style scoped>
.bid-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.bid-panel__row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-sm);
}

.bid-panel__input {
  flex: 1;
  min-width: 0;
}

.bid-panel__submit {
  flex-shrink: 0;
}

.bid-panel__hint {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.bid-panel__warning {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--warning);
}

.bid-panel__reason {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.bid-panel__error {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--error);
}

.bid-panel__balance {
  margin: 0;
  padding-top: var(--space-xs);
  border-top: 1px solid var(--bg-overlay);
  font-size: var(--text-caption);
  color: var(--text-secondary);
}
</style>
