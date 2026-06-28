<script setup lang="ts">
import type { BorderDecal } from '@/types/api/items'

defineProps<{
  decals: BorderDecal[]
}>()
</script>

<template>
  <span class="border-decals" aria-hidden="true">
    <svg
      v-for="(decal, i) in decals"
      :key="i"
      class="border-decals__item"
      :viewBox="decal.viewBox"
      :style="{
        left: `${decal.xPct}%`,
        top: `${decal.yPct}%`,
        width: `${decal.sizePct}%`,
        opacity: decal.opacity ?? 1,
        transform: `translate(-50%, -50%) rotate(${decal.rotateDeg ?? 0}deg)`,
      }"
    >
      <path
        v-for="(p, pi) in decal.paths"
        :key="pi"
        :d="p.d"
        :fill="p.fill ?? 'none'"
        :stroke="p.stroke"
        :stroke-width="p.strokeWidth"
        :stroke-linecap="p.strokeLinecap"
        :stroke-linejoin="p.strokeLinejoin"
        :stroke-dasharray="p.strokeDasharray"
        :stroke-opacity="p.strokeOpacity"
        :fill-opacity="p.fillOpacity"
        :transform="p.transform"
      />
    </svg>
  </span>
</template>

<style scoped>
.border-decals {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.border-decals__item {
  position: absolute;
  aspect-ratio: 1 / 1;
  height: auto;
  overflow: visible;
}
</style>
