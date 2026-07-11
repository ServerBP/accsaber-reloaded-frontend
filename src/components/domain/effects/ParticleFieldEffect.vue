<script setup lang="ts">
import type { Composition } from '@/types/api/items'
import type { TokenContext } from '@/utils/items'
import { computed } from 'vue'
import { asNumber, asString, type EffectMeasure } from './shared'

const props = defineProps<{
  composition: Composition
  ctx: TokenContext
  measure: EffectMeasure
}>()

type ParticleMotion = 'rise' | 'fall' | 'drift' | 'twinkle' | 'gust'

function particleMotion(c: Composition): ParticleMotion {
  const m = asString(c.motion)
  return m === 'fall' || m === 'drift' || m === 'twinkle' || m === 'gust' ? m : 'rise'
}

const particleClasses = computed(() => {
  const shape = asString(props.composition.shape)
  const shapeClass = shape === 'dot' || shape === 'spark' || shape === 'dust' ? shape : 'ember'
  return [`comp-fx-particle--${shapeClass}`, `comp-fx-particle--${particleMotion(props.composition)}`]
})

const color = computed(() => asString(props.composition.color) ?? '#ffb04a')

interface FieldParticle {
  x: number
  y: number
  size: number
  duration: number
  delay: number
  travel: number
  dx: number
  peak: number
}

const particles = computed<FieldParticle[]>(() => {
  const c = props.composition
  const base = Math.max(3, Math.min(28, asNumber(c.count) ?? 8))
  const wide = asString(c.spread) === 'field'
  const count = wide ? Math.round(base * 1.5) : base
  const motion = particleMotion(c)
  const sMin = asNumber(c.sizeMinPx) ?? 1.6
  const sMax = Math.max(sMin, asNumber(c.sizeMaxPx) ?? 3.6)
  const travelBase = asNumber(c.travelPx) ?? (wide ? 110 : 82)
  const speed = asNumber(c.speedSecs) ?? 3.6
  const spreadLo = wide ? 3 : 12
  const spreadSpan = (wide ? 97 : 88) - spreadLo
  const fromLeft = asString(c.from) === 'left'
  const out: FieldParticle[] = []
  for (let i = 0; i < count; i++) {
    const travel = travelBase + ((i * 37) % 40)
    let x: number
    let y: number
    let dx: number
    let peak: number
    if (motion === 'gust') {
      x = fromLeft ? -4 + ((i * 29) % 14) : 86 + ((i * 29) % 14)
      y = 70 + ((i * 53) % 24)
      dx = (fromLeft ? 1 : -1) * (travel + 22)
      peak = -(12 + ((i * 23) % 18))
    } else {
      const near = 2 + ((i * 29) % 13)
      y = motion === 'rise' ? 100 - near : motion === 'fall' ? near : 6 + ((i * 53) % 84)
      x = spreadLo + ((i * 61) % spreadSpan)
      dx = ((i * 53) % 24) - 12
      peak = 0
    }
    out.push({
      x,
      y,
      size: sMin + (((i * 7) % 100) / 100) * (sMax - sMin),
      duration: speed + (i % 5) * 0.45,
      delay: (i * 0.73) % Math.max(1, speed + 1),
      travel,
      dx,
      peak,
    })
  }
  return out
})
</script>

<template>
  <div class="comp-fx-region">
    <span
      v-for="(p, j) in particles"
      :key="j"
      class="comp-fx-particle"
      :class="particleClasses"
      :style="{
        left: `${p.x}%`,
        top: `${p.y}%`,
        width: `${p.size}px`,
        height: `${p.size}px`,
        '--pcolor': color,
        '--dur': `${p.duration}s`,
        '--delay': `${p.delay}s`,
        '--travel': `${p.travel}px`,
        '--dx': `${p.dx}px`,
        '--peak': `${p.peak}px`,
      }"
    ></span>
  </div>
</template>

<style scoped>
.comp-fx-region {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.comp-fx-particle {
  position: absolute;
  mix-blend-mode: var(--fx-blend, screen);
  opacity: 0;
}

.comp-fx-particle--ember {
  border-radius: 50%;
  background: radial-gradient(circle at 50% 40%,
    #fff2c4 0%,
    color-mix(in srgb, var(--pcolor) 82%, #ffe0a8) 45%,
    var(--pcolor) 100%);
  box-shadow: 0 0 3px 1px var(--fx-ember-halo, color-mix(in srgb, var(--pcolor) 60%, transparent));
}

.comp-fx-particle--dot {
  border-radius: 50%;
  background: radial-gradient(circle at 50% 40%,
    color-mix(in srgb, var(--pcolor) 96%, #fff) 0%,
    var(--pcolor) 100%);
}

.comp-fx-particle--spark {
  background: var(--pcolor);
  clip-path: polygon(50% 0%, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0% 50%, 42% 42%);
}

.comp-fx-particle--dust {
  border-radius: 50%;
  background: radial-gradient(circle at 50% 50%,
    color-mix(in srgb, var(--pcolor) 90%, transparent) 0%,
    transparent 70%);
}

.comp-fx-particle--rise { animation: comp-fx-rise var(--dur, 3.6s) linear infinite; animation-delay: var(--delay, 0s); }
.comp-fx-particle--fall { animation: comp-fx-fall var(--dur, 4s) linear infinite; animation-delay: var(--delay, 0s); }
.comp-fx-particle--drift { animation: comp-fx-drift var(--dur, 5s) ease-in-out infinite; animation-delay: var(--delay, 0s); }
.comp-fx-particle--twinkle { animation: comp-fx-twinkle var(--dur, 2.4s) ease-in-out infinite; animation-delay: var(--delay, 0s); }
.comp-fx-particle--gust { animation: comp-fx-gust var(--dur, 4s) linear infinite; animation-delay: var(--delay, 0s); }

@keyframes comp-fx-rise {
  0%   { opacity: 0; transform: translate(0, 0) scale(0.5); }
  18%  { opacity: 0.85; }
  75%  { opacity: 0.7; }
  100% { opacity: 0; transform: translate(var(--dx, 0px), calc(-1 * var(--travel, 82px))) scale(0.95); }
}

@keyframes comp-fx-fall {
  0%   { opacity: 0; transform: translate(0, 0) scale(0.6); }
  15%  { opacity: 0.9; }
  80%  { opacity: 0.7; }
  100% { opacity: 0; transform: translate(var(--dx, 0px), var(--travel, 82px)) scale(0.9); }
}

@keyframes comp-fx-drift {
  0%   { opacity: 0; transform: translate(0, 0); }
  20%  { opacity: 0.8; }
  50%  { transform: translate(var(--dx, 0px), calc(-0.45 * var(--travel, 60px))); }
  80%  { opacity: 0.55; }
  100% { opacity: 0; transform: translate(0, calc(-0.85 * var(--travel, 60px))); }
}

@keyframes comp-fx-twinkle {
  0%, 100% { opacity: 0; transform: scale(0.4); }
  45%      { opacity: 0.9; transform: scale(1); }
  70%      { opacity: 0.5; transform: scale(0.7); }
}

@keyframes comp-fx-gust {
  0%   { opacity: 0; transform: translate(0, 0) scale(0.55); }
  10%  { opacity: 0.72; }
  25%  { transform: translate(calc(var(--dx, -90px) * 0.32), calc(var(--peak, -18px) * 0.72)) scale(0.9); }
  50%  { transform: translate(calc(var(--dx, -90px) * 0.58), var(--peak, -18px)) scale(1); }
  75%  { transform: translate(calc(var(--dx, -90px) * 0.8), calc(var(--peak, -18px) * 0.72)) scale(0.95); }
  88%  { opacity: 0.4; }
  100% { opacity: 0; transform: translate(var(--dx, -90px), 0) scale(0.8); }
}

@media (prefers-reduced-motion: reduce) {
  .comp-fx-particle {
    animation: none;
    opacity: 0.5;
  }
}
</style>
