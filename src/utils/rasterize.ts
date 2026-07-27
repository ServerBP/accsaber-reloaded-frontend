const SVG_NS = 'http://www.w3.org/2000/svg'
const XHTML_NS = 'http://www.w3.org/1999/xhtml'

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
  'overflow-x': 'visible',
  'overflow-y': 'visible',
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

const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META'])

export interface RasterizeOptions {
  width: number
  height: number
  scale?: number
  fontFamilies?: string[]
}

export interface RasterizeResult {
  blob: Blob
  warnings: string[]
}

function serializeStyle(source: Element): string {
  const computed = window.getComputedStyle(source)
  const parts: string[] = []
  for (const prop of COPIED_PROPERTIES) {
    const value = computed.getPropertyValue(prop)
    if (!value) continue
    if (!INHERITED_PROPERTIES.has(prop) && INITIAL_VALUES[prop] === value) continue
    parts.push(`${prop}:${value}`)
    if (PREFIXED_PROPERTIES.has(prop)) parts.push(`-webkit-${prop}:${value}`)
  }
  return parts.join(';')
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read image data'))
    reader.readAsDataURL(blob)
  })
}

const ASSET_TIMEOUT_MS = 6000

async function inlineImageSource(src: string): Promise<string | null> {
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

function canvasToDataUrl(canvas: HTMLCanvasElement): string | null {
  try {
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

interface CloneContext {
  tasks: Promise<void>[]
  warnings: string[]
}

function cloneElement(source: Element, ctx: CloneContext): Element | null {
  if (SKIPPED_TAGS.has(source.tagName)) return null

  const computed = window.getComputedStyle(source)
  if (computed.display === 'none') return null

  let clone: Element

  if (source instanceof HTMLCanvasElement) {
    const dataUrl = canvasToDataUrl(source)
    if (!dataUrl) {
      ctx.warnings.push('A canvas layer could not be captured and was skipped.')
      return null
    }
    clone = document.createElementNS(XHTML_NS, 'img')
    clone.setAttribute('src', dataUrl)
  } else {
    clone = source.cloneNode(false) as Element
    while (clone.firstChild) clone.removeChild(clone.firstChild)
  }

  if (source instanceof HTMLImageElement && clone instanceof HTMLImageElement) {
    clone.removeAttribute('loading')
    clone.removeAttribute('decoding')
    clone.removeAttribute('srcset')
    const original = source.currentSrc || source.src
    ctx.tasks.push(
      inlineImageSource(original).then((dataUrl) => {
        if (dataUrl) clone.setAttribute('src', dataUrl)
        else {
          clone.removeAttribute('src')
          ctx.warnings.push('An image could not be embedded (blocked by CORS) and was skipped.')
        }
      }),
    )
  }

  clone.setAttribute('style', serializeStyle(source))

  if (source instanceof HTMLCanvasElement) return clone

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

let fontCssCache: Promise<string> | null = null

function googleFontsHref(): string | null {
  const link = document.querySelector<HTMLLinkElement>(
    'link[rel="stylesheet"][href*="fonts.googleapis.com/css2"]',
  )
  return link?.href ?? null
}

async function loadFontFaceCss(): Promise<string> {
  const href = googleFontsHref()
  if (!href) return ''
  const response = await fetch(href, { mode: 'cors' })
  if (!response.ok) return ''
  const css = await response.text()

  const blocks = css.match(/@font-face\s*\{[^}]*\}/g) ?? []
  const latinOnly = blocks.filter((b) => b.includes('U+0000-00FF'))
  const selected = latinOnly.length > 0 ? latinOnly : blocks

  const resolved = await Promise.all(
    selected.map(async (block) => {
      const match = block.match(/url\((https:\/\/[^)]+)\)/)
      if (!match) return null
      const dataUrl = await inlineImageSource(match[1])
      return dataUrl ? block.replace(match[1], dataUrl) : null
    }),
  )

  return resolved.filter((b): b is string => b !== null).join('\n')
}

async function fontFaceCss(families: string[]): Promise<string> {
  if (families.length === 0) return ''
  if (!fontCssCache) fontCssCache = loadFontFaceCss().catch(() => '')
  const all = await fontCssCache
  if (!all) return ''
  const blocks = all.match(/@font-face\s*\{[^}]*\}/g) ?? []
  const wanted = families.map((f) => f.toLowerCase())
  return blocks
    .filter((block) => {
      const name = block.match(/font-family:\s*['"]?([^;'"]+)/)?.[1]?.trim().toLowerCase()
      return !!name && wanted.includes(name)
    })
    .join('\n')
}

function collectFontFamilies(root: Element): string[] {
  const found = new Set<string>()
  const walk = (el: Element) => {
    if (el.textContent?.trim()) {
      const family = window.getComputedStyle(el).fontFamily
      for (const raw of family.split(',')) {
        const name = raw.trim().replace(/^['"]|['"]$/g, '')
        if (name && !name.startsWith('-') && !/^(system-ui|sans-serif|serif|monospace|ui-monospace|cursive|fantasy)$/i.test(name)) {
          found.add(name)
        }
      }
    }
    for (const child of Array.from(el.children)) walk(child)
  }
  walk(root)
  return Array.from(found)
}

export async function waitForRenderedAssets(root: Element): Promise<void> {
  if (document.fonts?.ready) await document.fonts.ready
  const images = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    images.map((img) =>
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
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
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

  const families = options.fontFamilies ?? collectFontFamilies(source)
  const fonts = await fontFaceCss(families)

  const wrapper = document.createElementNS(XHTML_NS, 'div')
  wrapper.setAttribute(
    'style',
    `width:${width}px;height:${height}px;transform:scale(${scale});transform-origin:0 0`,
  )
  wrapper.appendChild(clone)

  const serialized = new XMLSerializer().serializeToString(wrapper)
  const styleTag = fonts ? `<style xmlns="${XHTML_NS}">${fonts}</style>` : ''
  const svg =
    `<svg xmlns="${SVG_NS}" width="${outWidth}" height="${outHeight}" viewBox="0 0 ${outWidth} ${outHeight}">`
    + `<foreignObject x="0" y="0" width="${outWidth}" height="${outHeight}">${styleTag}${serialized}</foreignObject>`
    + `</svg>`

  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await image.decode()

  const canvas = document.createElement('canvas')
  canvas.width = outWidth
  canvas.height = outHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D context unavailable')
  context.drawImage(image, 0, 0, outWidth, outHeight)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('PNG encoding failed')

  return { blob, warnings: Array.from(new Set(ctx.warnings)) }
}
