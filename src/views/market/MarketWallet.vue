<script setup lang="ts">
import { formatEssenceAmount } from '@/utils/essence'
import EssenceAmount from '@/components/domain/EssenceAmount.vue'

defineProps<{
  balance: number
  reserved: number
}>()
</script>

<template>
  <span
    class="market-wallet"
    :title="reserved > 0 ? `${formatEssenceAmount(reserved)} essence held in your active bids` : 'Essence balance'"
  >
    <EssenceAmount :amount="balance" class="market-wallet__balance" />
    <span v-if="reserved > 0" class="market-wallet__reserved">
      +{{ formatEssenceAmount(reserved) }} in bids
    </span>
  </span>
</template>

<style scoped>
.market-wallet {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  background: var(--bg-surface);
  white-space: nowrap;
}

.market-wallet__balance {
  font-size: var(--text-body);
  color: var(--text-primary);
}

.market-wallet__reserved {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-secondary);
}
</style>
