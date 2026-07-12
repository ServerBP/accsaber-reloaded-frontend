import type { BorderShapeValue } from '@/types/api/items'
import { DEFAULT_AVATAR_MASK } from '@/utils/avatarBox'

export function shapeSilhouetteMask(shape: BorderShapeValue | null | undefined): string | null {
  if (!shape) return null
  if (shape.renderMode === 'pixel') return null
  const paths = shape.states.flatMap((state) => state.paths ?? [])
  if (paths.length === 0) return null
  const viewBox = shape.viewBox ?? '0 0 100 100'
  const parts = viewBox.split(/\s+/).map(Number)
  const w = parts[2] || 100
  const h = parts[3] || 100
  const inner = paths
    .map((p) => {
      const stroke = p.stroke && p.stroke !== 'none' ? 'white' : 'none'
      const fill = p.fill && p.fill !== 'none' ? 'white' : 'none'
      const sw = p.strokeWidth ?? 1
      return `<path d="${p.d}" stroke="${stroke}" stroke-width="${sw}" fill="${fill}" stroke-linecap="${p.strokeLinecap ?? 'butt'}" stroke-linejoin="${p.strokeLinejoin ?? 'miter'}" ${p.transform ? `transform="${p.transform}"` : ''} />`
    })
    .join('')
  const avatar = `<path d="${shape.avatarMask ?? DEFAULT_AVATAR_MASK}" fill="white" />`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}" preserveAspectRatio="none">${inner}${avatar}</svg>`
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`
}
