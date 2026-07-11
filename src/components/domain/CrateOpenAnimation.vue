<script setup lang="ts">
import CrateCardFace from '@/components/domain/internal/CrateCardFace.vue'
import FragmentedItem from '@/components/domain/FragmentedItem.vue'
import ItemPreview from '@/components/domain/ItemPreview.vue'
import ModifierCompositions from '@/components/domain/ModifierCompositions.vue'
import {
  useCrateAnimation,
  type CrateAnimationPoolEntry,
} from '@/composables/useCrateAnimation'
import type { ItemModifierRef, ItemResponse, UnusualEffectRef } from '@/types/api/items'
import { buildEffectLayers, readFragmentSpec } from '@/utils/items'
import { computed, ref, toRef, watch } from 'vue'

export type { CrateAnimationPoolEntry }

const props = withDefaults(
  defineProps<{
    pool: CrateAnimationPoolEntry[]
    result: ItemResponse | null
    resultModifiers?: ItemModifierRef[]
    resultUnusualEffect?: UnusualEffectRef | null
    playToken: number
    cardWidth?: number
    cardHeight?: number
    cardGap?: number
    carouselLength?: number
    height?: number
    spinDurationMs?: number
  }>(),
  {
    cardWidth: 140,
    cardHeight: 180,
    cardGap: 8,
    carouselLength: 64,
    height: 260,
    spinDurationMs: 4500,
    resultModifiers: () => [],
    resultUnusualEffect: null,
  },
)

const emit = defineEmits<{
  complete: []
  skip: []
}>()

const stageEl = ref<HTMLElement | null>(null)
const resultModifiersRef = computed(() => props.resultModifiers)
const resultUnusualEffectRef = computed(() => props.resultUnusualEffect ?? null)
const resultLayers = computed(() =>
  buildEffectLayers(props.resultModifiers, props.resultUnusualEffect),
)
const resultFragmentSpec = computed(() => readFragmentSpec(props.resultUnusualEffect ?? null))

const {
  phase,
  carousel,
  landingIndex,
  carouselOffset,
  isSpinning,
  armed,
  cutPct,
  hitScore,
  play,
  skip,
} = useCrateAnimation({
  result: toRef(props, 'result'),
  resultModifiers: resultModifiersRef,
  resultUnusualEffect: resultUnusualEffectRef,
  pool: toRef(props, 'pool'),
  cardWidth: toRef(props, 'cardWidth'),
  cardGap: toRef(props, 'cardGap'),
  carouselLength: toRef(props, 'carouselLength'),
  spinDurationMs: toRef(props, 'spinDurationMs'),
  stageEl,
  onComplete: () => emit('complete'),
  onSkip: () => emit('skip'),
})

watch(() => props.playToken, play)

const stripVisible = computed(
  () => armed.value && ['idle', 'spinning', 'landed'].includes(phase.value),
)
const bladeVisible = computed(() => phase.value === 'slicing')
const halvesVisible = computed(() => phase.value === 'slicing' || phase.value === 'falling')
const revealVisible = computed(() => phase.value === 'revealing' || phase.value === 'revealed')
const reticleVisible = computed(
  () => armed.value && ['idle', 'spinning', 'landed'].includes(phase.value),
)
const skipVisible = computed(
  () => ['spinning', 'landed', 'slicing', 'falling'].includes(phase.value),
)
const scorePopupVisible = computed(
  () => ['slicing', 'falling', 'revealing'].includes(phase.value),
)

const cardSizeVars = computed(() => ({
  '--card-w': `${props.cardWidth}px`,
  '--card-h': `${props.cardHeight}px`,
}))

const carouselStyle = computed(() => ({
  width: `${props.cardWidth}px`,
  height: `${props.cardHeight}px`,
  gap: `${props.cardGap}px`,
  transform: `translateY(-50%) translateX(${carouselOffset.value}px)`,
  transition: isSpinning.value
    ? `transform ${props.spinDurationMs}ms cubic-bezier(0.05, 0.7, 0.1, 1)`
    : 'none',
}))

const cardOffsetPx = computed(() => (0.5 - cutPct.value) * props.cardWidth)

const halfStyle = computed(() => ({
  '--cut-pct': `${cutPct.value * 100}%`,
  '--card-offset-x': `${cardOffsetPx.value}px`,
}))

const scoreTier = computed<'perfect' | 'great' | 'good' | 'ok'>(() => {
  if (hitScore.value >= 115) return 'perfect'
  if (hitScore.value >= 110) return 'great'
  if (hitScore.value >= 105) return 'good'
  return 'ok'
})

const scoreLabel = computed(() => {
  if (hitScore.value >= 115) return 'PERFECT'
  if (hitScore.value >= 110) return 'GREAT'
  if (hitScore.value >= 105) return 'GOOD'
  return 'OK'
})
</script>

<template>
  <div
    ref="stageEl"
    class="crate-anim"
    :class="`crate-anim--${phase}`"
    :style="{ height: `${height}px`, ...cardSizeVars }"
  >
    <div v-if="reticleVisible" class="crate-anim__reticle" aria-hidden="true" />

    <div v-if="stripVisible" class="crate-anim__strip-wrap">
      <div class="crate-anim__strip" :style="carouselStyle">
        <div
          v-for="(slot, i) in carousel"
          :key="i"
          class="crate-anim__card"
          :class="[
            `rarity--${slot.item.rarity}`,
            {
              'crate-anim__card--winner': i === landingIndex && phase !== 'spinning',
              'crate-anim__card--dim': phase !== 'spinning' && i !== landingIndex,
            },
          ]"
        >
          <CrateCardFace :item="slot.item" selected />
          <ModifierCompositions
            v-for="layer in buildEffectLayers(slot.modifiers, slot.unusualEffect)"
            :key="layer.key"
            :spec="layer.spec"
            :type-key="slot.item.typeKey"
          />
        </div>
      </div>
    </div>

    <div v-if="bladeVisible" class="crate-anim__blade" aria-hidden="true" />

    <template v-if="halvesVisible && result">
      <div
        class="crate-anim__half crate-anim__half--left"
        :class="`rarity--${result.rarity}`"
        :style="halfStyle"
        aria-hidden="true"
      >
        <CrateCardFace :item="result" selected />
        <ModifierCompositions
          v-for="layer in resultLayers"
          :key="layer.key"
          :spec="layer.spec"
          :type-key="result?.typeKey"
        />
      </div>
      <div
        class="crate-anim__half crate-anim__half--right"
        :class="`rarity--${result.rarity}`"
        :style="halfStyle"
        aria-hidden="true"
      >
        <CrateCardFace :item="result" selected />
        <ModifierCompositions
          v-for="layer in resultLayers"
          :key="layer.key"
          :spec="layer.spec"
          :type-key="result?.typeKey"
        />
      </div>
    </template>

    <div
      v-if="scorePopupVisible"
      :key="`score-${playToken}`"
      class="crate-anim__score-popup"
      :class="`crate-anim__score-popup--${scoreTier}`"
      aria-hidden="true"
    >
      <span class="crate-anim__score-popup-num">{{ hitScore }}</span>
      <span v-if="scoreTier === 'perfect'" class="crate-anim__score-popup-label">PERFECT</span>
    </div>

    <div
      v-if="revealVisible && result"
      class="crate-anim__reveal"
      :class="`rarity--${result.rarity}`"
    >
      <div class="crate-anim__reveal-icon">
        <FragmentedItem v-if="resultFragmentSpec" :item="result" :spec="resultFragmentSpec" :selected="true" />
        <ItemPreview v-else :item="result" selected />
      </div>
      <div class="crate-anim__reveal-name">{{ result.name }}</div>
      <div class="crate-anim__reveal-rarity">{{ result.rarity }}</div>
      <ModifierCompositions
        v-for="layer in resultLayers"
        :key="layer.key"
        :spec="layer.spec"
        :type-key="result?.typeKey"
      />
      <div
        class="crate-anim__score-badge"
        :class="`crate-anim__score-badge--${scoreTier}`"
      >
        <span class="crate-anim__score-badge-num">{{ hitScore }}</span>
        <span class="crate-anim__score-badge-tag">{{ scoreLabel }}</span>
      </div>
    </div>

    <button
      v-if="skipVisible"
      type="button"
      class="crate-anim__skip"
      @click.stop="skip"
    >
      Skip
    </button>
  </div>
</template>

<style scoped>
.crate-anim {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  user-select: none;
  isolation: isolate;
}

.crate-anim::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at center, transparent 40%, color-mix(in srgb, var(--bg-base) 60%, transparent) 100%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated) 50%, transparent) 0%, transparent 25%, transparent 75%, color-mix(in srgb, var(--bg-elevated) 50%, transparent) 100%);
  pointer-events: none;
  z-index: 0;
}

.crate-anim__reticle {
  position: absolute;
  top: 12px;
  bottom: 12px;
  left: 50%;
  width: 2px;
  margin-left: -1px;
  background: linear-gradient(180deg, transparent, var(--accent) 30%, var(--accent) 70%, transparent);
  opacity: 0.55;
  z-index: 2;
  pointer-events: none;
}

.crate-anim__reticle::before,
.crate-anim__reticle::after {
  content: '';
  position: absolute;
  left: -4px;
  width: 10px;
  height: 10px;
  background: var(--accent);
  clip-path: polygon(50% 100%, 0 0, 100% 0);
}

.crate-anim__reticle::before { top: 0; }
.crate-anim__reticle::after { bottom: 0; transform: rotate(180deg); }

.crate-anim__strip-wrap {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.crate-anim__strip {
  position: absolute;
  top: 50%;
  left: 0;
  display: flex;
  align-items: center;
  will-change: transform;
}

.crate-anim__card {
  position: relative;
  flex-shrink: 0;
  width: var(--card-w);
  height: var(--card-h);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--rarity-color, var(--text-tertiary)) 22%, var(--bg-surface)) 0%, var(--bg-surface) 70%);
  border: 1px solid color-mix(in srgb, var(--rarity-color, var(--bg-overlay)) 35%, var(--bg-overlay));
  border-radius: var(--radius-card);
  color: var(--text-primary);
  box-shadow: 0 0 12px color-mix(in srgb, var(--rarity-color, transparent) 18%, transparent);
  overflow: hidden;
  transition: transform 200ms ease, box-shadow 220ms ease, opacity 300ms ease, filter 300ms ease;
}

.crate-anim__card--winner {
  transform: scale(1.06);
  box-shadow:
    0 0 32px color-mix(in srgb, var(--rarity-color, transparent) 70%, transparent),
    0 0 8px color-mix(in srgb, var(--rarity-color, transparent) 90%, transparent);
}

.crate-anim__card--dim {
  opacity: 0.12;
  filter: blur(1px) saturate(0.5);
  pointer-events: none;
}

.crate-anim__blade {
  position: absolute;
  left: 50%;
  top: calc(50% - var(--card-h) / 2);
  width: 5px;
  height: var(--card-h);
  margin-left: -2.5px;
  background: linear-gradient(180deg, transparent 0%, #fff 8%, #fff 100%);
  box-shadow:
    0 0 10px #fff,
    0 0 28px color-mix(in srgb, var(--accent) 55%, #fff);
  transform-origin: top center;
  transform: scaleY(0);
  z-index: 4;
  pointer-events: none;
  animation: blade-flash 180ms cubic-bezier(0.4, 0, 0.4, 1) forwards;
}

@keyframes blade-flash {
  0%   { transform: scaleY(0); opacity: 0; }
  12%  { opacity: 1; }
  65%  { transform: scaleY(1); opacity: 1; }
  100% { transform: scaleY(1); opacity: 0; }
}

.crate-anim__half {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--card-w);
  height: var(--card-h);
  margin-top: calc(var(--card-h) / -2);
  margin-left: calc(var(--card-w) / -2 + var(--card-offset-x, 0px));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--rarity-color, var(--text-tertiary)) 22%, var(--bg-surface)) 0%, var(--bg-surface) 70%);
  border: 1px solid color-mix(in srgb, var(--rarity-color, var(--bg-overlay)) 35%, var(--bg-overlay));
  border-radius: var(--radius-card);
  box-shadow: 0 0 24px color-mix(in srgb, var(--rarity-color, transparent) 40%, transparent);
  z-index: 3;
  overflow: hidden;
  will-change: transform, opacity;
  animation-duration: 700ms;
  animation-timing-function: cubic-bezier(0.45, 0, 0.2, 1);
  animation-fill-mode: forwards;
}

.crate-anim__half--left {
  clip-path: polygon(0% 0%, var(--cut-pct, 50%) 0%, var(--cut-pct, 50%) 100%, 0% 100%);
  animation-name: half-left-cut-fall;
}

.crate-anim__half--right {
  clip-path: polygon(var(--cut-pct, 50%) 0%, 100% 0%, 100% 100%, var(--cut-pct, 50%) 100%);
  animation-name: half-right-cut-fall;
}

@keyframes half-left-cut-fall {
  0%   { transform: translate(0, 0) scale(1.06) rotate(0); opacity: 1; }
  26%  { transform: translate(-5px, 1px) scale(1) rotate(-1deg); opacity: 1; }
  100% { transform: translate(-72px, 138px) scale(1) rotate(-20deg); opacity: 0; }
}

@keyframes half-right-cut-fall {
  0%   { transform: translate(0, 0) scale(1.06) rotate(0); opacity: 1; }
  26%  { transform: translate(5px, 1px) scale(1) rotate(1deg); opacity: 1; }
  100% { transform: translate(72px, 138px) scale(1) rotate(20deg); opacity: 0; }
}

.crate-anim__reveal {
  position: absolute;
  top: 50%;
  left: 50%;
  width: calc(var(--card-w) * 1.4);
  min-height: var(--card-h);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-lg);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--rarity-color, var(--text-tertiary)) 30%, var(--bg-surface)) 0%, var(--bg-surface) 70%);
  border: 1px solid var(--rarity-color, var(--bg-overlay));
  border-radius: var(--radius-card);
  z-index: 5;
  transform: translate(-50%, -50%);
  overflow: hidden;
  animation:
    reveal-rise 380ms cubic-bezier(0.2, 0.8, 0.3, 1) forwards,
    reveal-glow 1800ms cubic-bezier(0.4, 0, 0.6, 1) 380ms infinite alternate;
}

.crate-anim__reveal-icon {
  width: 96px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.crate-anim__reveal-name {
  font-size: var(--text-card-title);
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
}

.crate-anim__reveal-rarity {
  font-size: var(--text-caption);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--rarity-color, var(--text-tertiary));
  font-weight: 700;
}

@keyframes reveal-rise {
  0%   { transform: translate(-50%, calc(-50% + 60px)) scale(0.85); opacity: 0; filter: blur(4px); }
  60%  { opacity: 1; filter: blur(0); }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; filter: blur(0); }
}

@keyframes reveal-glow {
  0%   { box-shadow: 0 0 24px color-mix(in srgb, var(--rarity-color, transparent) 40%, transparent), 0 0 4px color-mix(in srgb, var(--rarity-color, transparent) 60%, transparent); }
  100% { box-shadow: 0 0 56px color-mix(in srgb, var(--rarity-color, transparent) 70%, transparent), 0 0 12px color-mix(in srgb, var(--rarity-color, transparent) 90%, transparent); }
}

.crate-anim__score-popup {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  z-index: 6;
  pointer-events: none;
  animation: score-popup 900ms cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
}

.crate-anim__score-popup-num {
  font-family: var(--font-mono);
  font-size: 3.25rem;
  font-weight: 700;
  line-height: 1;
  color: var(--score-color, #ffd76b);
  text-shadow:
    0 0 8px color-mix(in srgb, var(--score-color, #ffd76b) 80%, #fff),
    0 0 24px color-mix(in srgb, var(--score-color, #ffd76b) 60%, transparent);
}

.crate-anim__score-popup-label {
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: var(--score-color, #ffd76b);
  text-shadow: 0 0 10px color-mix(in srgb, var(--score-color, #ffd76b) 70%, transparent);
}

.crate-anim__score-popup--perfect { --score-color: #ffd76b; }
.crate-anim__score-popup--great   { --score-color: #fff0a8; }
.crate-anim__score-popup--good    { --score-color: #ffffff; }
.crate-anim__score-popup--ok      { --score-color: #cfcfcf; }

@keyframes score-popup {
  0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 0; }
  18%  { transform: translate(-50%, -50%) scale(1.25); opacity: 1; }
  32%  { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, calc(-50% - 90px)) scale(0.85); opacity: 0; }
}

.crate-anim__score-badge {
  position: absolute;
  top: -14px;
  right: -14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 4px 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--score-color, #ffd76b);
  border-radius: var(--radius-pill);
  box-shadow: 0 0 12px color-mix(in srgb, var(--score-color, #ffd76b) 50%, transparent);
  opacity: 0;
  z-index: 6;
  animation: score-badge-pop 320ms cubic-bezier(0.2, 0.8, 0.3, 1) 200ms forwards;
}

.crate-anim__score-badge--perfect { --score-color: #ffd76b; }
.crate-anim__score-badge--great   { --score-color: #fff0a8; }
.crate-anim__score-badge--good    { --score-color: #ffffff; }
.crate-anim__score-badge--ok      { --score-color: var(--text-secondary); }

.crate-anim__score-badge-num {
  font-family: var(--font-mono);
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--score-color, #ffd76b);
  line-height: 1;
}

.crate-anim__score-badge-tag {
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: var(--score-color, #ffd76b);
}

@keyframes score-badge-pop {
  0%   { transform: scale(0.4); opacity: 0; }
  60%  { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

.crate-anim__skip {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  z-index: 10;
  padding: 4px var(--space-sm);
  background: color-mix(in srgb, var(--bg-elevated) 80%, transparent);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease;
}

.crate-anim__skip:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.rarity--common    { --rarity-color: var(--text-tertiary); }
.rarity--uncommon  { --rarity-color: var(--success); }
.rarity--rare      { --rarity-color: var(--info); }
.rarity--epic      { --rarity-color: var(--tier-apex); }
.rarity--legendary { --rarity-color: var(--tier-gold); }
.rarity--mythic    { --rarity-color: var(--error); }

@media (prefers-reduced-motion: reduce) {
  .crate-anim__card,
  .crate-anim__blade,
  .crate-anim__half--left,
  .crate-anim__half--right,
  .crate-anim__reveal,
  .crate-anim__score-popup,
  .crate-anim__score-badge {
    animation: none !important;
    transition: none !important;
  }

  .crate-anim__reveal {
    transform: translate(-50%, -50%);
    opacity: 1;
  }

  .crate-anim__score-badge {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
