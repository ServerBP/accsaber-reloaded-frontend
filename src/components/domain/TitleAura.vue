<script setup lang="ts">
import TitleFlameAura from '@/components/domain/TitleFlameAura.vue'
import TitleHazeAura from '@/components/domain/TitleHazeAura.vue'
import TitleSmokeAura from '@/components/domain/TitleSmokeAura.vue'
import type { TitleAuraSpec, TitleAuraType } from '@/types/api/items'
import { TITLE_AURA_PAD } from '@/utils/titleAura'
import { computed, type Component } from 'vue'

const AURA_RENDERERS: Record<TitleAuraType, Component> = {
  flame: TitleFlameAura,
  haze: TitleHazeAura,
  smoke: TitleSmokeAura,
}

const props = defineProps<{
  aura: TitleAuraSpec
  light: boolean
}>()

const renderer = computed(() => AURA_RENDERERS[props.aura.type] ?? null)

const hostStyle = {
  left: `${-TITLE_AURA_PAD.x}em`,
  top: `${-TITLE_AURA_PAD.top}em`,
  width: `calc(100% + ${TITLE_AURA_PAD.x * 2}em)`,
  height: `calc(100% + ${TITLE_AURA_PAD.top + TITLE_AURA_PAD.bottom}em)`,
}
</script>

<template>
  <span v-if="renderer" class="title-aura" :style="hostStyle" aria-hidden="true">
    <component :is="renderer" :aura="aura" :light="light" />
  </span>
</template>

<style scoped>
.title-aura {
  position: absolute;
  display: block;
  pointer-events: none;
  z-index: 0;
}

.title-aura :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
}
</style>
