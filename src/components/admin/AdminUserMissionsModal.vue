<script setup lang="ts">
import { getUserCompletedMissions, getUserMissions } from '@/api/admin/missions';
import BaseModal from '@/components/common/BaseModal.vue';
import MissionsPanel from '@/components/domain/MissionsPanel.vue';
import type { MissionResponse } from '@/types/api/missions';

const props = defineProps<{
  open: boolean
  userId: string | null
  userName: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

function loadActive(): Promise<MissionResponse[]> {
  if (!props.userId) return Promise.resolve([])
  return getUserMissions(props.userId)
}

function loadHistory(): Promise<MissionResponse[]> {
  if (!props.userId) return Promise.resolve([])
  return getUserCompletedMissions(props.userId)
}
</script>

<template>
  <BaseModal :open="open" :title="userName ? `Missions - ${userName}` : 'Missions'" max-width="680px"
    @close="emit('close')">
    <div class="admin-missions-modal">
      <MissionsPanel v-if="userId" :key="userId" :active="open" :load-active="loadActive" :load-history="loadHistory"
        hide-title />
    </div>
  </BaseModal>
</template>

<style scoped>
.admin-missions-modal {
  margin: calc(var(--space-lg) * -1);
  max-height: calc(100vh - var(--space-xl) * 4);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.admin-missions-modal :deep(.missions-panel) {
  min-height: 0;
  flex: 1;
}
</style>
