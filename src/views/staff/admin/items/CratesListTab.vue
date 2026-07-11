<script setup lang="ts">
import {
  getAdminCrateContents,
  getAdminCrates,
} from '@/api/admin/crates'
import { createItem } from '@/api/admin/items'
import AdminTable from '@/components/admin/AdminTable.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import { useItemTypeStore } from '@/stores/itemTypes'
import type { CreateItemRequest, ItemRarity, ItemResponse } from '@/types/api/items'
import { formatRelativeDate } from '@/utils/formatters'
import { RARITY_ORDER } from '@/utils/items'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const itemTypeStore = useItemTypeStore()
const router = useRouter()

const crates = ref<ItemResponse[]>([])
const rewardCounts = ref<Record<string, number>>({})
const loading = ref(false)

const modalOpen = ref(false)
const submitting = ref(false)
const form = ref<{ name: string; rarity: ItemRarity }>({
  name: '',
  rarity: 'common',
})
const createError = ref<string | null>(null)

const rarityOptions = RARITY_ORDER.map((r) => ({ value: r, label: r }))

const crateTypeId = computed(() => itemTypeStore.byKey.get('crate')?.id ?? null)

function statusOf(c: ItemResponse): 'Live' | 'Draft' | 'Deprecated' {
  if (c.deprecated) return 'Deprecated'
  if (!c.active) return 'Draft'
  return 'Live'
}

async function fetchCrates() {
  loading.value = true
  try {
    crates.value = await getAdminCrates()
    const entries = await Promise.all(
      crates.value.map(async (c) => {
        try {
          const contents = await getAdminCrateContents(c.id)
          return [c.id, contents.length] as const
        } catch {
          return [c.id, 0] as const
        }
      }),
    )
    rewardCounts.value = Object.fromEntries(entries)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  form.value = { name: '', rarity: 'common' }
  createError.value = null
  modalOpen.value = true
}

async function submitCreate() {
  if (!crateTypeId.value) {
    createError.value = 'Crate item type not found'
    return
  }
  if (!form.value.name.trim()) {
    createError.value = 'Name is required'
    return
  }
  submitting.value = true
  try {
    const req: CreateItemRequest = {
      typeId: crateTypeId.value,
      name: form.value.name.trim(),
      rarity: form.value.rarity,
      visible: false,
      tradeable: false,
      stackable: true,
    }
    const created = await createItem(req)
    modalOpen.value = false
    router.push({ name: 'admin-crate-editor', params: { crateItemId: created.id } })
  } catch (e) {
    createError.value = (e as Error).message ?? 'Failed to create crate'
  } finally {
    submitting.value = false
  }
}

function openCrate(c: ItemResponse) {
  router.push({ name: 'admin-crate-editor', params: { crateItemId: c.id } })
}

onMounted(async () => {
  await itemTypeStore.fetchItemTypes()
  await fetchCrates()
})
</script>

<template>
  <div class="crates-list">
    <header class="crates-list__bar">
      <div class="crates-list__title">All crates</div>
      <BaseButton variant="primary" size="sm" :disabled="!crateTypeId" @click="openCreate">
        + New Crate
      </BaseButton>
    </header>

    <AdminTable :items="crates" :loading="loading" empty-message="No crates yet. Create one to get started.">
      <template #head>
        <th>Name</th>
        <th>Rarity</th>
        <th class="right">Rewards</th>
        <th>Status</th>
        <th>Created</th>
      </template>

      <template #default="{ item }: { item: ItemResponse }">
        <td>
          <button class="crates-list__row-name" @click="openCrate(item)">
            {{ item.name || 'Untitled crate' }}
          </button>
        </td>
        <td>
          <span class="crates-list__rarity" :class="`rarity--${item.rarity}`">
            {{ item.rarity }}
          </span>
        </td>
        <td class="right mono">{{ rewardCounts[item.id] ?? '-' }}</td>
        <td>
          <span class="crates-list__status" :class="`crates-list__status--${statusOf(item).toLowerCase()}`">
            {{ statusOf(item) }}
          </span>
        </td>
        <td class="muted">{{ formatRelativeDate(item.createdAt) }}</td>
      </template>
    </AdminTable>

    <BaseModal :open="modalOpen" title="New crate" max-width="480px" @close="modalOpen = false">
      <div class="crates-list__form">
        <BaseInput v-model="form.name" label="Name" placeholder="e.g. Season 1 Crate" />
        <BaseSelect :model-value="form.rarity" :options="rarityOptions" label="Rarity"
          @update:model-value="(v: string) => (form.rarity = v as ItemRarity)" />
        <p class="crates-list__hint">
          The crate will be created as a draft (not visible to players). You can add rewards
          on the next screen.
        </p>
        <p v-if="createError" class="crates-list__error">{{ createError }}</p>
      </div>
      <template #footer>
        <BaseButton size="sm" @click="modalOpen = false">Cancel</BaseButton>
        <BaseButton variant="primary" size="sm" :loading="submitting" @click="submitCreate">
          Create
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.crates-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.crates-list__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
}

.crates-list__title {
  font-size: var(--text-section-heading);
  font-weight: 600;
  color: var(--text-primary);
}

.crates-list__row-name {
  background: transparent;
  border: none;
  padding: 0;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: 500;
  cursor: pointer;
  text-align: left;
}

.crates-list__row-name:hover {
  color: var(--accent);
  text-decoration: underline;
}

.crates-list__rarity {
  text-transform: capitalize;
  color: var(--rarity-color, var(--text-primary));
  font-weight: 500;
}

.crates-list__rarity.rarity--common {
  --rarity-color: var(--text-tertiary);
}

.crates-list__rarity.rarity--uncommon {
  --rarity-color: var(--success);
}

.crates-list__rarity.rarity--rare {
  --rarity-color: var(--info);
}

.crates-list__rarity.rarity--epic {
  --rarity-color: var(--tier-apex);
}

.crates-list__rarity.rarity--legendary {
  --rarity-color: var(--tier-gold);
}

.crates-list__rarity.rarity--mythic {
  --rarity-color: var(--error);
}

.crates-list__status {
  display: inline-block;
  padding: 2px var(--space-sm);
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
  border: 1px solid var(--status-color, var(--bg-overlay));
  color: var(--status-color, var(--text-secondary));
}

.crates-list__status--live {
  --status-color: var(--success);
}

.crates-list__status--draft {
  --status-color: var(--warning);
}

.crates-list__status--deprecated {
  --status-color: var(--text-tertiary);
}

.crates-list__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.crates-list__hint {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-secondary);
  line-height: 1.4;
}

.crates-list__error {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--error);
}
</style>
