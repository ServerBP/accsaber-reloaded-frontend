<script setup lang="ts">
defineProps<{
  avatarUrl: string
  clipId: string
  maskPath: string
  imageBox: { x: number; y: number; size: number }
}>()
</script>

<template>
  <svg
    class="level-badge__avatar-wrap"
    viewBox="0 0 100 100"
    preserveAspectRatio="xMidYMid meet"
    aria-label="Avatar"
  >
    <defs>
      <clipPath :id="clipId" clipPathUnits="userSpaceOnUse">
        <path :d="maskPath" />
      </clipPath>
    </defs>
    <g :clip-path="`url(#${clipId})`">
      <rect x="0" y="0" width="100" height="100" class="level-badge__avatar-bg" />
      <foreignObject
        :x="imageBox.x"
        :y="imageBox.y"
        :width="imageBox.size"
        :height="imageBox.size"
      >
        <img :src="avatarUrl" alt="" class="level-badge__avatar-img" decoding="async" />
      </foreignObject>
    </g>
  </svg>
</template>

<style scoped>
.level-badge__avatar-wrap {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 124px;
  height: 124px;
  z-index: 2;
  display: block;
  overflow: visible;
}

.level-badge__avatar-bg {
  fill: var(--bg-base);
}

.level-badge__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
