const SVG_NS = 'http://www.w3.org/2000/svg'
const XHTML_NS = 'http://www.w3.org/1999/xhtml'
const ASSET_TIMEOUT_MS = 6000
const SETTLE_FRAMES = 4

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const INHERITED_PROPERTIES = new Set([
  'color',
  'direction',
  'dominant-baseline',
  'fill',
  'fill-opacity',
  'fill-rule',
  'font-family',
  'font-size',
  'font-stretch',
  'font-style',
  'font-variant-numeric',
  'font-weight',
  'letter-spacing',
  'line-height',
  'list-style-type',
  'paint-order',
  'shape-rendering',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
  'text-align',
  'text-anchor',
  'text-transform',
  'visibility',
  'white-space',
  'word-break',
  'word-spacing',
  'writing-mode',
])

const COPIED_PROPERTIES = [
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'box-sizing',
  'overflow-x',
  'overflow-y',
  'z-index',
  'opacity',
  'flex-direction',
  'flex-wrap',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'align-items',
  'align-self',
  'justify-content',
  'gap',
  'order',
  'grid-template-columns',
  'grid-template-rows',
  'grid-column',
  'grid-row',
  'aspect-ratio',
  'object-fit',
  'object-position',
  'background-color',
  'background-image',
  'background-size',
  'background-position',
  'background-repeat',
  'background-origin',
  'background-clip',
  'background-blend-mode',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
  'box-shadow',
  'mix-blend-mode',
  'isolation',
  'filter',
  'clip-path',
  'clip-rule',
  'mask-image',
  'mask-size',
  'mask-position',
  'mask-repeat',
  'mask-clip',
  'mask-origin',
  'mask-mode',
  'mask-composite',
  'transform',
  'transform-origin',
  'transform-style',
  'perspective',
  'text-decoration-line',
  'text-decoration-color',
  'text-shadow',
  'text-overflow',
  'overflow-wrap',
  'vertical-align',
  'marker-start',
  'marker-mid',
  'marker-end',
  'stop-color',
  'stop-opacity',
  'vector-effect',
  ...INHERITED_PROPERTIES,
]

const INITIAL_VALUES: Record<string, string> = {
  'background-blend-mode': 'normal',
  'background-clip': 'border-box',
  'background-color': 'rgba(0, 0, 0, 0)',
  'background-image': 'none',
  'background-origin': 'padding-box',
  'background-position': '0% 0%',
  'background-repeat': 'repeat',
  'background-size': 'auto',
  'border-bottom-color': 'rgb(0, 0, 0)',
  'border-bottom-left-radius': '0px',
  'border-bottom-right-radius': '0px',
  'border-bottom-style': 'none',
  'border-bottom-width': '0px',
  'border-left-color': 'rgb(0, 0, 0)',
  'border-left-style': 'none',
  'border-left-width': '0px',
  'border-right-color': 'rgb(0, 0, 0)',
  'border-right-style': 'none',
  'border-right-width': '0px',
  'border-top-color': 'rgb(0, 0, 0)',
  'border-top-left-radius': '0px',
  'border-top-right-radius': '0px',
  'border-top-style': 'none',
  'border-top-width': '0px',
  'bottom': 'auto',
  'box-shadow': 'none',
  'clip-path': 'none',
  'clip-rule': 'nonzero',
  'filter': 'none',
  'flex-basis': 'auto',
  'flex-grow': '0',
  'flex-shrink': '1',
  'gap': 'normal',
  'grid-column': 'auto',
  'grid-row': 'auto',
  'grid-template-columns': 'none',
  'grid-template-rows': 'none',
  'isolation': 'auto',
  'left': 'auto',
  'margin-bottom': '0px',
  'margin-left': '0px',
  'margin-right': '0px',
  'margin-top': '0px',
  'marker-end': 'none',
  'marker-mid': 'none',
  'marker-start': 'none',
  'mask-clip': 'border-box',
  'mask-composite': 'add',
  'mask-image': 'none',
  'mask-mode': 'match-source',
  'mask-origin': 'border-box',
  'mask-position': '0% 0%',
  'mask-repeat': 'repeat',
  'mask-size': 'auto',
  'max-height': 'none',
  'max-width': 'none',
  'min-height': 'auto',
  'min-width': 'auto',
  'mix-blend-mode': 'normal',
  'object-fit': 'fill',
  'object-position': '50% 50%',
  'opacity': '1',
  'order': '0',
  'overflow-wrap': 'normal',
  'padding-bottom': '0px',
  'padding-left': '0px',
  'padding-right': '0px',
  'padding-top': '0px',
  'perspective': 'none',
  'right': 'auto',
  'stop-color': 'rgb(0, 0, 0)',
  'stop-opacity': '1',
  'text-decoration-color': 'rgb(0, 0, 0)',
  'text-decoration-line': 'none',
  'text-overflow': 'clip',
  'text-shadow': 'none',
  'top': 'auto',
  'transform': 'none',
  'transform-style': 'flat',
  'vector-effect': 'none',
  'vertical-align': 'baseline',
  'z-index': 'auto',
}

const PREFIXED_PROPERTIES = new Set([
  'mask-image',
  'mask-size',
  'mask-position',
  'mask-repeat',
  'mask-clip',
  'mask-origin',
  'mask-composite',
  'background-clip',
])

const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT'])

const GENERIC_FONT_FAMILIES =
  /^(system-ui|sans-serif|serif|monospace|ui-monospace|cursive|fantasy)$/i

interface RasterizeOptions {
  width: number
  height: number
  scale?: number
  trim?: { size: number; paddingPct: number }
  probe?: Rect
}

interface RasterizeResult {
  blob: Blob
  warnings: string[]
  probeOpaque?: number
}

function isInitial(prop: string, value: string): boolean {
  return !INHERITED_PROPERTIES.has(prop) && INITIAL_VALUES[prop] === value
}

function serializeStyle(source: Element): string {
  const computed = window.getComputedStyle(source)
  const parts: string[] = []
  for (const prop of COPIED_PROPERTIES) {
    const value = computed.getPropertyValue(prop)
    if (value && !isInitial(prop, value)) parts.push(`${prop}:${value}`)

    if (!PREFIXED_PROPERTIES.has(prop)) continue
    const prefixed = computed.getPropertyValue(`-webkit-${prop}`) || value
    if (prefixed && !isInitial(prop, prefixed)) parts.push(`-webkit-${prop}:${prefixed}`)
  }
  return parts.join(';')
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read image data'))
    reader.readAsDataURL(blob)
  })
}

async function inlineSource(src: string): Promise<string | null> {
  if (src.startsWith('data:')) return src
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ASSET_TIMEOUT_MS)
  try {
    const response = await fetch(src, {
      mode: 'cors',
      credentials: 'omit',
      signal: controller.signal,
    })
    if (!response.ok) return null
    return await blobToDataUrl(await response.blob())
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

interface CloneContext {
  tasks: Promise<void>[]
  warnings: string[]
}

function cloneCanvas(source: HTMLCanvasElement, ctx: CloneContext): Element | null {
  let dataUrl: string
  try {
    dataUrl = source.toDataURL('image/png')
  } catch {
    ctx.warnings.push('A canvas layer could not be captured and was skipped.')
    return null
  }
  const img = document.createElementNS(XHTML_NS, 'img')
  img.setAttribute('src', dataUrl)
  img.setAttribute('style', serializeStyle(source))
  return img
}

function cloneElement(source: Element, ctx: CloneContext): Element | null {
  if (SKIPPED_TAGS.has(source.tagName)) return null
  if (window.getComputedStyle(source).display === 'none') return null
  if (source instanceof HTMLCanvasElement) return cloneCanvas(source, ctx)

  const clone = source.cloneNode(false) as Element

  if (source instanceof HTMLImageElement && clone instanceof HTMLImageElement) {
    clone.removeAttribute('loading')
    clone.removeAttribute('decoding')
    clone.removeAttribute('srcset')
    ctx.tasks.push(
      inlineSource(source.currentSrc || source.src).then((dataUrl) => {
        if (dataUrl) {
          clone.setAttribute('src', dataUrl)
          return
        }
        clone.removeAttribute('src')
        ctx.warnings.push('An image could not be embedded (blocked by CORS) and was skipped.')
      }),
    )
  }

  clone.setAttribute('style', serializeStyle(source))

  for (const child of Array.from(source.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      clone.appendChild(document.createTextNode(child.nodeValue ?? ''))
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    const childClone = cloneElement(child as Element, ctx)
    if (childClone) clone.appendChild(childClone)
  }

  return clone
}

const FONT_FACE_RE = /@font-face\s*\{[^}]*\}/g

let fontCssCache: Promise<string> | null = null

async function loadFontFaceCss(): Promise<string> {
  const link = document.querySelector<HTMLLinkElement>(
    'link[rel="stylesheet"][href*="fonts.googleapis.com/css2"]',
  )
  if (!link) return ''
  const response = await fetch(link.href, { mode: 'cors' })
  if (!response.ok) return ''

  const blocks = (await response.text()).match(FONT_FACE_RE) ?? []
  const latin = blocks.filter((block) => block.includes('U+0000-00FF'))

  const resolved = await Promise.all(
    (latin.length > 0 ? latin : blocks).map(async (block) => {
      const url = block.match(/url\((https:\/\/[^)]+)\)/)?.[1]
      if (!url) return null
      const dataUrl = await inlineSource(url)
      return dataUrl ? block.replace(url, dataUrl) : null
    }),
  )
  return resolved.filter((block): block is string => block !== null).join('\n')
}

async function fontFaceCss(families: Set<string>): Promise<string> {
  if (families.size === 0) return ''
  if (!fontCssCache) fontCssCache = loadFontFaceCss().catch(() => '')
  const all = await fontCssCache
  return (all.match(FONT_FACE_RE) ?? [])
    .filter((block) => {
      const name = block.match(/font-family:\s*['"]?([^;'"]+)/)?.[1]?.trim().toLowerCase()
      return !!name && families.has(name)
    })
    .join('\n')
}

function collectFontFamilies(root: Element, found = new Set<string>()): Set<string> {
  if (root.textContent?.trim()) {
    for (const raw of window.getComputedStyle(root).fontFamily.split(',')) {
      const name = raw.trim().replace(/^['"]|['"]$/g, '')
      if (name && !name.startsWith('-') && !GENERIC_FONT_FAMILIES.test(name)) {
        found.add(name.toLowerCase())
      }
    }
  }
  for (const child of Array.from(root.children)) collectFontFamilies(child, found)
  return found
}

export async function waitForRenderedAssets(root: Element): Promise<void> {
  if (document.fonts?.ready) await document.fonts.ready

  await Promise.all(
    Array.from(root.querySelectorAll('img')).map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const done = () => {
              clearTimeout(timer)
              resolve()
            }
            const timer = setTimeout(done, ASSET_TIMEOUT_MS)
            img.addEventListener('load', done, { once: true })
            img.addEventListener('error', done, { once: true })
          }),
    ),
  )

  for (let i = 0; i < SETTLE_FRAMES; i++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
}

export async function rasterize(
  source: Element,
  options: RasterizeOptions,
): Promise<RasterizeResult> {
  const { width, height } = options
  const scale = options.scale ?? 1
  const outWidth = Math.round(width * scale)
  const outHeight = Math.round(height * scale)

  const ctx: CloneContext = { tasks: [], warnings: [] }
  const clone = cloneElement(source, ctx)
  if (!clone) throw new Error('Nothing to capture')
  await Promise.all(ctx.tasks)

  const fonts = await fontFaceCss(collectFontFamilies(source))

  const wrapper = document.createElementNS(XHTML_NS, 'div')
  wrapper.setAttribute(
    'style',
    `width:${width}px;height:${height}px;transform:scale(${scale});transform-origin:0 0`,
  )
  wrapper.appendChild(clone)

  const svg =
    `<svg xmlns="${SVG_NS}" width="${outWidth}" height="${outHeight}" viewBox="0 0 ${outWidth} ${outHeight}">`
    + `<foreignObject x="0" y="0" width="${outWidth}" height="${outHeight}">`
    + (fonts ? `<style xmlns="${XHTML_NS}">${fonts}</style>` : '')
    + new XMLSerializer().serializeToString(wrapper)
    + `</foreignObject></svg>`

  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await image.decode()

  const canvas = document.createElement('canvas')
  canvas.width = outWidth
  canvas.height = outHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D context unavailable')
  context.drawImage(image, 0, 0, outWidth, outHeight)

  const probeOpaque = options.probe
    ? countOpaque(canvas, {
        x: Math.round(options.probe.x * scale),
        y: Math.round(options.probe.y * scale),
        w: Math.round(options.probe.w * scale),
        h: Math.round(options.probe.h * scale),
      })
    : undefined

  const finalCanvas = options.trim ? refitToSquare(canvas, options.trim) : canvas
  const blob = await new Promise<Blob | null>((resolve) => finalCanvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('PNG encoding failed')

  return { blob, warnings: Array.from(new Set(ctx.warnings)), probeOpaque }
}

function alphaOf(canvas: HTMLCanvasElement, rect: Rect): Uint8ClampedArray | null {
  const x = Math.max(0, Math.min(rect.x, canvas.width))
  const y = Math.max(0, Math.min(rect.y, canvas.height))
  const w = Math.max(0, Math.min(rect.w, canvas.width - x))
  const h = Math.max(0, Math.min(rect.h, canvas.height - y))
  if (w === 0 || h === 0) return null
  return canvas.getContext('2d')?.getImageData(x, y, w, h).data ?? null
}

function countOpaque(canvas: HTMLCanvasElement, rect: Rect): number {
  const data = alphaOf(canvas, rect)
  if (!data) return 0
  let count = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] > 8) count++
  return count
}

function alphaBounds(canvas: HTMLCanvasElement): Rect | null {
  const { width, height } = canvas
  const data = alphaOf(canvas, { x: 0, y: 0, w: width, h: height })
  if (!data) return null

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 8) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

function refitToSquare(
  source: HTMLCanvasElement,
  trim: { size: number; paddingPct: number },
): HTMLCanvasElement {
  const bounds = alphaBounds(source)
  if (!bounds) return source

  const out = document.createElement('canvas')
  out.width = trim.size
  out.height = trim.size
  const context = out.getContext('2d')
  if (!context) return source

  const inner = trim.size * (1 - trim.paddingPct * 2)
  const scale = Math.min(inner / bounds.w, inner / bounds.h)
  const drawW = bounds.w * scale
  const drawH = bounds.h * scale

  context.imageSmoothingQuality = 'high'
  context.drawImage(
    source,
    bounds.x,
    bounds.y,
    bounds.w,
    bounds.h,
    (trim.size - drawW) / 2,
    (trim.size - drawH) / 2,
    drawW,
    drawH,
  )
  return out
}
