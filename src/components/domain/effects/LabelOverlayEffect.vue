<script setup lang="ts">
import type { Composition } from '@/types/api/items'
import type { TokenContext } from '@/utils/items'
import { substituteTokens } from '@/utils/items'
import { computed } from 'vue'
import { asNumber, asString, type EffectMeasure } from './shared'

const props = defineProps<{
  composition: Composition
  ctx: TokenContext
  measure: EffectMeasure
}>()

const isStat = computed(() => props.composition.type === 'stat_counter')

const label = computed<string | null>(() => {
  const c = props.composition
  if (isStat.value) {
    const key = asString(c.statKey) ?? ''
    if (key === 'serial') return null
    const prefix = asString(c.prefix) ?? ''
    const raw = (props.ctx.stats ?? {})[key]
    return `${prefix}${raw == null ? 0 : raw}`
  }
  const direct = asString(c.text)
  if (direct) return direct
  const expr = asString(c.textExpr)
  if (!expr) return null
  if (/^#?\$\{serial\}$/.test(expr.trim())) return null
  return substituteTokens(expr, props.ctx)
})

const positionClass = computed(() => {
  const p = asString(props.composition.position)
  return `comp-label--${p ?? 'top-right'}`
})

const style = computed<Record<string, string>>(() => {
  const c = props.composition
  const out: Record<string, string> = {}
  const bg = asString(c.background)
  const color = asString(c.color)
  const fw = asNumber(c.fontWeight)
  if (bg) out.background = bg
  if (color) out.color = color
  if (fw) out.fontWeight = String(fw)
  return out
})
</script>

<template>
  <div
    v-if="label != null"
    class="comp-label"
    :class="[positionClass, { 'comp-label--mono': isStat }]"
    :style="style"
  >{{ label }}</div>
</template>

<style scoped>
.comp-label {
  position: absolute;
  padding: 2px 6px;
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  background: rgba(0, 0, 0, 0.7);
  color: var(--text-primary);
  border-radius: 3px;
  white-space: nowrap;
}

.comp-label--mono {
  font-family: var(--font-mono);
}

.comp-label--top-left { top: 4px; left: 4px; }
.comp-label--top-right { top: 4px; right: 4px; }
.comp-label--bottom-left { bottom: 4px; left: 4px; }
.comp-label--bottom-right { bottom: 4px; right: 4px; }
.comp-label--center { top: 50%; left: 50%; transform: translate(-50%, -50%); }
</style>
