<script setup lang="ts">
import { useItemCatalog } from '@/composables/useItemCatalog'
import type { CampaignItemAwardResponse } from '@/types/api/campaigns'
import { computed, defineAsyncComponent, onUnmounted, nextTick, ref } from 'vue'

const CampaignRewardItem = defineAsyncComponent(
  () => import('@/components/domain/CampaignRewardItem.vue'),
)

const props = defineProps<{
  rewards: CampaignItemAwardResponse[]
  totalCount: number
}>()

const POPUP_WIDTH = 260
const SCROLL_OPTS: AddEventListenerOptions = { capture: true, passive: true }

const { itemsById, ensureLoaded } = useItemCatalog()

const visible = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const popupRef = ref<HTMLElement | null>(null)
const popupStyle = ref<Record<string, string>>({})

let hoverTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

const label = computed(() => `${props.totalCount.toLocaleString()} item${props.totalCount === 1 ? '' : 's'}`)

function updatePosition() {
  const el = triggerRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const margin = 8
  const maxLeft = window.innerWidth - POPUP_WIDTH - margin
  const popupHeight = popupRef.value?.offsetHeight ?? 0
  const spaceBelow = window.innerHeight - rect.bottom - margin
  const spaceAbove = rect.top - margin
  const flipUp =
    popupHeight > 0 ? spaceBelow < popupHeight && spaceAbove > spaceBelow : spaceBelow < spaceAbove
  const style: Record<string, string> = {
    position: 'fixed',
    left: `${Math.max(margin, Math.min(rect.left, maxLeft))}px`,
    width: `${POPUP_WIDTH}px`,
  }
  if (flipUp) style.bottom = `${window.innerHeight - rect.top + margin}px`
  else style.top = `${rect.bottom + margin}px`
  popupStyle.value = style
}

function onScrollOrResize() {
  if (visible.value) updatePosition()
}

function onOutsidePointer(event: PointerEvent) {
  const target = event.target as Node | null
  if (!target) return
  if (triggerRef.value?.contains(target) || popupRef.value?.contains(target)) return
  close()
}

function attachListeners() {
  window.addEventListener('scroll', onScrollOrResize, SCROLL_OPTS)
  window.addEventListener('resize', onScrollOrResize, { passive: true })
  document.addEventListener('pointerdown', onOutsidePointer, true)
}

function detachListeners() {
  window.removeEventListener('scroll', onScrollOrResize, SCROLL_OPTS)
  window.removeEventListener('resize', onScrollOrResize)
  document.removeEventListener('pointerdown', onOutsidePointer, true)
}

function clearTimers() {
  if (hoverTimer) {
    clearTimeout(hoverTimer)
    hoverTimer = null
  }
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function open() {
  if (visible.value) return
  updatePosition()
  visible.value = true
  attachListeners()
  void ensureLoaded()
  void nextTick(updatePosition)
}

function close() {
  if (!visible.value) return
  visible.value = false
  detachListeners()
}

function scheduleHide() {
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(close, 160)
}

function onMouseEnter() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  if (visible.value) return
  hoverTimer = setTimeout(open, 350)
}

function onMouseLeave() {
  if (hoverTimer) {
    clearTimeout(hoverTimer)
    hoverTimer = null
  }
  scheduleHide()
}

function onToggle() {
  clearTimers()
  if (visible.value) close()
  else open()
}

onUnmounted(() => {
  clearTimers()
  detachListeners()
})
</script>

<template>
  <span ref="triggerRef" class="rewards-tip" @mouseenter="onMouseEnter" @mouseleave="onMouseLeave">
    <button
      type="button"
      class="rewards-tip__btn"
      :class="{ 'rewards-tip__btn--active': visible }"
      :aria-expanded="visible"
      aria-label="Show campaign rewards"
      @click.stop.prevent="onToggle"
      @keydown.escape="close"
    >
      {{ label }}
      <svg
        width="9"
        height="9"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <Teleport to="body">
      <Transition name="rewards-tip">
        <div
          v-if="visible"
          ref="popupRef"
          class="rewards-tip__popup"
          :style="popupStyle"
          role="dialog"
          aria-label="Campaign rewards"
          @mouseenter="clearTimers"
          @mouseleave="scheduleHide"
        >
          <div class="rewards-tip__head">
            <span class="rewards-tip__title">Rewards</span>
            <span class="rewards-tip__count">{{ label }}</span>
          </div>
          <ul class="rewards-tip__list">
            <li v-for="r in rewards" :key="r.itemId" class="rewards-tip__row">
              <CampaignRewardItem
                :name="r.itemName"
                :quantity="r.quantity"
                :item="itemsById.get(r.itemId) ?? null"
              />
            </li>
          </ul>
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

<style scoped>
.rewards-tip {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.rewards-tip__btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--bg-overlay);
  border-radius: 2px;
  cursor: pointer;
  transition:
    color 120ms ease,
    border-color 120ms ease;
}

.rewards-tip__btn:hover,
.rewards-tip__btn--active {
  color: var(--card-accent, var(--accent));
  border-color: var(--card-accent, var(--accent));
}

.rewards-tip__btn:focus-visible {
  outline: none;
  border-color: var(--card-accent, var(--accent));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--card-accent, var(--accent)) 30%, transparent);
}
</style>

<style>
.rewards-tip__popup {
  z-index: 10000;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  overflow: hidden;
  filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.4));
  pointer-events: auto;
}

.rewards-tip__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--bg-overlay);
}

.rewards-tip__title {
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.rewards-tip__count {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.rewards-tip__list {
  margin: 0;
  padding: var(--space-sm);
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 260px;
  overflow-y: auto;
}

.rewards-tip-enter-active {
  transition:
    opacity 150ms ease-out,
    transform 150ms ease-out;
}

.rewards-tip-leave-active {
  transition:
    opacity 100ms ease-in,
    transform 100ms ease-in;
}

.rewards-tip-enter-from,
.rewards-tip-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .rewards-tip-enter-from,
  .rewards-tip-leave-to {
    transform: none;
  }
}
</style>
