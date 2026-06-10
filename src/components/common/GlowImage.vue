<script setup lang="ts">
import { onAvatarError } from '@/composables/useAvatarFallback'

const props = withDefaults(defineProps<{
  src: string
  alt?: string
  size?: number
  fallbackSrc?: string | null
}>(), {
  alt: '',
  size: 36,
  fallbackSrc: null,
})

const handleError = (e: Event) => onAvatarError(props.fallbackSrc)(e)
</script>

<template>
  <div class="glow-image" :style="{ width: `${size}px`, height: `${size}px` }">
    <img class="glow-image__img" :src="src" :alt="alt" loading="lazy" decoding="async"
      @error="handleError" />
  </div>
</template>

<style scoped>
.glow-image {
  position: relative;
  flex-shrink: 0;
}

.glow-image__img {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-btn);
  object-fit: cover;
}
</style>
