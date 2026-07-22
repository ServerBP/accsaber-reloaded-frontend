<script setup lang="ts">
import CountryFlag from '@/components/domain/CountryFlag.vue'
import { onAvatarError, pickAvatarFallback, pickAvatarUrl } from '@/composables/useAvatarFallback'
import type { UserRefDisplay } from '@/types/display'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps<{
  user: UserRefDisplay
  link?: boolean
  compact?: boolean
}>()

const avatarUrl = computed(() => pickAvatarUrl(props.user))
const avatarFallback = computed(() => pickAvatarFallback(props.user))
</script>

<template>
  <component
    :is="link ? RouterLink : 'span'"
    class="user-chip"
    :class="{ 'user-chip--link': link, 'user-chip--compact': compact }"
    :to="link ? { name: 'player-profile', params: { userId: String(user.id) } } : undefined"
  >
    <img
      v-if="avatarUrl"
      class="user-chip__avatar"
      :src="avatarUrl"
      :alt="`${user.name} avatar`"
      loading="lazy"
      decoding="async"
      @error="onAvatarError(avatarFallback)($event)"
    />
    <span class="user-chip__name">{{ user.name }}</span>
    <CountryFlag v-if="user.country" :country="user.country" />
  </component>
</template>

<style scoped>
.user-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  color: var(--text-primary);
  text-decoration: none;
  font-size: var(--text-body);
}

.user-chip__avatar {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-card);
  object-fit: cover;
  flex-shrink: 0;
}

.user-chip__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-chip--link:hover .user-chip__name {
  color: var(--page-accent, var(--accent));
}

.user-chip--compact {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.user-chip--compact .user-chip__avatar {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-btn);
}
</style>
