<script setup lang="ts">
import {
  deleteAdminCrateContent,
  deleteAdminCrateModifier,
  deleteAdminCrateUnusualEffect,
  getAdminCrateContents,
  getAdminCrateModifiers,
  getAdminCrateUnusualEffects,
  putAdminCrateContent,
  putAdminCrateModifier,
  putAdminCrateUnusualEffect,
  type CrateContentResponse,
  type CrateModifierResponse,
} from '@/api/admin/crates'
import { getAdminUnusualEffects } from '@/api/admin/unusual-effects'
import {
  deleteItemIcon,
  getAdminItem,
  getAdminItems,
  reactivateItem,
  deleteItem as retireItem,
  updateItem,
  uploadItemIcon,
} from '@/api/admin/items'
import { getItemModifiers } from '@/api/items'
import { ApiError, getApiErrorMessage, parseApiError } from '@/api/client'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ImageUploader from '@/components/common/ImageUploader.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import CrateOpenAnimation from '@/components/domain/CrateOpenAnimation.vue'
import CratePreviewModal from '@/components/domain/CratePreviewModal.vue'
import { usePageMeta } from '@/composables/usePageMeta'
import type {
  ItemModifierResponse,
  ItemRarity,
  ItemResponse,
  ItemTypeKey,
  UnusualEffectResponse,
  UpdateItemRequest,
} from '@/types/api/items'
import { createCrateRoller, type CrateRoll } from '@/utils/crateRoll'
import { RARITY_ORDER } from '@/utils/items'
import { decimalToPercent, percentToDecimal } from '@/utils/modifiers'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const crateId = computed(() => String(route.params.crateItemId))

const crate = ref<ItemResponse | null>(null)

usePageMeta({
  title: computed(() =>
    crate.value ? `${crate.value.name} | AccSaber Admin` : 'Crate | AccSaber Admin',
  ),
  description: 'Crate editor.',
})

const contents = ref<CrateContentResponse[]>([])
const allItems = ref<ItemResponse[]>([])
const attachedModifiers = ref<CrateModifierResponse[]>([])
const allModifiers = ref<ItemModifierResponse[]>([])
const attachedEffects = ref<UnusualEffectResponse[]>([])
const allEffects = ref<UnusualEffectResponse[]>([])
const loading = ref(true)
const errorMsg = ref<string | null>(null)

const search = ref('')
const allowNestedCrates = ref(false)
const groupByType = ref(true)

const metaSaving = ref(false)
const statusBusy = ref(false)
const previewOpen = ref(false)

const selectedIds = ref<Set<string>>(new Set())
const bulkWeight = ref(100)
const bulkBusy = ref(false)

const form = ref({
  name: '',
  description: '',
  rarity: 'common' as ItemRarity,
  tradeable: false,
  visible: true,
  stackable: true,
  welcomeGrant: false,
  missionPoolable: false,
})

const rarityOptions = RARITY_ORDER.map((r) => ({ value: r, label: r }))

const rewardIds = computed(() => new Set(contents.value.map((c) => c.rewardItem.id)))

const totalWeight = computed(() =>
  contents.value.reduce((s, c) => s + c.dropWeight, 0),
)

const filteredItems = computed(() => {
  const q = search.value.trim().toLowerCase()
  return allItems.value.filter((i) => {
    if (i.deprecated) return false
    if (!allowNestedCrates.value && i.typeKey === 'crate') return false
    if (i.id === crateId.value) return false
    if (!q) return true
    return (
      i.name.toLowerCase().includes(q) ||
      i.typeKey.toLowerCase().includes(q)
    )
  })
})

const grouped = computed<{ key: ItemTypeKey; items: ItemResponse[] }[]>(() => {
  if (!groupByType.value) {
    return [{ key: 'all' as ItemTypeKey, items: filteredItems.value }]
  }
  const map = new Map<ItemTypeKey, ItemResponse[]>()
  for (const item of filteredItems.value) {
    const arr = map.get(item.typeKey)
    if (arr) arr.push(item)
    else map.set(item.typeKey, [item])
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([key, items]) => ({ key, items }))
})

async function refresh() {
  loading.value = true
  errorMsg.value = null
  try {
    const [meta, pool, all, crateMods, mods, crateEffects, effects] = await Promise.all([
      getAdminItem(crateId.value),
      getAdminCrateContents(crateId.value),
      getAdminItems({ includeInactive: false }),
      getAdminCrateModifiers(crateId.value),
      getItemModifiers(),
      getAdminCrateUnusualEffects(crateId.value),
      getAdminUnusualEffects(),
    ])
    crate.value = meta
    contents.value = pool
    allItems.value = all
    attachedModifiers.value = crateMods
    allModifiers.value = mods
    attachedEffects.value = crateEffects
    allEffects.value = effects
    syncFormFromCrate()
  } catch (e) {
    errorMsg.value = getApiErrorMessage(e, 'Failed to load crate')
  } finally {
    loading.value = false
  }
}

function syncFormFromCrate() {
  if (!crate.value) return
  form.value = {
    name: crate.value.name,
    description: crate.value.description ?? '',
    rarity: crate.value.rarity,
    tradeable: crate.value.tradeable,
    visible: crate.value.visible,
    stackable: crate.value.stackable,
    welcomeGrant: crate.value.welcomeGrant,
    missionPoolable: crate.value.missionPoolable,
  }
}

async function saveMetadata() {
  if (!crate.value) return
  metaSaving.value = true
  errorMsg.value = null
  try {
    const req: UpdateItemRequest = {
      name: form.value.name,
      description: form.value.description || undefined,
      rarity: form.value.rarity,
      tradeable: form.value.tradeable,
      visible: form.value.visible,
      stackable: form.value.stackable,
      welcomeGrant: form.value.welcomeGrant,
      missionPoolable: form.value.missionPoolable,
    }
    crate.value = await updateItem(crate.value.id, req)
    syncFormFromCrate()
  } catch (e) {
    errorMsg.value = getApiErrorMessage(e, 'Failed to save metadata')
  } finally {
    metaSaving.value = false
  }
}

async function onCrateIconUpload(file: File) {
  if (!crate.value) return
  crate.value = await uploadItemIcon(crate.value.id, file)
}

async function onCrateIconRemove() {
  if (!crate.value) return
  crate.value = await deleteItemIcon(crate.value.id)
}

async function togglePublish() {
  if (!crate.value) return
  const target = !crate.value.active
  if (target) {
    if (contents.value.length === 0) {
      if (!confirm('This crate has no rewards and cannot be opened. Publish anyway?')) {
        return
      }
    }
    if (!form.value.name.trim()) {
      errorMsg.value = 'Name is required before publishing'
      return
    }
    if (totalWeight.value > 0 && totalWeight.value < 10) {
      if (!confirm(`Total weight is only ${totalWeight.value}. Publish anyway?`)) {
        return
      }
    }
  }
  statusBusy.value = true
  errorMsg.value = null
  try {
    crate.value = target
      ? await reactivateItem(crate.value.id)
      : await retireItem(crate.value.id).then(() => getAdminItem(crateId.value))
    syncFormFromCrate()
  } catch (e) {
    errorMsg.value = getApiErrorMessage(e, 'Failed to change crate status')
  } finally {
    statusBusy.value = false
  }
}

const rowBusy = ref<Record<string, boolean>>({})

async function addReward(item: ItemResponse, weight = 100) {
  if (rewardIds.value.has(item.id)) return
  const optimistic: CrateContentResponse = {
    rewardItem: item,
    dropWeight: weight,
    dropChance: 0,
  }
  contents.value = [...contents.value, optimistic]
  rowBusy.value[item.id] = true
  try {
    await putAdminCrateContent(crateId.value, item.id, weight)
    contents.value = await getAdminCrateContents(crateId.value)
  } catch (e) {
    contents.value = contents.value.filter((c) => c.rewardItem.id !== item.id)
    errorMsg.value =
      e instanceof ApiError
        ? getApiErrorMessage(e, 'Cannot add reward')
        : 'Cannot add reward'
  } finally {
    delete rowBusy.value[item.id]
  }
}

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function clearSelection() {
  selectedIds.value = new Set()
}

const selectableCount = computed(
  () => [...selectedIds.value].filter((id) => !rewardIds.value.has(id)).length,
)

async function addSelected() {
  const ids = [...selectedIds.value].filter((id) => !rewardIds.value.has(id))
  if (ids.length === 0) return
  const weight = Math.max(1, Math.floor(bulkWeight.value || 1))
  bulkBusy.value = true
  errorMsg.value = null
  try {
    for (const id of ids) {
      await putAdminCrateContent(crateId.value, id, weight)
    }
    contents.value = await getAdminCrateContents(crateId.value)
    selectedIds.value = new Set()
  } catch (e) {
    errorMsg.value = getApiErrorMessage(e, 'Failed to add selected rewards')
    contents.value = await getAdminCrateContents(crateId.value)
  } finally {
    bulkBusy.value = false
  }
}

async function removeReward(rewardId: string) {
  const snapshot = contents.value
  contents.value = contents.value.filter((c) => c.rewardItem.id !== rewardId)
  rowBusy.value[rewardId] = true
  try {
    await deleteAdminCrateContent(crateId.value, rewardId)
    contents.value = await getAdminCrateContents(crateId.value)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      contents.value = await getAdminCrateContents(crateId.value)
    } else {
      contents.value = snapshot
      errorMsg.value = getApiErrorMessage(e, 'Failed to remove reward')
    }
  } finally {
    delete rowBusy.value[rewardId]
  }
}

const weightDrafts = ref<Record<string, string>>({})
const weightTimers: Record<string, ReturnType<typeof setTimeout>> = {}
const weightErrors = ref<Record<string, string>>({})

function onWeightInput(rewardId: string, value: string) {
  weightDrafts.value[rewardId] = value
  const trimmed = value.trim()
  const parsed = Number.parseInt(trimmed, 10)
  if (!trimmed || !Number.isFinite(parsed) || parsed < 1) {
    weightErrors.value[rewardId] = 'Min 1'
    return
  }
  delete weightErrors.value[rewardId]
  if (weightTimers[rewardId]) clearTimeout(weightTimers[rewardId])
  weightTimers[rewardId] = setTimeout(() => {
    commitWeight(rewardId, parsed)
  }, 400)
}

async function commitWeight(rewardId: string, weight: number) {
  rowBusy.value[rewardId] = true
  try {
    await putAdminCrateContent(crateId.value, rewardId, weight)
    contents.value = await getAdminCrateContents(crateId.value)
    delete weightDrafts.value[rewardId]
  } catch (e) {
    weightErrors.value[rewardId] = getApiErrorMessage(e, 'Failed to update weight')
  } finally {
    delete rowBusy.value[rewardId]
  }
}

function applyPreset(rewardId: string, preset: number) {
  weightDrafts.value[rewardId] = String(preset)
  if (weightTimers[rewardId]) clearTimeout(weightTimers[rewardId])
  commitWeight(rewardId, preset)
}

function rollOnce(pool: CrateContentResponse[]): ItemResponse | null {
  const total = pool.reduce((s, c) => s + c.dropWeight, 0)
  if (total <= 0) return null
  let pick = Math.floor(Math.random() * total)
  for (const c of pool) {
    if (pick < c.dropWeight) return c.rewardItem
    pick -= c.dropWeight
  }
  return null
}

const lastRoll = ref<CrateRoll | null>(null)
const rollToken = ref(0)

function doOpenOnce() {
  const roll = createCrateRoller({
    contents: contents.value,
    crateModifiers: attachedModifiers.value,
    globalModifiers: allModifiers.value,
    unusualEffects: attachedEffects.value,
  })()
  if (!roll) return
  lastRoll.value = roll
  rollToken.value++
}

interface SimRow {
  item: ItemResponse
  expected: number
  simulated: number
  delta: number
  outOfRange: boolean
}

const simRows = ref<SimRow[] | null>(null)
const simRunning = ref(false)
const simSampleSize = ref(0)

async function runSimulation(n: number) {
  if (contents.value.length === 0) return
  simRunning.value = true
  simSampleSize.value = n
  await new Promise((r) => setTimeout(r, 16))
  const counts = new Map<string, number>()
  for (let i = 0; i < n; i++) {
    const item = rollOnce(contents.value)
    if (!item) continue
    counts.set(item.id, (counts.get(item.id) ?? 0) + 1)
  }
  const rows: SimRow[] = contents.value.map((c) => {
    const expectedFrac = c.dropChance
    const observed = (counts.get(c.rewardItem.id) ?? 0) / n
    const variance = expectedFrac * (1 - expectedFrac) / n
    const sigma = Math.sqrt(variance)
    const delta = observed - expectedFrac
    const outOfRange = sigma > 0 ? Math.abs(delta) > 1.5 * sigma : false
    return {
      item: c.rewardItem,
      expected: expectedFrac,
      simulated: observed,
      delta,
      outOfRange,
    }
  })
  rows.sort((a, b) => b.expected - a.expected)
  simRows.value = rows
  simRunning.value = false
}

const dropChanceFor = (id: string) => {
  const c = contents.value.find((x) => x.rewardItem.id === id)
  return c ? c.dropChance : 0
}

function formatPct(v: number, digits = 2) {
  return `${(v * 100).toFixed(digits)}%`
}

function formatSignedPct(v: number, digits = 2) {
  const pct = v * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(digits)}%`
}

const modifierById = computed(() => {
  const map = new Map<string, ItemModifierResponse>()
  for (const m of allModifiers.value) map.set(m.id, m)
  return map
})

const attachedModifierIds = computed(
  () => new Set(attachedModifiers.value.map((m) => m.modifier.id)),
)

const attachableModifiers = computed(() =>
  allModifiers.value.filter(
    (m) => m.key !== 'normal' && !attachedModifierIds.value.has(m.id),
  ),
)

const modifierPickerOptions = computed(() => [
  { value: '', label: 'Select a modifier...' },
  ...attachableModifiers.value.map((m) => ({
    value: m.id,
    label: m.name,
    description: m.description ?? undefined,
  })),
])

const newModifierId = ref('')
const newChancePct = ref('25')
const attachBusy = ref(false)
const modifierError = ref<string | null>(null)

const selectedModifier = computed(() =>
  newModifierId.value ? modifierById.value.get(newModifierId.value) ?? null : null,
)

function isSeasonalModifier(mod: ItemModifierResponse | null | undefined): boolean {
  return !!mod && (mod.globalDropChance != null || !!mod.seasonStart || !!mod.seasonEnd)
}

function modifierDescription(id: string): string | null {
  return modifierById.value.get(id)?.description ?? null
}

function isSeasonalById(id: string): boolean {
  return isSeasonalModifier(modifierById.value.get(id))
}

function parseChancePct(value: string | number): number | null {
  const str = String(value).trim()
  const pct = Number(str)
  if (!str || !Number.isFinite(pct) || pct <= 0 || pct > 100) return null
  return percentToDecimal(pct)
}

async function attachModifier() {
  if (!newModifierId.value) return
  const decimal = parseChancePct(newChancePct.value)
  if (decimal == null) {
    modifierError.value = 'Enter a chance between 0 (exclusive) and 100.'
    return
  }
  attachBusy.value = true
  modifierError.value = null
  try {
    await putAdminCrateModifier(crateId.value, newModifierId.value, decimal)
    attachedModifiers.value = await getAdminCrateModifiers(crateId.value)
    newModifierId.value = ''
    newChancePct.value = '25'
  } catch (e) {
    modifierError.value = parseApiError(e, 'Failed to attach modifier').message
  } finally {
    attachBusy.value = false
  }
}

const modRowBusy = ref<Record<string, boolean>>({})
const modChanceDrafts = ref<Record<string, string>>({})
const modChanceErrors = ref<Record<string, string>>({})
const modChanceTimers: Record<string, ReturnType<typeof setTimeout>> = {}

function onModChanceInput(modId: string, value: string) {
  modChanceDrafts.value[modId] = value
  const decimal = parseChancePct(value)
  if (decimal == null) {
    modChanceErrors.value[modId] = '0-100, exclusive of 0'
    return
  }
  delete modChanceErrors.value[modId]
  if (modChanceTimers[modId]) clearTimeout(modChanceTimers[modId])
  modChanceTimers[modId] = setTimeout(() => commitModChance(modId, decimal), 400)
}

async function commitModChance(modId: string, decimal: number) {
  modRowBusy.value[modId] = true
  try {
    await putAdminCrateModifier(crateId.value, modId, decimal)
    attachedModifiers.value = await getAdminCrateModifiers(crateId.value)
    delete modChanceDrafts.value[modId]
  } catch (e) {
    modChanceErrors.value[modId] = parseApiError(e, 'Failed to update chance').message
  } finally {
    delete modRowBusy.value[modId]
  }
}

async function detachModifier(modId: string) {
  const snapshot = attachedModifiers.value
  attachedModifiers.value = attachedModifiers.value.filter((m) => m.modifier.id !== modId)
  modRowBusy.value[modId] = true
  try {
    await deleteAdminCrateModifier(crateId.value, modId)
    attachedModifiers.value = await getAdminCrateModifiers(crateId.value)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      attachedModifiers.value = await getAdminCrateModifiers(crateId.value)
    } else {
      attachedModifiers.value = snapshot
      errorMsg.value = getApiErrorMessage(e, 'Failed to remove modifier')
    }
  } finally {
    delete modRowBusy.value[modId]
  }
}

const crateRollsUnusual = computed(() =>
  attachedModifiers.value.some((m) => m.modifier.key === 'unusual'),
)

const attachedEffectIds = computed(() => new Set(attachedEffects.value.map((e) => e.id)))

const attachableEffects = computed(() =>
  allEffects.value.filter((e) => !attachedEffectIds.value.has(e.id)),
)

const effectPickerOptions = computed(() => [
  { value: '', label: 'Select an effect...' },
  ...attachableEffects.value.map((e) => ({
    value: e.id,
    label: e.name,
    description: e.description ?? undefined,
  })),
])

const newEffectId = ref('')
const effectAttachBusy = ref(false)
const effectError = ref<string | null>(null)
const effectRowBusy = ref<Record<string, boolean>>({})

async function attachEffect() {
  if (!newEffectId.value) return
  effectAttachBusy.value = true
  effectError.value = null
  try {
    await putAdminCrateUnusualEffect(crateId.value, newEffectId.value)
    attachedEffects.value = await getAdminCrateUnusualEffects(crateId.value)
    newEffectId.value = ''
  } catch (e) {
    effectError.value = parseApiError(e, 'Failed to attach effect').message
  } finally {
    effectAttachBusy.value = false
  }
}

async function detachEffect(effectId: string) {
  const snapshot = attachedEffects.value
  attachedEffects.value = attachedEffects.value.filter((e) => e.id !== effectId)
  effectRowBusy.value[effectId] = true
  try {
    await deleteAdminCrateUnusualEffect(crateId.value, effectId)
    attachedEffects.value = await getAdminCrateUnusualEffects(crateId.value)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      attachedEffects.value = await getAdminCrateUnusualEffects(crateId.value)
    } else {
      attachedEffects.value = snapshot
      errorMsg.value = getApiErrorMessage(e, 'Failed to remove effect')
    }
  } finally {
    delete effectRowBusy.value[effectId]
  }
}

onMounted(refresh)

watch(crateId, refresh)
</script>

<template>
  <div class="crate-editor">
    <header class="crate-editor__header">
      <BaseButton size="sm" @click="router.push({ name: 'admin', query: { tab: 'items', itab: 'crates' } })">
        &larr; Back to crates
      </BaseButton>
      <div class="crate-editor__title">
        {{ crate?.name || 'Crate editor' }}
      </div>
      <div class="crate-editor__spacer" />
      <div v-if="crate" class="crate-editor__status-group">
        <BaseButton size="sm" @click="previewOpen = true">Preview</BaseButton>
        <span class="crate-editor__status" :class="{
          'crate-editor__status--live': crate.active && !crate.deprecated,
          'crate-editor__status--draft': !crate.active,
          'crate-editor__status--deprecated': crate.deprecated,
        }">
          {{ crate.deprecated ? 'Deprecated' : crate.active ? 'Live' : 'Draft' }}
        </span>
        <BaseButton v-if="!crate.deprecated" size="sm" :variant="crate.active ? 'destructive' : 'primary'"
          :loading="statusBusy" @click="togglePublish">
          {{ crate.active ? 'Retire to Draft' : 'Publish' }}
        </BaseButton>
      </div>
    </header>

    <div v-if="errorMsg" class="crate-editor__error">{{ errorMsg }}</div>

    <div v-if="crate && !crate.active" class="crate-editor__banner">
      DRAFT - not visible to players
    </div>

    <section v-if="loading" class="crate-editor__loading">
      <SkeletonLoader variant="card" />
      <SkeletonLoader variant="card" />
      <SkeletonLoader variant="card" />
    </section>

    <template v-else-if="crate">
      <section class="crate-editor__panel">
        <h2 class="crate-editor__panel-title">Metadata</h2>
        <div class="crate-editor__meta-grid">
          <BaseInput v-model="form.name" label="Name" />
          <BaseInput v-model="form.description" label="Description" />
          <BaseSelect :model-value="form.rarity" :options="rarityOptions" label="Rarity"
            @update:model-value="(v: string) => (form.rarity = v as ItemRarity)" />
          <ImageUploader label="Icon" aspect-ratio="1 / 1" :image-url="crate?.iconUrl ?? null"
            :upload-handler="onCrateIconUpload" :remove-handler="onCrateIconRemove" />
          <div class="crate-editor__meta-checks">
            <label class="crate-editor__check">
              <input v-model="form.tradeable" type="checkbox" /> Tradeable
            </label>
            <label class="crate-editor__check">
              <input v-model="form.visible" type="checkbox" /> Visible
            </label>
            <label class="crate-editor__check">
              <input v-model="form.stackable" type="checkbox" /> Stackable
            </label>
            <label class="crate-editor__check">
              <input v-model="form.welcomeGrant" type="checkbox" /> Welcome grant
            </label>
            <label class="crate-editor__check">
              <input v-model="form.missionPoolable" type="checkbox" /> Mission reward
            </label>
          </div>
        </div>
        <div class="crate-editor__meta-actions">
          <BaseButton variant="primary" size="sm" :loading="metaSaving" @click="saveMetadata">
            Save metadata
          </BaseButton>
        </div>
      </section>

      <section class="crate-editor__panel">
        <header class="crate-editor__panel-header">
          <h2 class="crate-editor__panel-title">Contents</h2>
          <div class="crate-editor__totals">
            Total weight: <span class="mono">{{ totalWeight }}</span> -
            Reward count: <span class="mono">{{ contents.length }}</span>
          </div>
        </header>

        <div class="crate-editor__split">
          <div class="crate-editor__pane crate-editor__pane--picker">
            <header class="crate-editor__pane-header">
              <BaseInput v-model="search" placeholder="Search items..." aria-label="Search items" />
              <label class="crate-editor__check crate-editor__check--inline">
                <input v-model="allowNestedCrates" type="checkbox" /> Allow crates
              </label>
              <label class="crate-editor__check crate-editor__check--inline">
                <input v-model="groupByType" type="checkbox" /> Group by type
              </label>
            </header>
            <div v-if="selectableCount > 0" class="crate-editor__bulk-bar">
              <span class="crate-editor__bulk-count">{{ selectableCount }} selected</span>
              <label class="crate-editor__bulk-weight">
                Weight
                <input type="number" min="1" step="1" :value="bulkWeight"
                  @input="bulkWeight = Math.max(1, Math.floor(Number(($event.target as HTMLInputElement).value) || 1))" />
              </label>
              <BaseButton size="sm" variant="primary" :loading="bulkBusy" @click="addSelected">
                Add {{ selectableCount }}
              </BaseButton>
              <BaseButton size="sm" @click="clearSelection">Clear</BaseButton>
            </div>
            <div class="crate-editor__picker-list">
              <div v-if="filteredItems.length === 0" class="crate-editor__picker-empty">
                No matching items.
              </div>
              <div v-for="group in grouped" :key="String(group.key)" class="crate-editor__group">
                <div v-if="groupByType" class="crate-editor__group-label">{{ group.key }}</div>
                <div v-for="item in group.items" :key="item.id" class="crate-editor__picker-row">
                  <input type="checkbox" class="crate-editor__picker-check"
                    :checked="selectedIds.has(item.id)" :disabled="rewardIds.has(item.id)"
                    :aria-label="`Select ${item.name}`" @change="toggleSelect(item.id)" />
                  <button type="button" class="crate-editor__picker-item"
                    :class="{ 'crate-editor__picker-item--added': rewardIds.has(item.id) }"
                    :disabled="rewardIds.has(item.id) || rowBusy[item.id]" @click="addReward(item)">
                    <div class="crate-editor__picker-icon">
                      <img v-if="item.iconUrl" :src="item.iconUrl" alt="" loading="lazy" decoding="async" />
                      <span v-else class="crate-editor__picker-icon-placeholder" />
                    </div>
                    <div class="crate-editor__picker-meta">
                      <div class="crate-editor__picker-name">{{ item.name }}</div>
                      <div class="crate-editor__picker-sub">
                        <span class="crate-editor__picker-type">{{ item.typeKey }}</span>
                        <span class="crate-editor__rarity" :class="`rarity--${item.rarity}`">
                          {{ item.rarity }}
                        </span>
                      </div>
                    </div>
                    <div class="crate-editor__picker-action">
                      {{ rewardIds.has(item.id) ? 'Already added' : '+ Add' }}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="crate-editor__pane crate-editor__pane--pool">
            <header class="crate-editor__pane-header">
              <div class="crate-editor__pane-title">Current pool</div>
            </header>
            <div v-if="contents.length === 0" class="crate-editor__pool-empty">
              <EmptyState message="Pick rewards from the left to get started" />
            </div>
            <table v-else class="crate-editor__pool-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Name</th>
                  <th>Rarity</th>
                  <th>Weight</th>
                  <th class="right">Chance</th>
                  <th class="right"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in contents" :key="c.rewardItem.id">
                  <td class="crate-editor__pool-icon">
                    <img v-if="c.rewardItem.iconUrl" :src="c.rewardItem.iconUrl" alt="" loading="lazy" decoding="async" />
                    <span v-else class="crate-editor__picker-icon-placeholder" />
                  </td>
                  <td>
                    <div class="crate-editor__pool-name">{{ c.rewardItem.name }}</div>
                    <div class="crate-editor__pool-type">{{ c.rewardItem.typeKey }}</div>
                  </td>
                  <td>
                    <span class="crate-editor__rarity" :class="`rarity--${c.rewardItem.rarity}`">
                      {{ c.rewardItem.rarity }}
                    </span>
                  </td>
                  <td class="crate-editor__pool-weight">
                    <input type="number" min="1" step="1" class="crate-editor__weight-input"
                      :value="weightDrafts[c.rewardItem.id] ?? String(c.dropWeight)"
                      :disabled="rowBusy[c.rewardItem.id]"
                      @input="onWeightInput(c.rewardItem.id, ($event.target as HTMLInputElement).value)" />
                    <div class="crate-editor__preset-row">
                      <button v-for="p in [1, 10, 100, 1000]" :key="p" type="button" class="crate-editor__preset"
                        :class="{ 'crate-editor__preset--active': c.dropWeight === p }"
                        @click="applyPreset(c.rewardItem.id, p)">
                        {{ p }}
                      </button>
                    </div>
                    <div v-if="weightErrors[c.rewardItem.id]" class="crate-editor__weight-err">
                      {{ weightErrors[c.rewardItem.id] }}
                    </div>
                  </td>
                  <td class="right mono">{{ formatPct(c.dropChance) }}</td>
                  <td class="right">
                    <button type="button" class="crate-editor__remove" :disabled="rowBusy[c.rewardItem.id]"
                      @click="removeReward(c.rewardItem.id)" aria-label="Remove">
                      &times;
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="contents.length > 0" class="crate-editor__pool-footer">
              Total weight: <span class="mono">{{ totalWeight }}</span> -
              Reward count: <span class="mono">{{ contents.length }}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="crate-editor__panel">
        <header class="crate-editor__panel-header">
          <h2 class="crate-editor__panel-title">Modifiers</h2>
          <div class="crate-editor__totals">
            Attached: <span class="mono">{{ attachedModifiers.length }}</span>
          </div>
        </header>
        <p class="crate-editor__hint">
          Each attached modifier rolls independently on every open - several can hit at once
          and stack on the reward. A chance is a standalone probability, not a share of a pie.
          100% is guaranteed; 0% is rejected.
        </p>

        <div class="crate-editor__mod-attach">
          <div class="crate-editor__mod-attach-picker">
            <BaseSelect
              v-model="newModifierId"
              :options="modifierPickerOptions"
              label="Add modifier"
              searchable
            />
          </div>
          <label class="crate-editor__mod-chance-field">
            <span class="crate-editor__mod-chance-label">Chance (%)</span>
            <input
              v-model="newChancePct"
              type="number"
              min="0"
              max="100"
              step="any"
              class="crate-editor__weight-input"
            />
          </label>
          <BaseButton
            size="sm"
            variant="primary"
            :loading="attachBusy"
            :disabled="!newModifierId"
            @click="attachModifier"
          >
            Attach
          </BaseButton>
        </div>
        <p
          v-if="selectedModifier && isSeasonalModifier(selectedModifier)"
          class="crate-editor__mod-season-hint"
        >
          Attached here &rarr; uses this chance and drops year-round on this crate, overriding
          its season window.
        </p>
        <p v-if="modifierError" class="crate-editor__weight-err">{{ modifierError }}</p>

        <div v-if="attachedModifiers.length === 0" class="crate-editor__pool-empty">
          <EmptyState message="No modifiers attached. Add one above." />
        </div>
        <table v-else class="crate-editor__pool-table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Chance</th>
              <th class="right"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in attachedModifiers" :key="m.modifier.id">
              <td class="crate-editor__mod-chip-cell">
                <span
                  class="crate-editor__mod-chip"
                  :style="{ background: m.modifier.colorHex }"
                  aria-hidden="true"
                />
              </td>
              <td>
                <div class="crate-editor__pool-name">{{ m.modifier.name }}</div>
                <div class="crate-editor__pool-type">
                  {{ modifierDescription(m.modifier.id) ?? m.modifier.key }}
                </div>
                <div v-if="isSeasonalById(m.modifier.id)" class="crate-editor__mod-season-tag">
                  Seasonal &rarr; overrides season, drops year-round here
                </div>
              </td>
              <td class="crate-editor__pool-weight">
                <div class="crate-editor__mod-chance-edit">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    class="crate-editor__weight-input"
                    :value="modChanceDrafts[m.modifier.id] ?? String(decimalToPercent(m.dropChance))"
                    :disabled="modRowBusy[m.modifier.id]"
                    @input="onModChanceInput(m.modifier.id, ($event.target as HTMLInputElement).value)"
                  />
                  <span class="crate-editor__mod-pct">%</span>
                </div>
                <div v-if="modChanceErrors[m.modifier.id]" class="crate-editor__weight-err">
                  {{ modChanceErrors[m.modifier.id] }}
                </div>
              </td>
              <td class="right">
                <button
                  type="button"
                  class="crate-editor__remove"
                  :disabled="modRowBusy[m.modifier.id]"
                  @click="detachModifier(m.modifier.id)"
                  aria-label="Detach modifier"
                >
                  &times;
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="crate-editor__panel">
        <header class="crate-editor__panel-header">
          <h2 class="crate-editor__panel-title">Unusual effects</h2>
          <div class="crate-editor__totals">
            Attached: <span class="mono">{{ attachedEffects.length }}</span>
          </div>
        </header>
        <p class="crate-editor__hint">
          On an Unusual roll, one of these is chosen at equal chance. Add the Unusual modifier
          above to give this crate a chance to roll one.
        </p>
        <p
          v-if="attachedEffects.length && !crateRollsUnusual"
          class="crate-editor__mod-season-hint"
        >
          This crate has no Unusual modifier attached, so these effects will never roll here.
        </p>

        <div class="crate-editor__mod-attach">
          <div class="crate-editor__mod-attach-picker">
            <BaseSelect
              v-model="newEffectId"
              :options="effectPickerOptions"
              label="Add effect"
              searchable
            />
          </div>
          <BaseButton
            size="sm"
            variant="primary"
            :loading="effectAttachBusy"
            :disabled="!newEffectId"
            @click="attachEffect"
          >
            Attach
          </BaseButton>
        </div>
        <p v-if="effectError" class="crate-editor__weight-err">{{ effectError }}</p>

        <div v-if="attachedEffects.length === 0" class="crate-editor__pool-empty">
          <EmptyState message="No effects attached. The default Unusual sparkle will be used." />
        </div>
        <table v-else class="crate-editor__pool-table">
          <thead>
            <tr>
              <th>Name</th>
              <th class="right"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in attachedEffects" :key="e.id">
              <td>
                <div class="crate-editor__pool-name">{{ e.name }}</div>
                <div class="crate-editor__pool-type">{{ e.description ?? e.key }}</div>
              </td>
              <td class="right">
                <button
                  type="button"
                  class="crate-editor__remove"
                  :disabled="effectRowBusy[e.id]"
                  @click="detachEffect(e.id)"
                  aria-label="Detach effect"
                >
                  &times;
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="crate-editor__panel">
        <h2 class="crate-editor__panel-title">Test</h2>
        <p class="crate-editor__hint">
          Playground for testing the contents and animation.
        </p>
        <div class="crate-editor__test-actions">
          <BaseButton size="sm" :disabled="contents.length === 0" @click="doOpenOnce">
            Open once
          </BaseButton>
          <BaseButton size="sm" :disabled="contents.length === 0 || simRunning" @click="runSimulation(1000)">
            Run 1,000
          </BaseButton>
          <BaseButton size="sm" :disabled="contents.length === 0 || simRunning"
            :loading="simRunning && simSampleSize === 100000" @click="runSimulation(100000)">
            Run 100,000
          </BaseButton>
        </div>

        <CrateOpenAnimation
          v-if="rollToken > 0 && lastRoll"
          :contents="contents"
          :crate-modifiers="attachedModifiers"
          :global-modifiers="allModifiers"
          :unusual-effects="attachedEffects"
          :result="lastRoll.item"
          :result-modifiers="lastRoll.modifiers"
          :result-unusual-effect="lastRoll.unusualEffect"
          :play-token="rollToken"
        />
        <div v-if="lastRoll && rollToken > 0" class="crate-editor__roll-chance">
          Drop chance:
          <span class="mono">{{ formatPct(dropChanceFor(lastRoll.item.id)) }}</span>
        </div>

        <table v-if="simRows && simRows.length" class="crate-editor__sim-table">
          <thead>
            <tr>
              <th>Reward</th>
              <th class="right">Expected</th>
              <th class="right">Simulated</th>
              <th class="right">&Delta;</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in simRows" :key="row.item.id">
              <td>{{ row.item.name }}</td>
              <td class="right mono">{{ formatPct(row.expected) }}</td>
              <td class="right mono">{{ formatPct(row.simulated) }}</td>
              <td class="right mono" :class="{ 'crate-editor__sim-out': row.outOfRange }">
                {{ formatSignedPct(row.delta) }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <CratePreviewModal
        :open="previewOpen"
        :crate="crate"
        :contents="contents"
        :modifiers="attachedModifiers"
        :effects="attachedEffects"
        @close="previewOpen = false"
      />
    </template>
  </div>
</template>

<style scoped>
.crate-editor {
  padding: var(--space-xl);
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.crate-editor__header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.crate-editor__title {
  font-size: var(--text-page-title);
  font-weight: 700;
  color: var(--text-primary);
}

.crate-editor__spacer {
  flex: 1;
}

.crate-editor__status-group {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.crate-editor__status {
  padding: 2px var(--space-sm);
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
  border: 1px solid var(--status-color, var(--bg-overlay));
  color: var(--status-color, var(--text-secondary));
}

.crate-editor__status--live {
  --status-color: var(--success);
}

.crate-editor__status--draft {
  --status-color: var(--warning);
}

.crate-editor__status--deprecated {
  --status-color: var(--text-tertiary);
}

.crate-editor__banner {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--warning);
  background: color-mix(in srgb, var(--warning) 12%, transparent);
  color: var(--warning);
  border-radius: var(--radius-card);
  font-size: var(--text-caption);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 600;
}

.crate-editor__error {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--error);
  background: color-mix(in srgb, var(--error) 12%, transparent);
  color: var(--error);
  border-radius: var(--radius-card);
  font-size: var(--text-body);
}

.crate-editor__loading {
  display: grid;
  gap: var(--space-md);
}

.crate-editor__panel {
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.crate-editor__panel-title {
  margin: 0;
  font-size: var(--text-section-heading);
  font-weight: 600;
  color: var(--text-primary);
}

.crate-editor__panel-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.crate-editor__totals {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.mono {
  font-family: var(--font-mono);
}

.crate-editor__meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-md);
}

.crate-editor__meta-checks {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-sm) var(--space-md);
  grid-column: 1 / -1;
}

.crate-editor__bulk-bar {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--bg-overlay);
  background: var(--bg-elevated);
  flex-wrap: wrap;
}

.crate-editor__bulk-count {
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--accent);
}

.crate-editor__bulk-weight {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.crate-editor__bulk-weight input {
  width: 72px;
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-mono);
  outline: none;
}

.crate-editor__bulk-weight input:focus {
  border-color: var(--accent);
}

.crate-editor__picker-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.crate-editor__picker-check {
  flex-shrink: 0;
  cursor: pointer;
}

.crate-editor__picker-row .crate-editor__picker-item {
  flex: 1;
  min-width: 0;
}

.crate-editor__check {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  cursor: pointer;
}

.crate-editor__check--inline {
  flex-shrink: 0;
}

.crate-editor__meta-actions {
  display: flex;
  justify-content: flex-end;
}

.crate-editor__split {
  display: grid;
  grid-template-columns: minmax(0, 360px) minmax(0, 1fr);
  gap: var(--space-lg);
}

@media (max-width: 880px) {
  .crate-editor__split {
    grid-template-columns: minmax(0, 1fr);
  }

  .crate-editor__meta-grid {
    grid-template-columns: 1fr;
  }
}

.crate-editor__pane {
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  display: flex;
  flex-direction: column;
  min-height: 360px;
}

.crate-editor__pane-header {
  padding: var(--space-md);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  border-bottom: 1px solid var(--bg-overlay);
  flex-wrap: wrap;
}

.crate-editor__pane-header> :first-child {
  flex: 1;
  min-width: 160px;
}

.crate-editor__pane-title {
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.crate-editor__picker-list {
  flex: 1;
  overflow-y: auto;
  max-height: 520px;
  padding: var(--space-sm);
}

.crate-editor__picker-empty,
.crate-editor__pool-empty {
  padding: var(--space-xl) var(--space-md);
  color: var(--text-tertiary);
  text-align: center;
}

.crate-editor__group {
  margin-bottom: var(--space-sm);
}

.crate-editor__group-label {
  font-size: var(--text-caption);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
  padding: var(--space-xs) var(--space-sm);
}

.crate-editor__picker-item {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  gap: var(--space-sm);
  align-items: center;
  width: 100%;
  padding: var(--space-sm);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-card);
  color: var(--text-primary);
  font-family: var(--font-sans);
  cursor: pointer;
  text-align: left;
  transition: background-color 100ms ease, border-color 100ms ease;
}

.crate-editor__picker-item:not(:disabled):hover {
  background: var(--bg-elevated);
  border-color: var(--bg-overlay);
}

.crate-editor__picker-item--added,
.crate-editor__picker-item:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.crate-editor__picker-icon,
.crate-editor__pool-icon img {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-avatar);
  object-fit: cover;
  display: block;
}

.crate-editor__picker-icon img {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-avatar);
  object-fit: cover;
  display: block;
}

.crate-editor__picker-icon-placeholder {
  display: inline-block;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-avatar);
  background: var(--bg-overlay);
}

.crate-editor__picker-name {
  font-size: var(--text-body);
  font-weight: 500;
  color: var(--text-primary);
}

.crate-editor__picker-sub {
  display: flex;
  gap: var(--space-sm);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  align-items: center;
}

.crate-editor__picker-type {
  color: var(--text-tertiary);
}

.crate-editor__picker-action {
  font-size: var(--text-caption);
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
}

.crate-editor__picker-item--added .crate-editor__picker-action {
  color: var(--text-tertiary);
}

.crate-editor__rarity {
  text-transform: capitalize;
  color: var(--rarity-color, var(--text-primary));
  font-weight: 500;
}

.crate-editor__rarity.rarity--common {
  --rarity-color: var(--text-tertiary);
}

.crate-editor__rarity.rarity--uncommon {
  --rarity-color: var(--success);
}

.crate-editor__rarity.rarity--rare {
  --rarity-color: var(--info);
}

.crate-editor__rarity.rarity--epic {
  --rarity-color: var(--tier-apex);
}

.crate-editor__rarity.rarity--legendary {
  --rarity-color: var(--tier-gold);
}

.crate-editor__rarity.rarity--mythic {
  --rarity-color: var(--error);
}

.crate-editor__pool-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-body);
}

.crate-editor__pool-table th {
  text-align: left;
  font-size: var(--text-caption);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--bg-overlay);
}

.crate-editor__pool-table th.right,
.crate-editor__pool-table td.right {
  text-align: right;
}

.crate-editor__pool-table td {
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--bg-overlay);
  vertical-align: middle;
}

.crate-editor__pool-table tr:last-child td {
  border-bottom: none;
}

.crate-editor__pool-icon img,
.crate-editor__pool-icon .crate-editor__picker-icon-placeholder {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-avatar);
}

.crate-editor__pool-name {
  font-weight: 500;
  color: var(--text-primary);
}

.crate-editor__pool-type {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.crate-editor__weight-input {
  width: 96px;
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-mono);
  outline: none;
}

.crate-editor__weight-input:focus {
  border-color: var(--accent);
}

.crate-editor__preset-row {
  display: flex;
  gap: var(--space-xs);
  margin-top: var(--space-xs);
}

.crate-editor__preset {
  padding: 2px var(--space-sm);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  cursor: pointer;
  transition: color 100ms ease, border-color 100ms ease;
}

.crate-editor__preset:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.crate-editor__preset--active {
  color: var(--accent);
  border-color: var(--accent);
}

.crate-editor__weight-err {
  margin-top: var(--space-xs);
  font-size: var(--text-caption);
  color: var(--error);
}

.crate-editor__remove {
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  padding: var(--space-xs);
  border-radius: var(--radius-btn);
  transition: color 100ms ease, background-color 100ms ease;
}

.crate-editor__remove:hover {
  color: var(--error);
  background: color-mix(in srgb, var(--error) 10%, transparent);
}

.crate-editor__pool-footer {
  padding: var(--space-md);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  border-top: 1px solid var(--bg-overlay);
}

.crate-editor__hint {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.crate-editor__test-actions {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.crate-editor__roll-chance {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.crate-editor__sim-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-body);
}

.crate-editor__sim-table th {
  text-align: left;
  font-size: var(--text-caption);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--bg-overlay);
}

.crate-editor__sim-table th.right,
.crate-editor__sim-table td.right {
  text-align: right;
}

.crate-editor__sim-table td {
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--bg-overlay);
}

.crate-editor__sim-table tr:last-child td {
  border-bottom: none;
}

.crate-editor__sim-out {
  color: var(--error);
}

.crate-editor__mod-attach {
  display: flex;
  align-items: flex-end;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.crate-editor__mod-attach-picker {
  flex: 1;
  min-width: 200px;
}

.crate-editor__mod-chance-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.crate-editor__mod-chance-label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.crate-editor__mod-season-hint {
  margin: 0;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--info);
  background: color-mix(in srgb, var(--info) 10%, transparent);
  color: var(--info);
  border-radius: var(--radius-card);
  font-size: var(--text-caption);
  line-height: 1.4;
}

.crate-editor__mod-chip-cell {
  width: 28px;
}

.crate-editor__mod-chip {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: var(--radius-badge);
  border: 1px solid color-mix(in srgb, var(--text-primary) 20%, transparent);
}

.crate-editor__mod-season-tag {
  margin-top: var(--space-xs);
  font-size: var(--text-caption);
  color: var(--info);
}

.crate-editor__mod-chance-edit {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
}

.crate-editor__mod-pct {
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
}
</style>
