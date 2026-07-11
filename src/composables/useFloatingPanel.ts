import { onMounted, onUnmounted, ref } from 'vue'

export function useFloatingPanel(opts?: { minWidth?: number; flipThreshold?: number }) {
  const isOpen = ref(false)
  const containerRef = ref<HTMLElement | null>(null)
  const triggerRef = ref<HTMLElement | null>(null)
  const panelRef = ref<HTMLElement | null>(null)
  const panelStyle = ref<Record<string, string>>({})

  const flipThreshold = opts?.flipThreshold ?? 300

  function updatePosition() {
    const trigger = triggerRef.value
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const openUp = spaceBelow < flipThreshold && spaceAbove > spaceBelow
    const width = opts?.minWidth ? Math.max(rect.width, opts.minWidth) : rect.width
    const style: Record<string, string> = {
      position: 'fixed',
      left: `${rect.left}px`,
      width: `${width}px`,
      minWidth: `${rect.width}px`,
    }
    if (openUp) style.bottom = `${window.innerHeight - rect.top}px`
    else style.top = `${rect.bottom}px`
    panelStyle.value = style
  }

  function open() {
    isOpen.value = true
    updatePosition()
  }

  function close() {
    isOpen.value = false
  }

  function toggle() {
    if (isOpen.value) close()
    else open()
  }

  function onClickOutside(e: MouseEvent) {
    const target = e.target as Node
    if (containerRef.value?.contains(target)) return
    if (panelRef.value?.contains(target)) return
    isOpen.value = false
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') isOpen.value = false
  }

  function onReposition() {
    if (isOpen.value) updatePosition()
  }

  onMounted(() => {
    document.addEventListener('click', onClickOutside)
    document.addEventListener('keydown', onKeydown)
    window.addEventListener('scroll', onReposition, true)
    window.addEventListener('resize', onReposition)
  })

  onUnmounted(() => {
    document.removeEventListener('click', onClickOutside)
    document.removeEventListener('keydown', onKeydown)
    window.removeEventListener('scroll', onReposition, true)
    window.removeEventListener('resize', onReposition)
  })

  return { isOpen, containerRef, triggerRef, panelRef, panelStyle, open, close, toggle, updatePosition }
}
