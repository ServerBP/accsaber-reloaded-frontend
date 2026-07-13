<script setup lang="ts">
defineProps<{
  ready: boolean
  label: string
}>()

defineEmits<{
  dismiss: []
}>()
</script>

<template>
  <Teleport to="body">
    <div
      class="crate-stage"
      role="dialog"
      aria-modal="true"
      :aria-label="label"
      @click.self="$emit('dismiss')"
    >
      <div class="crate-stage__panel">
        <div class="crate-stage__title"><slot name="title" /></div>
        <slot />
        <div class="crate-stage__actions" :class="{ 'crate-stage__actions--ready': ready }">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.crate-stage {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-md);
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 1001;
  animation: crate-stage-in 150ms ease-out;
}

.crate-stage__panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  width: 100%;
  max-width: 960px;
}

.crate-stage__title {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-sm);
  font-size: var(--text-caption);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.crate-stage :deep(.crate-anim) {
  width: 100%;
}

.crate-stage__actions {
  display: flex;
  gap: var(--space-sm);
  min-height: 38px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 150ms ease-out;
}

.crate-stage__actions--ready {
  opacity: 1;
  pointer-events: auto;
}

@keyframes crate-stage-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .crate-stage {
    animation: none;
  }

  .crate-stage__actions {
    transition: none;
  }
}
</style>
