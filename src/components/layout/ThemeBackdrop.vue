<script setup lang="ts">
import ModifierCompositions from '@/components/domain/ModifierCompositions.vue'
import { BACKDROP_RENDERERS } from '@/components/layout/backdropRenderers'
import { useThemeStore } from '@/stores/theme'
import { annotateEffectLayerStacks } from '@/utils/items'
import { readBackdropConfig } from '@/utils/themeBackdrop'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const themeStore = useThemeStore()
const route = useRoute()

const config = computed(() => readBackdropConfig(themeStore.activeTokens))
const configKey = computed(() =>
  config.value ? `${route.path}|${JSON.stringify(config.value)}` : '',
)
const effectLayers = computed(() =>
  annotateEffectLayerStacks(
    (themeStore.activeEffects ?? []).flatMap((layer) => {
      const compositions = layer.spec.themeCompositions
      if (!compositions?.length) return []
      return [{ key: layer.key, spec: { contractVersion: 1 as const, compositions } }]
    }),
  ),
)
</script>

<template>
  <component
    :is="BACKDROP_RENDERERS[config.type]"
    v-if="config"
    :key="configKey"
    :config="config"
  />
  <div v-if="effectLayers.length" class="backdrop-effects">
    <ModifierCompositions
      v-for="layer in effectLayers"
      :key="layer.key"
      :spec="layer.spec"
      :stack-index="layer.stackIndex"
    />
  </div>
</template>

<style scoped>
.backdrop-effects {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}
</style>
