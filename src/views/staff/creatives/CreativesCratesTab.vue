<script setup lang="ts">
import CratePreview from '@/components/domain/CratePreview.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ItemPreview from '@/components/domain/ItemPreview.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import { useItemTypeStore } from '@/stores/itemTypes'
import type { ItemResponse } from '@/types/api/items'
import { computed, onMounted, ref } from 'vue'

const itemTypeStore = useItemTypeStore()

const crates = ref<ItemResponse[]>([])
const loading = ref(true)
const errored = ref(false)

const selectedCrate = ref<ItemResponse | null>(null)
const previewOpen = ref(false)

const crateTypeId = computed(() => itemTypeStore.byKey.get('crate')?.id ?? null)

function statusOf(c: ItemResponse): 'Live' | 'Draft' | 'Deprecated' {
  if (c.deprecated) return 'Deprecated'
  if (!c.active) return 'Draft'
  return 'Live'
}

async function load() {
  loading.value = true
  errored.value = false
  try {
    await itemTypeStore.fetchItemTypes()
    if (!crateTypeId.value) {
      crates.value = []
      return
    }
    const { getStaffItems } = await import('@/api/staff/items')
    const items = await getStaffItems({ typeId: crateTypeId.value, includeInactive: true })
    crates.value = items
  } catch {
    errored.value = true
  } finally {
    loading.value = false
  }
}

function openPreview(c: ItemResponse) {
  selectedCrate.value = c
  previewOpen.value = true
}

onMounted(load)
</script>

<template>
  <div class="creatives-crates">
    <header class="creatives-crates__header">
      <div>
        <h1 class="creatives-crates__title">Crate Preview</h1>
        <p class="creatives-crates__meta">
          Every crate, including unreleased drafts. Open one to inspect its reward pool,
          roll-on modifiers and possible unusual effects with drop chances.
        </p>
      </div>
      <span v-if="!loading && crates.length" class="creatives-crates__count">
        {{ crates.length }} crate{{ crates.length === 1 ? '' : 's' }}
      </span>
    </header>

    <div v-if="loading" class="creatives-crates__grid">
      <SkeletonLoader v-for="i in 8" :key="i" variant="card" />
    </div>

    <EmptyState
      v-else-if="errored"
      message="The staff item catalog could not be reached. Try again."
    />

    <EmptyState
      v-else-if="!crates.length"
      message="There are no crates in the catalog yet."
    />

    <div v-else class="creatives-crates__grid">
      <button
        v-for="crate in crates"
        :key="crate.id"
        type="button"
        class="crate-card"
        @click="openPreview(crate)"
      >
        <span class="crate-card__status" :class="`crate-card__status--${statusOf(crate).toLowerCase()}`">
          {{ statusOf(crate) }}
        </span>
        <div class="crate-card__visual">
          <ItemPreview :item="crate" />
        </div>
        <div class="crate-card__body">
          <span class="crate-card__name">{{ crate.name || 'Untitled crate' }}</span>
          <span class="crate-card__rarity" :class="`rarity--${crate.rarity}`">{{ crate.rarity }}</span>
        </div>
      </button>
    </div>

    <CratePreview :open="previewOpen" :crate="selectedCrate" @close="previewOpen = false" />
  </div>
</template>

<style scoped>
.creatives-crates {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.creatives-crates__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-lg);
  flex-wrap: wrap;
}

.creatives-crates__title {
  font-size: var(--text-page-title);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.creatives-crates__meta {
  font-size: var(--text-body);
  color: var(--text-secondary);
  margin: var(--space-xs) 0 0;
  max-width: 60ch;
  line-height: 1.5;
}

.creatives-crates__count {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  white-space: nowrap;
}

.creatives-crates__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-md);
}

.crate-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  cursor: pointer;
  text-align: left;
  transition: border-color 120ms ease, transform 120ms ease;
}

.crate-card:hover {
  border-color: var(--text-tertiary);
  transform: scale(1.01);
}

.crate-card__status {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  z-index: 1;
  padding: 2px var(--space-sm);
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
  border: 1px solid var(--status-color, var(--bg-overlay));
  color: var(--status-color, var(--text-secondary));
  background: var(--bg-surface);
}

.crate-card__status--live {
  --status-color: var(--success);
}

.crate-card__status--draft {
  --status-color: var(--warning);
}

.crate-card__status--deprecated {
  --status-color: var(--text-tertiary);
}

.crate-card__visual {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  overflow: hidden;
}

.crate-card__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.crate-card__name {
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.crate-card__rarity {
  font-size: var(--text-caption);
  text-transform: capitalize;
  color: var(--rarity-color, var(--text-secondary));
  font-weight: 500;
}

.crate-card__rarity.rarity--common {
  --rarity-color: var(--text-tertiary);
}

.crate-card__rarity.rarity--uncommon {
  --rarity-color: var(--success);
}

.crate-card__rarity.rarity--rare {
  --rarity-color: var(--info);
}

.crate-card__rarity.rarity--epic {
  --rarity-color: var(--tier-apex);
}

.crate-card__rarity.rarity--legendary {
  --rarity-color: var(--tier-gold);
}

.crate-card__rarity.rarity--mythic {
  --rarity-color: var(--error);
}
</style>
