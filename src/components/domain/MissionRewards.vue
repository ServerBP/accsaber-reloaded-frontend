<script setup lang="ts">
import RewardItemTile from '@/components/domain/RewardItemTile.vue'
import type { ItemResponse } from '@/types/api/items'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    xpReward?: number | null
    itemReward?: ItemResponse | null
    size?: number
  }>(),
  { xpReward: null, itemReward: null, size: 32 },
)

const hasXp = computed(() => props.xpReward != null && props.xpReward > 0)
</script>

<template>
  <div v-if="hasXp || itemReward" class="mission-rewards">
    <span v-if="hasXp" class="mission-rewards__xp">+{{ xpReward?.toLocaleString() }} XP</span>
    <RewardItemTile v-if="itemReward" :item="itemReward" :size="size" />
  </div>
</template>

<style scoped>
.mission-rewards {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

.mission-rewards__xp {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--mission-reward-accent, var(--page-accent, var(--accent)));
  white-space: nowrap;
}
</style>
