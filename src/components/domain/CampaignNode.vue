<script setup lang="ts">
import CampaignShape from '@/components/domain/CampaignShape.vue'
import type {
  CampaignDifficultyProgressResponse,
  CampaignDifficultyResponse,
} from '@/types/api/campaigns'
import { pickCoverUrl } from '@/composables/useAvatarFallback'
import {
  isMilestoneNode,
  resolveSize,
  resolveShape,
  shapeCorners,
  type LabelPlacement,
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
  isNext?: boolean
  labelPlacement?: LabelPlacement | null
}>()

defineEmits<{ select: [id: string] }>()

const state = computed<'locked' | 'available' | 'cleared' | 'current'>(() => {
  if (props.progress?.completed) return 'cleared'
  if (props.selected) return 'current'
  if (props.progress && !props.progress.unlocked) return 'locked'
  if (props.isNext) return 'current'
  return 'available'
})

const effectiveSize = computed(() => resolveSize(props.difficulty.size, props.size))

const effectiveShape = computed(() => resolveShape(props.difficulty.borderShape))

const isMilestone = computed(() => isMilestoneNode(props.difficulty))

const effectiveAccent = computed(() => {
  if (props.difficulty.borderColor) return props.difficulty.borderColor
  if (isMilestone.value) return 'var(--accent-overall)'
  return props.accentColor
})

const avatarUrl = computed(
  () => props.difficulty.checkpointAvatarUrl || pickCoverUrl(props.difficulty) || null,
)

const avatarRadius = computed(() => effectiveSize.value)

const NODE_BORDER_SCALE = 1.5

const borderArt = computed(() => {
  const url = props.difficulty.nodeBorderUrl
  if (!url) return null
  const radius = effectiveSize.value * NODE_BORDER_SCALE
  return {
    url,
    x: props.cx - radius,
    y: props.cy - radius,
    extent: radius * 2,
    below: props.difficulty.nodeBorderLayer === 'BELOW',
  }
})

const clipId = computed(() => `node-clip-${props.difficulty.id}`)

const borderId = computed(() => `node-border-${props.difficulty.id}`)

const clipPoints = computed(() =>
  shapeCorners(effectiveShape.value, props.cx, props.cy, effectiveSize.value),
)

const songLabel = computed(() => props.difficulty.songName)

const labelBoxed = computed(() => !!props.labelPlacement?.boxed)

const baseLabelFontSize = computed(() => Math.max(effectiveSize.value * 0.22, 9))

const labelFontSize = computed(() => {
  if (!labelBoxed.value) return baseLabelFontSize.value
  const len = Math.max(songLabel.value.length, 1)
  const fit = (effectiveSize.value * 1.7) / (len * 0.56)
  return Math.max(8, Math.min(baseLabelFontSize.value, fit))
})

const labelX = computed(() => props.labelPlacement?.x ?? props.cx)

const labelY = computed(
  () => props.labelPlacement?.y ?? props.cy + effectiveSize.value * 1.55,
)

const labelAnchor = computed(() => props.labelPlacement?.anchor ?? 'middle')

const labelPlate = computed(() => {
  if (!labelBoxed.value) return null
  const fs = labelFontSize.value
  const textW = Math.max(songLabel.value.length, 1) * fs * 0.56
  const w = textW + fs * 0.9
  const h = fs * 1.5
  return {
    x: labelX.value - w / 2,
    y: labelY.value - fs * 0.95,
    width: w,
    height: h,
    rx: Math.min(4, h / 3),
  }
})

const tickCx = computed(() => props.cx + effectiveSize.value * 0.62)

const tickCy = computed(() => props.cy + effectiveSize.value * 0.72)

const tickR = computed(() => effectiveSize.value * 0.32)

const requiresAll = computed(() =>
  props.difficulty.prerequisiteMode === 'AND'
  && (props.difficulty.prerequisites?.length ?? 0) >= 2,
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
      <image
        v-if="borderArt"
        :id="borderId"
        :href="borderArt.url"
        :x="borderArt.x"
        :y="borderArt.y"
        :width="borderArt.extent"
        :height="borderArt.extent"
        preserveAspectRatio="xMidYMid meet"
      />
    </defs>

    <use v-if="borderArt?.below" class="campaign-node__border" :href="`#${borderId}`" />

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

    <use v-if="borderArt && !borderArt.below" class="campaign-node__border" :href="`#${borderId}`" />

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

    <rect
      v-if="labelPlate"
      class="campaign-node__label-plate"
      :x="labelPlate.x"
      :y="labelPlate.y"
      :width="labelPlate.width"
      :height="labelPlate.height"
      :rx="labelPlate.rx"
    />

    <text
      class="campaign-node__label"
      :class="{ 'campaign-node__label--boxed': labelBoxed }"
      :x="labelX"
      :y="labelY"
      :font-size="labelFontSize"
      :text-anchor="labelAnchor"
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

.campaign-node__border {
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

.campaign-node__label--boxed {
  stroke-width: 1.5;
}

.campaign-node__label-plate {
  fill: var(--bg-base);
  fill-opacity: 0.82;
  stroke: var(--bg-overlay);
  stroke-width: 1;
  pointer-events: none;
}

.campaign-node--locked .campaign-node__label {
  fill: var(--text-tertiary);
}

.campaign-node--locked .campaign-node__avatar,
.campaign-node--locked .campaign-node__border {
  filter: grayscale(0.65) brightness(0.62);
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
