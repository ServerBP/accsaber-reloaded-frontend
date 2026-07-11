<script setup lang="ts">
import { useElementCanvas } from '@/composables/useBackdropCanvas'
import type { BorderArcadeOverlaySpec, BorderColorValue } from '@/types/api/items'
import { frameDelta, overlaySpace } from '@/utils/overlayCanvas'
import { randBetween as rand } from '@/utils/random'
import { useTemplateRef } from 'vue'

const props = defineProps<{
  overlay: BorderArcadeOverlaySpec
  avatarUrl?: string | null
  color?: BorderColorValue | null
}>()

const MARGIN = 20
const CELL = 1.0
const INV_W = 11
const INV_SPACING = 20
const INV_COUNT = 6
const INV_Y = 2.4
const SHIP_Y = 80

const INV_A = ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000']
const INV_B = ['00100000100', '10010001001', '10111111101', '11011101101', '11111111111', '01111111110', '00100000100', '01000000010']
const SHIP = ['00000100000', '00001110000', '00001110000', '01111111110', '11111111111', '11111111111', '11111111111']
const SYM: Record<string, string[]> = {
  plus: ['00100', '00100', '11111', '00100', '00100'],
  ex: ['10001', '01010', '00100', '01010', '10001'],
  oh: ['01110', '10001', '10001', '10001', '01110'],
  tri: ['00100', '00100', '01010', '01010', '11111'],
  sq: ['11111', '10001', '10001', '10001', '11111'],
}
const SYM_KEYS = Object.keys(SYM)
const FONT: Record<string, string[]> = {
  H: ['101', '101', '111', '101', '101'],
  P: ['111', '101', '111', '100', '100'],
  M: ['10001', '11011', '10101', '10001', '10001'],
}

interface Invader { x: number; alive: boolean }
interface Bullet { x: number; y: number; dead?: boolean }
interface Burst { x: number; y: number; t: number }
interface Sym { x: number; y: number; vy: number; k: string; c: string }

let invaders: Invader[] = []
let ship = { x: 50, dir: 1 }
let bullets: Bullet[] = []
let bursts: Burst[] = []
let syms: Sym[] = []
let lastNow = 0
let lastFire = 0
let lastStep = 0
let frameA = true

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvas')

useElementCanvas(canvasRef, {
  init(_w, _h, now) {
    const symbolColors = props.overlay.symbols ?? ['#ff5d5d', '#5ad6ff', '#ff5db0', '#5ee56b', '#ffe14d']
    invaders = Array.from({ length: INV_COUNT }, (_, i) => ({ x: i * INV_SPACING - 4, alive: true }))
    ship = { x: 50, dir: 1 }
    bullets = []
    bursts = []
    syms = Array.from({ length: 6 }, (_, i) => ({
      x: i % 2 === 0 ? rand(2, 6) : rand(89, 94),
      y: rand(2, 92),
      vy: (i % 2 === 0 ? 1 : -1) * rand(4, 7),
      k: SYM_KEYS[i % SYM_KEYS.length],
      c: symbolColors[i % symbolColors.length],
    }))
    lastNow = now
    lastFire = now
    lastStep = now
    frameA = true
  },
  draw(ctx, w, h, now, reduced) {
    ctx.clearRect(0, 0, w, h)
    const { sx, sy, toX, toY } = overlaySpace(w, h, MARGIN)
    const dt = frameDelta(now, lastNow, reduced)
    lastNow = now

    const cInv = props.overlay.invader ?? '#5ee56b'
    const cShip = props.overlay.ship ?? '#5ad6ff'
    const cBullet = props.overlay.bullet ?? '#fff4c2'
    const cBurst = props.overlay.burst ?? '#ffd24d'
    const cHp = props.overlay.hp ?? '#ff4d5e'
    const cMp = props.overlay.mp ?? '#4db6ff'
    const cHudBg = props.overlay.hudBg ?? '#0b0b14'
    const cHudEdge = props.overlay.hudEdge ?? '#000000'
    const cHudGloss = props.overlay.hudGloss ?? '#ffffff'
    const cBarBg = props.overlay.barBg ?? '#05050a'
    const cHpLabel = props.overlay.hpLabel ?? '#ff8a93'
    const cHpEmpty = props.overlay.hpEmpty ?? '#2a1418'
    const cMpLabel = props.overlay.mpLabel ?? '#8fcbff'
    const cMpEmpty = props.overlay.mpEmpty ?? '#141f2a'

    function spr(bmp: string[], ox: number, oy: number, col: string) {
      ctx.fillStyle = col
      for (let r = 0; r < bmp.length; r++) {
        for (let c = 0; c < bmp[r].length; c++) {
          if (bmp[r][c] === '1') {
            ctx.fillRect(Math.round(toX(ox + c * CELL)), Math.round(toY(oy + r * CELL)), Math.ceil(CELL * sx), Math.ceil(CELL * sy))
          }
        }
      }
    }
    function rect(x: number, y: number, ww: number, hh: number, col: string, al = 1) {
      ctx.globalAlpha = al
      ctx.fillStyle = col
      ctx.fillRect(Math.round(toX(x)), Math.round(toY(y)), Math.max(1, Math.round(ww * sx)), Math.max(1, Math.round(hh * sy)))
      ctx.globalAlpha = 1
    }

    if (!reduced && now - lastStep > 420) {
      frameA = !frameA
      lastStep = now
    }
    for (const iv of invaders) {
      if (!reduced) {
        iv.x -= 6 * dt
        if (iv.x < -13) { iv.x += INV_COUNT * INV_SPACING; iv.alive = true }
      }
      if (iv.alive) spr(frameA ? INV_A : INV_B, iv.x, INV_Y, cInv)
    }

    if (!reduced) {
      ship.x += ship.dir * 13 * dt
      if (ship.x > 78) { ship.x = 78; ship.dir = -1 }
      if (ship.x < 12) { ship.x = 12; ship.dir = 1 }
    }
    spr(SHIP, ship.x, SHIP_Y, cShip)

    if (!reduced) {
      if (now - lastFire > 850) { bullets.push({ x: ship.x + 5, y: SHIP_Y - 1 }); lastFire = now }
      for (const b of bullets) {
        b.y -= 52 * dt
        if (b.y <= INV_Y + 8) {
          let best: Invader | null = null
          let bd = 6
          for (const iv of invaders) {
            if (!iv.alive) continue
            const d = Math.abs((iv.x + INV_W / 2) - b.x)
            if (d < bd) { bd = d; best = iv }
          }
          if (best) { best.alive = false; bursts.push({ x: best.x + INV_W / 2, y: INV_Y + 4, t: 0 }) }
          b.dead = true
        }
        if (!b.dead) rect(b.x, b.y, 1, 2.4, cBullet)
      }
      bullets = bullets.filter((b) => !b.dead && b.y > -4)

      for (const bu of bursts) {
        bu.t += dt
        const radius = 1 + bu.t * 10
        ctx.strokeStyle = cBurst
        ctx.globalAlpha = Math.max(0, 1 - bu.t * 3.5)
        ctx.lineWidth = Math.max(1, 0.8 * sx)
        ctx.strokeRect(Math.round(toX(bu.x - radius)), Math.round(toY(bu.y - radius)), Math.round(radius * 2 * sx), Math.round(radius * 2 * sy))
        ctx.globalAlpha = 1
      }
      bursts = bursts.filter((b) => b.t < 0.3)
    }

    for (const sm of syms) {
      if (!reduced) {
        sm.y += sm.vy * dt
        if (sm.y > 92) sm.y = 2
        if (sm.y < 2) sm.y = 92
      }
      spr(SYM[sm.k], sm.x, sm.y, sm.c)
    }

    const label = (txt: string, ox: number, oy: number, col: string) => {
      let cx = ox
      for (const ch of txt) {
        const g = FONT[ch]
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < g[r].length; c++) {
            if (g[r][c] === '1') rect(cx + c * 0.85, oy + r * 0.85, 0.85, 0.85, col)
          }
        }
        cx += g[0].length * 0.85 + 0.9
      }
    }
    const bar = (x: number, y: number, ww: number, frac: number, fill: string, emptyc: string) => {
      rect(x, y, ww, 2.6, cBarBg)
      rect(x + 0.4, y + 0.4, ww - 0.8, 1.8, emptyc)
      const segs = 11
      const fw = (ww - 0.8) / segs
      const n = Math.round(frac * segs)
      for (let i = 0; i < n; i++) rect(x + 0.4 + i * fw, y + 0.4, fw - 0.35, 1.8, fill)
    }
    rect(28.5, 88.2, 43, 11, cHudBg)
    rect(28.5, 88.2, 43, 0.8, cHudEdge, 0.4)
    rect(28.5, 98.4, 43, 0.9, cHudGloss, 0.06)
    const t = now / 1000
    const hp = reduced ? 0.78 : 0.72 + 0.28 * Math.sin(t * 0.7)
    const mp = reduced ? 0.6 : 0.55 + 0.45 * Math.sin(t * 0.45 + 1)
    label('HP', 30.5, 89.6, cHpLabel)
    bar(39.5, 89.4, 30, hp, cHp, cHpEmpty)
    label('MP', 30.5, 94.4, cMpLabel)
    bar(39.5, 94.2, 30, mp, cMp, cMpEmpty)
  },
})
</script>

<template>
  <canvas ref="canvas" class="border-arcade-overlay" aria-hidden="true" />
</template>

<style scoped>
.border-arcade-overlay {
  position: absolute;
  inset: -20%;
  width: 140%;
  height: 140%;
  max-width: none;
  max-height: none;
  pointer-events: none;
}
</style>
