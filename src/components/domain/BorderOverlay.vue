<script setup lang="ts">
import BorderArcadeOverlay from '@/components/domain/BorderArcadeOverlay.vue'
import BorderBlackHoleOverlay from '@/components/domain/BorderBlackHoleOverlay.vue'
import BorderBlueprintOverlay from '@/components/domain/BorderBlueprintOverlay.vue'
import BorderRainOverlay from '@/components/domain/BorderRainOverlay.vue'
import BorderThermalOverlay from '@/components/domain/BorderThermalOverlay.vue'
import type { BorderColorValue, BorderOverlaySpec, BorderOverlayType } from '@/types/api/items'
import type { Component } from 'vue'

const OVERLAY_RENDERERS: Record<BorderOverlayType, Component> = {
  rain: BorderRainOverlay,
  blackhole: BorderBlackHoleOverlay,
  arcade: BorderArcadeOverlay,
  thermal: BorderThermalOverlay,
  blueprint: BorderBlueprintOverlay,
}

defineProps<{
  overlay: BorderOverlaySpec
  avatarUrl?: string | null
  color?: BorderColorValue | null
}>()
</script>

<template>
  <component
    :is="OVERLAY_RENDERERS[overlay.type]"
    v-if="OVERLAY_RENDERERS[overlay.type]"
    :overlay="overlay"
    :avatar-url="avatarUrl"
    :color="color"
  />
</template>
