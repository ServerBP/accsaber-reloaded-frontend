import type { CampaignDifficultyResponse, CampaignNodeShape } from '@/types/api/campaigns'

export const SQRT3 = Math.sqrt(3)

const SHAPE_VALUES: ReadonlyArray<CampaignNodeShape> = ['hex', 'square', 'circle', 'diamond']

export function resolveShape(raw: string | null | undefined): CampaignNodeShape {
  if (!raw) return 'hex'
  const v = raw.toLowerCase()
  return (SHAPE_VALUES as readonly string[]).includes(v) ? (v as CampaignNodeShape) : 'hex'
}

export function parseNumericSize(raw: string | null | undefined, fallback: number): number {
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function hexCorners(cx: number, cy: number, size: number): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i
    const x = cx + size * Math.cos(angle)
    const y = cy + size * Math.sin(angle)
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return pts.join(' ')
}

export function shapeCorners(
  shape: CampaignNodeShape,
  cx: number,
  cy: number,
  size: number,
): string {
  if (shape === 'hex') return hexCorners(cx, cy, size)
  if (shape === 'square') {
    const s = size * 0.95
    return [
      `${(cx - s).toFixed(2)},${(cy - s).toFixed(2)}`,
      `${(cx + s).toFixed(2)},${(cy - s).toFixed(2)}`,
      `${(cx + s).toFixed(2)},${(cy + s).toFixed(2)}`,
      `${(cx - s).toFixed(2)},${(cy + s).toFixed(2)}`,
    ].join(' ')
  }
  if (shape === 'diamond') {
    const s = size * 1.05
    return [
      `${cx.toFixed(2)},${(cy - s).toFixed(2)}`,
      `${(cx + s).toFixed(2)},${cy.toFixed(2)}`,
      `${cx.toFixed(2)},${(cy + s).toFixed(2)}`,
      `${(cx - s).toFixed(2)},${cy.toFixed(2)}`,
    ].join(' ')
  }
  return hexCorners(cx, cy, size)
}

export interface NodeLayout {
  id: string
  cx: number
  cy: number
}

export interface LayoutBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

export function layoutNodes(
  difficulties: Pick<CampaignDifficultyResponse, 'id' | 'positionX' | 'positionY'>[],
  unit: number,
): { nodes: NodeLayout[]; bounds: LayoutBounds } {
  const nodes: NodeLayout[] = difficulties.map((d) => ({
    id: d.id,
    cx: d.positionX * unit * 1.5,
    cy: d.positionY * unit * SQRT3 + (d.positionX % 2 !== 0 ? (unit * SQRT3) / 2 : 0),
  }))

  if (nodes.length === 0) {
    return { nodes, bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 } }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    if (n.cx < minX) minX = n.cx
    if (n.cy < minY) minY = n.cy
    if (n.cx > maxX) maxX = n.cx
    if (n.cy > maxY) maxY = n.cy
  }

  return {
    nodes,
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    },
  }
}

export function edgePointOnShape(
  shape: CampaignNodeShape,
  size: number,
  cx: number,
  cy: number,
  towardX: number,
  towardY: number,
): { x: number; y: number } {
  const dx = towardX - cx
  const dy = towardY - cy
  const len = Math.hypot(dx, dy)
  if (len === 0) return { x: cx, y: cy }
  const ux = dx / len
  const uy = dy / len

  let r: number
  switch (shape) {
    case 'circle':
      r = size
      break
    case 'square': {
      const half = size * 0.95
      r = half / Math.max(Math.abs(ux), Math.abs(uy))
      break
    }
    case 'diamond': {
      const vertex = size * 1.05
      r = vertex / (Math.abs(ux) + Math.abs(uy))
      break
    }
    case 'hex':
    default: {
      const angle = Math.atan2(uy, ux)
      const sector = ((angle + 2 * Math.PI) % (Math.PI / 3)) - Math.PI / 6
      r = (size * SQRT3) / (2 * Math.cos(sector))
      break
    }
  }
  return { x: cx + ux * r, y: cy + uy * r }
}

export function formatRequirement(
  type: CampaignDifficultyResponse['requirementType'],
  value: number,
): string {
  switch (type) {
    case 'ACC':
      return `${(value * 100).toFixed(2)}%`
    case 'AP':
      return `${Math.round(value)}ap`
    case 'SCORE':
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
      if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`
      return String(Math.round(value))
    case 'STREAK_115':
      return `115×${Math.round(value)}`
    case 'FC':
      return 'FC'
    default:
      return String(value)
  }
}

export function formatRequirementShort(
  type: CampaignDifficultyResponse['requirementType'],
  value: number,
): string {
  switch (type) {
    case 'ACC':
      return `${(value * 100).toFixed(1)}%`
    case 'AP':
      return `${Math.round(value)}ap`
    case 'SCORE':
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
      if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`
      return String(Math.round(value))
    case 'STREAK_115':
      return `×${Math.round(value)}`
    case 'FC':
      return 'FC'
    default:
      return String(value)
  }
}

export function formatUserValue(
  type: CampaignDifficultyResponse['requirementType'],
  value: number | null,
): string {
  if (value == null) return '-'
  switch (type) {
    case 'ACC':
      return `${(value * 100).toFixed(2)}%`
    case 'AP':
      return `${value.toFixed(1)}ap`
    case 'SCORE':
      return value.toLocaleString('en-US')
    case 'STREAK_115':
      return `${Math.round(value)}`
    case 'FC':
      return value > 0 ? 'cleared' : 'not yet'
    default:
      return String(value)
  }
}
