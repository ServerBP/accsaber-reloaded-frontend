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

interface EntityConfig {
  widthPct: number
  xPct: number
  bodyColor: string
  mistColor: string
  eyeColor: string
  floatMs: number
  blinkMs: number
  intensity: number
}

function readEntity(c: Composition): EntityConfig {
  return {
    widthPct: Math.max(20, Math.min(90, asNumber(c.widthPct) ?? 55)),
    xPct: Math.max(0, Math.min(100, asNumber(c.xPct) ?? 50)),
    bodyColor: asString(c.bodyColor) ?? '#0a0812',
    mistColor: asString(c.mistColor) ?? '#3d3654',
    eyeColor: asString(c.eyeColor) ?? '#ffffff',
    floatMs: Math.max(2000, asNumber(c.floatMs) ?? 7000),
    blinkMs: Math.max(2000, asNumber(c.blinkMs) ?? 6000),
    intensity: Math.max(0.2, Math.min(1, asNumber(c.intensity) ?? 0.9)),
  }
}

interface EntityRender {
  x: number
  y: number
  w: number
  h: number
  bodyBg: string
  mistBg: string
  eyeColor: string
  floatS: number
  blinkS: number
}

const entities = computed<EntityRender[]>(() => {
  if (props.measure.stack > 0) return []
  const box = props.measure.box
  if (!box.w || !box.h) return []
  const cfg = readEntity(props.composition)
  const minD = Math.min(box.w, box.h)
  const elongated = Math.max(box.w, box.h) / minD >= 1.5
  let w = (cfg.widthPct / 100) * minD * (elongated ? 1.4 : 1.25)
  let h = w * 0.55
  const headroom = box.y
  if (headroom > minD * 0.25) {
    h = Math.min(h, headroom * 1.05)
    w = h / 0.55
  }
  const hover = props.measure.typeKey === 'title' ? 0.55 : 0.97
  const body = `color-mix(in srgb, ${cfg.bodyColor} ${Math.round(cfg.intensity * 100)}%, transparent)`
  const bodySoft = `color-mix(in srgb, ${cfg.bodyColor} ${Math.round(cfg.intensity * 60)}%, transparent)`
  const bodyBg = `radial-gradient(ellipse 34% 42% at 24% 58%, ${body} 0 52%, transparent 74%), radial-gradient(ellipse 40% 52% at 50% 48%, ${body} 0 56%, transparent 76%), radial-gradient(ellipse 34% 44% at 76% 56%, ${body} 0 52%, transparent 74%), radial-gradient(ellipse 26% 34% at 38% 30%, ${bodySoft} 0 46%, transparent 70%), radial-gradient(ellipse 24% 30% at 64% 32%, ${bodySoft} 0 42%, transparent 68%)`
  const mistBg = `radial-gradient(ellipse 50% 45% at 50% 40%, color-mix(in srgb, ${cfg.mistColor} 26%, transparent) 0%, color-mix(in srgb, ${cfg.mistColor} 10%, transparent) 50%, transparent 74%)`
  return [{
    x: box.x + box.w * (cfg.xPct / 100) - w / 2,
    y: box.y - h * hover,
    w,
    h,
    bodyBg,
    mistBg,
    eyeColor: cfg.eyeColor,
    floatS: cfg.floatMs / 1000,
    blinkS: cfg.blinkMs / 1000,
  }]
})
</script>

<template>
  <div class="comp-fx-region">
    <div
      v-for="(ent, j) in entities"
      :key="j"
      class="comp-fx-entity"
      :style="{
        left: `${ent.x}px`,
        top: `${ent.y}px`,
        width: `${ent.w}px`,
        height: `${ent.h}px`,
        '--efloat': `${ent.floatS}s`,
        '--eblink': `${ent.blinkS}s`,
        '--eeye': ent.eyeColor,
      }"
    >
      <span class="comp-fx-entity-mist" :style="{ background: ent.mistBg }"></span>
      <span class="comp-fx-entity-body" :style="{ background: ent.bodyBg }"></span>
      <span class="comp-fx-entity-eye comp-fx-entity-eye--l"></span>
      <span class="comp-fx-entity-eye comp-fx-entity-eye--r"></span>
    </div>
  </div>
</template>

<style scoped>
.comp-fx-region {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
}

.comp-fx-entity {
  position: absolute;
  animation: comp-fx-entity-float var(--efloat, 7s) ease-in-out infinite;
}

.comp-fx-entity-body {
  position: absolute;
  inset: 0;
  filter: blur(3px);
}

.comp-fx-entity-mist {
  position: absolute;
  inset: -22%;
  mix-blend-mode: var(--fx-blend, screen);
  animation: comp-fx-entity-mist-breathe 5.2s ease-in-out infinite;
}

.comp-fx-entity-eye {
  position: absolute;
  top: 44%;
  width: 12%;
  height: 12%;
  border-radius: 50%;
  background: radial-gradient(ellipse at 50% 50%, #fff 0 30%, var(--eeye, #ffffff) 60%, transparent 100%);
  mix-blend-mode: var(--fx-blend, screen);
  animation: comp-fx-entity-blink var(--eblink, 6s) ease-in-out infinite;
}

.comp-fx-entity-eye::after {
  content: '';
  position: absolute;
  inset: -120% -60%;
  background: radial-gradient(ellipse at 50% 50%,
    color-mix(in srgb, var(--eeye, #ffffff) 36%, transparent) 0%,
    transparent 70%);
}

.comp-fx-entity-eye--l {
  left: 30%;
  --etilt: 9deg;
}

.comp-fx-entity-eye--r {
  right: 30%;
  --etilt: -9deg;
}

@keyframes comp-fx-entity-float {
  0%, 100% { transform: translate(0, 0); }
  30%      { transform: translate(-2.2%, 3.4%); }
  60%      { transform: translate(1.8%, -2.4%); }
  82%      { transform: translate(2.4%, 1.6%); }
}

@keyframes comp-fx-entity-mist-breathe {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 1; }
}

@keyframes comp-fx-entity-blink {
  0%, 90%, 100% { transform: rotate(var(--etilt, 0deg)) scaleY(1); }
  93%           { transform: rotate(var(--etilt, 0deg)) scaleY(0.06); }
  96%           { transform: rotate(var(--etilt, 0deg)) scaleY(1); }
}

@media (prefers-reduced-motion: reduce) {
  .comp-fx-entity,
  .comp-fx-entity-mist {
    animation: none;
  }
  .comp-fx-entity-eye {
    animation: none;
    transform: rotate(var(--etilt, 0deg));
  }
}
</style>
