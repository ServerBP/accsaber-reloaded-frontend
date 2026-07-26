<script setup lang="ts">
import { PLUGIN_HARD_WARNING } from '@/utils/campaignPlugin'
import CampaignEditorNote from './CampaignEditorNote.vue'

defineProps<{ show: boolean; detail?: string }>()
</script>

<template>
  <CampaignEditorNote v-if="show" tone="error">
    <strong>{{ PLUGIN_HARD_WARNING }}</strong>
    <template v-if="detail"> {{ detail }}</template>
  </CampaignEditorNote>
</template>
