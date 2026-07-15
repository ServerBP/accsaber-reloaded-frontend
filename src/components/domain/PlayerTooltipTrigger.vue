<script setup lang="ts">
import { defineAsyncComponent, onUnmounted, ref, watch } from 'vue';

const loadCard = () => import('@/components/domain/PlayerTooltipCard.vue')
const PlayerTooltipCard = defineAsyncComponent(loadCard)

defineProps<{
  userId: string
  userName: string
  avatarUrl: string
  avatarFallbackUrl?: string | null
  country: string
}>()

const showTooltip = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const popupRef = ref<HTMLElement | null>(null)
const tooltipStyle = ref<Record<string, string>>({})
const VIEWPORT_MARGIN = 8
let hoverTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null
let resizeObserver: ResizeObserver | null = null

const SCROLL_OPTS: AddEventListenerOptions = { capture: true, passive: true }

function clearHoverTimer() {
  if (hoverTimer) {
    clearTimeout(hoverTimer)
    hoverTimer = null
  }
}

function clearHideTimer() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function updatePosition() {
  const el = triggerRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const popup = popupRef.value?.getBoundingClientRect()
  const width = popup?.width ?? 0
  const height = popup?.height ?? 0

  const below = rect.bottom + VIEWPORT_MARGIN
  const above = rect.top - VIEWPORT_MARGIN - height
  const flip =
    height > 0 && below + height > window.innerHeight && above >= VIEWPORT_MARGIN
  const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN

  tooltipStyle.value = {
    position: 'fixed',
    top: `${flip ? above : below}px`,
    left: `${Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft))}px`,
  }
}

function onScrollOrResize() {
  if (!showTooltip.value) return
  updatePosition()
}

function attachListeners() {
  window.addEventListener('scroll', onScrollOrResize, SCROLL_OPTS)
  window.addEventListener('resize', onScrollOrResize, { passive: true })
}

function detachListeners() {
  window.removeEventListener('scroll', onScrollOrResize, SCROLL_OPTS)
  window.removeEventListener('resize', onScrollOrResize)
}

function hide() {
  showTooltip.value = false
  detachListeners()
}

function scheduleHide() {
  clearHideTimer()
  hideTimer = setTimeout(hide, 200)
}

function onMouseEnter() {
  clearHideTimer()
  if (showTooltip.value) return
  void loadCard()
  hoverTimer = setTimeout(() => {
    updatePosition()
    showTooltip.value = true
    attachListeners()
  }, 800)
}

function onMouseLeave() {
  clearHoverTimer()
  scheduleHide()
}

function onPopupEnter() {
  clearHoverTimer()
  clearHideTimer()
}

function onPopupLeave() {
  scheduleHide()
}

watch(popupRef, (el) => {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (!el) return
  resizeObserver = new ResizeObserver(updatePosition)
  resizeObserver.observe(el)
})

onUnmounted(() => {
  clearHoverTimer()
  clearHideTimer()
  detachListeners()
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<template>
  <span ref="triggerRef" class="tooltip-trigger" @mouseenter="onMouseEnter" @mouseleave="onMouseLeave">
    <slot />
    <Teleport to="body">
      <Transition name="tooltip">
        <div v-if="showTooltip" ref="popupRef" class="tooltip-trigger__popup" :style="tooltipStyle"
          @mouseenter="onPopupEnter" @mouseleave="onPopupLeave">
          <PlayerTooltipCard :user-id="userId" :user-name="userName" :avatar-url="avatarUrl"
            :avatar-fallback-url="avatarFallbackUrl" :country="country" />
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

<style scoped>
.tooltip-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
}
</style>

<style>
.tooltip-trigger__popup {
  z-index: 10000;
  pointer-events: auto;
  filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.4));
}

.tooltip-enter-active {
  transition: opacity 150ms ease-out, transform 150ms ease-out;
}

.tooltip-leave-active {
  transition: opacity 100ms ease-in, transform 100ms ease-in;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
