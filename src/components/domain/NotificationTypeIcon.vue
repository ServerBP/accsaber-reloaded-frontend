<script setup lang="ts">
import type { NotificationType } from '@/types/api/notifications'
import { NOTIFICATION_TYPES } from '@/utils/notifications'
import { computed } from 'vue'

const props = defineProps<{
  type: string
}>()

const KNOWN_TYPES: ReadonlySet<string> = new Set(NOTIFICATION_TYPES)

const resolved = computed<NotificationType | 'unknown'>(() =>
  KNOWN_TYPES.has(props.type) ? (props.type as NotificationType) : 'unknown',
)
</script>

<template>
  <svg class="notification-type-icon" :class="`notification-type-icon--${resolved}`" width="20"
    height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="resolved === 'trade_offer'">
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </template>
    <template v-else-if="resolved === 'trade_accepted'">
      <polyline points="20 6 9 17 4 12" />
    </template>
    <template v-else-if="resolved === 'trade_declined'">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </template>
    <template v-else-if="resolved === 'market_sold'">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </template>
    <template v-else-if="resolved === 'market_bid'">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </template>
    <template v-else-if="resolved === 'item_earned'">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </template>
    <template v-else-if="resolved === 'server'">
      <circle cx="12" cy="12" r="2" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49" />
      <path d="M7.76 16.24a6 6 0 0 1 0-8.49" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M4.93 19.07a10 10 0 0 1 0-14.14" />
    </template>
    <template v-else>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </template>
  </svg>
</template>

<style scoped>
.notification-type-icon {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.notification-type-icon--trade_offer,
.notification-type-icon--market_bid {
  color: var(--info);
}

.notification-type-icon--trade_accepted,
.notification-type-icon--market_sold {
  color: var(--success);
}

.notification-type-icon--trade_declined {
  color: var(--error);
}

.notification-type-icon--item_earned {
  color: var(--tier-gold);
}

.notification-type-icon--server {
  color: var(--accent);
}
</style>
