<script setup lang="ts">
import { useElementCanvas } from '@/composables/useBackdropCanvas'
import type { TitleSmokeAuraSpec } from '@/types/api/items'
import { lerpHex } from '@/utils/color'
import { withAlpha } from '@/utils/overlayCanvas'
import { randBetween as rand } from '@/utils/random'
import { titleAuraRect, type TitleAuraRect } from '@/utils/titleAura'
import { computed, useTemplateRef } from 'vue'

const props = defineProps<{
  aura: TitleSmokeAuraSpec
  light: boolean
}>()

const palette = computed(() => {
  const a = props.aura
  return {
    smoke: (props.light ? a.lightSmoke : undefined) ?? a.smoke ?? '#291d38',
    ember: (props.light ? a.lightEmber : undefined) ?? a.ember ?? '#dc2626',
  }
})

interface Puff {
  x: number
  y: number
  vy: number
  swayAmp: number
  swayFreq: number
  rot: number
  vr: number
  born: number
  life: number
  baseSize: number
  sprite: HTMLCanvasElement
  maxA: number
}

interface Ember {
  x: number
  y: number
  vy: number
  drift: number
  born: number
  life: number
  size: number
}

let rect: TitleAuraRect | null = null
let puffs: Puff[] = []
let embers: Ember[] = []
let sprites: HTMLCanvasElement[] = []

function makeSprite(color: string, edge: string | null): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 96
  c.height = 96
  const g = c.getContext('2d')
  if (!g) return c
  for (let i = 0; i < 6; i++) {
    const bx = 48 + rand(-17, 17)
    const by = 48 + rand(-17, 17)
    const br = rand(13, 23)
    const grad = g.createRadialGradient(bx, by, 0, bx, by, br)
    grad.addColorStop(0, withAlpha(color, 0.4))
    grad.addColorStop(1, withAlpha(color, 0))
    g.fillStyle = grad
    g.fillRect(0, 0, 96, 96)
  }
  if (edge) {
    const grad = g.createRadialGradient(48, 48, 12, 48, 48, 44)
    grad.addColorStop(0, withAlpha(edge, 0))
    grad.addColorStop(0.75, withAlpha(edge, 0.13))
    grad.addColorStop(1, withAlpha(edge, 0))
    g.fillStyle = grad
    g.fillRect(0, 0, 96, 96)
  }
  return c
}

function resetPuff(p: Puff, now: number, warm: boolean) {
  if (!rect) return
  const fs = rect.fs
  const bias = Math.pow(Math.random(), 0.7) * (Math.random() < 0.5 ? -1 : 1)
  p.x = rect.x + rect.w / 2 + bias * rect.w * 0.44
  p.y = rect.y + rect.h * rand(0.4, 1)
  p.vy = fs * rand(0.3, 0.52)
  p.swayAmp = fs * rand(0.25, 0.55)
  p.swayFreq = rand(0.4, 0.9)
  p.rot = rand(0, Math.PI * 2)
  p.vr = rand(-0.35, 0.35)
  p.life = rand(3600, 5400)
  p.born = warm ? now - rand(0, p.life) : now
  p.baseSize = fs * rand(0.55, 0.9)
  p.sprite = sprites[Math.random() < 0.25 ? sprites.length - 1 : Math.floor(rand(0, sprites.length - 1))]
  p.maxA = rand(0.28, 0.48) * (props.light ? 0.85 : 1)
}

function resetEmber(e: Ember, now: number, warm: boolean) {
  if (!rect) return
  const fs = rect.fs
  e.x = rect.x + rand(0, rect.w)
  e.y = rect.y + rect.h * rand(0.3, 1)
  e.vy = fs * rand(1.0, 1.7)
  e.drift = rand(-0.5, 0.5) * fs
  e.born = warm ? now - rand(0, 1600) : now
  e.life = rand(1100, 2000)
  e.size = fs * rand(0.05, 0.09)
}

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvas')

useElementCanvas(canvasRef, {
  init(_w, _h, now) {
    if (!canvasRef.value) return
    rect = titleAuraRect(canvasRef.value)
    const { smoke, ember } = palette.value
    sprites = [
      makeSprite(smoke, null),
      makeSprite(smoke, null),
      makeSprite(smoke, ember),
      makeSprite(lerpHex(smoke, ember, 0.3), ember),
    ]
    puffs = Array.from({ length: 12 }, () => {
      const p = {} as Puff
      resetPuff(p, now, true)
      return p
    })
    embers = Array.from({ length: 7 }, () => {
      const e = {} as Ember
      resetEmber(e, now, true)
      return e
    })
  },
  draw(ctx, w, h, now, reduced) {
    if (!rect) return
    ctx.clearRect(0, 0, w, h)
    const { ember } = palette.value
    const fs = rect.fs
    const t = reduced ? 0.9 : now / 1000
    const cx = rect.x + rect.w / 2

    const glow = ctx.createRadialGradient(cx, rect.y + rect.h, 0, cx, rect.y + rect.h, rect.w * 0.62)
    glow.addColorStop(0, withAlpha(ember, 0.07 + 0.045 * Math.sin(t * 0.85)))
    glow.addColorStop(1, withAlpha(ember, 0))
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)

    for (const p of puffs) {
      let lp = (now - p.born) / p.life
      if (reduced) lp = ((p.born * 13) % 100) / 100
      if (lp >= 1) {
        resetPuff(p, now, false)
        continue
      }
      const px = p.x + Math.sin(t * p.swayFreq * Math.PI * 2 + p.born) * p.swayAmp
      const py = p.y - lp * p.vy * (p.life / 1000)
      const size = p.baseSize * (1 + lp * 1.3)
      const topFade = Math.max(0, Math.min(1, py / (fs * 0.9)))
      const alpha = Math.pow(Math.sin(Math.PI * lp), 0.8) * p.maxA * topFade
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(p.rot + t * p.vr)
      ctx.globalAlpha = alpha
      ctx.drawImage(p.sprite, -size, -size, size * 2, size * 2)
      ctx.restore()
    }
    ctx.globalAlpha = 1

    ctx.globalCompositeOperation = props.light ? 'source-over' : 'lighter'
    for (const e of embers) {
      let lp = (now - e.born) / e.life
      if (reduced) lp = ((e.born * 11) % 100) / 100
      if (lp >= 1) {
        resetEmber(e, now, false)
        continue
      }
      const flick = 0.55 + 0.45 * Math.sin(t * 8 + e.born)
      const ex = e.x + Math.sin(lp * 5 + e.born) * e.drift
      const ey = e.y - lp * e.vy * (e.life / 1000)
      ctx.fillStyle = withAlpha(ember, (1 - lp) * flick * 0.9)
      ctx.beginPath()
      ctx.arc(ex, ey, e.size * (1 - lp * 0.4), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  },
})
</script>

<template>
  <canvas ref="canvas" aria-hidden="true" />
</template>
