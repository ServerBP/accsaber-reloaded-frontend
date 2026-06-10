<script setup lang="ts">
import ParticleCanvas from '@/components/common/ParticleCanvas.vue'
import CampaignNode from '@/components/domain/CampaignNode.vue'
import { useThemeStore } from '@/stores/theme'
import type {
  CampaignDifficultyProgressResponse,
  CampaignDifficultyResponse,
  CampaignNodeShape,
} from '@/types/api/campaigns'
import {
  edgePointOnShape,
  hexCorners,
  layoutNodes,
  parseNumericSize,
  resolveShape,
  shapeCorners,
  SQRT3,
  type NodeLayout,
} from '@/utils/campaignLayout'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  difficulties: CampaignDifficultyResponse[]
  progress?: CampaignDifficultyProgressResponse[]
  accentColor?: string
  nodeAccents?: Map<string, string>
  backgroundUrl?: string | null
  focusId?: string | null
  defaultScale?: number
  showStarfield?: boolean
  selectedId?: string | null
  editable?: boolean
  mode?: 'drag' | 'connect'
  unit?: number
}>(), {
  accentColor: 'var(--accent)',
  nodeAccents: () => new Map(),
  backgroundUrl: null,
  focusId: null,
  defaultScale: 1.25,
  showStarfield: false,
  selectedId: null,
  editable: false,
  mode: 'drag',
  unit: 48,
})

const themeStore = useThemeStore()

function nodeAccentFor(id: string): string {
  return props.nodeAccents.get(id) ?? props.accentColor
}

const emit = defineEmits<{
  select: [id: string]
  hover: [id: string | null]
  deselect: []
  move: [payload: { id: string; positionX: number; positionY: number }]
  emptyClick: [payload: { x: number; y: number }]
  connect: [payload: { fromId: string; toId: string }]
  disconnect: [payload: { fromId: string; toId: string }]
}>()

const connectFromId = ref<string | null>(null)
const connectPoint = ref<{ x: number; y: number } | null>(null)
const connectHoverId = ref<string | null>(null)

const stage = ref<HTMLDivElement | null>(null)
const stageWidth = ref(800)
const stageHeight = ref(560)

const layout = computed(() => layoutNodes(props.difficulties, props.unit))

const dragOverlay = ref(new Map<string, { cx: number; cy: number }>())

const draggingNodeId = ref<string | null>(null)

const renderedNodes = computed(() =>
  layout.value.nodes.map((n) => {
    const o = dragOverlay.value.get(n.id)
    return o ? { ...n, cx: o.cx, cy: o.cy } : n
  }),
)

const nodeById = computed(() => {
  const map = new Map<string, NodeLayout>()
  for (const n of renderedNodes.value) map.set(n.id, n)
  return map
})

const progressById = computed(() => {
  const map = new Map<string, CampaignDifficultyProgressResponse>()
  for (const p of props.progress ?? []) map.set(p.campaignDifficultyId, p)
  return map
})

interface Edge {
  fromId: string
  toId: string
  fromX: number
  fromY: number
  toX: number
  toY: number
  midX: number
  midY: number
  cleared: boolean
  available: boolean
  locked: boolean
  toSize: number
}

interface CheckpointLabel {
  key: string
  label: string
  color: string
  x: number
  y: number
}

const checkpointLabels = computed<CheckpointLabel[]>(() => {
  const groups = new Map<string, { nodes: NodeLayout[]; color: string | null; label: string }>()
  for (const d of props.difficulties) {
    if (!d.checkpointLabel) continue
    const node = nodeById.value.get(d.id)
    if (!node) continue
    const key = d.checkpointLabel
    const existing = groups.get(key)
    if (existing) {
      existing.nodes.push(node)
      if (!existing.color && d.checkpointColor) existing.color = d.checkpointColor
    } else {
      groups.set(key, { nodes: [node], color: d.checkpointColor, label: d.checkpointLabel })
    }
  }
  const out: CheckpointLabel[] = []
  for (const [key, g] of groups) {
    const xs = g.nodes.map((n) => n.cx)
    const ys = g.nodes.map((n) => n.cy)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const color = g.color || 'var(--accent-overall)'
    out.push({
      key,
      label: g.label,
      color,
      x: (minX + maxX) / 2,
      y: minY - props.unit * 1.55,
    })
  }
  return out
})

interface NodeFootprint {
  shape: CampaignNodeShape
  outerSize: number
}

function nodeFootprint(d: CampaignDifficultyResponse): NodeFootprint {
  const size = parseNumericSize(d.size, props.unit)
  const accentBand = Math.max(size * 0.07, 3)
  return {
    shape: resolveShape(d.borderShape),
    outerSize: size + accentBand,
  }
}

const difficultyById = computed(() => {
  const map = new Map<string, CampaignDifficultyResponse>()
  for (const d of props.difficulties) map.set(d.id, d)
  return map
})

const edges = computed<Edge[]>(() => {
  const out: Edge[] = []
  for (const d of props.difficulties) {
    const to = nodeById.value.get(d.id)
    if (!to) continue
    const toFootprint = nodeFootprint(d)
    for (const fromId of d.prerequisiteCampaignDifficultyIds ?? []) {
      const from = nodeById.value.get(fromId)
      if (!from) continue
      const fromDiff = difficultyById.value.get(fromId)
      if (!fromDiff) continue
      const fromFootprint = nodeFootprint(fromDiff)
      const a = edgePointOnShape(
        fromFootprint.shape, fromFootprint.outerSize,
        from.cx, from.cy, to.cx, to.cy,
      )
      const b = edgePointOnShape(
        toFootprint.shape, toFootprint.outerSize,
        to.cx, to.cy, from.cx, from.cy,
      )
      const fromProg = progressById.value.get(fromId)
      const toProg = progressById.value.get(d.id)
      const cleared = !!fromProg?.completed && !!toProg?.completed
      const available = !!fromProg?.completed && !!toProg?.unlocked && !toProg.completed
      const locked = !fromProg?.completed
      out.push({
        fromId,
        toId: d.id,
        fromX: a.x,
        fromY: a.y,
        toX: b.x,
        toY: b.y,
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
        cleared,
        available,
        locked,
        toSize: toFootprint.outerSize,
      })
    }
  }
  return out
})

const contentBounds = computed(() => {
  const b = layout.value.bounds
  const margin = props.unit * 2
  return {
    x: b.minX - margin,
    y: b.minY - margin,
    width: b.width + margin * 2,
    height: b.height + margin * 2 + props.unit,
  }
})

const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)
const minScale = 0.4
const maxScale = 2.5

let resizeObserver: ResizeObserver | null = null

function fitToContent() {
  if (!stage.value) return
  const w = stage.value.clientWidth
  const h = stage.value.clientHeight
  stageWidth.value = w
  stageHeight.value = h
  const b = contentBounds.value
  if (b.width === 0 || b.height === 0) return
  const fit = Math.min(w / b.width, h / b.height)
  const s = Math.max(minScale, Math.min(maxScale, fit))
  scale.value = s
  translateX.value = w / 2 - (b.x + b.width / 2) * s
  translateY.value = h / 2 - (b.y + b.height / 2) * s
}

function clampPan() {
  // Soft clamp: keep at least 80px of content on-screen
  const b = contentBounds.value
  const cw = b.width * scale.value
  const ch = b.height * scale.value
  const padX = 80
  const padY = 80
  const minTx = -(b.x + b.width) * scale.value + padX
  const maxTx = stageWidth.value - (b.x * scale.value) - padX
  const minTy = -(b.y + b.height) * scale.value + padY
  const maxTy = stageHeight.value - (b.y * scale.value) - padY
  if (cw < stageWidth.value) {
    translateX.value = Math.min(Math.max(translateX.value, minTx), maxTx)
  } else {
    translateX.value = Math.min(Math.max(translateX.value, minTx), maxTx)
  }
  if (ch < stageHeight.value) {
    translateY.value = Math.min(Math.max(translateY.value, minTy), maxTy)
  } else {
    translateY.value = Math.min(Math.max(translateY.value, minTy), maxTy)
  }
}

function onWheel(e: WheelEvent) {
  if (!stage.value) return
  e.preventDefault()
  const rect = stage.value.getBoundingClientRect()
  const cx = e.clientX - rect.left
  const cy = e.clientY - rect.top
  const delta = -e.deltaY * 0.0015
  const factor = Math.exp(delta)
  const next = Math.max(minScale, Math.min(maxScale, scale.value * factor))
  const ratio = next / scale.value
  translateX.value = cx - (cx - translateX.value) * ratio
  translateY.value = cy - (cy - translateY.value) * ratio
  scale.value = next
  clampPan()
}

interface DragState {
  x: number
  y: number
  tx: number
  ty: number
  nodeId: string | null
  startCx: number
  startCy: number
  moved: boolean
}

let dragStart: DragState | null = null
let suppressClick = false

const CLICK_THRESHOLD_PX = 4

function nodeIdFromEvent(target: EventTarget | null): string | null {
  if (!target) return null
  const el = (target as Element).closest?.('[data-node]') as HTMLElement | null
  return el?.dataset.id ?? null
}

function nodeIdAtPoint(clientX: number, clientY: number): string | null {
  if (typeof document === 'undefined') return null
  const hit = document.elementFromPoint(clientX, clientY)
  if (!hit) return null
  const node = hit.closest('[data-node]') as HTMLElement | null
  return node?.dataset.id ?? null
}

function clientToContent(clientX: number, clientY: number) {
  if (!stage.value) return { x: 0, y: 0 }
  const rect = stage.value.getBoundingClientRect()
  return {
    x: (clientX - rect.left - translateX.value) / scale.value,
    y: (clientY - rect.top - translateY.value) / scale.value,
  }
}

function contentToGrid(cx: number, cy: number) {
  const positionX = Math.round(cx / (props.unit * 1.5))
  const offsetY = positionX % 2 !== 0 ? (props.unit * SQRT3) / 2 : 0
  const positionY = Math.round((cy - offsetY) / (props.unit * SQRT3))
  return { positionX, positionY }
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0 && e.button !== 1) return
  const target = e.target as Element | null
  if (target?.closest?.('.campaign-roadmap__bottom-stack')) return
  if (target?.closest?.('.campaign-roadmap__edge-x')) return
  const nodeId = nodeIdFromEvent(e.target)
  const node = nodeId ? nodeById.value.get(nodeId) : null
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  if (nodeId && props.editable && props.mode === 'connect') {
    connectFromId.value = nodeId
    connectPoint.value = clientToContent(e.clientX, e.clientY)
    dragStart = {
      x: e.clientX,
      y: e.clientY,
      tx: translateX.value,
      ty: translateY.value,
      nodeId,
      startCx: node?.cx ?? 0,
      startCy: node?.cy ?? 0,
      moved: false,
    }
    return
  }
  dragStart = {
    x: e.clientX,
    y: e.clientY,
    tx: translateX.value,
    ty: translateY.value,
    nodeId,
    startCx: node?.cx ?? 0,
    startCy: node?.cy ?? 0,
    moved: false,
  }
}

function onPointerMove(e: PointerEvent) {
  if (!dragStart) return
  const dx = e.clientX - dragStart.x
  const dy = e.clientY - dragStart.y
  if (!dragStart.moved && Math.hypot(dx, dy) > CLICK_THRESHOLD_PX) {
    dragStart.moved = true
  }
  if (connectFromId.value) {
    connectPoint.value = clientToContent(e.clientX, e.clientY)
    const hover = nodeIdAtPoint(e.clientX, e.clientY)
    connectHoverId.value = hover && hover !== connectFromId.value ? hover : null
    return
  }
  if (dragStart.nodeId && props.editable && props.mode === 'drag') {
    if (!dragStart.moved) return
    const ratio = 1 / scale.value
    dragOverlay.value.set(dragStart.nodeId, {
      cx: dragStart.startCx + dx * ratio,
      cy: dragStart.startCy + dy * ratio,
    })
    dragOverlay.value = new Map(dragOverlay.value)
    draggingNodeId.value = dragStart.nodeId
    return
  }
  if (dragStart.nodeId) return
  translateX.value = dragStart.tx + dx
  translateY.value = dragStart.ty + dy
}

function settleOverlay(nodeId: string, from: { cx: number; cy: number }, to: { cx: number; cy: number }) {
  const reduced = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    dragOverlay.value.delete(nodeId)
    dragOverlay.value = new Map(dragOverlay.value)
    draggingNodeId.value = null
    return
  }
  const startTime = performance.now()
  const duration = 180
  const animate = (now: number) => {
    const t = Math.min((now - startTime) / duration, 1)
    const eased = 1 - Math.pow(1 - t, 3)
    const x = from.cx + (to.cx - from.cx) * eased
    const y = from.cy + (to.cy - from.cy) * eased
    dragOverlay.value.set(nodeId, { cx: x, cy: y })
    dragOverlay.value = new Map(dragOverlay.value)
    if (t < 1) {
      requestAnimationFrame(animate)
    } else {
      dragOverlay.value.delete(nodeId)
      dragOverlay.value = new Map(dragOverlay.value)
      draggingNodeId.value = null
    }
  }
  requestAnimationFrame(animate)
}

function onPointerUp(e: PointerEvent) {
  if (!dragStart) return
  const { nodeId, moved } = dragStart
  ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  clampPan()

  if (connectFromId.value) {
    const fromId = connectFromId.value
    const targetNodeId = connectHoverId.value
      ?? nodeIdAtPoint(e.clientX, e.clientY)
      ?? nodeIdFromEvent(e.target)
    connectFromId.value = null
    connectPoint.value = null
    connectHoverId.value = null
    suppressClick = true
    dragStart = null
    if (targetNodeId && targetNodeId !== fromId) {
      emit('connect', { fromId, toId: targetNodeId })
    }
    return
  }

  if (nodeId && props.editable && props.mode === 'drag' && moved) {
    const final = dragOverlay.value.get(nodeId)
    if (final) {
      const { positionX, positionY } = contentToGrid(final.cx, final.cy)
      const snapCx = positionX * props.unit * 1.5
      const snapCy = positionY * props.unit * SQRT3
        + (positionX % 2 !== 0 ? (props.unit * SQRT3) / 2 : 0)
      emit('move', { id: nodeId, positionX, positionY })
      settleOverlay(nodeId, final, { cx: snapCx, cy: snapCy })
    } else {
      draggingNodeId.value = null
    }
    suppressClick = true
    dragStart = null
    return
  }

  if (nodeId && !moved) {
    emit('select', nodeId)
    suppressClick = true
    dragStart = null
    return
  }

  if (!nodeId && !moved) {
    if (props.editable) {
      const content = clientToContent(e.clientX, e.clientY)
      emit('emptyClick', content)
    } else {
      emit('deselect')
    }
  }
  dragStart = null
}

function onNodeClickCapture(e: MouseEvent) {
  if (suppressClick) {
    e.stopPropagation()
    e.preventDefault()
    suppressClick = false
  }
}

function adjustZoom(factor: number) {
  if (!stage.value) return
  const cx = stageWidth.value / 2
  const cy = stageHeight.value / 2
  const next = Math.max(minScale, Math.min(maxScale, scale.value * factor))
  const ratio = next / scale.value
  translateX.value = cx - (cx - translateX.value) * ratio
  translateY.value = cy - (cy - translateY.value) * ratio
  scale.value = next
  clampPan()
}

function focusNode(id: string, targetScale?: number) {
  const n = nodeById.value.get(id)
  if (!n || !stage.value) return
  const s = targetScale ?? Math.max(scale.value, props.defaultScale)
  const clamped = Math.max(minScale, Math.min(maxScale, s))
  translateX.value = stageWidth.value / 2 - n.cx * clamped
  translateY.value = stageHeight.value / 2 - n.cy * clamped
  scale.value = clamped
  clampPan()
}

function initialPosition() {
  if (!stage.value) return
  stageWidth.value = stage.value.clientWidth
  stageHeight.value = stage.value.clientHeight
  if (props.focusId && nodeById.value.has(props.focusId)) {
    focusNode(props.focusId, props.defaultScale)
  } else {
    fitToContent()
  }
}

let didInitialPosition = false

onMounted(() => {
  if (!stage.value) return
  void nextTick(() => {
    initialPosition()
    didInitialPosition = true
  })
  resizeObserver = new ResizeObserver(() => {
    if (!stage.value) return
    stageWidth.value = stage.value.clientWidth
    stageHeight.value = stage.value.clientHeight
    clampPan()
  })
  resizeObserver.observe(stage.value)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})

watch(() => props.difficulties.length, () => {
  initialPosition()
})

watch(() => props.focusId, (id) => {
  if (id && didInitialPosition) focusNode(id)
})

defineExpose({ fitToContent, focusNode })

const transformStyle = computed(
  () => `translate(${translateX.value} ${translateY.value}) scale(${scale.value})`,
)

const snapTarget = computed<{
  cx: number
  cy: number
  shape: CampaignNodeShape
  size: number
} | null>(() => {
  const id = draggingNodeId.value
  if (!id) return null
  const overlay = dragOverlay.value.get(id)
  if (!overlay) return null
  const diff = props.difficulties.find((d) => d.id === id)
  if (!diff) return null
  const { positionX, positionY } = contentToGrid(overlay.cx, overlay.cy)
  const cx = positionX * props.unit * 1.5
  const cy = positionY * props.unit * SQRT3 + (positionX % 2 !== 0 ? (props.unit * SQRT3) / 2 : 0)
  return {
    cx,
    cy,
    shape: resolveShape(diff.borderShape),
    size: parseNumericSize(diff.size, props.unit),
  }
})

const snapShapePoints = computed(() => {
  const t = snapTarget.value
  if (!t) return ''
  return shapeCorners(t.shape, 0, 0, t.size * 1.04)
})

const arrowDecorations = computed(() =>
  edges.value.map((e) => {
    const dx = e.toX - e.fromX
    const dy = e.toY - e.fromY
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    const headSize = Math.max(e.toSize * 0.22, 6)
    const baseX = e.toX - ux * headSize
    const baseY = e.toY - uy * headSize
    const perpX = -uy
    const perpY = ux
    const leftX = baseX + perpX * headSize * 0.5
    const leftY = baseY + perpY * headSize * 0.5
    const rightX = baseX - perpX * headSize * 0.5
    const rightY = baseY - perpY * headSize * 0.5
    return {
      ...e,
      arrowPoints: `${e.toX},${e.toY} ${leftX},${leftY} ${rightX},${rightY}`,
    }
  }),
)
</script>

<template>
  <div ref="stage" class="campaign-roadmap" @wheel="onWheel" @pointerdown="onPointerDown"
    @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp">
    <div v-if="backgroundUrl" class="campaign-roadmap__bg"
      :style="{ backgroundImage: `url(${backgroundUrl})` }" aria-hidden="true" />
    <template v-else-if="showStarfield">
      <div class="campaign-roadmap__glow" :style="{ '--starfield-accent': accentColor }" aria-hidden="true" />
      <ParticleCanvas class="campaign-roadmap__particles" :dark-mode="themeStore.theme === 'dark'" />
    </template>
    <svg class="campaign-roadmap__svg" :width="stageWidth" :height="stageHeight">
      <defs>
        <pattern id="campaign-roadmap-grid" :width="unit * 1.5" :height="unit * SQRT3"
          patternUnits="userSpaceOnUse">
          <circle :cx="0" :cy="0" r="1.2" fill="var(--bg-overlay)" />
        </pattern>
      </defs>

      <rect v-if="!backgroundUrl && !showStarfield" x="0" y="0" :width="stageWidth"
        :height="stageHeight" fill="url(#campaign-roadmap-grid)" opacity="0.4" />

      <g :transform="transformStyle">
        <g v-if="editable" class="campaign-roadmap__origin" aria-hidden="true">
          <line x1="-10" y1="0" x2="10" y2="0" stroke="var(--text-tertiary)" stroke-width="1" />
          <line x1="0" y1="-10" x2="0" y2="10" stroke="var(--text-tertiary)" stroke-width="1" />
          <circle cx="0" cy="0" r="3" fill="none" stroke="var(--text-tertiary)" stroke-width="1" />
          <text x="14" y="14" font-size="11" fill="var(--text-tertiary)"
            font-family="var(--font-mono)">0,0</text>
        </g>

        <g class="campaign-roadmap__edges">
          <g v-for="e in arrowDecorations" :key="`edge-${e.fromId}-${e.toId}`"
            class="campaign-roadmap__edge-group">
            <line class="campaign-roadmap__edge-hit"
              :x1="e.fromX" :y1="e.fromY" :x2="e.toX" :y2="e.toY"
              stroke="transparent" :stroke-width="Math.max(unit * 0.3, 14)" />
            <line :x1="e.fromX" :y1="e.fromY" :x2="e.toX" :y2="e.toY"
              :stroke="e.cleared ? '#ffffff' : e.available ? 'var(--text-secondary)' : 'var(--text-tertiary)'"
              :stroke-width="e.cleared ? 2 : 1.25"
              :stroke-dasharray="e.locked ? `${unit * 0.12} ${unit * 0.1}` : undefined"
              :opacity="e.cleared ? 0.95 : e.available ? 0.85 : 0.45" />
            <polygon :points="e.arrowPoints"
              :fill="e.cleared ? '#ffffff' : e.available ? 'var(--text-secondary)' : 'transparent'"
              :stroke="e.cleared ? '#ffffff' : e.available ? 'var(--text-secondary)' : 'var(--text-tertiary)'"
              stroke-width="1" :opacity="e.cleared ? 0.95 : e.available ? 0.85 : 0.4" />
            <g v-if="editable" class="campaign-roadmap__edge-x"
              :transform="`translate(${e.midX}, ${e.midY})`"
              @click.stop="emit('disconnect', { fromId: e.fromId, toId: e.toId })">
              <circle r="10" fill="var(--bg-base)" stroke="var(--error)" stroke-width="1.5" />
              <path d="M-4 -4L4 4M-4 4L4 -4" stroke="var(--error)" stroke-width="2"
                stroke-linecap="round" fill="none" />
            </g>
          </g>
        </g>

        <g v-if="snapTarget" class="campaign-roadmap__snap" aria-hidden="true"
          :style="{ transform: `translate(${snapTarget.cx}px, ${snapTarget.cy}px)` }">
          <circle v-if="snapTarget.shape === 'circle'" :r="snapTarget.size * 1.04" />
          <polygon v-else :points="snapShapePoints" />
        </g>

        <g v-if="connectFromId && connectPoint && nodeById.get(connectFromId)"
          class="campaign-roadmap__connecting" aria-hidden="true">
          <line :x1="nodeById.get(connectFromId)!.cx" :y1="nodeById.get(connectFromId)!.cy"
            :x2="connectPoint.x" :y2="connectPoint.y"
            stroke="var(--accent)" stroke-width="2" stroke-dasharray="6 4" />
        </g>

        <g v-for="n in renderedNodes" :key="n.id" data-node :data-id="n.id"
          :class="{
            'campaign-roadmap__node--editable': editable,
            'campaign-roadmap__node--connect-target': connectHoverId === n.id,
          }"
          @mouseenter="emit('hover', n.id)"
          @mouseleave="emit('hover', null)"
          @click.capture="onNodeClickCapture">
          <CampaignNode :difficulty="difficulties.find((d) => d.id === n.id)!"
            :progress="progressById.get(n.id) ?? null" :cx="n.cx" :cy="n.cy" :size="unit"
            :accent-color="nodeAccentFor(n.id)" :selected="selectedId === n.id"
            @select="emit('select', $event)" />
        </g>

        <g class="campaign-roadmap__checkpoints">
          <text v-for="cp in checkpointLabels" :key="cp.key" :x="cp.x" :y="cp.y"
            :font-size="Math.max(unit * 0.34, 14)" text-anchor="middle"
            class="campaign-roadmap__checkpoint-text"
            :style="{ fill: cp.color, '--checkpoint-color': cp.color }">
            {{ cp.label }}
          </text>
        </g>
      </g>
    </svg>

    <div class="campaign-roadmap__bottom-stack">
      <div class="campaign-roadmap__controls" aria-label="Roadmap controls">
        <button type="button" class="campaign-roadmap__btn" aria-label="Zoom in" @click="adjustZoom(1.2)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button type="button" class="campaign-roadmap__btn" aria-label="Zoom out" @click="adjustZoom(1 / 1.2)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button type="button" class="campaign-roadmap__btn" aria-label="Fit roadmap" @click="fitToContent">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="4 8 4 4 8 4" />
            <polyline points="20 8 20 4 16 4" />
            <polyline points="4 16 4 20 8 20" />
            <polyline points="20 16 20 20 16 20" />
          </svg>
        </button>
      </div>
      <slot name="actions" />
    </div>

    <div class="campaign-roadmap__hint" aria-hidden="true">drag · scroll to zoom</div>
  </div>
</template>

<style scoped>
.campaign-roadmap {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 4px;
  overflow: hidden;
  touch-action: none;
  cursor: grab;
  user-select: none;
}

.campaign-roadmap:active {
  cursor: grabbing;
}

.campaign-roadmap__node--editable {
  cursor: grab;
}

.campaign-roadmap__node--editable:active {
  cursor: grabbing;
}

.campaign-roadmap__node--connect-target {
  filter: brightness(1.18);
  transition: filter 120ms ease;
}

.campaign-roadmap__edge-hit {
  pointer-events: stroke;
}

.campaign-roadmap__edge-x {
  opacity: 0;
  cursor: pointer;
  transition: opacity 140ms ease;
}

.campaign-roadmap__edge-group:hover .campaign-roadmap__edge-x {
  opacity: 1;
}

.campaign-roadmap__connecting line {
  pointer-events: none;
}

.campaign-roadmap__snap {
  pointer-events: none;
  transition: transform 140ms cubic-bezier(0.34, 1.56, 0.64, 1);
  animation: snap-breathe 1.6s ease-in-out infinite;
  transform-box: fill-box;
}

.campaign-roadmap__snap polygon,
.campaign-roadmap__snap circle {
  fill: color-mix(in srgb, var(--page-accent, var(--accent)) 12%, transparent);
  stroke: var(--page-accent, var(--accent));
  stroke-width: 1.5;
  stroke-dasharray: 6 5;
  stroke-linejoin: round;
}

@keyframes snap-breathe {
  0%, 100% { opacity: 0.65; }
  50% { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .campaign-roadmap__snap {
    transition: none;
    animation: none;
    opacity: 0.85;
  }
}

.campaign-roadmap__svg {
  display: block;
  position: relative;
}

.campaign-roadmap__checkpoint-text {
  font-family: var(--font-sans);
  font-weight: 800;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  pointer-events: none;
  filter:
    drop-shadow(0 0 4px color-mix(in srgb, var(--checkpoint-color) 75%, transparent))
    drop-shadow(0 0 14px color-mix(in srgb, var(--checkpoint-color) 45%, transparent));
}

.campaign-roadmap__bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  opacity: 0.28;
  filter: saturate(1.05);
  mask-image: radial-gradient(ellipse at center, #000 55%, transparent 100%);
  pointer-events: none;
}

.campaign-roadmap__glow {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 70% 60% at 50% 35%,
      color-mix(in srgb, var(--starfield-accent) 14%, transparent),
      transparent 70%),
    radial-gradient(ellipse 90% 100% at 50% 110%,
      color-mix(in srgb, var(--starfield-accent) 8%, transparent),
      transparent 75%);
  pointer-events: none;
}

.campaign-roadmap__particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.campaign-roadmap__bottom-stack {
  position: absolute;
  bottom: var(--space-md);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.campaign-roadmap__controls {
  display: flex;
  flex-direction: row;
  gap: 2px;
  padding: 2px;
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: 4px;
}

.campaign-roadmap__btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: 2px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 120ms ease, background 120ms ease;
}

.campaign-roadmap__btn:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.campaign-roadmap__hint {
  position: absolute;
  bottom: var(--space-sm);
  left: var(--space-sm);
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  pointer-events: none;
}
</style>
