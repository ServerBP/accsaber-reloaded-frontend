export const DEFAULT_AVATAR_MASK
  = 'M14,0 L86,0 Q100,0 100,14 L100,86 Q100,100 86,100 L14,100 Q0,100 0,86 L0,14 Q0,0 14,0 Z'

interface AvatarImageBox {
  x: number
  y: number
  size: number
}

const COVER_BOX: AvatarImageBox = { x: 0, y: 0, size: 100 }

const safeBoxCache = new Map<string, AvatarImageBox>()

function computeSafeBox(mask: string): AvatarImageBox {
  const cached = safeBoxCache.get(mask)
  if (cached) return cached
  if (typeof document === 'undefined') return { x: 0, y: 0, size: 100 }
  const svgNs = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNs, 'svg')
  svg.setAttribute('viewBox', '0 0 100 100')
  svg.setAttribute('width', '0')
  svg.setAttribute('height', '0')
  svg.style.position = 'absolute'
  svg.style.opacity = '0'
  svg.style.pointerEvents = 'none'
  const path = document.createElementNS(svgNs, 'path')
  path.setAttribute('d', mask)
  svg.appendChild(path)
  document.body.appendChild(svg)

  let result: AvatarImageBox = { x: 0, y: 0, size: 100 }
  try {
    const len = path.getTotalLength()
    const N = 240
    const samples: Array<[number, number]> = new Array(N)
    for (let i = 0; i < N; i++) {
      const pt = path.getPointAtLength((i / N) * len)
      samples[i] = [pt.x, pt.y]
    }

    const inside = (px: number, py: number): boolean => {
      let hit = false
      for (let i = 0, j = N - 1; i < N; j = i++) {
        const [xi, yi] = samples[i]
        const [xj, yj] = samples[j]
        if ((yi > py) !== (yj > py)
          && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
          hit = !hit
        }
      }
      return hit
    }

    let polyArea = 0
    for (let i = 0; i < N; i++) {
      const [x1, y1] = samples[i]
      const [x2, y2] = samples[(i + 1) % N]
      polyArea += x1 * y2 - x2 * y1
    }
    polyArea = Math.abs(polyArea) / 2
    const density = polyArea / 10000

    let lo = 0
    let hi = 100
    for (let iter = 0; iter < 22; iter++) {
      const mid = (lo + hi) / 2
      const h = mid / 2
      if (
        inside(50 - h, 50 - h)
        && inside(50 + h, 50 - h)
        && inside(50 + h, 50 + h)
        && inside(50 - h, 50 + h)
      ) {
        lo = mid
      } else {
        hi = mid
      }
    }
    const inscribed = lo
    const blended = inscribed + (100 - inscribed) * density * density * density
    const size = density > 0.93
      ? 100
      : Math.max(72, Math.min(100, blended))
    result = { x: 50 - size / 2, y: 50 - size / 2, size }
  } catch {
    result = { x: 0, y: 0, size: 100 }
  }
  document.body.removeChild(svg)
  safeBoxCache.set(mask, result)
  return result
}

export function resolveAvatarImageBox(
  shape: { avatarFit?: string | null; avatarMask?: string | null } | null | undefined,
): AvatarImageBox {
  if (shape?.avatarFit === 'cover') return { ...COVER_BOX }
  return computeSafeBox(shape?.avatarMask ?? DEFAULT_AVATAR_MASK)
}
