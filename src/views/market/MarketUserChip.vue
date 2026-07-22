<script setup lang="ts">
import CountryFlag from '@/components/domain/CountryFlag.vue'
import { onAvatarError, pickAvatarFallback, pickAvatarUrl } from '@/composables/useAvatarFallback'
import type { MarketUserRef } from '@/types/api/market'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps<{
  user: MarketUserRef
  link?: boolean
  compact?: boolean
}>()

const avatarUrl = computed(() => pickAvatarUrl(props.user))
const avatarFallback = computed(() => pickAvatarFallback(props.user))
</script>

<template>
  <component
    :is="link ? RouterLink : 'span'"
    class="market-user-chip"
    :class="{ 'market-user-chip--link': link, 'market-user-chip--compact': compact }"
    :to="link ? { name: 'player-profile', params: { userId: String(user.id) } } : undefined"
  >
    <img
      v-if="avatarUrl"
      class="market-user-chip__avatar"
      :src="avatarUrl"
      :alt="`${user.name} avatar`"
      loading="lazy"
      decoding="async"
      @error="onAvatarError(avatarFallback)($event)"
    />
    <span class="market-user-chip__name">{{ user.name }}</span>
    <CountryFlag v-if="user.country" :country="user.country" />
  </component>
</template>

<style scoped>
.market-user-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  color: var(--text-primary);
  text-decoration: none;
  font-size: var(--text-body);
}

.market-user-chip__avatar {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-card);
  object-fit: cover;
  flex-shrink: 0;
}

.market-user-chip__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.market-user-chip--link:hover .market-user-chip__name {
  color: var(--page-accent, var(--accent));
}

.market-user-chip--compact {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.market-user-chip--compact .market-user-chip__avatar {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-btn);
}
</style>
