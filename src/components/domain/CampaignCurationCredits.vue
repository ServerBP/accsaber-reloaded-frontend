<script setup lang="ts">
import UserChip from '@/components/domain/UserChip.vue'
import type { CampaignResponse } from '@/types/api/campaigns'
import { campaignBadges } from '@/utils/campaignBadges'
import { toStaffUserDisplay } from '@/utils/mappers'
import { computed } from 'vue'

const props = defineProps<{
  campaign: CampaignResponse
}>()

const credits = computed(() =>
  campaignBadges(props.campaign).flatMap((badge) =>
    badge.by
      ? [
          {
            kind: badge.kind,
            label: badge.kind === 'loved' ? 'Loved by' : 'Curated by',
            user: toStaffUserDisplay(badge.by),
          },
        ]
      : [],
  ),
)
</script>

<template>
  <ul v-if="credits.length > 0" class="curation-credits">
    <li v-for="credit in credits" :key="credit.kind" class="curation-credits__item">
      <span class="curation-credits__label">{{ credit.label }}</span>
      <UserChip :user="credit.user" compact />
    </li>
  </ul>
</template>

<style scoped>
.curation-credits {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs) var(--space-md);
}

.curation-credits__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.curation-credits__label {
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}
</style>
