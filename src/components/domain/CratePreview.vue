<script setup lang="ts">
import CratePreviewModal from '@/components/domain/CratePreviewModal.vue'
import { useCrateContents } from '@/composables/useCrateContents'
import { useCrateModifiers } from '@/composables/useCrateModifiers'
import { useCrateUnusualEffects } from '@/composables/useCrateUnusualEffects'
import type { ItemResponse } from '@/types/api/items'
import { watch } from 'vue'

const props = defineProps<{
  open: boolean
  crate: ItemResponse | null
  ownedItemIds?: Set<string>
}>()

defineEmits<{ close: [] }>()

const { contents, loading: contentsLoading } = useCrateContents(() => props.crate)
const { modifiers, loading: modifiersLoading } = useCrateModifiers(() => props.crate)
const {
  effects,
  loading: effectsLoading,
  load: loadEffects,
} = useCrateUnusualEffects(() => props.crate?.id ?? null)

watch(
  () => props.open && props.crate?.id,
  (ready) => {
    if (ready) loadEffects()
  },
  { immediate: true },
)
</script>

<template>
  <CratePreviewModal
    :open="open"
    :crate="crate"
    :contents="contents"
    :contents-loading="contentsLoading"
    :modifiers="modifiers"
    :modifiers-loading="modifiersLoading"
    :effects="effects"
    :effects-loading="effectsLoading"
    :owned-item-ids="ownedItemIds"
    @close="$emit('close')"
  />
</template>
