<script setup lang="ts">
import BaseBanner from '@/components/common/BaseBanner.vue'
import AppNavbar from '@/components/layout/AppNavbar.vue'
import ThemeBackdrop from '@/components/layout/ThemeBackdrop.vue'
import { useBrandFavicon } from '@/composables/useBrandLogo'
import { useNotificationSocket } from '@/composables/useNotificationSocket'
import { initializePageFlip } from '@/composables/usePageFlip'
import { useAuthStore } from '@/stores/auth'
import { useBackendStatusStore } from '@/stores/backendStatus'
import { useEssenceStore } from '@/stores/essence'
import { useRelationsStore } from '@/stores/relations'
import { useSettingsStore } from '@/stores/settings'
import { flushPendingScores } from '@/utils/practiceScores'
import { isCreativesSubdomain } from '@/utils/subdomain'
import { computed, defineAsyncComponent, watch } from 'vue'

const PreviewControlBar = isCreativesSubdomain
  ? defineAsyncComponent(() => import('@/components/layout/PreviewControlBar.vue'))
  : null

const MaintenancePage = defineAsyncComponent(() => import('@/views/offline/MaintenancePage.vue'))

const authStore = useAuthStore()
const backendStatus = useBackendStatusStore()
const essenceStore = useEssenceStore()
const relationsStore = useRelationsStore()
const settingsStore = useSettingsStore()

initializePageFlip()
useBrandFavicon()
useNotificationSocket()

if (!backendStatus.offline) void flushPendingScores()

const showLegacyBanner = computed(() => authStore.legacyUserIdDetected !== null)

function dismissLegacyBanner() {
  authStore.dismissLegacyMigration()
}

const showRestrictedBanner = computed(() => authStore.restricted)

function dismissRestrictedBanner() {
  authStore.clearRestricted()
}

watch(
  () => authStore.isLoggedIn,
  (loggedIn) => {
    if (loggedIn) {
      void relationsStore.fetchAll()
      void settingsStore.fetchPrivacy()
      void settingsStore.fetchAppearance()
    } else {
      relationsStore.reset()
      settingsStore.reset()
      essenceStore.reset()
    }
  },
  { immediate: true },
)
</script>

<template>
  <ThemeBackdrop />
  <MaintenancePage v-if="backendStatus.offline" />
  <template v-else>
    <AppNavbar />
    <main class="main-content">
      <BaseBanner v-if="showRestrictedBanner" variant="error" @close="dismissRestrictedBanner">
        Your account is restricted. You can still browse, but creating or changing content is
        disabled. Contact staff if you think this is a mistake.
      </BaseBanner>
      <BaseBanner v-if="showLegacyBanner" variant="info" @close="dismissLegacyBanner">
        We've upgraded login. Please log in again with Discord, BeatLeader, or Steam to restore your
        personalized experience.
      </BaseBanner>
      <router-view v-slot="{ Component }">
        <transition name="page">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <component :is="PreviewControlBar" v-if="PreviewControlBar" />
  </template>
</template>

<style scoped>
.main-content {
  min-height: calc(100vh - var(--navbar-height));
  padding: var(--space-xl);
  padding-top: calc(var(--navbar-height) + var(--space-xl));
}

.page-enter-active,
.page-leave-active {
  transition:
    opacity 150ms ease,
    transform 150ms ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateX(8px);
}

.page-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

@media (max-width: 767px) {
  .main-content {
    min-height: calc(100vh - var(--navbar-height));
    padding: var(--space-md);
    padding-top: calc(var(--navbar-height) + var(--space-md));
  }
}
</style>
