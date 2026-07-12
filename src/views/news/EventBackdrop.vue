<script setup lang="ts">
defineProps<{
  url: string
}>()
</script>

<template>
  <Teleport to="body">
    <div class="event-backdrop" :style="{ backgroundImage: `url('${url}')` }" aria-hidden="true" />
  </Teleport>
</template>

<style scoped>
.event-backdrop {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-size: cover;
  background-position: center;
}

.event-backdrop::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--bg-base) 58%, transparent) 0%,
    color-mix(in srgb, var(--bg-base) 74%, transparent) 42%,
    var(--bg-base) 94%
  );
}
</style>
