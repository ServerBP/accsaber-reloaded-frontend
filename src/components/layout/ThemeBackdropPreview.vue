<script setup lang="ts">
import { BACKDROP_RENDERERS } from '@/components/layout/backdropRenderers'
import { readBackdropConfig, type ThemeBackdropType } from '@/utils/themeBackdrop'
import { computed } from 'vue'

const props = defineProps<{
  tokens: Record<string, string> | null
}>()

const PREVIEW_ZOOM: Record<ThemeBackdropType, number> = {
  starfield: 2,
  pixel_field: 4,
  forest: 4,
}

const config = computed(() => readBackdropConfig(props.tokens))
const configKey = computed(() => (config.value ? JSON.stringify(config.value) : ''))
</script>

<template>
  <span
    v-if="config"
    class="theme-backdrop-preview"
    data-fx-static=""
    :data-fx-inline="PREVIEW_ZOOM[config.type]"
    aria-hidden="true"
  >
    <component :is="BACKDROP_RENDERERS[config.type]" :key="configKey" :config="config" />
  </span>
</template>

<style scoped>
.theme-backdrop-preview {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: block;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
}

.theme-backdrop-preview :deep(canvas) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: auto;
}
</style>
