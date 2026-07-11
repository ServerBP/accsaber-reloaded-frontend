<script setup lang="ts">
import { useElementCanvas } from '@/composables/useBackdropCanvas'
import type { ToonFill } from '@/types/api/items'
import { overlaySpace } from '@/utils/overlayCanvas'
import { randBetween as rand } from '@/utils/random'
import { useTemplateRef } from 'vue'

const props = defineProps<{
  fill: ToonFill
}>()

const MARGIN = 25

interface Speck {
  x: number
  y: number
  alpha: number
}

let specks: Speck[] = []
let lastRollAt = 0

function rollStatic() {
  specks = Array.from({ length: 90 }, () => ({
    x: rand(-25, 125),
    y: rand(-25, 125),
    alpha: rand(0.04, 0.16),
  }))
}

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvas')

useElementCanvas(canvasRef, {
  init(_w, _h, now) {
    rollStatic()
    lastRollAt = now
  },
  draw(ctx, w, h, now, reduced) {
    const cell = props.fill.staticCell ?? 2.4
    const fps = props.fill.staticFps ?? 8
    if (!reduced && now - lastRollAt >= 1000 / fps) {
      rollStatic()
      lastRollAt = now
    }
    const { sx, sy, toX, toY } = overlaySpace(w, h, MARGIN)
    ctx.fillStyle = props.fill.ink
    ctx.fillRect(0, 0, w, h)
    const boost = props.fill.staticAlpha ?? 1
    ctx.fillStyle = props.fill.line
    for (const speck of specks) {
      const cx = Math.round(speck.x / cell) * cell
      const cy = Math.round(speck.y / cell) * cell
      ctx.globalAlpha = Math.min(1, speck.alpha * boost)
      ctx.fillRect(toX(cx), toY(cy), cell * sx, cell * sy)
    }
    ctx.globalAlpha = 1
  },
})
</script>

<template>
  <canvas ref="canvas" class="toon-border-fill" aria-hidden="true" />
</template>

<style scoped>
.toon-border-fill {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  pointer-events: none;
}
</style>
