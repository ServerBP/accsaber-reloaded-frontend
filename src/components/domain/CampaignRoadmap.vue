<script setup lang="ts">
import ParticleCanvas from '@/components/common/ParticleCanvas.vue'
import CampaignBarrierGate from '@/components/domain/CampaignBarrierGate.vue'
import CampaignNode from '@/components/domain/CampaignNode.vue'
import { useThemeStore } from '@/stores/theme'
import { readBackdropConfig } from '@/utils/themeBackdrop'
import type {
  BarrierProgressResponse,
  CampaignBarrierResponse,
  CampaignDifficultyProgressResponse,
  CampaignDifficultyResponse,
  CampaignNodeShape,
  CampaignTextResponse,
} from '@/types/api/campaigns'
import { sanitizeRichHtml } from '@/utils/richText'
import CampaignPresenceCursor from '@/components/domain/CampaignPresenceCursor.vue'
import type {
  PresenceAction,
  PresenceKind,
  PresencePeer,
} from '@/composables/useCampaignPresence'
import {
  barrierConditionLabel,
  barrierPairValue,
  computeLabelPlacements,
  edgePointOnShape,
  layoutNodes,
  prereqIds,
  resolveConnectionColor,
  resolveSize,
  resolveShape,
  shapeCorners,
  SQRT3,
  type NodeLayout,
} from '@/utils/campaignLayout'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    difficulties: CampaignDifficultyResponse[]
    barriers?: CampaignBarrierResponse[]
    texts?: CampaignTextResponse[]
    progress?: CampaignDifficultyProgressResponse[]
    barrierProgress?: BarrierProgressResponse[]
    accentColor?: string
    barrierAccent?: string
    nodeAccents?: Map<string, string>
    backgroundUrl?: string | null
    backgroundColor?: string | null
    focusId?: string | null
    defaultScale?: number
    showStarfield?: boolean
    selectedId?: string | null
    selectedIds?: string[]
    selectedEdge?: { fromId: string; toId: string } | null
    highlightBarrierId?: string | null
    barrierPlacement?: boolean
    activeTray?: string | null
    followFocus?: boolean
    presencePeers?: PresencePeer[]
    editable?: boolean
    flagMissingRewards?: boolean
    mode?: 'drag' | 'connect' | 'select'
    unit?: number
    markNext?: boolean
  }>(),
  {
    barriers: () => [],
    texts: () => [],
    progress: undefined,
    barrierProgress: undefined,
    accentColor: 'var(--accent)',
    barrierAccent: 'var(--warning)',
    nodeAccents: () => new Map(),
    backgroundUrl: null,
    backgroundColor: null,
    focusId: null,
    defaultScale: 1.25,
    showStarfield: false,
    selectedId: null,
    selectedIds: () => [],
    selectedEdge: null,
    highlightBarrierId: null,
    barrierPlacement: false,
    activeTray: null,
    followFocus: true,
    presencePeers: () => [],
    editable: false,
    flagMissingRewards: false,
    mode: 'drag',
    unit: 48,
    markNext: false,
  },
)

const themeStore = useThemeStore()

function nodeAccentFor(id: string): string {
  return props.nodeAccents.get(id) ?? props.accentColor
}

const backgroundFill = computed(() => props.backgroundColor?.trim() || 'var(--accent-overall)')

const themeBackdropActive = computed(() => readBackdropConfig(themeStore.activeTokens) !== null)
const showOwnStarfield = computed(() => props.showStarfield && !themeBackdropActive.value)
const transparentToThemeBackdrop = computed(
  () => props.showStarfield && themeBackdropActive.value && !props.backgroundUrl,
)

const emit = defineEmits<{
  select: [id: string]
  selectMany: [ids: string[]]
  toggleSelect: [id: string]
  hover: [id: string | null]
  deselect: []
  move: [payload: { id: string; positionX: number; positionY: number }]
  moveMany: [payloads: Array<{ id: string; positionX: number; positionY: number }>]
  emptyClick: [payload: { x: number; y: number }]
  connect: [payload: { fromId: string; toId: string }]
  disconnect: [payload: { fromId: string; toId: string }]
  placeBarrier: [payload: { fromId: string; toId: string }]
  edgeSelect: [payload: { fromId: string; toId: string }]
  cursormove: [
    payload: {
      x: number
      y: number
      action: PresenceAction
      targetId: string | null
      kind: PresenceKind
      tray: string | null
    },
  ]
  cursoroff: []
}>()

const selectedSet = computed(() => new Set(props.selectedIds))

const connectFromId = ref<string | null>(null)
const connectPoint = ref<{ x: number; y: number } | null>(null)
const connectHoverId = ref<string | null>(null)
const hoverNodeId = ref<string | null>(null)

function onNodeHover(id: string | null) {
  hoverNodeId.value = id
  emit('hover', id)
}

const stage = ref<HTMLDivElement | null>(null)
const stageWidth = ref(800)
const stageHeight = ref(560)

const layout = computed(() => layoutNodes(props.difficulties, props.unit))

const dragOverlay = ref(new Map<string, { cx: number; cy: number }>())

const draggingNodeId = ref<string | null>(null)

const remoteDragById = ref(new Map<string, { cx: number; cy: number; color: string }>())

function appliedPos<T extends { id: string; cx: number; cy: number }>(n: T): T {
  const local = dragOverlay.value.get(n.id)
  if (local) return { ...n, cx: local.cx, cy: local.cy }
  const remote = remoteDragById.value.get(n.id)
  if (remote) return { ...n, cx: remote.cx, cy: remote.cy }
  return n
}

const renderedNodes = computed(() => layout.value.nodes.map(appliedPos))

const nodeById = computed(() => {
  const map = new Map<string, NodeLayout>()
  for (const n of renderedNodes.value) map.set(n.id, n)
  return map
})

const progressById = computed(() => {
  const map = new Map<string, CampaignDifficultyProgressResponse>()
  for (const p of props.progress ?? []) map.set(p.node.id, p)
  return map
})

const nextIds = computed(() => {
  const set = new Set<string>()
  if (!props.markNext) return set
  for (const p of props.progress ?? []) {
    if (p.unlocked && !p.completed) set.add(p.node.id)
  }
  return set
})

const difficultyById = computed(() => {
  const map = new Map<string, CampaignDifficultyResponse>()
  for (const d of props.difficulties) map.set(d.id, d)
  return map
})

function nodeUnranked(d: CampaignDifficultyResponse): boolean {
  if (d.status != null) return d.status !== 'RANKED'
  return d.categoryId == null
}

const missingRewardIds = computed(() => {
  const set = new Set<string>()
  if (!props.flagMissingRewards) return set
  if (props.difficulties.some(nodeUnranked)) return set
  for (const d of props.difficulties) {
    if ((d.xp ?? 0) <= 0 && (d.items?.length ?? 0) === 0) set.add(d.id)
  }
  return set
})

function nodeSizeFor(id: string): number {
  return resolveSize(difficultyById.value.get(id)?.size, props.unit)
}

const barrierLayout = computed(() => layoutNodes(props.barriers, props.unit))

const renderedBarriers = computed(() => barrierLayout.value.nodes.map(appliedPos))

const barrierById = computed(() => {
  const map = new Map<string, NodeLayout>()
  for (const b of renderedBarriers.value) map.set(b.id, b)
  return map
})

const barrierMetaById = computed(() => {
  const map = new Map<string, CampaignBarrierResponse>()
  for (const b of props.barriers) map.set(b.id, b)
  return map
})

const barrierProgressById = computed(() => {
  const map = new Map<string, BarrierProgressResponse>()
  for (const p of props.barrierProgress ?? []) map.set(p.barrier.id, p)
  return map
})

const textLayout = computed(() => layoutNodes(props.texts, props.unit))

const renderedTexts = computed(() => textLayout.value.nodes.map(appliedPos))

const TEXT_FONTS: Record<string, string> = {
  mono: 'var(--font-mono)',
  serif: 'Georgia, "Times New Roman", serif',
}

interface TextStatic {
  html: string
  fontSize: number
  color: string
  fontFamily: string
  effectClass: string
  width: number
  height: number
}

interface TextRender extends TextStatic {
  id: string
  cx: number
  cy: number
}

// Depends only on the text data (not positions), so sanitize runs on edit, never per drag frame.
const textStaticById = computed(() => {
  const map = new Map<string, TextStatic>()
  for (const t of props.texts) {
    const scale = t.scale ?? 1
    const font = t.font ?? ''
    map.set(t.id, {
      html: sanitizeRichHtml(t.content),
      fontSize: Math.max(props.unit * 0.3 * scale, 8),
      color: t.color || 'var(--text-primary)',
      fontFamily: font ? (TEXT_FONTS[font] ?? `"${font}", var(--font-sans)`) : 'var(--font-sans)',
      effectClass: (t.effects ?? '')
        .split(/\s+/)
        .filter((e) => e === 'glow' || e === 'outline' || e === 'shadow')
        .join(' '),
      width: Math.max(props.unit * 5, 160),
      height: Math.max(props.unit * 3, 90),
    })
  }
  return map
})

const EMPTY_TEXT_STATIC: TextStatic = {
  html: '',
  fontSize: 12,
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-sans)',
  effectClass: '',
  width: 160,
  height: 90,
}

const renderedTextEls = computed<TextRender[]>(() =>
  renderedTexts.value.map((n) => ({
    id: n.id,
    cx: n.cx,
    cy: n.cy,
    ...(textStaticById.value.get(n.id) ?? EMPTY_TEXT_STATIC),
  })),
)

const vertexById = computed(() => {
  const map = new Map<string, NodeLayout>()
  for (const n of renderedNodes.value) map.set(n.id, n)
  for (const b of renderedBarriers.value) map.set(b.id, b)
  for (const t of renderedTexts.value) map.set(t.id, t)
  return map
})

const vertexPos = computed(() => {
  const map = new Map<string, { cx: number; cy: number }>()
  for (const v of vertexById.value.values()) map.set(v.id, { cx: v.cx, cy: v.cy })
  return map
})

const dependentsByVertex = computed(() => {
  const map = new Map<string, string[]>()
  const push = (from: string, to: string) => {
    const list = map.get(from) ?? []
    list.push(to)
    map.set(from, list)
  }
  for (const d of props.difficulties) {
    for (const p of prereqIds(d.prerequisites)) push(p, d.id)
  }
  for (const b of props.barriers) {
    for (const p of prereqIds(b.prerequisites)) push(p, b.id)
  }
  return map
})

const hoverBarrierId = ref<string | null>(null)

function onBarrierHover(id: string | null) {
  hoverBarrierId.value = id
  hoverNodeId.value = id
  emit('hover', id)
}

const labelLayout = computed(() =>
  computeLabelPlacements(
    renderedNodes.value.map((n) => {
      const d = difficultyById.value.get(n.id)
      return {
        id: n.id,
        cx: n.cx,
        cy: n.cy,
        size: resolveSize(d?.size, props.unit),
        text: d?.songName ?? '',
      }
    }),
  ),
)

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
  color: string | null
}

interface CheckpointLabel {
  key: string
  label: string
  color: string
  fontSize: number
  x: number
  y: number
  anchor: 'middle' | 'start' | 'end'
}

const checkpointLabels = computed<CheckpointLabel[]>(() => {
  const groups = new Map<
    string,
    { nodes: NodeLayout[]; color: string | null; size: number | null; label: string; position: string }
  >()
  for (const d of props.difficulties) {
    if (!d.checkpointLabel) continue
    const node = nodeById.value.get(d.id)
    if (!node) continue
    const key = d.checkpointLabel
    const existing = groups.get(key)
    if (existing) {
      existing.nodes.push(node)
      if (!existing.color && d.checkpointColor) existing.color = d.checkpointColor
      if (!existing.size && d.checkpointSize) existing.size = d.checkpointSize
      if (!existing.position && d.checkpointLabelPosition) existing.position = d.checkpointLabelPosition
    } else {
      groups.set(key, {
        nodes: [node],
        color: d.checkpointColor,
        size: d.checkpointSize,
        label: d.checkpointLabel,
        position: d.checkpointLabelPosition ?? '',
      })
    }
  }
  const out: CheckpointLabel[] = []
  for (const [key, g] of groups) {
    if (g.position === 'NONE') continue
    const xs = g.nodes.map((n) => n.cx)
    const ys = g.nodes.map((n) => n.cy)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const midX = (minX + maxX) / 2
    const midY = (Math.min(...ys) + Math.max(...ys)) / 2
    const sizeOf = (n: NodeLayout) =>
      resolveSize(difficultyById.value.get(n.id)?.size, props.unit)
    const topNode = g.nodes.reduce((a, b) => (b.cy < a.cy ? b : a))
    const bottomNode = g.nodes.reduce((a, b) => (b.cy > a.cy ? b : a))
    const leftNode = g.nodes.reduce((a, b) => (b.cx < a.cx ? b : a))
    const rightNode = g.nodes.reduce((a, b) => (b.cx > a.cx ? b : a))
    const color = g.color || 'var(--accent-overall)'
    const fontSize = resolveSize(g.size, Math.max(props.unit * 0.34, 14))
    let x = midX
    let y = topNode.cy - (sizeOf(topNode) * 1.3 + props.unit * 0.7)
    let anchor: 'middle' | 'start' | 'end' = 'middle'
    if (g.position === 'DOWN') {
      y = bottomNode.cy + (sizeOf(bottomNode) * 1.3 + props.unit * 0.7)
    } else if (g.position === 'LEFT') {
      x = minX - (sizeOf(leftNode) * 1.15 + props.unit * 0.4)
      y = midY + fontSize * 0.34
      anchor = 'end'
    } else if (g.position === 'RIGHT') {
      x = maxX + (sizeOf(rightNode) * 1.15 + props.unit * 0.4)
      y = midY + fontSize * 0.34
      anchor = 'start'
    }
    out.push({ key, label: g.label, color, fontSize, x, y, anchor })
  }
  return out
})

const barrierCheckpointLabels = computed<CheckpointLabel[]>(() => {
  const out: CheckpointLabel[] = []
  for (const b of props.barriers) {
    if (!b.checkpointLabel) continue
    const position = b.checkpointLabelPosition ?? ''
    if (position === 'NONE') continue
    const node = barrierById.value.get(b.id)
    if (!node) continue
    const size = resolveSize(b.size, props.unit)
    const color = b.checkpointColor || 'var(--warning)'
    const fontSize = resolveSize(b.checkpointSize, Math.max(props.unit * 0.3, 13))
    const gap = size * 1.2 + props.unit * 0.5
    let x = node.cx
    let y = node.cy - gap
    let anchor: 'middle' | 'start' | 'end' = 'middle'
    if (position === 'DOWN') {
      y = node.cy + gap
    } else if (position === 'LEFT') {
      x = node.cx - gap
      y = node.cy + fontSize * 0.34
      anchor = 'end'
    } else if (position === 'RIGHT') {
      x = node.cx + gap
      y = node.cy + fontSize * 0.34
      anchor = 'start'
    }
    out.push({ key: `barrier-${b.id}`, label: b.checkpointLabel, color, fontSize, x, y, anchor })
  }
  return out
})

interface NodeFootprint {
  shape: CampaignNodeShape
  outerSize: number
}

function nodeFootprint(d: CampaignDifficultyResponse): NodeFootprint {
  const size = resolveSize(d.size, props.unit)
  const accentBand = Math.max(size * 0.07, 3)
  return {
    shape: resolveShape(d.borderShape),
    outerSize: size + accentBand,
  }
}

const barrierEdgeRadius = computed(() => Math.max(props.unit * 0.16, 9))

function vertexFootprint(id: string): NodeFootprint | null {
  if (barrierMetaById.value.has(id)) {
    return { shape: 'circle', outerSize: barrierEdgeRadius.value }
  }
  const d = difficultyById.value.get(id)
  return d ? nodeFootprint(d) : null
}

function vertexCompleted(id: string): boolean {
  const bp = barrierProgressById.value.get(id)
  if (bp) return bp.satisfied
  return !!progressById.value.get(id)?.completed
}

function vertexUnlocked(id: string): boolean {
  const bp = barrierProgressById.value.get(id)
  if (bp) return bp.unlocked
  return !!progressById.value.get(id)?.unlocked
}

interface EdgePrereq {
  fromId: string
  color: string | null
}

const edgeTargets = computed<{ id: string; prereqs: EdgePrereq[] }[]>(() => {
  const toEdgePrereqs = (list: { comesFromCampaignDifficultyId: string; color: string | null }[]) =>
    list.map((p) => ({
      fromId: p.comesFromCampaignDifficultyId,
      color: resolveConnectionColor(p.color),
    }))
  const list: { id: string; prereqs: EdgePrereq[] }[] = []
  for (const d of props.difficulties) {
    list.push({ id: d.id, prereqs: toEdgePrereqs(d.prerequisites ?? []) })
  }
  for (const b of props.barriers) {
    list.push({ id: b.id, prereqs: toEdgePrereqs(b.prerequisites ?? []) })
  }
  return list
})

const edges = computed<Edge[]>(() => {
  const out: Edge[] = []
  for (const t of edgeTargets.value) {
    const to = vertexPos.value.get(t.id)
    const toFp = vertexFootprint(t.id)
    if (!to || !toFp) continue
    for (const { fromId, color } of t.prereqs) {
      const from = vertexPos.value.get(fromId)
      const fromFp = vertexFootprint(fromId)
      if (!from || !fromFp) continue
      const a = edgePointOnShape(fromFp.shape, fromFp.outerSize, from.cx, from.cy, to.cx, to.cy)
      const b = edgePointOnShape(toFp.shape, toFp.outerSize, to.cx, to.cy, from.cx, from.cy)
      const fromDone = vertexCompleted(fromId)
      const toDone = vertexCompleted(t.id)
      const cleared = fromDone && toDone
      const available = fromDone && vertexUnlocked(t.id) && !toDone
      const locked = !fromDone
      out.push({
        fromId,
        toId: t.id,
        fromX: a.x,
        fromY: a.y,
        toX: b.x,
        toY: b.y,
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
        cleared,
        available,
        locked,
        toSize: toFp.outerSize,
        color,
      })
    }
  }
  return out
})

function edgeStroke(e: Edge): string {
  if (e.color) return e.color
  return e.cleared ? '#ffffff' : e.available ? 'var(--text-secondary)' : 'var(--text-tertiary)'
}

function isSelectedEdge(e: { fromId: string; toId: string }): boolean {
  const sel = props.selectedEdge
  return !!sel && sel.fromId === e.fromId && sel.toId === e.toId
}

interface BarrierGeom {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  readoutText: string
  accent: string
  state: 'plain' | 'locked' | 'blocking' | 'open'
}

function centroidOf(pts: { cx: number; cy: number }[]): { cx: number; cy: number } {
  return {
    cx: pts.reduce((s, p) => s + p.cx, 0) / pts.length,
    cy: pts.reduce((s, p) => s + p.cy, 0) / pts.length,
  }
}

const barrierGeometry = computed<BarrierGeom[]>(() => {
  const out: BarrierGeom[] = []
  for (const b of props.barriers) {
    const center = barrierById.value.get(b.id)
    if (!center) continue
    const incoming = prereqIds(b.prerequisites)
      .map((id) => vertexPos.value.get(id))
      .filter((p): p is { cx: number; cy: number } => !!p)
    const outgoing = (dependentsByVertex.value.get(b.id) ?? [])
      .map((id) => vertexPos.value.get(id))
      .filter((p): p is { cx: number; cy: number } => !!p)
    let dx = 0
    let dy = 1
    if (incoming.length && outgoing.length) {
      const i = centroidOf(incoming)
      const o = centroidOf(outgoing)
      dx = o.cx - i.cx
      dy = o.cy - i.cy
    } else if (incoming.length) {
      const i = centroidOf(incoming)
      dx = center.cx - i.cx
      dy = center.cy - i.cy
    } else if (outgoing.length) {
      const o = centroidOf(outgoing)
      dx = o.cx - center.cx
      dy = o.cy - center.cy
    }
    const len = Math.hypot(dx, dy) || 1
    const fx = dx / len
    const fy = dy / len
    const wx = -fy
    const wy = fx
    const half = (Math.max(resolveSize(b.size, props.unit), props.unit) * 1.7) / 2
    let ax = center.cx - wx * half
    let ay = center.cy - wy * half
    let bx = center.cx + wx * half
    let by = center.cy + wy * half
    if (ay < by || (ay === by && ax > bx)) {
      ;[ax, bx] = [bx, ax]
      ;[ay, by] = [by, ay]
    }
    const prog = barrierProgressById.value.get(b.id)
    let state: BarrierGeom['state'] = 'plain'
    if (prog) {
      if (!prog.unlocked) state = 'locked'
      else if (prog.satisfied) state = 'open'
      else state = 'blocking'
    }
    const label = barrierConditionLabel(b.conditionType)
    const isFc = b.conditionType === 'FC' || b.conditionType === 'PASS'
    const goal = barrierPairValue(b.conditionType, b.conditionValue)
    let readoutText: string
    if (isFc) {
      readoutText = label
    } else if (state === 'blocking') {
      readoutText = `${label}: ${barrierPairValue(b.conditionType, prog?.currentValue ?? null)}/${goal}`
    } else {
      readoutText = `${label}: ${goal}`
    }
    out.push({
      id: b.id,
      x1: ax,
      y1: ay,
      x2: bx,
      y2: by,
      readoutText,
      accent: b.borderColor || props.barrierAccent,
      state,
    })
  }
  return out
})

const highlightedBarrierId = computed(() => hoverBarrierId.value ?? props.highlightBarrierId)

const affectedHighlight = computed(() => {
  const id = highlightedBarrierId.value
  if (!id) return null
  const meta = barrierMetaById.value.get(id)
  const center = barrierById.value.get(id)
  if (!meta || !center) return null
  const nodes = (meta.affectedCampaignDifficultyIds ?? [])
    .map((nid) => {
      const n = nodeById.value.get(nid)
      if (!n) return null
      const size = resolveSize(difficultyById.value.get(nid)?.size, props.unit)
      return { id: n.id, cx: n.cx, cy: n.cy, r: size + Math.max(size * 0.07, 3) + 6 }
    })
    .filter((n): n is { id: string; cx: number; cy: number; r: number } => !!n)
  if (nodes.length === 0) return null
  return { cx: center.cx, cy: center.cy, nodes }
})

const contentBounds = computed(() => {
  const pts = [...layout.value.nodes, ...barrierLayout.value.nodes, ...textLayout.value.nodes]
  const margin = props.unit * 2
  if (pts.length === 0) {
    return { x: -margin, y: -margin, width: margin * 2, height: margin * 2 + props.unit }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    if (p.cx < minX) minX = p.cx
    if (p.cy < minY) minY = p.cy
    if (p.cx > maxX) maxX = p.cx
    if (p.cy > maxY) maxY = p.cy
  }
  return {
    x: minX - margin,
    y: minY - margin,
    width: maxX - minX + margin * 2,
    height: maxY - minY + margin * 2 + props.unit,
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
  const maxTx = stageWidth.value - b.x * scale.value - padX
  const minTy = -(b.y + b.height) * scale.value + padY
  const maxTy = stageHeight.value - b.y * scale.value - padY
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
let groupDragStart: Map<string, { cx: number; cy: number }> | null = null
let marqueeStart: { x: number; y: number; additive: boolean } | null = null
const marquee = ref<{ x0: number; y0: number; x1: number; y1: number } | null>(null)

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

function edgeAtPoint(clientX: number, clientY: number): { fromId: string; toId: string } | null {
  if (typeof document === 'undefined') return null
  const hit = document.elementFromPoint(clientX, clientY)
  const line = hit?.closest('.campaign-roadmap__edge-hit') as SVGElement | null
  const fromId = line?.dataset.edgeFrom
  const toId = line?.dataset.edgeTo
  return fromId && toId ? { fromId, toId } : null
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
  if (props.barrierPlacement && target?.closest?.('.campaign-roadmap__edge-hit')) return
  const nodeId = nodeIdFromEvent(e.target)
  const node = nodeId ? vertexById.value.get(nodeId) : null
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

  if (props.editable && props.mode === 'select') {
    if (nodeId) {
      if (selectedSet.value.has(nodeId) && props.selectedIds.length > 1) {
        groupDragStart = new Map()
        for (const id of props.selectedIds) {
          const gn = vertexById.value.get(id)
          if (gn) groupDragStart.set(id, { cx: gn.cx, cy: gn.cy })
        }
      } else {
        groupDragStart = null
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
      return
    }
    const p = clientToContent(e.clientX, e.clientY)
    marqueeStart = { x: p.x, y: p.y, additive: e.shiftKey }
    marquee.value = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }
    dragStart = {
      x: e.clientX,
      y: e.clientY,
      tx: translateX.value,
      ty: translateY.value,
      nodeId: null,
      startCx: 0,
      startCy: 0,
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

function presenceKindOf(id: string): PresenceKind {
  if (barrierMetaById.value.has(id)) return 'barrier'
  if (textStaticById.value.has(id)) return 'text'
  return 'node'
}

let lastPresence = { x: 0, y: 0, has: false }

function emitPresence(x: number, y: number) {
  if (!props.editable) return
  lastPresence = { x, y, has: true }
  let action: PresenceAction = 'move'
  let targetId: string | null = null
  if (props.barrierPlacement) {
    action = 'place'
  } else if (connectFromId.value) {
    action = 'connect'
    targetId = connectHoverId.value ?? connectFromId.value
  } else if (draggingNodeId.value) {
    action = 'drag'
    targetId = draggingNodeId.value
  } else if (marqueeStart) {
    action = 'select'
  } else if (hoverNodeId.value) {
    action = 'select'
    targetId = hoverNodeId.value
  } else if (props.selectedId) {
    action = 'edit'
    targetId = props.selectedId
  }
  emit('cursormove', {
    x,
    y,
    action,
    targetId,
    kind: targetId ? presenceKindOf(targetId) : null,
    tray: props.activeTray ?? null,
  })
}

function trackPresence(e: PointerEvent) {
  if (!props.editable) return
  const p = clientToContent(e.clientX, e.clientY)
  emitPresence(p.x, p.y)
}

function onPointerLeave() {
  if (!props.editable) return
  lastPresence.has = false
  emit('cursoroff')
}

watch(
  [
    draggingNodeId,
    connectFromId,
    () => props.barrierPlacement,
    () => props.selectedId,
    () => props.activeTray,
  ],
  () => {
  if (lastPresence.has) emitPresence(lastPresence.x, lastPresence.y)
})

const cursorDisplay = ref(new Map<string, { x: number; y: number }>())
let cursorRaf: number | null = null

function tickCursors() {
  const disp = cursorDisplay.value
  const alive = new Set<string>()
  let changed = false
  for (const peer of props.presencePeers) {
    if (peer.x == null || peer.y == null) continue
    alive.add(peer.userId)
    const cur = disp.get(peer.userId)
    if (!cur) {
      disp.set(peer.userId, { x: peer.x, y: peer.y })
      changed = true
    } else {
      const nx = cur.x + (peer.x - cur.x) * 0.28
      const ny = cur.y + (peer.y - cur.y) * 0.28
      if (Math.abs(nx - cur.x) > 0.02 || Math.abs(ny - cur.y) > 0.02) {
        cur.x = nx
        cur.y = ny
        changed = true
      }
    }
  }
  for (const id of [...disp.keys()]) {
    if (!alive.has(id)) {
      disp.delete(id)
      changed = true
    }
  }
  if (changed) cursorDisplay.value = new Map(disp)

  const drag = new Map(remoteDragById.value)
  let dragChanged = false
  for (const peer of props.presencePeers) {
    if (peer.action === 'drag' && peer.targetId && peer.x != null && peer.y != null) {
      const d = disp.get(peer.userId)
      if (!d) continue
      const prev = drag.get(peer.targetId)
      if (!prev || prev.cx !== d.x || prev.cy !== d.y) {
        drag.set(peer.targetId, { cx: d.x, cy: d.y, color: peer.color })
        dragChanged = true
      }
    }
  }
  if (dragChanged) remoteDragById.value = drag

  cursorRaf = requestAnimationFrame(tickCursors)
}

watch(
  () => [props.difficulties, props.barriers, props.texts],
  () => {
    if (remoteDragById.value.size) remoteDragById.value = new Map()
  },
)

function startCursorLoop() {
  if (cursorRaf == null) cursorRaf = requestAnimationFrame(tickCursors)
}

function stopCursorLoop() {
  if (cursorRaf != null) {
    cancelAnimationFrame(cursorRaf)
    cursorRaf = null
  }
}

watch(
  () => props.presencePeers.length,
  (n) => {
    if (n > 0) startCursorLoop()
    else {
      stopCursorLoop()
      if (cursorDisplay.value.size) cursorDisplay.value = new Map()
      if (remoteDragById.value.size) remoteDragById.value = new Map()
    }
  },
  { immediate: true },
)

onUnmounted(stopCursorLoop)

const renderedCursors = computed(() => {
  const disp = cursorDisplay.value
  const out: Array<{ peer: PresencePeer; x: number; y: number }> = []
  for (const peer of props.presencePeers) {
    const d = disp.get(peer.userId)
    if (d) out.push({ peer, x: d.x, y: d.y })
  }
  return out
})

const remoteConnects = computed(() => {
  const disp = cursorDisplay.value
  const out: Array<{ key: string; x1: number; y1: number; x2: number; y2: number; color: string }> =
    []
  for (const peer of props.presencePeers) {
    if (peer.action !== 'connect' || !peer.targetId) continue
    const from = vertexById.value.get(peer.targetId)
    const to = disp.get(peer.userId)
    if (from && to) {
      out.push({ key: peer.userId, x1: from.cx, y1: from.cy, x2: to.x, y2: to.y, color: peer.color })
    }
  }
  return out
})

const remoteRings = computed(() => {
  const out: Array<{ key: string; cx: number; cy: number; color: string }> = []
  for (const peer of props.presencePeers) {
    if (!peer.targetId || peer.action === 'move') continue
    const v = vertexById.value.get(peer.targetId)
    if (v) out.push({ key: `${peer.userId}:${peer.targetId}`, cx: v.cx, cy: v.cy, color: peer.color })
  }
  return out
})

function onPointerMove(e: PointerEvent) {
  trackPresence(e)
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
  if (marqueeStart) {
    const p = clientToContent(e.clientX, e.clientY)
    marquee.value = {
      x0: Math.min(marqueeStart.x, p.x),
      y0: Math.min(marqueeStart.y, p.y),
      x1: Math.max(marqueeStart.x, p.x),
      y1: Math.max(marqueeStart.y, p.y),
    }
    return
  }
  if (dragStart.nodeId && props.editable && groupDragStart) {
    if (!dragStart.moved) return
    const ratio = 1 / scale.value
    const ddx = dx * ratio
    const ddy = dy * ratio
    for (const [id, start] of groupDragStart) {
      dragOverlay.value.set(id, { cx: start.cx + ddx, cy: start.cy + ddy })
    }
    dragOverlay.value = new Map(dragOverlay.value)
    draggingNodeId.value = dragStart.nodeId
    return
  }
  if (dragStart.nodeId && props.editable && (props.mode === 'drag' || props.mode === 'select')) {
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

function settleOverlay(
  nodeId: string,
  from: { cx: number; cy: number },
  to: { cx: number; cy: number },
) {
  const reduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
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
    const targetNodeId =
      connectHoverId.value ?? nodeIdAtPoint(e.clientX, e.clientY) ?? nodeIdFromEvent(e.target)
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

  if (marqueeStart) {
    const rect = marquee.value
    const additive = marqueeStart.additive
    marquee.value = null
    marqueeStart = null
    dragStart = null
    if (moved) suppressClick = true
    if (moved && rect) {
      const inside = [
        ...renderedNodes.value,
        ...renderedBarriers.value,
        ...renderedTexts.value,
      ]
        .filter((n) => n.cx >= rect.x0 && n.cx <= rect.x1 && n.cy >= rect.y0 && n.cy <= rect.y1)
        .map((n) => n.id)
      const ids = additive ? Array.from(new Set([...props.selectedIds, ...inside])) : inside
      emit('selectMany', ids)
    } else if (!additive) {
      const edge = edgeAtPoint(e.clientX, e.clientY)
      if (edge) emit('edgeSelect', edge)
      else emit('selectMany', [])
    }
    return
  }

  if (nodeId && props.editable && groupDragStart && moved) {
    const draggedFinal = dragOverlay.value.get(nodeId)
    const start = groupDragStart.get(nodeId)
    if (draggedFinal && start) {
      const { positionX, positionY } = contentToGrid(draggedFinal.cx, draggedFinal.cy)
      const snapCx = positionX * props.unit * 1.5
      const snapCy =
        positionY * props.unit * SQRT3 + (positionX % 2 !== 0 ? (props.unit * SQRT3) / 2 : 0)
      const shiftX = snapCx - start.cx
      const shiftY = snapCy - start.cy
      const payloads: Array<{ id: string; positionX: number; positionY: number }> = []
      for (const [id, st] of groupDragStart) {
        const targetCx = st.cx + shiftX
        const targetCy = st.cy + shiftY
        const grid = contentToGrid(targetCx, targetCy)
        payloads.push({ id, positionX: grid.positionX, positionY: grid.positionY })
        const settledCx = grid.positionX * props.unit * 1.5
        const settledCy =
          grid.positionY * props.unit * SQRT3 +
          (grid.positionX % 2 !== 0 ? (props.unit * SQRT3) / 2 : 0)
        settleOverlay(id, dragOverlay.value.get(id) ?? { cx: targetCx, cy: targetCy }, {
          cx: settledCx,
          cy: settledCy,
        })
      }
      emit('moveMany', payloads)
    } else {
      draggingNodeId.value = null
    }
    groupDragStart = null
    suppressClick = true
    dragStart = null
    return
  }

  if (nodeId && props.editable && (props.mode === 'drag' || props.mode === 'select') && moved) {
    const final = dragOverlay.value.get(nodeId)
    if (final) {
      const { positionX, positionY } = contentToGrid(final.cx, final.cy)
      const snapCx = positionX * props.unit * 1.5
      const snapCy =
        positionY * props.unit * SQRT3 + (positionX % 2 !== 0 ? (props.unit * SQRT3) / 2 : 0)
      emit('move', { id: nodeId, positionX, positionY })
      settleOverlay(nodeId, final, { cx: snapCx, cy: snapCy })
    } else {
      draggingNodeId.value = null
    }
    groupDragStart = null
    suppressClick = true
    dragStart = null
    return
  }

  if (nodeId && !moved) {
    if (props.mode === 'select' && e.shiftKey) {
      emit('toggleSelect', nodeId)
    } else {
      emit('select', nodeId)
    }
    groupDragStart = null
    suppressClick = true
    dragStart = null
    return
  }

  if (!nodeId && !moved) {
    if (props.editable) {
      const edge = props.barrierPlacement ? null : edgeAtPoint(e.clientX, e.clientY)
      if (edge) {
        emit('edgeSelect', edge)
      } else {
        const content = clientToContent(e.clientX, e.clientY)
        emit('emptyClick', content)
      }
    } else {
      emit('deselect')
    }
  }
  groupDragStart = null
  dragStart = null
}

function onNodeClickCapture(e: MouseEvent) {
  if (suppressClick) {
    e.stopPropagation()
    e.preventDefault()
    suppressClick = false
  }
}

function onEdgeClick(edge: { fromId: string; toId: string }) {
  if (props.barrierPlacement) emit('placeBarrier', { fromId: edge.fromId, toId: edge.toId })
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
  const n = vertexById.value.get(id)
  if (!n || !stage.value) return
  const s = targetScale ?? Math.max(scale.value, props.defaultScale)
  const clamped = Math.max(minScale, Math.min(maxScale, s))
  translateX.value = stageWidth.value / 2 - n.cx * clamped
  translateY.value = stageHeight.value / 2 - n.cy * clamped
  scale.value = clamped
  clampPan()
}

const canRecenter = computed(() => !!props.focusId && vertexById.value.has(props.focusId))

function recenter() {
  if (props.focusId && vertexById.value.has(props.focusId)) {
    focusNode(props.focusId, props.defaultScale)
  } else {
    fitToContent()
  }
}

function initialPosition() {
  if (!stage.value) return
  stageWidth.value = stage.value.clientWidth
  stageHeight.value = stage.value.clientHeight
  recenter()
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

let knownVertexIds = new Set<string>()

watch(
  () => [props.difficulties, props.barriers, props.texts] as const,
  ([diffs, barrs, txts]) => {
    const nextIds = new Set<string>()
    for (const d of diffs) nextIds.add(d.id)
    for (const b of barrs) nextIds.add(b.id)
    for (const t of txts) nextIds.add(t.id)
    const hadContent = knownVertexIds.size > 0
    let overlaps = false
    for (const id of nextIds) {
      if (knownVertexIds.has(id)) {
        overlaps = true
        break
      }
    }
    knownVertexIds = nextIds
    if (nextIds.size === 0) return
    if (!hadContent || !overlaps) initialPosition()
  },
  { immediate: true },
)

watch(
  () => props.focusId,
  (id) => {
    if (id && didInitialPosition && props.followFocus) focusNode(id)
  },
)

function getViewCenterCell(): { x: number; y: number } {
  const cx = (stageWidth.value / 2 - translateX.value) / scale.value
  const cy = (stageHeight.value / 2 - translateY.value) / scale.value
  const { positionX, positionY } = contentToGrid(cx, cy)
  return { x: positionX, y: positionY }
}

defineExpose({ fitToContent, focusNode, getViewCenterCell })

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
  const isBarrier = !diff && barrierMetaById.value.has(id)
  const isText = !diff && !isBarrier && textStaticById.value.has(id)
  if (!diff && !isBarrier && !isText) return null
  const { positionX, positionY } = contentToGrid(overlay.cx, overlay.cy)
  const cx = positionX * props.unit * 1.5
  const cy = positionY * props.unit * SQRT3 + (positionX % 2 !== 0 ? (props.unit * SQRT3) / 2 : 0)
  if (isText) {
    return { cx, cy, shape: 'circle', size: Math.max(props.unit * 0.45, 12) }
  }
  if (!diff) {
    return { cx, cy, shape: 'circle', size: barrierEdgeRadius.value }
  }
  return {
    cx,
    cy,
    shape: resolveShape(diff.borderShape),
    size: resolveSize(diff.size, props.unit),
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
  <div
    ref="stage"
    class="campaign-roadmap"
    :class="{
      'campaign-roadmap--select': editable && mode === 'select',
      'campaign-roadmap--transparent': transparentToThemeBackdrop,
    }"
    @wheel="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @pointerleave="onPointerLeave"
  >
    <div
      v-if="backgroundUrl"
      class="campaign-roadmap__bg"
      :style="{ backgroundImage: `url(${backgroundUrl})` }"
      aria-hidden="true"
    />
    <template v-else-if="showOwnStarfield">
      <div
        class="campaign-roadmap__glow"
        :style="{ '--starfield-accent': backgroundFill }"
        aria-hidden="true"
      />
      <ParticleCanvas
        class="campaign-roadmap__particles"
        :dark-mode="themeStore.resolvedBase === 'dark'"
      />
    </template>
    <svg class="campaign-roadmap__svg" :width="stageWidth" :height="stageHeight">
      <defs>
        <pattern
          id="campaign-roadmap-grid"
          :width="unit * 1.5"
          :height="unit * SQRT3"
          patternUnits="userSpaceOnUse"
        >
          <circle :cx="0" :cy="0" r="1.2" fill="var(--bg-overlay)" />
        </pattern>
      </defs>

      <rect
        v-if="!backgroundUrl && !showStarfield"
        x="0"
        y="0"
        :width="stageWidth"
        :height="stageHeight"
        fill="url(#campaign-roadmap-grid)"
        opacity="0.4"
      />

      <g :transform="transformStyle">
        <g v-if="editable" class="campaign-roadmap__origin" aria-hidden="true">
          <line x1="-10" y1="0" x2="10" y2="0" stroke="var(--text-tertiary)" stroke-width="1" />
          <line x1="0" y1="-10" x2="0" y2="10" stroke="var(--text-tertiary)" stroke-width="1" />
          <circle cx="0" cy="0" r="3" fill="none" stroke="var(--text-tertiary)" stroke-width="1" />
          <text
            x="14"
            y="14"
            font-size="11"
            fill="var(--text-tertiary)"
            font-family="var(--font-mono)"
          >
            0,0
          </text>
        </g>

        <g
          class="campaign-roadmap__edges"
          :class="{
            'campaign-roadmap__edges--place': barrierPlacement,
            'campaign-roadmap__edges--interactive': editable && !barrierPlacement,
          }"
        >
          <g
            v-for="e in arrowDecorations"
            :key="`edge-${e.fromId}-${e.toId}`"
            class="campaign-roadmap__edge-group"
            :class="{
              'campaign-roadmap__edge-group--highlight':
                hoverNodeId === e.fromId || hoverNodeId === e.toId,
              'campaign-roadmap__edge-group--placeable': barrierPlacement,
              'campaign-roadmap__edge-group--selected': isSelectedEdge(e),
            }"
            :style="{ '--edge-hl': e.color ?? '#ffffff' }"
          >
            <line
              class="campaign-roadmap__edge-hit"
              :data-edge-from="e.fromId"
              :data-edge-to="e.toId"
              :x1="e.fromX"
              :y1="e.fromY"
              :x2="e.toX"
              :y2="e.toY"
              stroke="transparent"
              :stroke-width="barrierPlacement ? Math.max(unit * 0.9, 40) : Math.max(unit * 0.3, 14)"
              @click.stop="onEdgeClick(e)"
            />
            <line
              class="campaign-roadmap__edge-line"
              :x1="e.fromX"
              :y1="e.fromY"
              :x2="e.toX"
              :y2="e.toY"
              :stroke="edgeStroke(e)"
              :stroke-width="e.cleared ? 2 : 1.25"
              :stroke-dasharray="e.locked ? `${unit * 0.12} ${unit * 0.1}` : undefined"
              :opacity="e.cleared ? 0.95 : e.available ? 0.85 : e.color ? 0.6 : 0.45"
            />
            <polygon
              class="campaign-roadmap__edge-arrow"
              :points="e.arrowPoints"
              :fill="e.cleared || e.available ? edgeStroke(e) : 'transparent'"
              :stroke="edgeStroke(e)"
              stroke-width="1"
              :opacity="e.cleared ? 0.95 : e.available ? 0.85 : e.color ? 0.55 : 0.4"
            />
            <g
              v-if="editable && !barrierPlacement"
              class="campaign-roadmap__edge-x"
              :transform="`translate(${e.midX}, ${e.midY})`"
              @click.stop="emit('disconnect', { fromId: e.fromId, toId: e.toId })"
            >
              <circle r="10" fill="var(--bg-base)" stroke="var(--error)" stroke-width="1.5" />
              <path
                d="M-4 -4L4 4M-4 4L4 -4"
                stroke="var(--error)"
                stroke-width="2"
                stroke-linecap="round"
                fill="none"
              />
            </g>
          </g>
        </g>

        <g
          v-if="snapTarget"
          class="campaign-roadmap__snap"
          aria-hidden="true"
          :style="{ transform: `translate(${snapTarget.cx}px, ${snapTarget.cy}px)` }"
        >
          <circle v-if="snapTarget.shape === 'circle'" :r="snapTarget.size * 1.04" />
          <polygon v-else :points="snapShapePoints" />
        </g>

        <g
          v-if="connectFromId && connectPoint && vertexById.get(connectFromId)"
          class="campaign-roadmap__connecting"
          aria-hidden="true"
        >
          <line
            :x1="vertexById.get(connectFromId)!.cx"
            :y1="vertexById.get(connectFromId)!.cy"
            :x2="connectPoint.x"
            :y2="connectPoint.y"
            stroke="var(--accent)"
            stroke-width="2"
            stroke-dasharray="6 4"
          />
        </g>

        <rect
          v-if="marquee"
          class="campaign-roadmap__marquee"
          :x="marquee.x0"
          :y="marquee.y0"
          :width="marquee.x1 - marquee.x0"
          :height="marquee.y1 - marquee.y0"
          aria-hidden="true"
        />

        <g
          v-for="n in renderedNodes"
          :key="n.id"
          data-node
          :data-id="n.id"
          :class="{
            'campaign-roadmap__node--editable': editable,
            'campaign-roadmap__node--connect-target': connectHoverId === n.id,
          }"
          @mouseenter="onNodeHover(n.id)"
          @mouseleave="onNodeHover(null)"
          @click.capture="onNodeClickCapture"
        >
          <CampaignNode
            :difficulty="difficulties.find((d) => d.id === n.id)!"
            :progress="progressById.get(n.id) ?? null"
            :cx="n.cx"
            :cy="n.cy"
            :size="unit"
            :accent-color="nodeAccentFor(n.id)"
            :selected="selectedSet.has(n.id)"
            :is-next="nextIds.has(n.id)"
            :label-placement="labelLayout.get(n.id) ?? null"
            @select="emit('select', $event)"
          />
          <g
            v-if="missingRewardIds.has(n.id)"
            class="campaign-roadmap__reward-warn"
            :transform="`translate(${n.cx + nodeSizeFor(n.id) * 0.72}, ${n.cy - nodeSizeFor(n.id) * 0.72})`"
            aria-hidden="true"
          >
            <title>This node has no rewards set - 0 XP and no items.</title>
            <circle class="campaign-roadmap__reward-warn-bg" :r="Math.max(unit * 0.13, 7)" />
            <path
              class="campaign-roadmap__reward-warn-mark"
              :d="`M0 ${-unit * 0.06} V ${unit * 0.02} M0 ${unit * 0.055} v0.01`"
              :stroke-width="Math.max(unit * 0.03, 1.7)"
            />
          </g>
        </g>

        <g v-if="affectedHighlight" class="campaign-roadmap__affected" aria-hidden="true">
          <line
            v-for="n in affectedHighlight.nodes"
            :key="`tether-${n.id}`"
            class="campaign-roadmap__tether"
            :x1="affectedHighlight.cx"
            :y1="affectedHighlight.cy"
            :x2="n.cx"
            :y2="n.cy"
          />
          <circle
            v-for="n in affectedHighlight.nodes"
            :key="`aff-${n.id}`"
            class="campaign-roadmap__affected-ring"
            :cx="n.cx"
            :cy="n.cy"
            :r="n.r"
          />
        </g>

        <g
          v-for="bg in barrierGeometry"
          :key="`barrier-${bg.id}`"
          data-node
          :data-id="bg.id"
          :class="{ 'campaign-roadmap__node--editable': editable }"
          @mouseenter="onBarrierHover(bg.id)"
          @mouseleave="onBarrierHover(null)"
          @click.capture="onNodeClickCapture"
        >
          <CampaignBarrierGate
            :x1="bg.x1"
            :y1="bg.y1"
            :x2="bg.x2"
            :y2="bg.y2"
            :readout-text="bg.readoutText"
            :accent-color="bg.accent"
            :state="bg.state"
            :selected="selectedSet.has(bg.id)"
            :unit="unit"
          />
        </g>

        <g
          v-for="t in renderedTextEls"
          :key="`text-${t.id}`"
          :data-node="editable ? '' : null"
          :data-id="t.id"
          :class="{ 'campaign-roadmap__node--editable': editable }"
          @mouseenter="editable ? onNodeHover(t.id) : undefined"
          @mouseleave="editable ? onNodeHover(null) : undefined"
          @click.capture="onNodeClickCapture"
        >
          <foreignObject
            class="campaign-roadmap__text-fo"
            :x="t.cx - t.width / 2"
            :y="t.cy - t.height / 2"
            :width="t.width"
            :height="t.height"
          >
            <div class="campaign-roadmap__text-wrap" xmlns="http://www.w3.org/1999/xhtml">
              <div
                class="campaign-roadmap__text"
                :class="[
                  t.effectClass,
                  {
                    'campaign-roadmap__text--editable': editable,
                    'campaign-roadmap__text--selected': selectedSet.has(t.id),
                  },
                ]"
                :style="{ fontSize: t.fontSize + 'px', color: t.color, fontFamily: t.fontFamily }"
                v-html="t.html"
              />
            </div>
          </foreignObject>
        </g>

        <g class="campaign-roadmap__checkpoints">
          <text
            v-for="cp in checkpointLabels"
            :key="cp.key"
            :x="cp.x"
            :y="cp.y"
            :font-size="cp.fontSize"
            :text-anchor="cp.anchor"
            class="campaign-roadmap__checkpoint-text"
            :style="{ fill: cp.color, '--checkpoint-color': cp.color }"
          >
            {{ cp.label }}
          </text>
          <text
            v-for="cp in barrierCheckpointLabels"
            :key="cp.key"
            :x="cp.x"
            :y="cp.y"
            :font-size="cp.fontSize"
            :text-anchor="cp.anchor"
            class="campaign-roadmap__checkpoint-text"
            :style="{ fill: cp.color, '--checkpoint-color': cp.color }"
          >
            {{ cp.label }}
          </text>
        </g>

        <g v-if="editable" class="campaign-roadmap__presence-fx">
          <line
            v-for="c in remoteConnects"
            :key="`rconn-${c.key}`"
            :x1="c.x1"
            :y1="c.y1"
            :x2="c.x2"
            :y2="c.y2"
            :stroke="c.color"
            stroke-width="2"
            stroke-dasharray="6 4"
            opacity="0.75"
          />
          <circle
            v-for="r in remoteRings"
            :key="`rring-${r.key}`"
            :cx="r.cx"
            :cy="r.cy"
            :r="unit * 0.82"
            fill="none"
            :stroke="r.color"
            stroke-width="2"
            stroke-dasharray="5 4"
            opacity="0.8"
          />
        </g>

        <g v-if="editable" class="campaign-roadmap__cursors">
          <CampaignPresenceCursor
            v-for="rc in renderedCursors"
            :key="rc.peer.userId"
            :x="rc.x"
            :y="rc.y"
            :inv-scale="1 / scale"
            :color="rc.peer.color"
            :name="rc.peer.name"
            :avatar-url="rc.peer.avatarUrl"
            :action="rc.peer.action"
            :kind="rc.peer.kind"
          />
        </g>
      </g>
    </svg>

    <div class="campaign-roadmap__bottom-stack">
      <div class="campaign-roadmap__hint" aria-hidden="true">drag · scroll to zoom</div>
      <div class="campaign-roadmap__controls" aria-label="Roadmap controls">
        <button
          type="button"
          class="campaign-roadmap__btn"
          aria-label="Zoom in"
          @click="adjustZoom(1.2)"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button
          type="button"
          class="campaign-roadmap__btn"
          aria-label="Zoom out"
          @click="adjustZoom(1 / 1.2)"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button
          type="button"
          class="campaign-roadmap__btn"
          aria-label="Fit roadmap"
          @click="fitToContent"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="4 8 4 4 8 4" />
            <polyline points="20 8 20 4 16 4" />
            <polyline points="4 16 4 20 8 20" />
            <polyline points="20 16 20 20 16 20" />
          </svg>
        </button>
        <button
          v-if="canRecenter"
          type="button"
          class="campaign-roadmap__btn"
          aria-label="Recenter on current progress"
          @click="recenter"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="7" />
            <line x1="12" y1="1.5" x2="12" y2="4.5" />
            <line x1="12" y1="19.5" x2="12" y2="22.5" />
            <line x1="1.5" y1="12" x2="4.5" y2="12" />
            <line x1="19.5" y1="12" x2="22.5" y2="12" />
            <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </div>
      <slot name="actions" />
    </div>
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

.campaign-roadmap--transparent {
  background: transparent;
}

.campaign-roadmap:active {
  cursor: grabbing;
}

.campaign-roadmap--select {
  cursor: crosshair;
}

.campaign-roadmap--select:active {
  cursor: crosshair;
}

.campaign-roadmap__marquee {
  fill: color-mix(in srgb, var(--page-accent, var(--accent)) 10%, transparent);
  stroke: var(--page-accent, var(--accent));
  stroke-width: 1;
  stroke-dasharray: 5 4;
  pointer-events: none;
}

.campaign-roadmap__reward-warn {
  pointer-events: auto;
  cursor: help;
}

.campaign-roadmap__reward-warn-bg {
  fill: var(--warning);
  stroke: var(--bg-base);
  stroke-width: 1.5;
}

.campaign-roadmap__reward-warn-mark {
  stroke: var(--bg-base);
  stroke-linecap: round;
  fill: none;
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

.campaign-roadmap__edge-line,
.campaign-roadmap__edge-arrow {
  transition:
    stroke 120ms ease,
    fill 120ms ease,
    opacity 120ms ease;
}

.campaign-roadmap__edge-group--highlight .campaign-roadmap__edge-line {
  stroke: var(--edge-hl, #ffffff);
  stroke-width: 2.5;
  opacity: 1;
}

.campaign-roadmap__edge-group--highlight .campaign-roadmap__edge-arrow {
  fill: var(--edge-hl, #ffffff);
  stroke: var(--edge-hl, #ffffff);
  opacity: 1;
}

.campaign-roadmap__edges--place .campaign-roadmap__edge-hit {
  cursor: pointer;
}

.campaign-roadmap__edges--interactive .campaign-roadmap__edge-hit {
  cursor: pointer;
}

.campaign-roadmap__edges--interactive .campaign-roadmap__edge-group:hover .campaign-roadmap__edge-line {
  stroke: var(--edge-hl, #ffffff);
  stroke-width: 2.5;
  opacity: 1;
}

.campaign-roadmap__edges--interactive .campaign-roadmap__edge-group:hover .campaign-roadmap__edge-arrow {
  fill: var(--edge-hl, #ffffff);
  stroke: var(--edge-hl, #ffffff);
  opacity: 1;
}

.campaign-roadmap__edge-group--selected .campaign-roadmap__edge-hit {
  stroke: color-mix(in srgb, var(--page-accent, var(--accent)) 22%, transparent);
}

.campaign-roadmap__edge-group--selected .campaign-roadmap__edge-line {
  stroke: var(--edge-hl, #ffffff);
  stroke-width: 3;
  opacity: 1;
}

.campaign-roadmap__edge-group--selected .campaign-roadmap__edge-arrow {
  fill: var(--edge-hl, #ffffff);
  stroke: var(--edge-hl, #ffffff);
  opacity: 1;
}

.campaign-roadmap__edge-group--placeable .campaign-roadmap__edge-line {
  stroke: var(--warning);
  stroke-width: 2.5;
  opacity: 0.9;
}

.campaign-roadmap__edge-group--placeable .campaign-roadmap__edge-arrow {
  stroke: var(--warning);
  fill: var(--warning);
  opacity: 0.9;
}

.campaign-roadmap__edge-group--placeable:hover .campaign-roadmap__edge-line {
  stroke-width: 4;
  opacity: 1;
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

.campaign-roadmap__affected {
  pointer-events: none;
}

.campaign-roadmap__tether {
  stroke: color-mix(in srgb, var(--warning) 70%, transparent);
  stroke-width: 1.5;
  stroke-dasharray: 5 5;
  opacity: 0.85;
}

.campaign-roadmap__affected-ring {
  fill: none;
  stroke: var(--warning);
  stroke-width: 1.5;
  stroke-dasharray: 4 4;
  opacity: 0.85;
}

.campaign-roadmap__text-fo {
  overflow: visible;
  pointer-events: none;
}

.campaign-roadmap__text-wrap {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.campaign-roadmap__text {
  max-width: 100%;
  text-align: center;
  line-height: 1.3;
  font-weight: 600;
  pointer-events: auto;
  overflow-wrap: anywhere;
}

.campaign-roadmap__text--editable {
  cursor: grab;
  padding: 3px 8px;
  border-radius: 4px;
  transition:
    background 120ms ease,
    outline-color 120ms ease;
  outline: 1px dashed transparent;
  outline-offset: 2px;
}

.campaign-roadmap__text--editable:hover {
  background: color-mix(in srgb, var(--bg-elevated) 70%, transparent);
  outline-color: color-mix(in srgb, var(--page-accent, var(--accent)) 55%, transparent);
}

.campaign-roadmap__text--editable :deep(a) {
  pointer-events: none;
}

.campaign-roadmap__text--selected {
  outline-color: var(--page-accent, var(--accent)) !important;
  background: color-mix(in srgb, var(--bg-elevated) 80%, transparent);
}

.campaign-roadmap__text :deep(a) {
  color: var(--page-accent, var(--accent));
  text-decoration: underline;
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
  0%,
  100% {
    opacity: 0.65;
  }
  50% {
    opacity: 1;
  }
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
  filter: drop-shadow(0 0 4px color-mix(in srgb, var(--checkpoint-color) 75%, transparent))
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
    radial-gradient(
      ellipse 70% 60% at 50% 35%,
      color-mix(in srgb, var(--starfield-accent) 14%, transparent),
      transparent 70%
    ),
    radial-gradient(
      ellipse 90% 100% at 50% 110%,
      color-mix(in srgb, var(--starfield-accent) 8%, transparent),
      transparent 75%
    );
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
  transition:
    color 120ms ease,
    background 120ms ease;
}

.campaign-roadmap__btn:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.campaign-roadmap__hint {
  order: -1;
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  pointer-events: none;
}
</style>
