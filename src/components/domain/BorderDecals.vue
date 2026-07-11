<script setup lang="ts">
import type { BorderDecal } from '@/types/api/items'

defineProps<{
  decals: BorderDecal[]
}>()

function pulseVars(decal: BorderDecal): Record<string, string> | undefined {
  if (!decal.pulse) return undefined
  return {
    '--decal-pulse-period': `${decal.pulse.periodMs ?? 1100}ms`,
    '--decal-pulse-scale': String(1 + (decal.pulse.scaleAmp ?? 0.12)),
  }
}
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
      <g
        :class="{ 'border-decals__pulse': !!decal.pulse }"
        :style="pulseVars(decal)"
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
      </g>
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

.border-decals__pulse {
  transform-box: fill-box;
  transform-origin: center;
  animation: decal-pulse var(--decal-pulse-period, 1100ms) ease-in-out infinite;
}

@keyframes decal-pulse {
  0%, 100% { transform: scale(1); }
  38% { transform: scale(var(--decal-pulse-scale, 1.12)); }
  55% { transform: scale(1.02); }
}

@media (prefers-reduced-motion: reduce) {
  .border-decals__pulse {
    animation: none;
  }
}
</style>
