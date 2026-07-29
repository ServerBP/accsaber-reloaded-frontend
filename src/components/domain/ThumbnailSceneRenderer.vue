<script setup lang="ts">
import type { ThumbnailScene } from '@/types/api/items'
import type { Component } from 'vue'
import FacetVaultScene from './FacetVaultScene.vue'

const SCENE_RENDERERS: Record<ThumbnailScene['type'], Component> = {
  facet_vault: FacetVaultScene,
}

defineProps<{ scene: ThumbnailScene }>()
</script>

<template>
  <component :is="SCENE_RENDERERS[scene.type]" v-if="SCENE_RENDERERS[scene.type]" :scene="scene" />
</template>
