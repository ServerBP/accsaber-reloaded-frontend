<script setup lang="ts">
import { onAvatarError } from '@/composables/useAvatarFallback'
import { useClickOutside } from '@/composables/useClickOutside'
import { useOwnProfileLink } from '@/composables/useOwnProfileLink'
import { useAuthStore } from '@/stores/auth'
import { isStaffSubdomain } from '@/utils/subdomain'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const emit = defineEmits<{
  login: []
  signOut: []
  staffLogout: []
}>()

const authStore = useAuthStore()
const route = useRoute()
const { goToOwnProfile } = useOwnProfileLink()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const avatarFailed = ref(false)

watch(() => authStore.userProfile?.avatarUrl, () => {
  avatarFailed.value = false
})

useClickOutside(rootRef, open, () => {
  open.value = false
})

watch(() => route.fullPath, () => {
  open.value = false
})

const hasMenu = computed(() => authStore.isLoggedIn || authStore.isStaffAuthorized)
const showTradeOffers = computed(() => authStore.isLoggedIn && !isStaffSubdomain)
const showDivider = computed(() => authStore.isLoggedIn || authStore.isAdmin)

function onTriggerClick() {
  if (hasMenu.value) open.value = !open.value
  else emit('login')
}

function onAvatarImgError(event: Event) {
  const fallback = authStore.userProfile?.avatarFallbackUrl ?? null
  const img = event.currentTarget as HTMLImageElement
  if (fallback && img.dataset.fellBack !== '1') {
    onAvatarError(fallback)(event)
    return
  }
  avatarFailed.value = true
}

function goProfile() {
  open.value = false
  goToOwnProfile()
}
</script>

<template>
  <div ref="rootRef" class="navbar-user">
    <button type="button" class="navbar__icon-btn navbar-user__trigger"
      :class="{ 'navbar-user__trigger--open': open }"
      :aria-label="hasMenu ? 'Account menu' : 'Log in'" :aria-haspopup="hasMenu ? 'menu' : undefined"
      :aria-expanded="hasMenu ? open : undefined" @click="onTriggerClick">
      <img v-if="authStore.isLoggedIn && authStore.userProfile?.avatarUrl && !avatarFailed"
        :src="authStore.userProfile.avatarUrl" :alt="authStore.userProfile.name"
        class="navbar-user__avatar" decoding="async" @error="onAvatarImgError" />
      <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </button>

    <Transition name="navbar-menu">
      <div v-if="open" class="navbar-menu navbar-user__panel" role="menu">
        <span v-if="authStore.userProfile" class="navbar-user__name">
          {{ authStore.userProfile.name }}
        </span>

        <button v-if="authStore.isLoggedIn" type="button" class="navbar-menu__item" role="menuitem"
          @click="goProfile">
          Profile
        </button>
        <router-link v-if="showTradeOffers" to="/trade-offers" class="navbar-menu__item"
          role="menuitem" @click="open = false">
          Trade Offers
        </router-link>
        <router-link to="/settings" class="navbar-menu__item" role="menuitem" @click="open = false">
          Settings
        </router-link>

        <div v-if="showDivider" class="navbar-user__divider"></div>

        <button v-if="authStore.isAdmin" type="button"
          class="navbar-menu__item navbar-user__item--danger" role="menuitem"
          @click="open = false; emit('staffLogout')">
          Staff log out
        </button>
        <button v-if="authStore.isLoggedIn" type="button"
          class="navbar-menu__item navbar-user__item--danger" role="menuitem"
          @click="open = false; emit('signOut')">
          Sign out
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.navbar-user {
  position: relative;
}

.navbar-user__trigger--open {
  color: var(--navbar-text-strong);
  background: color-mix(in srgb, var(--navbar-text-strong) 10%, transparent);
}

.navbar-user__avatar {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-btn);
  object-fit: cover;
}

.navbar-user__panel {
  right: 0;
}

.navbar-user__name {
  padding: var(--space-xs) var(--space-md);
  color: var(--text-primary);
  font-size: var(--text-body);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.navbar-user__item--danger {
  color: var(--error);
}

.navbar-user__item--danger:hover {
  color: var(--error);
  background: color-mix(in srgb, var(--error) 12%, transparent);
}

.navbar-user__divider {
  height: 1px;
  margin: var(--space-xs) 0;
  background: var(--bg-overlay);
}
</style>
