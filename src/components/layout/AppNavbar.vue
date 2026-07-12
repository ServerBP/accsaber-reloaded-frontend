<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import GlobalSearchModal from '@/components/domain/GlobalSearchModal.vue'
import MissionsDropdown from '@/components/domain/MissionsDropdown.vue'
import PseudoLoginModal from '@/components/domain/PseudoLoginModal.vue'
import { useAuthStore } from '@/stores/auth'
import { onAvatarError } from '@/composables/useAvatarFallback'
import { useBrandLogo } from '@/composables/useBrandLogo'
import { isAdminSubdomain, isCreativesSubdomain, isRankingSubdomain, isStaffSubdomain, playerProfileHref } from '@/utils/subdomain'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const logoSrc = useBrandLogo()

const loginModalOpen = ref(false)
const searchModalOpen = ref(false)
const showStaffLogoutConfirm = ref(false)
const mobileDrawerOpen = ref(false)
const scrolled = ref(false)
const avatarFailed = ref(false)

watch(() => authStore.userProfile?.avatarUrl, () => {
  avatarFailed.value = false
})

const navAvatarError = (event: Event) => {
  const fallback = authStore.userProfile?.avatarFallbackUrl ?? null
  const img = event.currentTarget as HTMLImageElement
  if (fallback && img.dataset.fellBack !== '1') {
    onAvatarError(fallback)(event)
    return
  }
  avatarFailed.value = true
}

type MobileIcon = 'leaderboard' | 'map' | 'milestone'
interface NavItem {
  to: string
  label: string
  mobileIcon?: MobileIcon
}

const publicNavItems: NavItem[] = [
  { to: '/leaderboards', label: 'Leaderboards', mobileIcon: 'leaderboard' },
  { to: '/maps', label: 'Maps', mobileIcon: 'map' },
  { to: '/campaigns', label: 'Campaigns' },
  { to: '/milestones', label: 'Milestones', mobileIcon: 'milestone' },
  { to: '/stats', label: 'Stats' },
  { to: '/ranked-queue', label: 'Ranking Queue' },
]

const adminNavItems: NavItem[] = [
  { to: '/?tab=users', label: 'Users' },
  { to: '/?tab=staff', label: 'Staff' },
  { to: '/?tab=maps', label: 'Maps' },
  { to: '/?tab=batches', label: 'Batches' },
  { to: '/?tab=milestones', label: 'Milestones' },
  { to: '/?tab=campaigns', label: 'Campaigns' },
  { to: '/?tab=items', label: 'Items' },
  { to: '/?tab=curves', label: 'Curves' },
  { to: '/?tab=news', label: 'News' },
  { to: '/?tab=events', label: 'Events' },
  { to: '/?tab=operations', label: 'Operations' },
  { to: '/?tab=duplicates', label: 'Duplicates' },
]

const rankingPrefix = isRankingSubdomain ? '' : '/staff/ranking'

const batchesPath = isRankingSubdomain ? '/batches' : '/staff/ranking/batches'
const activityPath = isRankingSubdomain ? '/activity' : '/staff/ranking/activity'
const deactivatedPath = isRankingSubdomain ? '/deactivated' : '/staff/ranking/deactivated'

const reweightPath = isRankingSubdomain ? '/reweight' : '/staff/ranking/reweight'
const newsPath = isRankingSubdomain ? '/news' : '/staff/ranking/news'

const rankingNavItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [
    { to: rankingPrefix || '/', label: 'Queue' },
    { to: `${rankingPrefix}/import`, label: 'Import' },
    { to: batchesPath, label: 'Batches' },
  ]
  if (authStore.hasRole('RANKING_HEAD')) {
    items.push({ to: reweightPath, label: 'Reweight' })
    items.push({ to: newsPath, label: 'News' })
  }
  items.push({ to: activityPath, label: 'Activity' })
  items.push({ to: deactivatedPath, label: 'Deactivated' })
  return items
})

const creativesBase = isCreativesSubdomain ? '/manage' : '/staff/creatives'
const creativesNavItems: NavItem[] = [
  ...publicNavItems,
  { to: creativesBase, label: 'Crates' },
]

const isRankingContext = computed(() =>
  isRankingSubdomain || route.path.startsWith('/staff/ranking')
)

const isCreativesContext = computed(() =>
  isCreativesSubdomain || route.path.startsWith('/staff/creatives')
)

const showNewsAction = computed(() =>
  !isAdminSubdomain && !isCreativesSubdomain && !(isRankingContext.value && authStore.isStaffAuthorized),
)

const showMissionsAction = computed(() =>
  authStore.isLoggedIn && !isAdminSubdomain && !isRankingSubdomain && !isCreativesSubdomain,
)

const navItems = computed(() => {
  if (isRankingContext.value && authStore.isStaffAuthorized) {
    return rankingNavItems.value
  }
  if (isCreativesContext.value && authStore.hasCreativeAccess) return creativesNavItems
  if (isAdminSubdomain) return adminNavItems
  if (isRankingSubdomain) return rankingNavItems.value
  if (isCreativesSubdomain) return creativesNavItems
  return publicNavItems
})
const mobileQuickItems = computed(() =>
  navItems.value.filter((item): item is NavItem & { mobileIcon: MobileIcon } => !!item.mobileIcon)
)

function isActive(to: string): boolean {
  if (to.includes('?tab=')) {
    const tab = to.split('?tab=')[1]
    return route.query.tab === tab
  }
  if (to === '/') return route.path === '/' && !route.query.tab
  return route.path === to || route.path.startsWith(to + '/')
}

function handleUserClick() {
  if (authStore.isLoggedIn && authStore.userId) {
    if (isStaffSubdomain) {
      window.location.assign(playerProfileHref(authStore.userId))
    } else {
      router.push({ name: 'player-profile', params: { userId: authStore.userId } })
    }
  } else {
    loginModalOpen.value = true
  }
  mobileDrawerOpen.value = false
}

async function confirmStaffLogout() {
  showStaffLogoutConfirm.value = false
  mobileDrawerOpen.value = false
  await authStore.staffLogout()
}

function openSearch() {
  searchModalOpen.value = true
  mobileDrawerOpen.value = false
}

function onScroll() {
  scrolled.value = window.scrollY > 4
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <header class="navbar" :class="{ 'navbar--scrolled': scrolled }">
    <div class="navbar__inner">
      <router-link to="/" class="navbar__logo" aria-label="Home">
        <img :src="logoSrc" alt="AccSaber" class="navbar__logo-img" fetchpriority="high" decoding="async" />
      </router-link>

      <div class="navbar__mobile-quick">
        <router-link v-for="item in mobileQuickItems" :key="item.to" :to="item.to" class="navbar__icon-btn"
          :class="{ 'navbar__icon-btn--active': isActive(item.to) }" :aria-label="item.label">
          <svg v-if="item.mobileIcon === 'leaderboard'" width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <svg v-else-if="item.mobileIcon === 'map'" width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          <svg v-else-if="item.mobileIcon === 'milestone'" width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
        </router-link>
      </div>

      <nav class="navbar__nav" aria-label="Main navigation">
        <router-link v-for="item in navItems" :key="item.to" :to="item.to" class="navbar__link"
          :class="{ 'navbar__link--active': isActive(item.to) }">
          {{ item.label }}
        </router-link>
      </nav>

      <div class="navbar__actions">
        <router-link
          v-if="showNewsAction"
          to="/news"
          class="navbar__icon-btn navbar__icon-btn--desktop-only"
          :class="{ 'navbar__icon-btn--active': isActive('/news') }"
          aria-label="News"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 11l18-8v18L3 13z" />
            <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
          </svg>
        </router-link>

        <MissionsDropdown v-if="showMissionsAction" />

        <button type="button" class="navbar__search" @click="openSearch">
          <svg class="navbar__search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span class="navbar__search-placeholder">Search anything...</span>
        </button>

        <button class="navbar__icon-btn" :aria-label="authStore.isLoggedIn ? 'Profile' : 'Log in'"
          @click="handleUserClick">
          <img
            v-if="authStore.isLoggedIn && authStore.userProfile?.avatarUrl && !avatarFailed"
            :src="authStore.userProfile.avatarUrl" :alt="authStore.userProfile.name" class="navbar__avatar"
            decoding="async" @error="navAvatarError" />
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>

        <button v-if="authStore.isAdmin"
          class="navbar__icon-btn navbar__logout navbar__icon-btn--desktop-only" aria-label="Staff log out"
          @click="showStaffLogoutConfirm = true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </button>

        <router-link to="/settings" class="navbar__icon-btn navbar__icon-btn--desktop-only"
          :class="{ 'navbar__icon-btn--active': isActive('/settings') }" aria-label="Settings">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </router-link>

        <button class="navbar__icon-btn navbar__hamburger" aria-label="Menu"
          @click="mobileDrawerOpen = !mobileDrawerOpen">
          <svg v-if="!mobileDrawerOpen" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  </header>

  <div v-if="mobileDrawerOpen" class="navbar__backdrop" @click="mobileDrawerOpen = false"></div>

  <div class="navbar__drawer" :class="{ 'navbar__drawer--open': mobileDrawerOpen }">
    <section class="navbar__drawer-section">
      <button type="button" class="navbar__drawer-search" @click="openSearch">
        <svg class="navbar__search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span class="navbar__search-placeholder">Search anything...</span>
      </button>
    </section>

    <section class="navbar__drawer-section">
      <router-link v-for="item in navItems" :key="item.to" :to="item.to" class="navbar__drawer-link"
        :class="{ 'navbar__drawer-link--active': isActive(item.to) }" @click="mobileDrawerOpen = false">
        {{ item.label }}
      </router-link>
    </section>

    <section class="navbar__drawer-section">
      <router-link v-if="showNewsAction" to="/news" class="navbar__drawer-link"
        :class="{ 'navbar__drawer-link--active': isActive('/news') }" @click="mobileDrawerOpen = false">
        News
      </router-link>
      <router-link to="/settings" class="navbar__drawer-link"
        :class="{ 'navbar__drawer-link--active': isActive('/settings') }" @click="mobileDrawerOpen = false">
        Settings
      </router-link>
      <button v-if="authStore.isAdmin"
        class="navbar__drawer-link navbar__drawer-link--danger"
        @click="mobileDrawerOpen = false; showStaffLogoutConfirm = true">
        Staff log out
      </button>
    </section>
  </div>

  <GlobalSearchModal :open="searchModalOpen" @close="searchModalOpen = false" />

  <PseudoLoginModal :open="loginModalOpen" @close="loginModalOpen = false" />

  <BaseModal :open="showStaffLogoutConfirm" title="Staff Log Out" max-width="340px"
    @close="showStaffLogoutConfirm = false">
    <p class="logout-confirm__message">Are you sure you want to log out of the staff panel?</p>
    <template #footer>
      <div class="logout-confirm__actions">
        <BaseButton @click="showStaffLogoutConfirm = false">Cancel</BaseButton>
        <BaseButton variant="destructive" @click="confirmStaffLogout">Log Out</BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

<style>
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  height: var(--navbar-height);
  background: var(--navbar-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition: box-shadow 200ms ease, background 200ms ease;
}

.navbar--scrolled {
  background: var(--navbar-bg-scrolled);
  box-shadow: 0 1px 0 var(--bg-overlay), 0 8px 24px rgba(0, 0, 0, 0.18);
}

.navbar__inner {
  max-width: 1440px;
  height: 100%;
  margin: 0 auto;
  padding: 0 var(--space-xl);
  display: flex;
  align-items: center;
  gap: var(--space-lg);
}

.navbar__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: var(--space-xs);
  border-radius: var(--radius-btn);
  text-decoration: none;
  transition: background 120ms ease;
}

.navbar__logo:hover {
  background: color-mix(in srgb, var(--navbar-text-strong) 10%, transparent);
}

.navbar__logo-img {
  width: 40px;
  height: 40px;
  display: block;
}

.navbar__nav {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex: 1;
}

.navbar__link {
  position: relative;
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 var(--space-md);
  font-size: var(--text-body);
  font-weight: 500;
  color: var(--navbar-text);
  text-decoration: none;
  border-radius: var(--radius-btn);
  transition: color 120ms ease, background 120ms ease;
}

.navbar__link:hover {
  color: var(--navbar-text-strong);
  background: color-mix(in srgb, var(--navbar-text-strong) 10%, transparent);
}

.navbar__link--active {
  color: var(--navbar-text-strong);
}

.navbar__link--active::after {
  content: '';
  position: absolute;
  left: var(--space-md);
  right: var(--space-md);
  bottom: -4px;
  height: 2px;
  background: var(--accent);
  border-radius: 1px;
}

.navbar__actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

.navbar__search {
  position: relative;
  display: flex;
  align-items: center;
  width: 220px;
  height: 36px;
  padding: 0 var(--space-sm) 0 calc(var(--space-sm) + 22px);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  color: var(--text-tertiary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  cursor: pointer;
  text-align: left;
  transition: border-color 120ms ease, box-shadow 120ms ease, color 120ms ease;
}

.navbar__search:hover {
  border-color: var(--text-tertiary);
  color: var(--text-secondary);
}

.navbar__search:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent);
}

.navbar__search-icon {
  position: absolute;
  left: var(--space-sm);
  color: var(--text-tertiary);
  pointer-events: none;
}

.navbar__search-placeholder {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.navbar__icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: none;
  border: none;
  border-radius: var(--radius-btn);
  color: var(--navbar-text);
  cursor: pointer;
  transition: color 120ms ease, background 120ms ease;
}

.navbar__icon-btn:hover {
  color: var(--navbar-text-strong);
  background: color-mix(in srgb, var(--navbar-text-strong) 10%, transparent);
}

.navbar__logout:hover {
  color: var(--error);
}

.navbar__avatar {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-btn);
  object-fit: cover;
}

.navbar__hamburger {
  display: none;
}

.navbar__mobile-quick {
  display: none;
}

.navbar__backdrop,
.navbar__drawer {
  display: none;
}

.logout-confirm__message {
  color: var(--text-secondary);
  font-size: var(--text-body);
  margin: 0;
}

.logout-confirm__actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
}

@media (max-width: 1023px) {
  .navbar__search {
    width: 160px;
  }
}

@media (max-width: 767px) {
  .navbar__inner {
    padding: 0 var(--space-md);
    gap: var(--space-sm);
  }

  .navbar__logo-img {
    width: 36px;
    height: 36px;
  }

  .navbar__nav,
  .navbar__search,
  .navbar__icon-btn--desktop-only {
    display: none;
  }

  .navbar__mobile-quick {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    flex: 1;
    min-width: 0;
  }

  .navbar__mobile-quick .navbar__icon-btn {
    flex: 1;
    width: auto;
    height: 44px;
  }

  .navbar__icon-btn--active {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .navbar__hamburger {
    display: flex;
  }

  .navbar__backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .navbar__drawer {
    display: flex;
    position: fixed;
    top: var(--navbar-height);
    left: var(--space-md);
    right: var(--space-md);
    z-index: 101;
    flex-direction: column;
    gap: var(--space-xs);
    padding: var(--space-md);
    background: color-mix(in srgb, var(--bg-elevated) 96%, transparent);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--bg-overlay);
    border-radius: var(--radius-card);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
    opacity: 0;
    transform: translateY(-8px);
    pointer-events: none;
    transition: opacity 180ms ease, transform 180ms ease;
  }

  .navbar__drawer--open {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  .navbar__drawer-search {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    height: 44px;
    padding: 0 var(--space-md) 0 calc(var(--space-md) + 24px);
    background: var(--bg-base);
    border: 1px solid var(--bg-overlay);
    border-radius: var(--radius-btn);
    color: var(--text-tertiary);
    font-family: var(--font-sans);
    font-size: var(--text-body);
    cursor: pointer;
    text-align: left;
  }

  .navbar__drawer-search .navbar__search-icon {
    position: absolute;
    left: var(--space-md);
  }

  .navbar__drawer-link {
    display: flex;
    align-items: center;
    width: 100%;
    height: 44px;
    padding: 0 var(--space-md);
    font-family: var(--font-sans);
    font-size: var(--text-body);
    font-weight: 500;
    color: var(--text-secondary);
    text-decoration: none;
    background: none;
    border: none;
    border-radius: var(--radius-btn);
    cursor: pointer;
    text-align: left;
    transition: color 120ms ease, background 120ms ease;
  }

  .navbar__drawer-link:hover {
    color: var(--text-primary);
    background: var(--bg-surface);
  }

  .navbar__drawer-link--active {
    color: var(--text-primary);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .navbar__drawer-link--danger {
    color: var(--error);
  }

  .navbar__drawer-link--danger:hover {
    color: var(--error);
    background: color-mix(in srgb, var(--error) 12%, transparent);
  }

  .navbar__drawer-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .navbar__drawer-section+.navbar__drawer-section {
    margin-top: var(--space-sm);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--bg-overlay);
  }
}
</style>
