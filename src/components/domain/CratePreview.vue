<script setup lang="ts">
import CratePreviewModal from '@/components/domain/CratePreviewModal.vue'
import type {
  CrateContentResponse,
  CrateModifierResponse,
  ItemResponse,
  UnusualEffectResponse,
} from '@/types/api/items'
import { ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  crate: ItemResponse | null
  ownedItemIds?: Set<string>
}>()

defineEmits<{ close: [] }>()

const contents = ref<CrateContentResponse[]>([])
const modifiers = ref<CrateModifierResponse[]>([])
const effects = ref<UnusualEffectResponse[]>([])
const loading = ref(false)

let requestId = 0

async function load(crateId: string) {
  const token = ++requestId
  loading.value = true
  try {
    const { getStaffCrateContents, getStaffCrateModifiers, getStaffCrateUnusualEffects } =
      await import('@/api/staff/crates')
    const [contentList, modifierList, effectList] = await Promise.all([
      getStaffCrateContents(crateId),
      getStaffCrateModifiers(crateId),
      getStaffCrateUnusualEffects(crateId),
    ])
    if (token !== requestId) return
    contents.value = contentList
    modifiers.value = modifierList
    effects.value = effectList
  } catch {
    if (token !== requestId) return
    contents.value = []
    modifiers.value = []
    effects.value = []
  } finally {
    if (token === requestId) loading.value = false
  }
}

watch(
  () => (props.open ? (props.crate?.id ?? null) : null),
  (crateId) => {
    if (crateId) load(crateId)
  },
  { immediate: true },
)
</script>

<template>
  <CratePreviewModal
    :open="open"
    :crate="crate"
    :contents="contents"
    :contents-loading="loading"
    :modifiers="modifiers"
    :modifiers-loading="loading"
    :effects="effects"
    :effects-loading="loading"
    :owned-item-ids="ownedItemIds"
    @close="$emit('close')"
  />
</template>
