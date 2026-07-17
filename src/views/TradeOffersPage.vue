<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import Breadcrumbs, { type Crumb } from '@/components/common/Breadcrumbs.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import PageHeaderBleed from '@/components/common/PageHeaderBleed.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import TradeOfferRow from '@/components/domain/TradeOfferRow.vue'
import { usePageMeta } from '@/composables/usePageMeta'
import { useAuthStore } from '@/stores/auth'
import { useTradeStore } from '@/stores/trades'
import type { TradeListParams, TradeStatus } from '@/types/api/trades'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

usePageMeta({
  title: 'Market Hub | AccSaber',
  description: 'Trade items with other AccSaber players.',
})

const authStore = useAuthStore()
const tradeStore = useTradeStore()
const router = useRouter()

type SectionKey = 'incoming-pending' | 'incoming-history' | 'sent-pending' | 'sent-history'

interface SectionConfig {
  direction: 'incoming' | 'outgoing'
  statuses: TradeStatus[]
  perspective: 'incoming' | 'outgoing'
  emptyMessage: string
}

const SECTIONS: Record<SectionKey, SectionConfig> = {
  'incoming-pending': {
    direction: 'incoming',
    statuses: ['pending'],
    perspective: 'incoming',
    emptyMessage: 'You have no incoming trade offers.',
  },
  'incoming-history': {
    direction: 'incoming',
    statuses: ['accepted', 'declined', 'cancelled', 'expired'],
    perspective: 'incoming',
    emptyMessage: 'No incoming offer history yet.',
  },
  'sent-pending': {
    direction: 'outgoing',
    statuses: ['pending'],
    perspective: 'outgoing',
    emptyMessage: 'You have no outgoing trade offers.',
  },
  'sent-history': {
    direction: 'outgoing',
    statuses: ['accepted', 'declined', 'cancelled', 'expired'],
    perspective: 'outgoing',
    emptyMessage: 'No sent offer history yet.',
  },
}

const PAGE_SIZE = 20

const activeKey = ref<SectionKey>('incoming-pending')
const currentPage = ref(1)
const actionBusy = ref<string | null>(null)

const isLoggedIn = computed(() => authStore.isLoggedIn)
const myUserId = computed(() => authStore.userId)

const breadcrumbs = computed<Crumb[]>(() => {
  const out: Crumb[] = []
  if (myUserId.value) {
    out.push({ label: 'Profile', to: { name: 'player-profile', params: { userId: myUserId.value } } })
  }
  out.push({ label: 'Market Hub' })
  return out
})

const totalPages = computed(() => tradeStore.tradesPage?.totalPages ?? 0)
const trades = computed(() => tradeStore.tradesPage?.content ?? [])

async function fetchActive() {
  const cfg = SECTIONS[activeKey.value]
  const params: TradeListParams = {
    direction: cfg.direction,
    status: cfg.statuses,
    page: currentPage.value - 1,
    size: PAGE_SIZE,
    sort: 'createdAt,desc',
  }
  await tradeStore.fetchTrades(params)
}

function setSection(key: SectionKey) {
  activeKey.value = key
  currentPage.value = 1
}

async function refreshAll() {
  await Promise.all([tradeStore.refreshIncomingCount(), fetchActive()])
}

async function handleAccept(tradeId: string) {
  actionBusy.value = tradeId
  try {
    await tradeStore.acceptTrade(tradeId)
    await fetchActive()
  } finally {
    actionBusy.value = null
  }
}

async function handleDecline(tradeId: string) {
  actionBusy.value = tradeId
  try {
    await tradeStore.declineTrade(tradeId)
    await fetchActive()
  } finally {
    actionBusy.value = null
  }
}

async function handleCancel(tradeId: string) {
  actionBusy.value = tradeId
  try {
    await tradeStore.cancelTrade(tradeId)
    await fetchActive()
  } finally {
    actionBusy.value = null
  }
}

watch([activeKey, currentPage], fetchActive)

onMounted(() => {
  if (!isLoggedIn.value) return
  refreshAll()
})

const incomingPendingLabel = computed(() => `(${tradeStore.pendingIncomingCount} Pending)`)
</script>

<template>
  <div class="trades-page" :style="{ '--page-accent': 'var(--accent-overall)' }">
    <Breadcrumbs class="trades-page__breadcrumbs" :crumbs="breadcrumbs" />

    <PageHeaderBleed title="Market Hub" subtitle="Items you can trade with other AccSaber players" />

    <div v-if="!isLoggedIn" class="trades-page__gate">
      <EmptyState message="Sign in to view your trade offers." />
    </div>

    <div v-else class="trades-page__layout">
      <main class="trades-page__main">
        <template v-if="tradeStore.loading">
          <div v-for="i in 4" :key="i" class="trades-page__skeleton">
            <SkeletonLoader variant="card" />
          </div>
        </template>

        <EmptyState
          v-else-if="trades.length === 0"
          :message="SECTIONS[activeKey].emptyMessage"
        />

        <template v-else>
          <TradeOfferRow
            v-for="t in trades"
            :key="t.id"
            :trade="t"
            :perspective="SECTIONS[activeKey].perspective"
            :busy="actionBusy === t.id"
            @accept="handleAccept"
            @decline="handleDecline"
            @cancel="handleCancel"
          />

          <PaginationControls
            v-if="totalPages > 1"
            :page="currentPage"
            :total-pages="totalPages"
            @update:page="(p) => currentPage = p"
          />
        </template>
      </main>

      <aside class="trades-page__sidebar">
        <BaseButton
          variant="primary"
          size="lg"
          @click="router.push({ name: 'trade-new' })"
        >New Trade Offer</BaseButton>

        <nav class="trades-page__nav">
          <button
            class="trades-page__nav-btn"
            :class="{ 'trades-page__nav-btn--active': activeKey === 'incoming-pending' }"
            @click="setSection('incoming-pending')"
          >
            <span class="trades-page__nav-label">Incoming Offers</span>
            <span class="trades-page__nav-count">{{ incomingPendingLabel }}</span>
          </button>
          <button
            class="trades-page__nav-btn trades-page__nav-btn--sub"
            :class="{ 'trades-page__nav-btn--active': activeKey === 'incoming-history' }"
            @click="setSection('incoming-history')"
          >
            <span class="trades-page__nav-label">Incoming Offer History</span>
          </button>
          <button
            class="trades-page__nav-btn"
            :class="{ 'trades-page__nav-btn--active': activeKey === 'sent-pending' }"
            @click="setSection('sent-pending')"
          >
            <span class="trades-page__nav-label">Sent Offers</span>
          </button>
          <button
            class="trades-page__nav-btn trades-page__nav-btn--sub"
            :class="{ 'trades-page__nav-btn--active': activeKey === 'sent-history' }"
            @click="setSection('sent-history')"
          >
            <span class="trades-page__nav-label">Sent Offer History</span>
          </button>
        </nav>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.trades-page {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 1280px;
  margin: 0 auto;
  width: 100%;
}

.trades-page__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: var(--space-xl);
  align-items: start;
}

.trades-page__main {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  min-width: 0;
}

.trades-page__skeleton {
  height: 96px;
}

.trades-page__sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  position: sticky;
  top: calc(var(--navbar-height, 64px) + var(--space-md));
}

.trades-page__nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  padding: var(--space-sm);
}

.trades-page__nav-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid transparent;
  border-radius: var(--radius-btn);
  background: transparent;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  text-align: left;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}

.trades-page__nav-btn:hover {
  background: var(--bg-elevated);
}

.trades-page__nav-btn--active {
  background: color-mix(in srgb, var(--page-accent) 12%, var(--bg-surface));
  border-color: color-mix(in srgb, var(--page-accent) 40%, transparent);
  color: var(--page-accent);
}

.trades-page__nav-btn--sub {
  padding-left: var(--space-lg);
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.trades-page__nav-label {
  font-weight: 500;
}

.trades-page__nav-count {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.trades-page__nav-btn--active .trades-page__nav-count {
  color: var(--page-accent);
}

.trades-page__gate {
  padding: var(--space-2xl) 0;
}

.trades-page__breadcrumbs {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
}

@media (max-width: 1023px) {
  .trades-page__layout {
    grid-template-columns: 1fr;
  }

  .trades-page__sidebar {
    position: static;
    flex-direction: column;
  }
}
</style>
