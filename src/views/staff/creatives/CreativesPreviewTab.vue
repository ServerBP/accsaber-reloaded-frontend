<script setup lang="ts">
import { usePreviewStore } from '@/stores/preview'
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const preview = usePreviewStore()
const router = useRouter()

onMounted(() => {
  preview.active = true
  router.replace({ name: 'home' })
})
</script>

<template>
  <div class="creatives-launch">
    <p>Entering preview mode…</p>
  </div>
</template>

<style scoped>
.creatives-launch {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40vh;
  color: var(--text-secondary);
  font-size: var(--text-body);
}
</style>
