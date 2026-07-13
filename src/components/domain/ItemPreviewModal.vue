<script setup lang="ts">
import BaseModal from '@/components/common/BaseModal.vue'
import BorderCompositionPreview from '@/components/domain/BorderCompositionPreview.vue'
import ItemPreview from '@/components/domain/ItemPreview.vue'
import { useAuthStore } from '@/stores/auth'
import type { ItemResponse } from '@/types/api/items'
import { itemVariantPreviews, rarityClass, readBorderColorValue, readBorderShapeValue } from '@/utils/items'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  item: ItemResponse | null
}>()

const emit = defineEmits<{ close: [] }>()

const authStore = useAuthStore()
const avatarUrl = computed(() => authStore.userProfile?.avatarUrl ?? null)

const variants = computed(() => (props.item ? itemVariantPreviews(props.item) : null))
const activeVariant = ref<string | null>(null)

watch(
  () => [props.item, props.open] as const,
  () => {
    if (props.open) activeVariant.value = variants.value?.[0]?.key ?? null
  },
  { immediate: true },
)

const previewItem = computed<ItemResponse | null>(() => {
  if (!props.item) return null
  if (!variants.value) return props.item
  const match = variants.value.find((v) => v.key === activeVariant.value) ?? variants.value[0]
  return match.item
})

const isBorder = computed(
  () =>
    previewItem.value?.typeKey === 'profile_border_shape' ||
    previewItem.value?.typeKey === 'profile_border_color',
)

const isTitle = computed(() => previewItem.value?.typeKey === 'title')

const shapeValue = computed(() =>
  previewItem.value?.typeKey === 'profile_border_shape'
    ? readBorderShapeValue(previewItem.value.value)
    : null,
)
const colorValue = computed(() =>
  previewItem.value?.typeKey === 'profile_border_color'
    ? readBorderColorValue(previewItem.value.value)
    : null,
)

const typeLabel = computed(() => props.item?.typeKey.replace(/_/g, ' ') ?? '')
</script>

<template>
  <BaseModal :open="open" :title="item?.name" max-width="460px" @close="emit('close')">
    <div v-if="item" class="ipm">
      <div
        class="ipm__art"
        :class="[rarityClass(item.rarity), { 'ipm__art--wide': isTitle, 'ipm__art--border': isBorder }]"
      >
        <BorderCompositionPreview
          v-if="isBorder"
          :shape="shapeValue"
          :color="colorValue"
          :avatar-url="avatarUrl"
        />
        <ItemPreview v-else :item="previewItem ?? item" />
      </div>

      <span class="ipm__type">{{ typeLabel }}</span>
      <p v-if="item.description" class="ipm__desc">{{ item.description }}</p>

      <div v-if="variants" class="ipm__variants">
        <button
          v-for="v in variants"
          :key="v.key"
          type="button"
          class="ipm__variant"
          :class="{ 'ipm__variant--active': v.key === activeVariant }"
          @click="activeVariant = v.key"
        >
          {{ v.label }}
        </button>
      </div>

      <p v-if="isBorder && !avatarUrl" class="ipm__note">Log in to preview this on your profile picture.</p>
    </div>
  </BaseModal>
</template>

<style scoped>
.ipm {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  text-align: center;
}

.ipm__art {
  --rarity-color: var(--text-tertiary);
  --cell-accent: var(--rarity-color);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 172px;
  height: 172px;
  border: 1px solid var(--rarity-color);
  border-radius: var(--radius-card);
  background: var(--bg-base);
  overflow: hidden;
}

.ipm__art--wide {
  width: max-content;
  min-width: 200px;
  max-width: 100%;
  height: 104px;
  padding-inline: var(--space-lg);
}

.ipm__art--border {
  width: 208px;
  height: 208px;
  border: none;
  background: none;
  overflow: visible;
}

.ipm__art--wide :deep(.item-preview__title),
.ipm__art--wide :deep(.title-renderer__text) {
  max-width: none;
  overflow: visible;
  text-overflow: clip;
}

.ipm__art.rarity--common { --rarity-color: var(--text-tertiary); }
.ipm__art.rarity--uncommon { --rarity-color: var(--success); }
.ipm__art.rarity--rare { --rarity-color: var(--info); }
.ipm__art.rarity--epic { --rarity-color: var(--tier-apex); }
.ipm__art.rarity--legendary { --rarity-color: var(--tier-gold); }
.ipm__art.rarity--mythic { --rarity-color: var(--error); }

.ipm__type {
  font-size: var(--text-caption);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
}

.ipm__desc {
  margin: 0;
  max-width: 40ch;
  font-size: var(--text-body);
  line-height: 1.5;
  color: var(--text-secondary);
}

.ipm__variants {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-xs);
}

.ipm__variant {
  padding: 4px 12px;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 500;
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
}

.ipm__variant:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.ipm__variant--active {
  border-color: var(--page-accent, var(--accent));
  color: var(--text-primary);
  background: color-mix(in srgb, var(--page-accent, var(--accent)) 12%, transparent);
}

.ipm__note {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}
</style>
