<script setup lang="ts">
import BaseModal from '@/components/common/BaseModal.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import GlowImage from '@/components/common/GlowImage.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import CountryFlag from '@/components/domain/CountryFlag.vue'
import PlayerTooltipTrigger from '@/components/domain/PlayerTooltipTrigger.vue'
import RelationActions from '@/components/domain/RelationActions.vue'
import { useAuthStore } from '@/stores/auth'
import { useRelationsStore } from '@/stores/relations'
import type {
  RelationDirection,
  UserRelationResponse,
  UserRelationType,
} from '@/types/api/relations'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{
  open: boolean
  userId: string | null
  type: UserRelationType
  direction: RelationDirection
  title: string
}>()

const emit = defineEmits<{
  close: []
  removed: [item: UserRelationResponse]
}>()

const router = useRouter()
const authStore = useAuthStore()
const relationsStore = useRelationsStore()

const items = ref<UserRelationResponse[]>([])
const page = ref(1)
const totalPages = ref(0)
const loading = ref(false)
const removingId = ref<string | null>(null)
const PAGE_SIZE = 10

const isSelf = computed(() => authStore.userId === props.userId)

const canRemove = computed(
  () => isSelf.value && props.direction === 'outgoing',
)

const removeLabel = computed(() => {
  if (props.type === 'follower') return 'Unfollow'
  if (props.type === 'rival') return 'Stop rivaling'
  return 'Unblock'
})

async function load() {
  if (!props.userId) return
  loading.value = true
  try {
    const { getMyRelations, getUserRelations } = await import('@/api/relations')
    const params = {
      type: props.type,
      direction: props.direction,
      page: page.value - 1,
      size: PAGE_SIZE,
    }

    const res =
      props.type === 'blocked' && isSelf.value
        ? await getMyRelations({ type: 'blocked', page: params.page, size: PAGE_SIZE })
        : await getUserRelations(props.userId, params)

    items.value = res.content
    totalPages.value = res.totalPages
  } catch {
    items.value = []
    totalPages.value = 0
  }
  loading.value = false
}

function goToProfile(targetUserId: string) {
  emit('close')
  router.push({ name: 'player-profile', params: { userId: targetUserId } })
}

async function removeRelation(item: UserRelationResponse, event: Event) {
  event.stopPropagation()
  if (removingId.value) return
  removingId.value = item.id
  try {
    await relationsStore.remove(item.targetUserId, item.type)
    items.value = items.value.filter((i) => i.id !== item.id)
    emit('removed', item)
    if (items.value.length === 0 && page.value > 1) {
      page.value -= 1
    }
  } catch {
  } finally {
    removingId.value = null
  }
}

watch(
  () => [props.open, props.userId, props.type, props.direction] as const,
  ([open]) => {
    if (open) {
      page.value = 1
      load()
    }
  },
  { immediate: true },
)

watch(page, () => {
  if (props.open) load()
})
</script>

<template>
  <BaseModal :open="open" :title="title" max-width="480px" @close="emit('close')">
    <div class="relation-list">
      <template v-if="loading">
        <SkeletonLoader v-for="i in PAGE_SIZE" :key="i" variant="text" height="48px" />
      </template>

      <template v-else-if="items.length === 0">
        <EmptyState message="Nothing to show here yet." />
      </template>

      <template v-else>
        <div
          v-for="item in items"
          :key="item.id"
          class="relation-list__row"
          role="button"
          tabindex="0"
          @click="goToProfile(item.targetUserId)"
          @keydown.enter="goToProfile(item.targetUserId)"
        >
          <GlowImage
            v-if="item.targetCdnAvatarUrl ?? item.targetAvatarUrl"
            :src="(item.targetCdnAvatarUrl ?? item.targetAvatarUrl) ?? ''"
            :alt="item.targetName"
            :size="36"
          />
          <span v-else class="relation-list__avatar-fallback" />
          <PlayerTooltipTrigger
            :user-id="item.targetUserId"
            :user-name="item.targetName"
            :avatar-url="(item.targetCdnAvatarUrl ?? item.targetAvatarUrl) ?? ''"
            :country="item.targetCountry ?? ''"
            class="relation-list__trigger"
          >
            <span class="relation-list__name">{{ item.targetName }}</span>
          </PlayerTooltipTrigger>
          <button
            v-if="canRemove"
            class="relation-list__remove"
            :disabled="removingId === item.id"
            :aria-label="removeLabel"
            :title="removeLabel"
            @click="removeRelation(item, $event)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5"
                stroke-linecap="round" />
            </svg>
          </button>
          <RelationActions
            v-else
            :target-user-id="item.targetUserId"
            :target-name="item.targetName"
            dense
            class="relation-list__actions"
            @click.stop
          />
          <CountryFlag v-if="item.targetCountry" :country="item.targetCountry" />
        </div>

        <PaginationControls class="relation-list__pagination"
          v-if="totalPages > 1"
          :page="page"
          :total-pages="totalPages"
          @update:page="page = $event"
        />
      </template>
    </div>
  </BaseModal>
</template>

<style scoped>
.relation-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.relation-list__pagination {
  margin-top: var(--space-md);
}

.relation-list__row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  cursor: pointer;
  text-align: left;
  width: 100%;
  font: inherit;
  color: inherit;
  transition: border-color 120ms ease, background-color 120ms ease;
}

.relation-list__row:hover {
  border-color: var(--text-tertiary);
  background: var(--bg-elevated);
}

.relation-list__avatar-fallback {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-avatar);
  background: var(--bg-overlay);
  flex-shrink: 0;
}

.relation-list__trigger {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
}

.relation-list__name {
  flex: 1;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.relation-list__actions {
  flex-shrink: 0;
}

.relation-list__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  flex-shrink: 0;
  transition: color 120ms ease, border-color 120ms ease, background-color 120ms ease;
}

.relation-list__remove:hover:not(:disabled) {
  color: var(--error);
  border-color: var(--error);
  background: color-mix(in srgb, var(--error) 10%, transparent);
}

.relation-list__remove:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
