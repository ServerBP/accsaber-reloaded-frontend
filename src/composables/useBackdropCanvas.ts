import { onMounted, onUnmounted, type Ref } from 'vue'
import { useReducedMotion } from '@/composables/useReducedMotion'

export interface BackdropScene {
  init: (w: number, h: number, nowMs: number) => void
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, nowMs: number, reduced: boolean) => void
}

interface SceneSizing {
  measure: (canvas: HTMLCanvasElement) => { w: number; h: number; scale: number }
  observe?: (canvas: HTMLCanvasElement, onChange: () => void) => () => void
}

function deviceScale(): number {
  return Math.min(window.devicePixelRatio, 2)
}

function inlineHost(canvas: HTMLCanvasElement): HTMLElement | null {
  return canvas.closest('[data-fx-inline]')
}

function inlineZoom(host: HTMLElement): number {
  const zoom = parseFloat(host.getAttribute('data-fx-inline') ?? '')
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1
}

function useSceneCanvas(
  canvasRef: Ref<HTMLCanvasElement | null>,
  scene: BackdropScene,
  sizing: SceneSizing,
): void {
  const reduced = useReducedMotion()
  let rafId: number | null = null
  let isVisible = true
  let stopObserving: (() => void) | null = null
  let logicalW = 0
  let logicalH = 0

  function isStatic(): boolean {
    return reduced.value || !!canvasRef.value?.closest('[data-fx-static]')
  }

  function render(now: number) {
    if (!canvasRef.value || logicalW <= 0 || logicalH <= 0) return
    const ctx = canvasRef.value.getContext('2d')
    if (!ctx) return
    scene.draw(ctx, logicalW, logicalH, now, isStatic())
  }

  function loop(now: number) {
    if (!isVisible) return
    render(now)
    rafId = requestAnimationFrame(loop)
  }

  function resize() {
    if (!canvasRef.value) return
    const { w, h, scale } = sizing.measure(canvasRef.value)
    if (w <= 0 || h <= 0) return
    canvasRef.value.width = w * scale
    canvasRef.value.height = h * scale
    const ctx = canvasRef.value.getContext('2d')
    if (ctx) ctx.setTransform(scale, 0, 0, scale, 0, 0)
    logicalW = w
    logicalH = h
    scene.init(w, h, performance.now())
    if (isStatic()) render(performance.now())
  }

  function onVisibility() {
    isVisible = !document.hidden
    if (isVisible && rafId === null && !isStatic()) {
      rafId = requestAnimationFrame(loop)
    } else if (!isVisible && rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  onMounted(() => {
    resize()
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)
    if (canvasRef.value && sizing.observe) {
      stopObserving = sizing.observe(canvasRef.value, resize)
    }
    if (!isStatic()) {
      rafId = requestAnimationFrame(loop)
    }
  })

  onUnmounted(() => {
    if (rafId !== null) cancelAnimationFrame(rafId)
    window.removeEventListener('resize', resize)
    document.removeEventListener('visibilitychange', onVisibility)
    stopObserving?.()
    stopObserving = null
  })
}

function observeElement(canvas: HTMLCanvasElement, onChange: () => void): () => void {
  const observer = new ResizeObserver(onChange)
  observer.observe(canvas)
  return () => observer.disconnect()
}

export function useBackdropCanvas(
  canvasRef: Ref<HTMLCanvasElement | null>,
  scene: BackdropScene,
): void {
  useSceneCanvas(canvasRef, scene, {
    measure: (canvas) => {
      const host = inlineHost(canvas)
      if (host) {
        const zoom = inlineZoom(host)
        return {
          w: canvas.clientWidth * zoom,
          h: canvas.clientHeight * zoom,
          scale: deviceScale() / zoom,
        }
      }
      return { w: window.innerWidth, h: window.innerHeight, scale: deviceScale() }
    },
    observe: (canvas, onChange) =>
      inlineHost(canvas) ? observeElement(canvas, onChange) : () => {},
  })
}

export function useElementCanvas(
  canvasRef: Ref<HTMLCanvasElement | null>,
  scene: BackdropScene,
): void {
  useSceneCanvas(canvasRef, scene, {
    measure: (canvas) => ({ w: canvas.clientWidth, h: canvas.clientHeight, scale: deviceScale() }),
    observe: observeElement,
  })
}
