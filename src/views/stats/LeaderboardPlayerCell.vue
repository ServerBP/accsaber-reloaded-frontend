<script setup lang="ts">
import GlowImage from '@/components/common/GlowImage.vue'
import CountryFlag from '@/components/domain/CountryFlag.vue'
import PlayerTooltipTrigger from '@/components/domain/PlayerTooltipTrigger.vue'

withDefaults(
  defineProps<{
    userId: string
    userName: string
    avatarUrl: string
    avatarFallbackUrl?: string | null
    country: string
    size?: number
  }>(),
  { size: 32, avatarFallbackUrl: null },
)
</script>

<template>
  <PlayerTooltipTrigger :user-id="userId" :user-name="userName" :avatar-url="avatarUrl"
    :avatar-fallback-url="avatarFallbackUrl" :country="country">
    <div class="player-cell">
      <GlowImage :src="avatarUrl" :alt="userName" :size="size" :fallback-src="avatarFallbackUrl" />
      <span class="player-cell__name">{{ userName }}</span>
      <CountryFlag :country="country" />
    </div>
  </PlayerTooltipTrigger>
</template>

<style scoped>
.player-cell {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
}

.player-cell__name {
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
</style>
