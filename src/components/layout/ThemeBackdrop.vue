<script setup lang="ts">
import { BACKDROP_RENDERERS } from '@/components/layout/backdropRenderers'
import { useThemeStore } from '@/stores/theme'
import { readBackdropConfig } from '@/utils/themeBackdrop'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const themeStore = useThemeStore()
const route = useRoute()

const config = computed(() => readBackdropConfig(themeStore.activeTokens))
const configKey = computed(() =>
  config.value ? `${route.path}|${JSON.stringify(config.value)}` : '',
)
</script>

<template>
  <component
    :is="BACKDROP_RENDERERS[config.type]"
    v-if="config"
    :key="configKey"
    :config="config"
  />
</template>
