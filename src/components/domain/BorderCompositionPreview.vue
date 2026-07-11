<script setup lang="ts">
import BorderDecals from '@/components/domain/BorderDecals.vue'
import BorderOverlay from '@/components/domain/BorderOverlay.vue'
import LevelBadgeAvatar from '@/components/domain/LevelBadgeAvatar.vue'
import ProfileBorderRenderer from '@/components/domain/ProfileBorderRenderer.vue'
import type { BorderColorValue, BorderShapeValue } from '@/types/api/items'
import { DEFAULT_AVATAR_MASK, resolveAvatarImageBox } from '@/utils/avatarBox'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  shape: BorderShapeValue | null
  color: BorderColorValue | null
  avatarUrl?: string | null
}>()

const decals = computed(() => props.shape?.decals ?? [])
const overlay = computed(() =>
  props.shape?.overlay?.enabled ? props.shape.overlay : null,
)

const avatarMaskPath = computed(() => props.shape?.avatarMask ?? DEFAULT_AVATAR_MASK)
const avatarImageBox = ref(resolveAvatarImageBox(props.shape))

watch(
  () => props.shape,
  (shape) => {
    avatarImageBox.value = resolveAvatarImageBox(shape)
  },
  { deep: false },
)

const avatarClipId = `bcp-avatar-clip-${Math.random().toString(36).slice(2, 9)}`
</script>

<template>
  <div class="border-composition">
    <ProfileBorderRenderer :shape="shape" :color="color" />
    <LevelBadgeAvatar
      v-if="avatarUrl"
      :avatar-url="avatarUrl"
      :clip-id="avatarClipId"
      :mask-path="avatarMaskPath"
      :image-box="avatarImageBox"
    />
    <BorderDecals v-if="decals.length" class="border-composition__decals" :decals="decals" />
    <BorderOverlay
      v-if="overlay"
      class="border-composition__overlay"
      :overlay="overlay"
      :avatar-url="avatarUrl"
      :color="color"
    />
  </div>
</template>

<style scoped>
.border-composition {
  position: relative;
  width: 140px;
  height: 140px;
  color: var(--text-secondary);
}

.border-composition__decals,
.border-composition__overlay {
  z-index: 3;
}
</style>
