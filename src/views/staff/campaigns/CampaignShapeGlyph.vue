<script setup lang="ts">
import type { CampaignNodeShape } from '@/types/api/campaigns'
import { computed } from 'vue'

const props = withDefaults(defineProps<{ shape: CampaignNodeShape; radius?: number }>(), {
  radius: 10,
})

const hexPoints = computed(() => {
  const r = props.radius
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i
    pts.push(`${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
})

const diamondPoints = computed(() => {
  const r = props.radius
  return `0,${-r} ${r},0 0,${r} ${-r},0`
})

const squareHalf = computed(() => props.radius * 0.9)
</script>

<template>
  <svg width="22" height="22" viewBox="-12 -12 24 24" aria-hidden="true">
    <polygon
      v-if="shape === 'hex'"
      :points="hexPoints"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
    />
    <rect
      v-else-if="shape === 'square'"
      :x="-squareHalf"
      :y="-squareHalf"
      :width="squareHalf * 2"
      :height="squareHalf * 2"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
    />
    <circle v-else-if="shape === 'circle'" :r="radius" fill="none" stroke="currentColor" stroke-width="1.6" />
    <polygon v-else :points="diamondPoints" fill="none" stroke="currentColor" stroke-width="1.6" />
  </svg>
</template>
