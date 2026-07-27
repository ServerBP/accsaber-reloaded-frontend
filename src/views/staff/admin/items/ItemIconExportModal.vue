<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import ItemIconCapture from '@/components/domain/ItemIconCapture.vue'
import { getAdminItems } from '@/api/admin/items'
import { parseApiError } from '@/api/client'
import { useItemTypeStore } from '@/stores/itemTypes'
import type { ItemResponse } from '@/types/api/items'
import { RARITY_ORDER } from '@/utils/items'
import { captureBox, useItemIconExport } from '@/composables/useItemIconExport'
import { waitForRenderedAssets } from '@/utils/rasterize'
import { computed, nextTick, ref, watch, type ComponentPublicInstance } from 'vue'

const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{
  close: []
  updated: [items: ItemResponse[]]
}>()

const itemTypeStore = useItemTypeStore()

const IMAGE_BACKED_TYPES = ['badge', 'profile_background', 'profile_thumbnail_background']

const allItems = ref<ItemResponse[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)

const search = ref('')
const typeFilter = ref('')
const rarityFilter = ref('')
const iconFilter = ref<'all' | 'missing' | 'existing'>('all')
const includeInactive = ref(false)
const includeImageBacked = ref(false)

const base = ref<'dark' | 'light'>('dark')
const size = ref(512)

const selected = ref(new Set<string>())

const captureItem = ref<ItemResponse | null>(null)
const captureComp = ref<ComponentPublicInstance | null>(null)

const typeOptions = computed(() => [
  { value: '', label: 'All types' },
  ...itemTypeStore.itemTypes.map((t) => ({ value: t.key, label: `${t.name} (${t.key})` })),
])

const rarityOptions = computed(() => [
  { value: '', label: 'All rarities' },
  ...RARITY_ORDER.map((r) => ({ value: r, label: r })),
])

const iconOptions = [
  { value: 'all', label: 'Any icon state' },
  { value: 'missing', label: 'Only missing icons' },
  { value: 'existing', label: 'Only existing icons' },
]

const sizeOptions = [
  { value: '256', label: '256 x 256' },
  { value: '512', label: '512 x 512' },
  { value: '1024', label: '1024 x 1024' },
]

const baseOptions = [
  { value: 'dark', label: 'Dark base' },
  { value: 'light', label: 'Light base' },
]

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  return allItems.value.filter((item) => {
    if (!includeInactive.value && !item.active) return false
    if (!includeImageBacked.value && IMAGE_BACKED_TYPES.includes(item.typeKey)) return false
    if (typeFilter.value && item.typeKey !== typeFilter.value) return false
    if (rarityFilter.value && item.rarity !== rarityFilter.value) return false
    if (iconFilter.value === 'missing' && item.iconUrl) return false
    if (iconFilter.value === 'existing' && !item.iconUrl) return false
    if (term && !item.name.toLowerCase().includes(term)) return false
    return true
  })
})

const selectedItems = computed(() => filtered.value.filter((i) => selected.value.has(i.id)))

const allFilteredSelected = computed(
  () => filtered.value.length > 0 && filtered.value.every((i) => selected.value.has(i.id)),
)

function toggle(id: string) {
  if (selected.value.has(id)) selected.value.delete(id)
  else selected.value.add(id)
}

function selectAll() {
  for (const item of filtered.value) selected.value.add(item.id)
}

function selectNone() {
  for (const item of filtered.value) selected.value.delete(item.id)
}

function invertSelection() {
  for (const item of filtered.value) toggle(item.id)
}

async function renderItem(item: ItemResponse): Promise<Element> {
  captureItem.value = item
  await nextTick()
  const el = captureComp.value?.$el as Element | undefined
  if (!el) throw new Error('Capture surface unavailable')
  await waitForRenderedAssets(el)
  await waitForRenderedAssets(el)
  return el
}

const {
  running,
  total,
  completed,
  currentName,
  failures,
  warnings,
  uploaded,
  run,
  cancel,
} = useItemIconExport(renderItem)

const progressPct = computed(() =>
  total.value === 0 ? 0 : Math.round((completed.value / total.value) * 100),
)

const finished = computed(() => !running.value && total.value > 0)

async function fetchItems() {
  loading.value = true
  loadError.value = null
  try {
    allItems.value = await getAdminItems({ includeInactive: true })
    selected.value = new Set(filtered.value.map((i) => i.id))
  } catch (err) {
    loadError.value = parseApiError(err, 'Could not load items').message
  } finally {
    loading.value = false
  }
}

async function startExport() {
  const targets = selectedItems.value
  if (targets.length === 0) return
  await run(targets, { size: size.value })
  captureItem.value = null
  if (uploaded.value.length > 0) {
    const byId = new Map(uploaded.value.map((i) => [i.id, i]))
    allItems.value = allItems.value.map((i) => byId.get(i.id) ?? i)
    emit('updated', uploaded.value)
  }
}

function handleClose() {
  if (running.value) return
  emit('close')
}

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      captureItem.value = null
      return
    }
    await itemTypeStore.fetchItemTypes()
    await fetchItems()
  },
  { immediate: true },
)
</script>

<template>
  <BaseModal
    :open="open"
    title="Export previews to icons"
    max-width="920px"
    @close="handleClose"
  >
    <div class="icon-export">
      <p class="icon-export__intro">
        Renders each item's live preview to a transparent PNG and uploads it as that item's icon.
        Border shapes and colours export as frames with an empty centre so a profile picture fits inside.
      </p>

      <div class="icon-export__filters">
        <BaseInput v-model="search" label="Search" placeholder="Item name" />
        <BaseSelect v-model="typeFilter" :options="typeOptions" label="Type" searchable />
        <BaseSelect v-model="rarityFilter" :options="rarityOptions" label="Rarity" />
        <BaseSelect
          :model-value="iconFilter"
          :options="iconOptions"
          label="Icon"
          @update:model-value="(v: string) => iconFilter = v as 'all' | 'missing' | 'existing'"
        />
      </div>

      <div class="icon-export__toggles">
        <label class="icon-export__check">
          <input v-model="includeInactive" type="checkbox" /> Include inactive
        </label>
        <label class="icon-export__check">
          <input v-model="includeImageBacked" type="checkbox" />
          Include image-backed types (badges, backgrounds)
        </label>
      </div>

      <div class="icon-export__bulk">
        <span class="icon-export__count">
          {{ selectedItems.length }} of {{ filtered.length }} selected
        </span>
        <div class="icon-export__bulk-actions">
          <BaseButton size="sm" :disabled="allFilteredSelected" @click="selectAll">All</BaseButton>
          <BaseButton size="sm" :disabled="selectedItems.length === 0" @click="selectNone">None</BaseButton>
          <BaseButton size="sm" @click="invertSelection">Invert</BaseButton>
        </div>
      </div>

      <p v-if="loadError" class="icon-export__error">{{ loadError }}</p>

      <div v-if="loading" class="icon-export__loading">Loading items...</div>

      <div v-else-if="filtered.length === 0" class="icon-export__loading">
        No items match these filters.
      </div>

      <div v-else class="icon-export__grid">
        <button
          v-for="item in filtered"
          :key="item.id"
          type="button"
          class="icon-export__tile"
          :class="{ 'icon-export__tile--on': selected.has(item.id) }"
          :disabled="running"
          @click="toggle(item.id)"
        >
          <span class="icon-export__art">
            <ItemIconCapture :item="item" :width="64" :height="64" :base="base" />
          </span>
          <span class="icon-export__label">{{ item.name }}</span>
          <span class="icon-export__meta">
            {{ item.typeKey }}<template v-if="!item.iconUrl"> - no icon</template>
          </span>
        </button>
      </div>

      <div class="icon-export__capture" aria-hidden="true">
        <ItemIconCapture
          v-if="captureItem"
          :key="captureItem.id"
          ref="captureComp"
          :item="captureItem"
          :width="captureBox(captureItem.typeKey).width"
          :height="captureBox(captureItem.typeKey).height"
          :base="base"
        />
      </div>

      <div v-if="running || finished" class="icon-export__progress">
        <div class="icon-export__bar">
          <span class="icon-export__bar-fill" :style="{ width: `${progressPct}%` }" />
        </div>
        <span class="icon-export__progress-text">
          <template v-if="running">
            {{ completed }} / {{ total }}
            <template v-if="currentName"> - {{ currentName }}</template>
          </template>
          <template v-else>
            Done: {{ completed - failures.length }} uploaded, {{ failures.length }} failed
          </template>
        </span>
      </div>

      <ul v-if="warnings.length" class="icon-export__notes">
        <li v-for="(warning, i) in warnings" :key="i">{{ warning }}</li>
      </ul>

      <ul v-if="failures.length" class="icon-export__failures">
        <li v-for="failure in failures" :key="failure.id">
          <strong>{{ failure.name }}</strong> - {{ failure.message }}
        </li>
      </ul>
    </div>

    <template #footer>
      <div class="icon-export__footer">
        <BaseSelect
          :model-value="base"
          :options="baseOptions"
          @update:model-value="(v: string) => base = v as 'dark' | 'light'"
        />
        <BaseSelect
          :model-value="String(size)"
          :options="sizeOptions"
          @update:model-value="(v: string) => size = Number(v)"
        />
        <div class="icon-export__footer-actions">
          <BaseButton
            v-if="running"
            variant="destructive"
            @click="cancel"
          >Stop</BaseButton>
          <BaseButton :disabled="running" @click="handleClose">Close</BaseButton>
          <BaseButton
            variant="primary"
            :loading="running"
            :disabled="selectedItems.length === 0"
            @click="startExport"
          >Export {{ selectedItems.length }}</BaseButton>
        </div>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.icon-export {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.icon-export__intro {
  margin: 0;
  font-size: var(--text-caption);
  line-height: 1.5;
  color: var(--text-secondary);
}

.icon-export__filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-sm);
}

.icon-export__toggles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
}

.icon-export__check {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  cursor: pointer;
}

.icon-export__bulk {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding-top: var(--space-xs);
  border-top: 1px solid var(--bg-overlay);
}

.icon-export__count {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.icon-export__bulk-actions {
  display: flex;
  gap: var(--space-xs);
}

.icon-export__error {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--error);
}

.icon-export__loading {
  padding: var(--space-xl) 0;
  text-align: center;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.icon-export__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: var(--space-sm);
  max-height: 46vh;
  overflow-y: auto;
  padding: var(--space-xs);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
}

.icon-export__tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-sm) var(--space-xs);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-family: var(--font-sans);
  cursor: pointer;
  transition: border-color 120ms ease, background 120ms ease;
}

.icon-export__tile:disabled {
  cursor: not-allowed;
}

.icon-export__tile:hover:not(:disabled) {
  border-color: var(--text-tertiary);
}

.icon-export__tile--on {
  border-color: var(--page-accent, var(--accent));
  background: color-mix(in srgb, var(--page-accent, var(--accent)) 10%, var(--bg-surface));
  color: var(--text-primary);
}

.icon-export__art {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
}

.icon-export__label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-caption);
  font-weight: 500;
}

.icon-export__meta {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.icon-export__capture {
  position: fixed;
  top: 0;
  left: -20000px;
  pointer-events: none;
  opacity: 1;
}

.icon-export__progress {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.icon-export__bar {
  height: 4px;
  border-radius: 2px;
  background: var(--bg-overlay);
  overflow: hidden;
}

.icon-export__bar-fill {
  display: block;
  height: 100%;
  background: var(--page-accent, var(--accent));
  transition: width 150ms ease-out;
}

.icon-export__progress-text {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.icon-export__notes,
.icon-export__failures {
  margin: 0;
  padding-left: var(--space-md);
  font-size: var(--text-caption);
  line-height: 1.6;
}

.icon-export__notes {
  color: var(--text-tertiary);
}

.icon-export__failures {
  color: var(--error);
  max-height: 140px;
  overflow-y: auto;
}

.icon-export__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-sm);
}

.icon-export__footer-actions {
  display: flex;
  gap: var(--space-sm);
  margin-left: auto;
}
</style>
