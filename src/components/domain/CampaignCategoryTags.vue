<script setup lang="ts">
import { useCategoryStore } from '@/stores/categories'
import type { CampaignTagResponse } from '@/types/api/campaigns'
import { computed } from 'vue'

const props = defineProps<{
  tags: CampaignTagResponse[]
  collapse?: boolean
}>()

const categoryStore = useCategoryStore()

const categoryTags = computed(() => props.tags.filter((t) => t.kind === 'CATEGORY'))

const visibleTags = computed(() =>
  props.collapse ? categoryTags.value.slice(0, 1) : categoryTags.value,
)

const overflowCount = computed(() => categoryTags.value.length - visibleTags.value.length)

const fullLabel = computed(() => categoryTags.value.map((t) => t.name).join(', '))

function accentFor(tag: CampaignTagResponse): string {
  if (!tag.categoryId) return 'var(--accent-overall)'
  const code = categoryStore.getCategoryCode(tag.categoryId)
  if (!code) return 'var(--accent-overall)'
  return categoryStore.getCategoryInfo(code)?.accent ?? 'var(--accent-overall)'
}
</script>

<template>
  <template v-if="categoryTags.length">
    <span
      v-for="tag in visibleTags"
      :key="tag.id"
      class="campaign-tag"
      :style="{ color: accentFor(tag) }"
      :title="overflowCount > 0 ? fullLabel : undefined"
    >
      {{ tag.name }}
    </span>
    <span v-if="overflowCount > 0" class="campaign-tag campaign-tag--more" :title="fullLabel">
      (+{{ overflowCount }})
    </span>
  </template>
</template>

<style scoped>
.campaign-tag {
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.campaign-tag--more {
  color: var(--text-tertiary);
  letter-spacing: 0.08em;
}
</style>
