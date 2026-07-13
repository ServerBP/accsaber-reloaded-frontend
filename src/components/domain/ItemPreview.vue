<script setup lang="ts">
import BorderDecals from '@/components/domain/BorderDecals.vue'
import BorderOverlay from '@/components/domain/BorderOverlay.vue'
import ProfileBorderRenderer from '@/components/domain/ProfileBorderRenderer.vue'
import TitleRenderer from '@/components/domain/TitleRenderer.vue'
import ThemeBackdropPreview from '@/components/layout/ThemeBackdropPreview.vue'
import type {
  BorderColorValue,
  BorderShapeValue,
  ItemResponse,
  ThemeValue,
  TitleValue,
} from '@/types/api/items'
import { SUPPORTER_TIER_PALETTE } from '@/types/api/supporters'
import {
  fillToCss,
  pickAssetUrl,
  readBackgroundValue,
  readBadgeValue,
  readBorderColorValue,
  readBorderShapeValue,
  readThemeValue,
  readTitleValue,
  tokenize,
} from '@/utils/items'
import { DEFAULT_AVATAR_MASK } from '@/utils/avatarBox'
import { computed } from 'vue'

const props = defineProps<{
  item: ItemResponse
  selected?: boolean
}>()

const typeKey = computed(() => props.item.typeKey)

const titleValue = computed<TitleValue | null>(() =>
  typeKey.value === 'title' ? readTitleValue(props.item.value) : null,
)

const borderColorValue = computed<BorderColorValue | null>(() =>
  typeKey.value === 'profile_border_color' ? readBorderColorValue(props.item.value) : null,
)
const borderColorBackground = computed<string | null>(() => {
  const fill = borderColorValue.value?.states?.[0]?.fill
  return fill ? fillToCss(fill) : null
})
const borderColorIsCosmic = computed(() => {
  const type = borderColorValue.value?.states?.[0]?.fill?.type
  return type === 'cosmic' || type === 'toon'
})

const borderShapeValue = computed<BorderShapeValue | null>(() =>
  typeKey.value === 'profile_border_shape' ? readBorderShapeValue(props.item.value) : null,
)

const shapePreviewColor = computed<BorderColorValue | null>(() => {
  const shape = borderShapeValue.value
  if (!shape || shape.renderMode !== 'pixel') return null
  const tier = SUPPORTER_TIER_PALETTE.bronze
  return {
    states: [{
      atMs: 0,
      fill: {
        type: 'pixel_metal',
        shadow: tier.shadow,
        base: tier.base,
        highlight: tier.highlight,
      },
    }],
  }
})

const shapeAvatarMask = computed(() => borderShapeValue.value?.avatarMask ?? DEFAULT_AVATAR_MASK)

const shapeAvatarClipId = `ip-avatar-clip-${Math.random().toString(36).slice(2, 9)}`

const badgeValue = computed(() =>
  typeKey.value === 'badge' ? readBadgeValue(props.item.value) : null,
)
const badgeUrl = computed(() => pickAssetUrl(badgeValue.value?.asset) ?? props.item.iconUrl)
const badgeAlt = computed(() => badgeValue.value?.asset.altText ?? props.item.name)

const backgroundValue = computed(() =>
  typeKey.value === 'profile_background' || typeKey.value === 'profile_thumbnail_background'
    ? readBackgroundValue(props.item.value)
    : null,
)
const backgroundUrl = computed(() => pickAssetUrl(backgroundValue.value?.asset) ?? props.item.iconUrl)

const themeValue = computed<ThemeValue | null>(() =>
  typeKey.value === 'theme' ? readThemeValue(props.item.value) : null,
)
const themeStyleVars = computed<Record<string, string> | undefined>(() => {
  const tokens = themeValue.value?.tokens
  if (!tokens) return undefined
  const out: Record<string, string> = {}
  for (const [key, val] of Object.entries(tokens)) {
    out[`--${tokenize(key)}`] = val
  }
  return out
})

const PERK_RE = /^([+-]\d+)/
const perkAmount = computed<string | null>(() => {
  if (typeKey.value !== 'perk') return null
  const fromName = props.item.name.match(PERK_RE)
  if (fromName) return fromName[1]
  const fromDesc = props.item.description?.match(PERK_RE)
  return fromDesc ? fromDesc[1] : null
})

const isPinnedPerk = computed(() => {
  if (typeKey.value !== 'perk') return false
  const haystack = `${props.item.name} ${props.item.description ?? ''}`.toLowerCase()
  return haystack.includes('pinned')
})

const fallbackInitial = computed(() => props.item.name.charAt(0).toUpperCase())
</script>

<template>
  <span class="item-preview" :class="`item-preview--${typeKey}`">
    <img
      v-if="typeKey === 'badge' && badgeUrl"
      class="item-preview__img"
      :src="badgeUrl"
      :alt="badgeAlt"
      loading="lazy"
      decoding="async"
    />

    <span
      v-else-if="typeKey === 'title' && titleValue"
      class="item-preview__title"
    >
      <TitleRenderer :value="titleValue" />
    </span>

    <span
      v-else-if="typeKey === 'profile_border_color' && borderColorIsCosmic"
      class="item-preview__shape-wrap"
    >
      <ProfileBorderRenderer :shape="null" :color="borderColorValue" />
    </span>

    <span
      v-else-if="typeKey === 'profile_border_color' && borderColorBackground"
      class="item-preview__color-swatch"
      :style="{ background: borderColorBackground }"
    />

    <span
      v-else-if="typeKey === 'profile_border_shape' && borderShapeValue"
      class="item-preview__shape-wrap"
      aria-hidden="true"
    >
      <ProfileBorderRenderer :shape="borderShapeValue" :color="shapePreviewColor" />
      <svg
        class="item-preview__shape-avatar"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <clipPath :id="shapeAvatarClipId">
            <path :d="shapeAvatarMask" />
          </clipPath>
        </defs>
        <rect
          x="0"
          y="0"
          width="100"
          height="100"
          :clip-path="`url(#${shapeAvatarClipId})`"
          class="item-preview__shape-avatar-fill"
        />
      </svg>
      <BorderDecals v-if="borderShapeValue.decals?.length" :decals="borderShapeValue.decals" />
      <BorderOverlay
        v-if="borderShapeValue.overlay?.enabled"
        :overlay="borderShapeValue.overlay"
        :color="shapePreviewColor"
      />
    </span>

    <span
      v-else-if="typeKey === 'theme' && themeValue"
      class="item-preview__theme"
      :style="themeStyleVars"
    >
      <ThemeBackdropPreview :tokens="themeValue.tokens" />
      <span class="item-preview__theme-bg" />
      <span class="item-preview__theme-surface" />
      <span class="item-preview__theme-accent" />
    </span>

    <svg
      v-else-if="typeKey === 'perk' && isPinnedPerk && perkAmount"
      class="item-preview__pin"
      viewBox="0 0 50 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
      <text
        x="28"
        y="14"
        font-size="11"
        font-weight="700"
        font-family="ui-monospace, SFMono-Regular, Menlo, monospace"
        fill="currentColor"
        stroke="none"
        text-anchor="start"
        dominant-baseline="middle"
      >{{ perkAmount }}</text>
    </svg>

    <span
      v-else-if="typeKey === 'perk' && perkAmount"
      class="item-preview__medal"
    >
      <span class="item-preview__medal-text">{{ perkAmount }}</span>
    </span>

    <svg
      v-else-if="typeKey === 'statistic'"
      class="item-preview__stat-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <line x1="4" y1="20" x2="4" y2="12" />
      <line x1="10" y1="20" x2="10" y2="6" />
      <line x1="16" y1="20" x2="16" y2="14" />
      <line x1="22" y1="20" x2="22" y2="9" />
      <line x1="2" y1="22" x2="22" y2="22" />
    </svg>

    <img
      v-else-if="(typeKey === 'profile_background' || typeKey === 'profile_thumbnail_background') && backgroundUrl"
      class="item-preview__img item-preview__img--cover"
      :src="backgroundUrl"
      :alt="item.name"
      loading="lazy"
      decoding="async"
    />

    <svg
      v-else-if="typeKey === 'crate'"
      class="item-preview__crate"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect class="item-preview__crate-body" x="3" y="4.5" width="18" height="15" rx="1.6" />
      <path class="item-preview__crate-lid" d="M3,9 L3,6.1 Q3,4.5 4.6,4.5 L19.4,4.5 Q21,4.5 21,6.1 L21,9 Z" />
      <line class="item-preview__crate-seam" x1="3.4" y1="9" x2="20.6" y2="9" />
      <rect class="item-preview__crate-strap" x="6.05" y="5.4" width="1.9" height="13.2" rx="0.3" />
      <rect class="item-preview__crate-strap" x="16.05" y="5.4" width="1.9" height="13.2" rx="0.3" />
      <rect class="item-preview__crate-latch" x="5.5" y="8.35" width="3" height="1.3" rx="0.25" />
      <rect class="item-preview__crate-latch" x="15.5" y="8.35" width="3" height="1.3" rx="0.25" />
      <rect class="item-preview__crate-frame" x="3" y="4.5" width="18" height="15" rx="1.6" />
    </svg>

    <img
      v-else-if="item.iconUrl"
      class="item-preview__img"
      :src="item.iconUrl"
      :alt="item.name"
      loading="lazy"
      decoding="async"
    />

    <span v-else class="item-preview__initial">{{ fallbackInitial }}</span>
  </span>
</template>

<style scoped>
.item-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--text-primary);
  overflow: hidden;
  container-type: inline-size;
  --cell-accent: initial;
}

.item-preview__img {
  max-width: 80%;
  max-height: 80%;
  object-fit: contain;
}

.item-preview__img--cover {
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  object-fit: cover;
}

.item-preview__initial {
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 1.5rem;
  color: var(--cell-accent, var(--text-secondary));
  letter-spacing: 0.04em;
}

.item-preview__title {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 100%;
  padding: 0 var(--space-xs);
  color: var(--text-primary);
  text-align: center;
}

.item-preview__title :deep(.title-renderer) {
  font-size: clamp(0.7rem, 9cqi, 1.05rem);
  max-width: 100%;
}

.item-preview__title :deep(.title-renderer__text) {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
}

.item-preview__color-swatch {
  display: block;
  width: 65%;
  aspect-ratio: 1 / 1;
  border-radius: var(--radius-avatar);
  border: 1px solid color-mix(in srgb, var(--text-primary) 12%, transparent);
}

.item-preview__shape-wrap {
  position: relative;
  display: block;
  width: 65%;
  aspect-ratio: 1 / 1;
  color: var(--text-secondary);
}

.item-preview__shape-avatar {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 88.6%;
  height: 88.6%;
  display: block;
  overflow: visible;
}

.item-preview__shape-avatar-fill {
  fill: var(--bg-overlay);
}

.item-preview__theme {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 70%;
  aspect-ratio: 1 / 1;
  padding: 8px;
  border-radius: 6px;
  background: var(--color-bg, var(--bg-base));
  border: 1px solid color-mix(in srgb, var(--text-primary) 10%, transparent);
  justify-content: center;
  overflow: hidden;
}

.item-preview__theme-bg,
.item-preview__theme-surface,
.item-preview__theme-accent {
  position: relative;
  z-index: 1;
  display: block;
  height: 5px;
  border-radius: 2px;
}

.item-preview__theme-bg { background: var(--color-surface, var(--bg-surface)); width: 100%; }
.item-preview__theme-surface { background: var(--color-elevated, var(--bg-elevated)); width: 70%; }
.item-preview__theme-accent { background: var(--color-accent, var(--accent-overall)); width: 40%; }

.item-preview__pin {
  width: 80%;
  aspect-ratio: 50 / 24;
  color: var(--cell-accent, var(--tier-gold));
  overflow: visible;
}

.item-preview__medal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 70%;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  background: radial-gradient(
    circle at 30% 30%,
    color-mix(in srgb, var(--cell-accent, var(--tier-gold)) 100%, transparent),
    color-mix(in srgb, var(--cell-accent, var(--tier-gold)) 60%, var(--bg-base)) 70%
  );
  border: 2px solid color-mix(in srgb, var(--cell-accent, var(--tier-gold)) 80%, var(--bg-overlay));
  box-shadow:
    inset 0 -2px 4px rgba(0, 0, 0, 0.3),
    inset 0 2px 4px rgba(255, 255, 255, 0.2);
}

.item-preview__medal-text {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--bg-base);
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.4);
}

.item-preview__stat-icon {
  width: 60%;
  aspect-ratio: 1 / 1;
  color: var(--cell-accent, var(--info));
}

.item-preview__crate {
  width: 66%;
  aspect-ratio: 1 / 1;
  overflow: visible;
}

.item-preview__crate-body {
  fill: var(--bg-elevated);
}

.item-preview__crate-lid {
  fill: var(--bg-overlay);
}

.item-preview__crate-seam {
  stroke: var(--bg-base);
  stroke-width: 0.9;
  stroke-linecap: round;
}

.item-preview__crate-strap {
  fill: color-mix(in srgb, var(--tier-gold) 65%, var(--tier-bronze));
}

.item-preview__crate-latch {
  fill: var(--tier-gold);
}

.item-preview__crate-frame {
  fill: none;
  stroke: var(--text-secondary);
  stroke-width: 1;
  stroke-linejoin: round;
}
</style>
