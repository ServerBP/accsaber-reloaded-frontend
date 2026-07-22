<script setup lang="ts">
import { useClickOutside } from '@/composables/useClickOutside'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

interface NavLink {
  to: string
  label: string
}

const props = defineProps<{
  items: NavLink[]
}>()

const route = useRoute()
const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

useClickOutside(rootRef, open, () => {
  open.value = false
})

watch(() => route.fullPath, () => {
  open.value = false
})

function isActive(to: string): boolean {
  return route.path === to || route.path.startsWith(to + '/')
}

const anyActive = computed(() => props.items.some((item) => isActive(item.to)))
</script>

<template>
  <div ref="rootRef" class="navbar-more">
    <button type="button" class="navbar__link navbar-more__trigger"
      :class="{ 'navbar__link--active': anyActive }" aria-haspopup="menu" :aria-expanded="open"
      @click="open = !open">
      More
      <svg class="navbar-more__chevron" :class="{ 'navbar-more__chevron--open': open }" width="14"
        height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <Transition name="navbar-menu">
      <div v-if="open" class="navbar-menu navbar-more__panel" role="menu">
        <router-link v-for="item in items" :key="item.to" :to="item.to" class="navbar-menu__item"
          :class="{ 'navbar-more__item--active': isActive(item.to) }" role="menuitem"
          @click="open = false">
          {{ item.label }}
        </router-link>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.navbar-more {
  position: relative;
}

.navbar-more__trigger {
  gap: var(--space-xs);
  background: none;
  border: none;
  font-family: var(--font-sans);
  cursor: pointer;
}

.navbar-more__chevron {
  transition: transform 150ms ease;
}

.navbar-more__chevron--open {
  transform: rotate(180deg);
}

.navbar-more__panel {
  left: 0;
}

.navbar-more__item--active {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

@media (prefers-reduced-motion: reduce) {
  .navbar-more__chevron {
    transition: none;
  }
}
</style>
