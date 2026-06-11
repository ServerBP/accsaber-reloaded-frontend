<script setup lang="ts">
import CampaignShape from '@/components/domain/CampaignShape.vue'
import type {
  CampaignDifficultyProgressResponse,
  CampaignDifficultyResponse,
} from '@/types/api/campaigns'
import {
  parseNumericSize,
  resolveShape,
  shapeCorners,
} from '@/utils/campaignLayout'
import { computed } from 'vue'

const props = defineProps<{
  difficulty: CampaignDifficultyResponse
  progress?: CampaignDifficultyProgressResponse | null
  cx: number
  cy: number
  size: number
  accentColor: string
  selected?: boolean
}>()

defineEmits<{ select: [id: string] }>()

const state = computed<'locked' | 'available' | 'cleared' | 'current'>(() => {
  if (props.progress?.completed) return 'cleared'
  if (props.selected) return 'current'
  if (props.progress && !props.progress.unlocked) return 'locked'
  return 'available'
})

const effectiveSize = computed(() => parseNumericSize(props.difficulty.size, props.size))

const effectiveShape = computed(() => resolveShape(props.difficulty.borderShape))

const isMilestone = computed(
  () => !!(
    props.difficulty.checkpointLabel
    || props.difficulty.checkpointAvatarUrl
    || props.difficulty.checkpointColor
    || props.difficulty.checkpointSize
  ),
)

const effectiveAccent = computed(() => {
  if (props.difficulty.borderColor) return props.difficulty.borderColor
  if (isMilestone.value) return 'var(--accent-overall)'
  return props.accentColor
})

const avatarUrl = computed(
  () => props.difficulty.checkpointAvatarUrl || props.difficulty.coverUrl || null,
)

const avatarRadius = computed(() => effectiveSize.value)

const clipId = computed(() => `node-clip-${props.difficulty.id}`)

const clipPoints = computed(() =>
  shapeCorners(effectiveShape.value, props.cx, props.cy, effectiveSize.value),
)

const songLabel = computed(() => props.difficulty.songName)

const labelOffsetY = computed(() => props.cy + effectiveSize.value * 1.55)

const labelFontSize = computed(() => Math.max(effectiveSize.value * 0.22, 9))

const tickCx = computed(() => props.cx + effectiveSize.value * 0.62)

const tickCy = computed(() => props.cy + effectiveSize.value * 0.72)

const tickR = computed(() => effectiveSize.value * 0.32)

const requiresAll = computed(() =>
  props.difficulty.prerequisiteMode === 'AND'
  && (props.difficulty.prerequisiteCampaignDifficultyIds?.length ?? 0) >= 2,
)

const gateCx = computed(() => props.cx + effectiveSize.value * 0.62)

const gateCy = computed(() => props.cy - effectiveSize.value * 0.72)

const gateR = computed(() => effectiveSize.value * 0.3)
</script>

<template>
  <g
    class="campaign-node"
    :class="[`campaign-node--${state}`, { 'campaign-node--selected': selected }]"
    @click="$emit('select', difficulty.id)"
  >
    <defs>
      <clipPath :id="clipId" clipPathUnits="userSpaceOnUse">
        <circle v-if="effectiveShape === 'circle'" :cx="cx" :cy="cy" :r="effectiveSize" />
        <polygon v-else :points="clipPoints" />
      </clipPath>
    </defs>

    <CampaignShape
      :cx="cx"
      :cy="cy"
      :size="effectiveSize"
      :state="state"
      :shape="effectiveShape"
      :accent-color="effectiveAccent"
      :accent-band="Math.max(effectiveSize * 0.07, 3)"
      :inner-border="Math.max(effectiveSize * 0.05, 1.5)"
    />

    <image
      v-if="avatarUrl"
      :href="avatarUrl"
      :x="cx - avatarRadius"
      :y="cy - avatarRadius"
      :width="avatarRadius * 2"
      :height="avatarRadius * 2"
      :clip-path="`url(#${clipId})`"
      preserveAspectRatio="xMidYMid slice"
      class="campaign-node__avatar"
    />

    <g v-if="state === 'cleared'" class="campaign-node__tick" :transform="`translate(${tickCx}, ${tickCy})`">
      <circle :r="tickR" fill="var(--success)" stroke="var(--bg-base)" :stroke-width="tickR * 0.18" />
      <path
        :transform="`scale(${tickR * 0.055})`"
        d="M-8 0L-2 6L8 -6"
        fill="none"
        stroke="#ffffff"
        :stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </g>

    <text
      class="campaign-node__label"
      :x="cx"
      :y="labelOffsetY"
      :font-size="labelFontSize"
      text-anchor="middle"
      fill="var(--text-primary)"
    >
      {{ songLabel }}
    </text>

    <g
      v-if="requiresAll"
      class="campaign-node__gate"
      :transform="`translate(${gateCx}, ${gateCy})`"
      role="img"
      aria-label="Requires every prerequisite to unlock"
    >
      <title>Requires every prerequisite to unlock</title>
      <circle :r="gateR" fill="var(--bg-base)" :stroke="effectiveAccent"
        :stroke-width="gateR * 0.18" />
      <g :transform="`scale(${gateR * 0.07})`">
        <line x1="0" y1="-6" x2="0" y2="6" stroke="currentColor"
          stroke-width="1.8" stroke-linecap="round" />
        <line x1="-5.196" y1="-3" x2="5.196" y2="3" stroke="currentColor"
          stroke-width="1.8" stroke-linecap="round" />
        <line x1="-5.196" y1="3" x2="5.196" y2="-3" stroke="currentColor"
          stroke-width="1.8" stroke-linecap="round" />
      </g>
    </g>
  </g>
</template>

<style scoped>
.campaign-node {
  cursor: pointer;
}

.campaign-node__avatar {
  pointer-events: none;
}

.campaign-node__tick {
  pointer-events: none;
}

.campaign-node__label {
  font-family: var(--font-sans);
  font-weight: 600;
  pointer-events: none;
  paint-order: stroke;
  stroke: var(--bg-base);
  stroke-width: 3;
  stroke-linejoin: round;
}

.campaign-node--locked .campaign-node__label {
  fill: var(--text-tertiary);
}

.campaign-node__gate {
  color: var(--warning);
  cursor: help;
}

.campaign-node__gate title {
  pointer-events: auto;
}

.campaign-node--locked .campaign-node__gate {
  opacity: 0.55;
}

</style>
