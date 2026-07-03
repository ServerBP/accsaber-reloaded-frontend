<script setup lang="ts">
import CampaignPresenceActionGlyph from '@/components/domain/CampaignPresenceActionGlyph.vue'
import type { PresenceAction, PresenceKind } from '@/composables/useCampaignPresence'
import { computed } from 'vue'

const props = defineProps<{
  x: number
  y: number
  invScale: number
  color: string
  name: string
  avatarUrl: string
  action: PresenceAction
  kind: PresenceKind
}>()

const ARROW = 'M0 0 L0 17 L4.6 12.6 L7.2 18.2 L9.5 17.2 L6.9 11.7 L12.4 11.7 Z'

const clipId = computed(() => `presence-av-${props.name}-${Math.round(props.x)}-${Math.round(props.y)}`)

const displayName = computed(() =>
  props.name.length > 18 ? props.name.slice(0, 17) + '…' : props.name,
)

const showBadge = computed(
  () => props.action === 'drag' || props.action === 'connect' || props.action === 'place' || props.action === 'edit',
)

const chipWidth = computed(() => 26 + displayName.value.length * 6.4 + (props.kind ? 20 : 10))
</script>

<template>
  <g
    class="presence-cursor"
    :transform="`translate(${x}, ${y}) scale(${invScale})`"
    aria-hidden="true"
  >
    <path :d="ARROW" :fill="color" stroke="var(--bg-base)" stroke-width="1" stroke-linejoin="round" />
    <path :d="ARROW" fill="none" stroke="var(--text-primary)" stroke-width="0.7" stroke-linejoin="round" opacity="0.6" />

    <g v-if="showBadge" transform="translate(13.5, 9)">
      <circle r="8" :fill="color" stroke="var(--bg-base)" stroke-width="1" />
      <g
        transform="translate(-5, -5) scale(0.42)"
        stroke="var(--text-primary)"
        stroke-width="2"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <CampaignPresenceActionGlyph :action="action" />
      </g>
    </g>

    <g transform="translate(13, 16)">
      <rect
        :width="chipWidth"
        height="22"
        rx="4"
        fill="var(--bg-surface)"
        :stroke="color"
        stroke-width="1"
      />
      <clipPath :id="clipId">
        <rect x="5" y="3" width="16" height="16" rx="4" />
      </clipPath>
      <image
        v-if="avatarUrl"
        :href="avatarUrl"
        x="5"
        y="3"
        width="16"
        height="16"
        :clip-path="`url(#${clipId})`"
        preserveAspectRatio="xMidYMid slice"
      />
      <rect v-else x="5" y="3" width="16" height="16" rx="4" :fill="color" opacity="0.4" />
      <rect x="5" y="3" width="16" height="16" rx="4" fill="none" :stroke="color" stroke-width="1" />

      <text x="26" y="15" fill="var(--text-primary)" font-size="11" font-weight="600" font-family="var(--font-sans)">
        {{ displayName }}
      </text>

      <g
        v-if="kind"
        :transform="`translate(${chipWidth - 15}, 5)`"
        :stroke="color"
        stroke-width="1.6"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <g v-if="kind === 'node'" transform="scale(0.5)">
          <polygon points="12 3 20 8 20 16 12 21 4 16 4 8" />
        </g>
        <g v-else-if="kind === 'barrier'" transform="scale(0.5)">
          <line x1="7" y1="4" x2="7" y2="20" />
          <line x1="17" y1="4" x2="17" y2="20" />
          <line x1="4" y1="9" x2="20" y2="9" />
        </g>
        <g v-else-if="kind === 'text'" transform="scale(0.5)">
          <line x1="5" y1="6" x2="19" y2="6" />
          <line x1="12" y1="6" x2="12" y2="19" />
        </g>
      </g>
    </g>
  </g>
</template>

<style scoped>
.presence-cursor {
  opacity: 0.5;
  pointer-events: none;
}
</style>
