<script setup lang="ts">
import BaseModal from '@/components/common/BaseModal.vue'
import UnusualEffectTile from '@/components/domain/UnusualEffectTile.vue'
import type { UnusualEffectResponse } from '@/types/api/items'

defineProps<{
  open: boolean
  effect: UnusualEffectResponse | null
}>()

defineEmits<{ close: [] }>()
</script>

<template>
  <BaseModal :open="open" :title="effect?.name" max-width="340px" @close="$emit('close')">
    <div v-if="effect" class="epm">
      <UnusualEffectTile :name="effect.name" :effect-spec="effect.effectSpec" :size="220" />
      <span class="epm__type">Unusual effect</span>
    </div>
  </BaseModal>
</template>

<style scoped>
.epm {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

.epm :deep(.ue-tile__name) {
  display: none;
}

.epm__type {
  font-size: var(--text-caption);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
}
</style>
