<script setup lang="ts">
import DataTable from '@/components/common/DataTable.vue'
import ItemHoldersTooltip from '@/components/domain/ItemHoldersTooltip.vue'
import ItemPreview from '@/components/domain/ItemPreview.vue'
import ModifierChip from '@/components/domain/ModifierChip.vue'
import { useItemModifierStore } from '@/stores/itemModifiers'
import type { ItemRarity, ItemResponse, ItemTypeKey } from '@/types/api/items'
import type { TableColumn } from '@/types/display'
import { rarityClass, resolveModifierRefs } from '@/utils/items'
import { getRankClass } from '@/utils/ranking'
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import LeaderboardPlayerCell from './LeaderboardPlayerCell.vue'

const props = defineProps<{
  columns: TableColumn[]
  rows: Record<string, unknown>[]
  loading: boolean
  board: string
}>()

const router = useRouter()
const modifierStore = useItemModifierStore()

const isScarcity = computed(() => props.board === 'rarest-items')
const hasOwner = computed(() => props.board === 'rarest-unboxed' || props.board === 'first-edition-holders')
const isItemBoard = computed(() => isScarcity.value || hasOwner.value)

function rowTo(row: Record<string, unknown>) {
  if (isScarcity.value) return undefined
  const userId = (hasOwner.value ? row.ownerUserId : row.userId) as string | undefined
  if (userId) return { name: 'player-profile', params: { userId } }
  return undefined
}

function pushRow(row: Record<string, unknown>) {
  const target = rowTo(row)
  if (target) router.push(target)
}

function fmtInt(value: unknown): string {
  return Number(value ?? 0).toLocaleString()
}

function fmtEssence(value: unknown): string {
  return `✦ ${Number(value ?? 0).toLocaleString()}`
}

function fmtPercent(value: unknown): string {
  const raw = Number(value ?? 0)
  const pct = raw <= 1 ? raw * 100 : raw
  return `${pct.toFixed(1)}%`
}

function syntheticItem(row: Record<string, unknown>): ItemResponse {
  return {
    id: row.itemId as string,
    typeId: (row.itemTypeId as string | undefined) ?? '',
    typeKey: row.typeKey as ItemTypeKey,
    name: row.itemName as string,
    description: null,
    iconUrl: (row.iconUrl as string | null) ?? null,
    value: (row.itemValue as ItemResponse['value'] | undefined) ?? null,
    rarity: row.rarity as ItemRarity,
    downloadable: false,
    tradeable: false,
    visible: true,
    active: true,
    deprecated: false,
    stackable: false,
    welcomeGrant: false,
    missionPoolable: false,
    unlockLevel: null,
    worth: null,
    requirement: null,
    createdAt: '',
  }
}

function resolveModifiers(keys: unknown) {
  return resolveModifierRefs(keys, modifierStore.byKey)
}

function typeLabel(typeKey: unknown): string {
  return String(typeKey ?? '').replace(/_/g, ' ')
}

onMounted(() => {
  if (props.board === 'rarest-unboxed') modifierStore.fetchModifiers()
})
</script>

<template>
  <DataTable :columns="columns" :rows="rows" :loading="loading" :loading-rows="10" :row-clickable="!isScarcity"
    :row-to="isScarcity ? undefined : rowTo" row-key="rank" empty-message="No records found">

    <template #cell-rank="{ value }">
      <span class="rank-cell" :class="getRankClass(value as number)">#{{ value }}</span>
    </template>

    <template #cell-player="{ row }">
      <LeaderboardPlayerCell :user-id="(row.userId as string)" :user-name="(row.userName as string)"
        :avatar-url="(row.avatarUrl as string)"
        :avatar-fallback-url="(row.avatarFallbackUrl as string | null | undefined) ?? null"
        :country="(row.country as string)" />
    </template>

    <template #cell-owner="{ row }">
      <LeaderboardPlayerCell :user-id="(row.ownerUserId as string)" :user-name="(row.ownerUserName as string)"
        :avatar-url="(row.ownerAvatarUrl as string)"
        :avatar-fallback-url="(row.ownerAvatarFallbackUrl as string | null | undefined) ?? null"
        :country="(row.ownerCountry as string)" />
    </template>

    <template #cell-item="{ row }">
      <div class="item-cell">
        <span class="item-cell__frame" :class="rarityClass(row.rarity as ItemRarity)">
          <ItemPreview :item="syntheticItem(row)" />
        </span>
        <div class="item-cell__info">
          <span class="item-cell__name" :class="rarityClass(row.rarity as ItemRarity)">{{ row.itemName }}</span>
          <span class="item-cell__meta">
            <span class="item-cell__type">{{ typeLabel(row.typeKey) }}</span>
            <span v-if="row.serialNumber != null" class="item-cell__serial">#{{ row.serialNumber }}</span>
          </span>
        </div>
        <ItemHoldersTooltip v-if="isScarcity" class="item-cell__owners" :item-id="(row.itemId as string)"
          :item-name="(row.itemName as string)" :owner-count="(row.ownerCount as number)" />
      </div>
    </template>

    <template #cell-modifiers="{ row }">
      <div class="modifiers-cell">
        <template v-if="resolveModifiers(row.modifiers).length || row.unusualEffect">
          <ModifierChip v-for="mod in resolveModifiers(row.modifiers)" :key="mod.id" :modifier="mod" />
          <span v-if="row.unusualEffect" class="modifiers-cell__unusual">{{ row.unusualEffect }}</span>
        </template>
        <span v-else class="modifiers-cell__none">None</span>
      </div>
    </template>

    <template #cell-itemCount="{ value }"><span class="stat-accent">{{ fmtInt(value) }}</span></template>
    <template #cell-crateCount="{ value }"><span class="stat-accent">{{ fmtInt(value) }}</span></template>
    <template #cell-firstEditionCount="{ value }"><span class="stat-accent">{{ fmtInt(value) }}</span></template>
    <template #cell-tradeCount="{ value }"><span class="stat-accent">{{ fmtInt(value) }}</span></template>
    <template #cell-itemsTraded="{ value }">{{ fmtInt(value) }}</template>
    <template #cell-ownedCount="{ value }"><span class="stat-accent">{{ fmtInt(value) }}</span></template>
    <template #cell-catalogTotal="{ value }">{{ fmtInt(value) }}</template>
    <template #cell-completionPercent="{ value }"><span class="stat-accent">{{ fmtPercent(value) }}</span></template>
    <template #cell-ownerCount="{ value }"><span class="stat-accent">{{ fmtInt(value) }}</span></template>
    <template #cell-instanceCount="{ value }">{{ fmtInt(value) }}</template>
    <template #cell-itemsValue="{ value }">{{ fmtEssence(value) }}</template>
    <template #cell-essenceBalance="{ value }">{{ fmtEssence(value) }}</template>
    <template #cell-totalValue="{ value }"><span class="stat-essence">{{ fmtEssence(value) }}</span></template>
    <template #cell-essenceEarned="{ value }"><span class="stat-essence">{{ fmtEssence(value) }}</span></template>

    <template #mobile-card="{ row }">
      <div v-if="isItemBoard" class="stats-card stats-card--item" :class="{ 'stats-card--static': isScarcity }"
        @click="pushRow(row)">
        <div class="stats-card__head">
          <span class="stats-card__rank rank-cell" :class="getRankClass(row.rank as number)">#{{ row.rank }}</span>
          <span class="item-cell__frame item-cell__frame--sm" :class="rarityClass(row.rarity as ItemRarity)">
            <ItemPreview :item="syntheticItem(row)" />
          </span>
          <div class="item-cell__info">
            <span class="item-cell__name" :class="rarityClass(row.rarity as ItemRarity)">{{ row.itemName }}</span>
            <span class="item-cell__meta">
              <span class="item-cell__type">{{ typeLabel(row.typeKey) }}</span>
              <span v-if="row.serialNumber != null" class="item-cell__serial">#{{ row.serialNumber }}</span>
            </span>
          </div>
          <span v-if="hasOwner" class="stats-card__badge item-cell__name" :class="rarityClass(row.rarity as ItemRarity)">
            {{ row.rarity }}
          </span>
          <ItemHoldersTooltip v-if="isScarcity" :item-id="(row.itemId as string)"
            :item-name="(row.itemName as string)" :owner-count="(row.ownerCount as number)" />
        </div>

        <div class="stats-card__details">
          <div v-if="hasOwner" class="stats-card__detail">
            <span class="stats-card__label">{{ board === 'first-edition-holders' ? 'Holder' : 'Owner' }}</span>
            <LeaderboardPlayerCell :user-id="(row.ownerUserId as string)" :user-name="(row.ownerUserName as string)"
              :avatar-url="(row.ownerAvatarUrl as string)"
              :avatar-fallback-url="(row.ownerAvatarFallbackUrl as string | null | undefined) ?? null"
              :country="(row.ownerCountry as string)" :size="24" />
          </div>
          <div v-if="board === 'rarest-unboxed'" class="stats-card__detail stats-card__detail--stacked">
            <span class="stats-card__label">Modifiers</span>
            <div class="modifiers-cell">
              <template v-if="resolveModifiers(row.modifiers).length || row.unusualEffect">
                <ModifierChip v-for="mod in resolveModifiers(row.modifiers)" :key="mod.id" :modifier="mod" />
                <span v-if="row.unusualEffect" class="modifiers-cell__unusual">{{ row.unusualEffect }}</span>
              </template>
              <span v-else class="modifiers-cell__none">None</span>
            </div>
          </div>
          <div v-if="isScarcity" class="stats-card__counts">
            <span class="stats-card__count">
              <span class="stats-card__label">Owners</span>
              <span class="stat-accent">{{ fmtInt(row.ownerCount) }}</span>
            </span>
            <span class="stats-card__count">
              <span class="stats-card__label">Copies</span>
              <span>{{ fmtInt(row.instanceCount) }}</span>
            </span>
          </div>
        </div>
      </div>

      <div v-else class="stats-card" @click="pushRow(row)">
        <span class="stats-card__rank rank-cell" :class="getRankClass(row.rank as number)">#{{ row.rank }}</span>

        <div class="stats-card__player">
          <LeaderboardPlayerCell :user-id="(row.userId as string)" :user-name="(row.userName as string)"
            :avatar-url="(row.avatarUrl as string)"
            :avatar-fallback-url="(row.avatarFallbackUrl as string | null | undefined) ?? null"
            :country="(row.country as string)" :size="28" />
        </div>

        <span class="stats-card__stat">
          <template v-if="board === 'most-items'"><span class="stat-accent">{{ fmtInt(row.itemCount) }}</span></template>
          <template v-else-if="board === 'most-crates-opened'"><span class="stat-accent">{{ fmtInt(row.crateCount) }}</span></template>
          <template v-else-if="board === 'most-valuable-inventory'"><span class="stat-essence">{{ fmtEssence(row.totalValue) }}</span></template>
          <template v-else-if="board === 'first-editions'"><span class="stat-accent">{{ fmtInt(row.firstEditionCount) }}</span></template>
          <template v-else-if="board === 'most-complete-collection'"><span class="stat-accent">{{ fmtPercent(row.completionPercent) }}</span></template>
          <template v-else-if="board === 'biggest-traders'"><span class="stat-accent">{{ fmtInt(row.tradeCount) }}</span></template>
          <template v-else-if="board === 'most-essence-earned'"><span class="stat-essence">{{ fmtEssence(row.essenceEarned) }}</span></template>
        </span>
      </div>
    </template>
  </DataTable>
</template>

<style scoped>
.rank-cell {
  font-family: var(--font-mono);
  font-weight: 500;
  color: var(--text-secondary);
}

.rank-cell.rank--gold { color: var(--tier-gold); font-weight: 700; }
.rank-cell.rank--silver { color: var(--tier-silver); font-weight: 700; }
.rank-cell.rank--bronze { color: var(--tier-bronze); font-weight: 700; }

.stat-accent {
  color: var(--page-accent);
  font-weight: 600;
}

.stat-essence {
  color: var(--tier-gold);
  font-weight: 600;
}

.item-cell {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
}

.item-cell__frame {
  --rarity-color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  background: var(--bg-base);
  border: 1px solid var(--rarity-color);
  border-radius: var(--radius-card);
  overflow: hidden;
}

.item-cell__frame--sm {
  width: 30px;
  height: 30px;
}

.item-cell__frame.rarity--common { --rarity-color: var(--text-tertiary); }
.item-cell__frame.rarity--uncommon { --rarity-color: var(--success); }
.item-cell__frame.rarity--rare { --rarity-color: var(--info); }
.item-cell__frame.rarity--epic { --rarity-color: var(--tier-apex); }
.item-cell__frame.rarity--legendary { --rarity-color: var(--tier-gold); }
.item-cell__frame.rarity--mythic { --rarity-color: var(--error); }

.item-cell__info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.item-cell__owners {
  flex-shrink: 0;
  margin-left: var(--space-xs);
}

.item-cell__name {
  --rarity-color: var(--text-primary);
  font-weight: 500;
  color: var(--rarity-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-cell__name.rarity--common { --rarity-color: var(--text-primary); }
.item-cell__name.rarity--uncommon { --rarity-color: var(--success); }
.item-cell__name.rarity--rare { --rarity-color: var(--info); }
.item-cell__name.rarity--epic { --rarity-color: var(--tier-apex); }
.item-cell__name.rarity--legendary { --rarity-color: var(--tier-gold); }
.item-cell__name.rarity--mythic { --rarity-color: var(--error); }

.item-cell__meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.item-cell__type {
  text-transform: capitalize;
}

.item-cell__serial {
  font-family: var(--font-mono);
}

.modifiers-cell {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs);
}

.modifiers-cell__unusual {
  display: inline-flex;
  align-items: center;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid color-mix(in srgb, var(--tier-gold) 50%, transparent);
  background: color-mix(in srgb, var(--tier-gold) 10%, transparent);
  color: var(--tier-gold);
}

.modifiers-cell__none {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.stats-card {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-left: 2px solid transparent;
  border-radius: var(--radius-card);
  cursor: pointer;
  min-height: 48px;
  transition: border-color 120ms ease;
}

.stats-card:hover {
  border-left-color: var(--page-accent);
}

.stats-card--static {
  cursor: default;
}

.stats-card--static:hover {
  border-left-color: transparent;
}

.stats-card__rank {
  width: 32px;
  text-align: right;
  flex-shrink: 0;
}

.stats-card__player {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  flex: 1;
}

.stats-card__stat {
  font-family: var(--font-mono);
  flex-shrink: 0;
  margin-left: auto;
}

.stats-card--item {
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-sm);
}

.stats-card__head {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
}

.stats-card__head .item-cell__info {
  flex: 1;
}

.stats-card__badge {
  flex-shrink: 0;
  font-size: var(--text-caption);
  font-weight: 600;
  text-transform: capitalize;
}

.stats-card__details {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--bg-overlay);
}

.stats-card__detail {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  min-width: 0;
}

.stats-card__detail--stacked {
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-xs);
}

.stats-card__label {
  font-size: var(--text-caption);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.stats-card__counts {
  display: flex;
  gap: var(--space-xl);
}

.stats-card__count {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-family: var(--font-mono);
  font-weight: 600;
}
</style>
