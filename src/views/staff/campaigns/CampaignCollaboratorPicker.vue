<script setup lang="ts">
import { getApiErrorMessage } from '@/api/client'
import BaseModal from '@/components/common/BaseModal.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import CountryFlag from '@/components/domain/CountryFlag.vue'
import { onAvatarError, pickAvatarFallback, pickAvatarUrl } from '@/composables/useAvatarFallback'
import { useDebouncedRef } from '@/composables/useDebouncedRef'
import { useCategoryStore } from '@/stores/categories'
import type { LeaderboardResponse } from '@/types/api/users'
import { computed, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{ loading?: boolean; existingIds?: string[] }>(), {
  existingIds: () => [],
})

const emit = defineEmits<{
  close: []
  pick: [userId: string]
}>()

const categoryStore = useCategoryStore()

const PAGE_SIZE = 10

const query = ref('')
const debounced = useDebouncedRef(query, 220)
const page = ref(1)
const totalPages = ref(1)
const results = ref<LeaderboardResponse[]>([])
const fetching = ref(false)
const err = ref<string | null>(null)

const existingSet = computed(() => new Set(props.existingIds))

watch(debounced, () => {
  page.value = 1
})

async function search() {
  const categoryId = categoryStore.getCategoryId('overall')
  if (!categoryId) {
    err.value = 'Player search is unavailable right now.'
    results.value = []
    return
  }
  fetching.value = true
  err.value = null
  try {
    const { getLeaderboard } = await import('@/api/leaderboards')
    const data = await getLeaderboard(categoryId, {
      search: debounced.value || undefined,
      size: PAGE_SIZE,
      page: page.value - 1,
      inactiveUsers: true,
    })
    results.value = data.content
    totalPages.value = data.totalPages || 1
    if (page.value > totalPages.value) page.value = totalPages.value
  } catch (e) {
    err.value = getApiErrorMessage(e, 'Search failed')
    results.value = []
    totalPages.value = 1
  } finally {
    fetching.value = false
  }
}

onMounted(search)

watch([debounced, page], () => {
  void search()
})

function rowClick(entry: LeaderboardResponse) {
  if (existingSet.value.has(String(entry.userId)) || props.loading) return
  emit('pick', String(entry.userId))
}
</script>

<template>
  <BaseModal :open="true" title="Invite collaborator" max-width="620px" @close="emit('close')">
    <div class="collab-picker">
      <input
        class="collab-picker__search"
        v-model="query"
        type="search"
        autofocus
        placeholder="Search a player by name"
      />

      <p class="collab-picker__note">
        Collaborators can edit this campaign while it's a draft. Only you can publish, delete, or
        manage the roster.
      </p>

      <p v-if="err" class="collab-picker__error" role="alert">{{ err }}</p>

      <div v-if="fetching" class="collab-picker__list">
        <SkeletonLoader v-for="i in 6" :key="i" variant="table-row" />
      </div>

      <p v-else-if="results.length === 0" class="collab-picker__empty">No players match that search.</p>

      <ul v-else class="collab-picker__list">
        <li v-for="entry in results" :key="entry.userId">
          <button
            type="button"
            class="collab-picker__row"
            :disabled="loading || existingSet.has(String(entry.userId))"
            @click="rowClick(entry)"
          >
            <span class="collab-picker__avatar">
              <img
                v-if="pickAvatarUrl(entry)"
                :src="pickAvatarUrl(entry)"
                :alt="entry.userName"
                loading="lazy"
                @error="onAvatarError(pickAvatarFallback(entry))($event)"
              />
            </span>
            <span class="collab-picker__meta">
              <span class="collab-picker__name">{{ entry.userName }}</span>
              <span class="collab-picker__sub">
                <CountryFlag v-if="entry.country" :country="entry.country" />
                <span class="collab-picker__rank">#{{ entry.ranking }}</span>
              </span>
            </span>
            <span class="collab-picker__trailing">
              <span v-if="existingSet.has(String(entry.userId))" class="collab-picker__on">
                On campaign
              </span>
              <span v-else class="collab-picker__ap">{{ Math.round(entry.ap).toLocaleString() }} AP</span>
            </span>
          </button>
        </li>
      </ul>

      <div v-if="!fetching && totalPages > 1" class="collab-picker__pagination">
        <PaginationControls :page="page" :total-pages="totalPages" @update:page="page = $event" />
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.collab-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  width: min(560px, 100%);
  max-height: min(72vh, 600px);
}

.collab-picker__search {
  width: 100%;
  padding: 10px 12px;
  font-family: var(--font-sans);
  font-size: var(--text-body);
  color: var(--text-primary);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  outline: none;
  transition: border-color 120ms ease;
}

.collab-picker__search:focus {
  border-color: var(--page-accent, var(--accent));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--page-accent, var(--accent)) 20%, transparent);
}

.collab-picker__note {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  line-height: 1.45;
}

.collab-picker__error {
  margin: 0;
  padding: 8px 10px;
  font-size: var(--text-caption);
  color: var(--error);
  background: color-mix(in srgb, var(--error) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--error) 35%, transparent);
  border-radius: 3px;
}

.collab-picker__empty {
  margin: var(--space-md) 0;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  text-align: center;
}

.collab-picker__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--bg-overlay) transparent;
}

.collab-picker__list::-webkit-scrollbar {
  width: 5px;
}

.collab-picker__list::-webkit-scrollbar-thumb {
  background: var(--bg-overlay);
  border-radius: 3px;
}

.collab-picker__list li {
  margin: 0;
}

.collab-picker__row {
  width: 100%;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  gap: var(--space-sm);
  align-items: center;
  padding: 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  text-align: left;
  color: inherit;
  transition:
    background 120ms ease,
    border-color 120ms ease;
}

.collab-picker__row:hover {
  background: var(--bg-elevated);
  border-color: var(--bg-overlay);
}

.collab-picker__row:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.collab-picker__avatar {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--bg-elevated);
}

.collab-picker__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.collab-picker__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.collab-picker__name {
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collab-picker__sub {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.collab-picker__trailing {
  display: inline-flex;
  align-items: center;
}

.collab-picker__ap {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.collab-picker__on {
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.collab-picker__pagination {
  flex: 0 0 auto;
  display: flex;
  justify-content: center;
}
</style>
