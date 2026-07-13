<script setup lang="ts">
import FragmentedItem from '@/components/domain/FragmentedItem.vue'
import ItemPreview from '@/components/domain/ItemPreview.vue'
import ModifierChip from '@/components/domain/ModifierChip.vue'
import ModifierCompositions from '@/components/domain/ModifierCompositions.vue'
import CrateBloqFace from '@/components/domain/internal/CrateBloqFace.vue'
import { useCrateAnimation, type CrateHalfMotion } from '@/composables/useCrateAnimation'
import { useCrateSounds } from '@/composables/useCrateSounds'
import type {
  CrateContentResponse,
  CrateModifierResponse,
  ItemModifierRef,
  ItemModifierResponse,
  ItemResponse,
  UnusualEffectRef,
} from '@/types/api/items'
import {
  RARITY_ORDER,
  annotateEffectLayerStacks,
  buildEffectLayers,
  displayItemName,
  rarityClass,
  readFragmentSpec,
  userItemTokenContext,
} from '@/utils/items'
import { computed, ref, toRef, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    contents: CrateContentResponse[]
    result: ItemResponse | null
    playToken: number
    crateModifiers?: CrateModifierResponse[]
    globalModifiers?: ItemModifierResponse[]
    unusualEffects?: UnusualEffectRef[]
    resultModifiers?: ItemModifierRef[]
    resultUnusualEffect?: UnusualEffectRef | null
    resultSerialNumber?: number | null
    cardWidth?: number
    cardHeight?: number
    cardGap?: number
    carouselLength?: number
    height?: number
    spinDurationMs?: number
  }>(),
  {
    crateModifiers: () => [],
    globalModifiers: () => [],
    unusualEffects: () => [],
    resultModifiers: () => [],
    resultUnusualEffect: null,
    resultSerialNumber: null,
    cardWidth: 136,
    cardHeight: 182,
    cardGap: 10,
    carouselLength: 64,
    height: 280,
    spinDurationMs: 4500,
  },
)

const emit = defineEmits<{
  complete: []
  skip: []
}>()

const stageEl = ref<HTMLElement | null>(null)
const sparksEl = ref<HTMLCanvasElement | null>(null)

const sounds = useCrateSounds()

const {
  phase,
  carousel,
  landingIndex,
  carouselOffset,
  armed,
  cutPct,
  cutShiftPct,
  bladeTiltDeg,
  hitScore,
  halvesActive,
  halfLeft,
  halfRight,
  shakeX,
  shakeY,
  scoreVisible,
  play,
  skip,
} = useCrateAnimation({
  result: toRef(props, 'result'),
  resultModifiers: toRef(props, 'resultModifiers'),
  resultUnusualEffect: toRef(props, 'resultUnusualEffect'),
  contents: toRef(props, 'contents'),
  crateModifiers: toRef(props, 'crateModifiers'),
  globalModifiers: toRef(props, 'globalModifiers'),
  unusualEffects: toRef(props, 'unusualEffects'),
  cardWidth: toRef(props, 'cardWidth'),
  cardHeight: toRef(props, 'cardHeight'),
  cardGap: toRef(props, 'cardGap'),
  carouselLength: toRef(props, 'carouselLength'),
  spinDurationMs: toRef(props, 'spinDurationMs'),
  stageEl,
  sparksEl,
  onTick: sounds.tick,
  onLand: sounds.land,
  onSwing: sounds.swing,
  onSlice: sounds.slice,
  onReveal: () =>
    sounds.reveal(RARITY_ORDER.indexOf(props.result?.rarity ?? 'common')),
  onComplete: () => emit('complete'),
  onSkip: () => {
    sounds.reset()
    emit('skip')
  },
})

watch(
  () => props.playToken,
  () => {
    sounds.reset()
    sounds.prime()
    play()
  },
)

defineExpose({ skip })

const cards = computed(() =>
  carousel.value.map((slot, i) => ({
    slot,
    layers:
      i === landingIndex.value
        ? annotateEffectLayerStacks(buildEffectLayers(slot.modifiers, slot.unusualEffect))
        : [],
  })),
)

const resultLayers = computed(() =>
  annotateEffectLayerStacks(buildEffectLayers(props.resultModifiers, props.resultUnusualEffect)),
)
const resultFragmentSpec = computed(() => readFragmentSpec(props.resultUnusualEffect ?? null))
const revealName = computed(() =>
  props.result ? displayItemName(props.resultModifiers, props.result.name) : '',
)
const tokenCtx = computed(() =>
  userItemTokenContext({ serialNumber: props.resultSerialNumber ?? null }),
)

const stripVisible = computed(
  () =>
    armed.value && ['ready', 'spinning', 'landed', 'slicing', 'revealing'].includes(phase.value),
)
const reticleVisible = computed(() =>
  ['idle', 'ready', 'spinning', 'landed'].includes(phase.value),
)
const revealVisible = computed(
  () => (phase.value === 'revealing' || phase.value === 'revealed') && props.result !== null,
)
const skipVisible = computed(() =>
  ['ready', 'spinning', 'landed', 'slicing', 'revealing'].includes(phase.value),
)
const halvesMounted = computed(
  () =>
    armed.value &&
    (['spinning', 'landed', 'slicing'].includes(phase.value) || halvesActive.value),
)

const stageStyle = computed(() => ({
  height: `${props.height}px`,
  '--card-w': `${props.cardWidth}px`,
  '--card-h': `${props.cardHeight}px`,
}))

const worldStyle = computed(() => ({
  transform: `translate3d(${shakeX.value}px, ${shakeY.value}px, 0)`,
}))

const stripStyle = computed(() => ({
  gap: `${props.cardGap}px`,
  transform: `translateY(-50%) translateX(${carouselOffset.value}px)`,
}))

const cardOffsetPx = computed(() => (0.5 - cutPct.value) * props.cardWidth)

const edgeStyle = computed(() => {
  const bloqH = props.cardWidth
  const xPct =
    cutPct.value * 100 + cutShiftPct.value * (bloqH / props.cardHeight - 1)
  return {
    left: `calc(${xPct}% - 1.5px)`,
    height: `${bloqH}px`,
    transform: `rotate(${bladeTiltDeg.value}deg)`,
  }
})

function halfStyle(side: 'left' | 'right', motion: CrateHalfMotion) {
  const cut = cutPct.value * 100
  const shift = cutShiftPct.value
  const xTop = cut - shift
  const xBottom = cut + shift
  return {
    clipPath:
      side === 'left'
        ? `polygon(0% 0%, ${xTop}% 0%, ${xBottom}% 100%, 0% 100%)`
        : `polygon(${xTop}% 0%, 100% 0%, 100% 100%, ${xBottom}% 100%)`,
    transform: `translate(${motion.x}px, ${motion.y}px) rotate(${motion.angle}deg)`,
    transformOrigin: `${side === 'left' ? cut / 2 : (100 + cut) / 2}% 50%`,
    opacity: motion.opacity,
    marginLeft: `calc(var(--card-w) / -2 + ${cardOffsetPx.value}px)`,
  }
}

const scoreTier = computed<'perfect' | 'great' | 'good' | 'ok'>(() => {
  if (hitScore.value >= 115) return 'perfect'
  if (hitScore.value >= 110) return 'great'
  if (hitScore.value >= 105) return 'good'
  return 'ok'
})
</script>

<template>
  <div ref="stageEl" class="crate-anim" :class="`crate-anim--${phase}`" :style="stageStyle">
    <div class="crate-anim__world" :style="worldStyle">
      <div v-if="reticleVisible" class="crate-anim__reticle" aria-hidden="true" />

      <div
        v-if="stripVisible"
        class="crate-anim__strip-wrap"
        :class="{ 'crate-anim__strip-wrap--fading': phase === 'revealing' }"
        data-fx-static
      >
        <div class="crate-anim__strip" :style="stripStyle">
          <div
            v-for="(card, i) in cards"
            :key="i"
            v-memo="[phase, landingIndex]"
            class="crate-anim__card"
            :class="[
              rarityClass(card.slot.item.rarity),
              {
                'crate-anim__card--winner': i === landingIndex && phase === 'landed',
                'crate-anim__card--dim': phase !== 'spinning' && i !== landingIndex,
                'crate-anim__card--consumed':
                  i === landingIndex && (phase === 'slicing' || phase === 'revealing'),
              },
            ]"
          >
            <CrateBloqFace
              :item="card.slot.item"
              :modifiers="card.slot.modifiers"
              :arrow="i === landingIndex && phase === 'landed'"
            />
            <template v-if="i === landingIndex">
              <ModifierCompositions
                v-for="layer in card.layers"
                :key="layer.key"
                :spec="layer.spec"
                :type-key="card.slot.item.typeKey"
                measure-selector=".bloq"
              />
            </template>
          </div>
        </div>
      </div>

      <template v-if="halvesMounted && result">
        <div
          v-for="side in ['left', 'right'] as const"
          :key="side"
          class="crate-anim__half"
          :class="`rarity--${result.rarity}`"
          :style="halfStyle(side, side === 'left' ? halfLeft : halfRight)"
          aria-hidden="true"
        >
          <CrateBloqFace :item="result" :modifiers="resultModifiers" />
          <div
            v-if="halvesActive"
            class="crate-anim__half-edge"
            :style="edgeStyle"
            aria-hidden="true"
          />
        </div>
      </template>

      <div
        v-if="scoreVisible"
        :key="`score-${playToken}`"
        class="crate-anim__score"
        :class="`crate-anim__score--${scoreTier}`"
        aria-hidden="true"
      >
        <span class="crate-anim__score-num">{{ hitScore }}</span>
        <span v-if="scoreTier === 'perfect'" class="crate-anim__score-label">PERFECT</span>
      </div>
    </div>

    <canvas ref="sparksEl" class="crate-anim__sparks" aria-hidden="true" />

    <div v-if="revealVisible && result" class="crate-anim__reveal" :class="rarityClass(result.rarity)">
      <div class="crate-anim__reveal-icon">
        <FragmentedItem
          v-if="resultFragmentSpec"
          :item="result"
          :spec="resultFragmentSpec"
          :selected="true"
        />
        <ItemPreview v-else :item="result" selected />
        <ModifierCompositions
          v-for="layer in resultLayers"
          :key="layer.key"
          :spec="layer.spec"
          :context="tokenCtx"
          :type-key="result.typeKey"
          measure-selector=".title-renderer, .item-preview > *"
        />
      </div>
      <div class="crate-anim__reveal-name">{{ revealName }}</div>
      <div class="crate-anim__reveal-rarity">{{ result.rarity }}</div>
      <div v-if="resultModifiers.length" class="crate-anim__reveal-chips">
        <ModifierChip v-for="(m, i) in resultModifiers" :key="`${m.id}-${i}`" :modifier="m" />
      </div>
      <div v-if="resultUnusualEffect" class="crate-anim__reveal-effect">
        <span class="crate-anim__reveal-effect-label">Effect</span>
        <span class="crate-anim__reveal-effect-name">
          {{ resultUnusualEffect.name || resultUnusualEffect.key }}
        </span>
      </div>
      <div v-if="resultSerialNumber != null" class="crate-anim__reveal-serial">
        #{{ resultSerialNumber }}
      </div>
    </div>

    <div class="crate-anim__controls">
      <button
        type="button"
        class="crate-anim__control"
        :aria-label="sounds.muted.value ? 'Unmute crate sounds' : 'Mute crate sounds'"
        @click.stop="sounds.toggleMute"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <template v-if="sounds.muted.value">
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </template>
          <template v-else>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </template>
        </svg>
      </button>
      <button
        v-if="skipVisible"
        type="button"
        class="crate-anim__control crate-anim__control--skip"
        @click.stop="skip"
      >
        Skip
      </button>
    </div>
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

.crate-anim__world {
  position: absolute;
  inset: 0;
  will-change: transform;
}

.crate-anim__reticle {
  position: absolute;
  top: 12px;
  bottom: 12px;
  left: 50%;
  width: 2px;
  margin-left: -1px;
  background: linear-gradient(
    180deg,
    transparent,
    var(--accent) 30%,
    var(--accent) 70%,
    transparent
  );
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

.crate-anim__reticle::before {
  top: 0;
}

.crate-anim__reticle::after {
  bottom: 0;
  transform: rotate(180deg);
}

.crate-anim__strip-wrap {
  position: absolute;
  inset: 0;
  z-index: 1;
  mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
  transition: opacity 260ms ease-in;
}

.crate-anim__strip-wrap--fading {
  opacity: 0;
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
  transition: opacity 240ms ease;
}

.crate-anim__card--winner :deep(.bloq) {
  border-color: var(--rarity-color, var(--text-tertiary));
}

.crate-anim__card--dim {
  opacity: 0.14;
  pointer-events: none;
}

.crate-anim__card--consumed {
  opacity: 0;
  transition: none;
}

.crate-anim__half {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--card-w);
  height: var(--card-h);
  margin-top: calc(var(--card-h) / -2);
  display: flex;
  flex-direction: column;
  z-index: 3;
  will-change: transform, opacity;
}

.crate-anim__half-edge {
  position: absolute;
  top: 0;
  width: 3px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--rarity-color, var(--text-tertiary)) 40%, var(--text-primary)),
    var(--rarity-color, var(--text-tertiary))
  );
  animation: edge-cool 480ms ease-out forwards;
  pointer-events: none;
}

@keyframes edge-cool {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

.crate-anim__sparks {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 6;
  pointer-events: none;
}

.crate-anim__score {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  z-index: 7;
  pointer-events: none;
  animation: score-float 900ms cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
}

.crate-anim__score-num {
  font-family: var(--font-mono);
  font-size: 3.25rem;
  font-weight: 700;
  line-height: 1;
  color: var(--score-color);
  text-shadow: 0 0 18px color-mix(in srgb, var(--score-color) 55%, transparent);
}

.crate-anim__score-label {
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: var(--score-color);
}

.crate-anim__score--perfect {
  --score-color: var(--tier-gold);
}

.crate-anim__score--great {
  --score-color: color-mix(in srgb, var(--tier-gold) 45%, var(--text-primary));
}

.crate-anim__score--good {
  --score-color: var(--text-primary);
}

.crate-anim__score--ok {
  --score-color: var(--text-secondary);
}

@keyframes score-float {
  0% {
    transform: translate(-50%, -50%) scale(0.4);
    opacity: 0;
  }
  18% {
    transform: translate(-50%, -50%) scale(1.25);
    opacity: 1;
  }
  32% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, calc(-50% - 90px)) scale(0.85);
    opacity: 0;
  }
}

.crate-anim__reveal {
  position: absolute;
  top: 50%;
  left: 50%;
  width: calc(var(--card-w) * 1.5);
  min-height: var(--card-h);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  padding: var(--space-lg);
  background: var(--bg-surface);
  border: 1px solid var(--rarity-color, var(--bg-overlay));
  border-radius: var(--radius-card);
  z-index: 5;
  transform: translate(-50%, -50%);
  overflow: hidden;
  animation: reveal-rise 340ms cubic-bezier(0.2, 0.8, 0.3, 1) backwards;
}

@keyframes reveal-rise {
  0% {
    transform: translate(-50%, calc(-50% + 44px)) scale(0.92);
    opacity: 0;
    border-color: var(--text-primary);
  }
  60% {
    border-color: var(--text-primary);
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
    border-color: var(--rarity-color, var(--bg-overlay));
  }
}

.crate-anim__reveal-icon {
  position: relative;
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

.crate-anim__reveal-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-xs);
}

.crate-anim__reveal-effect {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-xs);
}

.crate-anim__reveal-effect-label {
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.crate-anim__reveal-effect-name {
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-primary);
}

.crate-anim__reveal-serial {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  font-variant-numeric: tabular-nums;
  color: var(--text-tertiary);
}

.crate-anim__controls {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  display: flex;
  gap: var(--space-xs);
  z-index: 10;
}

.crate-anim__control {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
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

.crate-anim__control:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.rarity--common {
  --rarity-color: var(--text-tertiary);
}

.rarity--uncommon {
  --rarity-color: var(--success);
}

.rarity--rare {
  --rarity-color: var(--info);
}

.rarity--epic {
  --rarity-color: var(--tier-apex);
}

.rarity--legendary {
  --rarity-color: var(--tier-gold);
}

.rarity--mythic {
  --rarity-color: var(--error);
}

@media (prefers-reduced-motion: reduce) {
  .crate-anim__card,
  .crate-anim__score,
  .crate-anim__reveal,
  .crate-anim__half-edge,
  .crate-anim__strip-wrap {
    animation: none !important;
    transition: none !important;
  }
}
</style>
