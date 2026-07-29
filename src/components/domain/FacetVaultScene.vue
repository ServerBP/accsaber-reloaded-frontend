<script setup lang="ts">
import type { FacetVaultScene } from '@/types/api/items'
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{ scene: FacetVaultScene }>()

const VIEW_W = 320
const COLS = 8
const SEED = 100

const hostRef = ref<HTMLElement | null>(null)
const aspect = ref(0.375)
let observer: ResizeObserver | null = null

onMounted(() => {
  const el = hostRef.value
  if (!el) return
  observer = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect
    if (!rect || rect.width === 0) return
    const next = Math.round((rect.height / rect.width) * 20) / 20
    if (next > 0 && next !== aspect.value) aspect.value = next
  })
  observer.observe(el)
})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
})

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const viewH = computed(() => Math.max(40, Math.round(VIEW_W * aspect.value)))
const rows = computed(() => Math.max(2, Math.round(COLS * aspect.value)))

interface Facet {
  points: string
  fill: string
}

const facets = computed<Facet[]>(() => {
  const palette = props.scene.facets.length > 0 ? props.scene.facets : [props.scene.ink]
  const rand = mulberry32(SEED)
  const h = viewH.value
  const nRows = rows.value
  const cellW = VIEW_W / COLS
  const cellH = h / nRows
  const jitterX = cellW * 0.75
  const jitterY = cellH * 0.65

  const pts: [number, number][][] = []
  for (let r = 0; r <= nRows; r++) {
    const row: [number, number][] = []
    for (let c = 0; c <= COLS; c++) {
      let x = c * cellW
      let y = r * cellH
      if (c > 0 && c < COLS) x += (rand() - 0.5) * jitterX
      if (r > 0 && r < nRows) y += (rand() - 0.5) * jitterY
      row.push([x, y])
    }
    pts.push(row)
  }

  const pick = () => palette[Math.floor(rand() * palette.length)]
  const out: Facet[] = []
  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < COLS; c++) {
      const a = pts[r][c]
      const b = pts[r][c + 1]
      const d = pts[r + 1][c + 1]
      const e = pts[r + 1][c]
      const tris = rand() < 0.5 ? [[a, b, d], [a, d, e]] : [[a, b, e], [b, d, e]]
      for (const tri of tris) {
        out.push({
          points: tri.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '),
          fill: pick(),
        })
      }
    }
  }
  return out
})

const edge = computed(() => props.scene.edge ?? '#ffffff')
const edgeOpacity = computed(() => props.scene.edgeOpacity ?? 0.08)
const caustic = computed(() => props.scene.caustic ?? null)
const causticOpacity = computed(() => props.scene.causticOpacity ?? 0.24)
const causticAngle = computed(() => props.scene.causticAngleDeg ?? 115)

const gradientId = `fv-caustic-${Math.random().toString(36).slice(2, 9)}`

const sheenStyle = computed<Record<string, string>>(() => ({
  '--fv-sheen-color': props.scene.sheenColor ?? '#ffffff',
  '--fv-sheen-opacity': String(props.scene.sheenOpacity ?? 0.08),
}))
</script>

<template>
  <div ref="hostRef" class="facet-vault" :style="{ background: scene.ink }" aria-hidden="true">
    <svg
      class="facet-vault__svg"
      :viewBox="`0 0 ${VIEW_W} ${viewH}`"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient
          v-if="caustic"
          :id="gradientId"
          gradientUnits="userSpaceOnUse"
          x1="0"
          :y1="viewH / 2"
          :x2="VIEW_W"
          :y2="viewH / 2"
          :gradientTransform="`rotate(${causticAngle - 90} ${VIEW_W / 2} ${viewH / 2})`"
        >
          <stop offset="0.38" :stop-color="caustic" stop-opacity="0" />
          <stop offset="0.5" :stop-color="caustic" :stop-opacity="causticOpacity" />
          <stop offset="0.62" :stop-color="caustic" stop-opacity="0" />
        </linearGradient>
      </defs>
      <polygon
        v-for="(facet, i) in facets"
        :key="i"
        :points="facet.points"
        :fill="facet.fill"
        :stroke="edge"
        :stroke-opacity="edgeOpacity"
        stroke-width="1"
        vector-effect="non-scaling-stroke"
      />
      <rect
        v-if="caustic"
        :x="-VIEW_W / 2"
        :y="-viewH / 2"
        :width="VIEW_W * 2"
        :height="viewH * 2"
        :fill="`url(#${gradientId})`"
      />
    </svg>
    <span v-if="scene.sheen" class="facet-vault__sheen" :style="sheenStyle" />
  </div>
</template>

<style scoped>
.facet-vault {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.facet-vault__svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.facet-vault__sheen {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 40%,
    color-mix(in srgb, var(--fv-sheen-color) calc(var(--fv-sheen-opacity) * 100%), transparent) 50%,
    transparent 60%
  );
  transform: translateX(-110%);
  animation: facet-vault-sheen 420ms ease-out 180ms forwards;
}

@keyframes facet-vault-sheen {
  to {
    transform: translateX(110%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .facet-vault__sheen {
    animation: none;
  }
}
</style>
