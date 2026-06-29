<script setup lang="ts">
import {
  addCampaignDifficulty,
  createCampaign,
  curateCampaign,
  deactivateCampaign,
  deactivateCampaignDifficulty,
  publishCampaign,
  reopenCampaignForEdit,
  uncurateCampaign,
  updateCampaign,
  updateCampaignDifficulty,
} from '@/api/admin/campaigns'
import {
  addCampaignCompletionItem,
  addCampaignDifficultyItem,
  addPlayerCampaignDifficulty,
  createPlayerCampaign,
  deletePlayerCampaign,
  deletePlayerCampaignDifficulty,
  getCampaign,
  getCampaignTags,
  publishPlayerCampaign,
  removeCampaignCompletionItem,
  removeCampaignDifficultyItem,
  unpublishPlayerCampaign,
  updatePlayerCampaign,
  updatePlayerCampaignDifficulty,
} from '@/api/campaigns'
import {
  deleteCampaignBackground,
  deleteCampaignIcon,
  uploadCampaignBackground,
  uploadCampaignIcon,
} from '@/api/cdn'
import { ApiError, getApiErrorMessage } from '@/api/client'
import BaseBanner from '@/components/common/BaseBanner.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import ImageUploader from '@/components/common/ImageUploader.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import Breadcrumbs, { type Crumb } from '@/components/common/Breadcrumbs.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import CampaignRoadmap from '@/components/domain/CampaignRoadmap.vue'
import CampaignRewardItem from '@/components/domain/CampaignRewardItem.vue'
import { useItemCatalog } from '@/composables/useItemCatalog'
import { useAuthStore } from '@/stores/auth'
import { useCategoryStore } from '@/stores/categories'
import { isAdminSubdomain } from '@/utils/subdomain'
import type {
  AddCampaignDifficultyRequest,
  UpdateCampaignDifficultyRequest,
  UpdateCampaignRequest,
} from '@/types/api/admin'
import type {
  CampaignDetailResponse,
  CampaignDifficultyResponse,
  CampaignTagResponse,
} from '@/types/api/campaigns'
import type { PublicMapDifficultyResponse } from '@/types/api/maps'
import type { CampaignRequirementType } from '@/types/enums'
import { formatDifficulty } from '@/utils/mappers'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CampaignItemPicker from './CampaignItemPicker.vue'
import CampaignMapPicker from './CampaignMapPicker.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const categoryStore = useCategoryStore()
const { itemsById: rewardItemsById, ensureLoaded: ensureRewardItems } = useItemCatalog()

const campaign = ref<CampaignDetailResponse | null>(null)
const allTags = ref<CampaignTagResponse[]>([])
const difficultyMeta = ref(new Map<string, PublicMapDifficultyResponse>())
const loading = ref(true)
const error = ref<string | null>(null)
const actionPending = ref(false)
const actionError = ref<string | null>(null)
const showMapPicker = ref(false)
const pendingPosition = ref<{ x: number; y: number } | null>(null)
const selectedId = ref<string | null>(null)
const canvasMode = ref<'drag' | 'connect'>('drag')
const itemPickerFor = ref<'campaign' | 'node' | null>(null)
const requirementDirtyIds = ref(new Set<string>())
const editedLiveCampaign = ref(false)
const showRepublishWarning = ref(false)

const campaignId = computed(() => String(route.params.campaignId ?? ''))

const isNewMode = computed(() => route.name === 'campaign-new')

const isUnsavedDraft = computed(() => campaign.value?.id === '')

const isAdminRoute = isAdminSubdomain

const isDraftStatus = computed(() => campaign.value?.status === 'DRAFT')

let suppressNextCampaignIdWatch = false

function createPlaceholderCampaign(): CampaignDetailResponse {
  return {
    id: '',
    creatorId: auth.userId ? String(auth.userId) : null,
    creatorName: null,
    creatorAlias: null,
    name: '',
    slug: '',
    summary: null,
    description: null,
    status: 'DRAFT',
    seekingCuration: false,
    progressionAgnostic: false,
    completionMode: 'TERMINAL',
    legacy: false,
    completionXp: 0,
    playlistExportEnabled: true,
    difficultyCount: 0,
    tags: [],
    backgroundUrl: null,
    iconUrl: null,
    submittedAt: null,
    curatedAt: null,
    createdAt: new Date().toISOString(),
    curatorNotes: null,
    difficulties: [],
    completionItems: [],
  }
}

async function ensureCampaign(): Promise<CampaignDetailResponse | null> {
  if (campaign.value && campaign.value.id !== '') return campaign.value
  if (!auth.isLoggedIn && !isCurator.value) {
    actionError.value = 'Sign in to create a campaign.'
    return null
  }
  try {
    const ts = Date.now()
    const fallbackName = `Untitled-${ts}`
    const fallbackSlug = `untitled-${ts}`
    const typedName = formMeta.value.name.trim()
    const typedSlug = formMeta.value.slug.trim()
    const req = {
      name: typedName || fallbackName,
      slug: typedSlug || fallbackSlug,
      completionMode: formMeta.value.completionMode,
      progressionAgnostic: formMeta.value.progressionAgnostic,
    }
    const created = !auth.isLoggedIn && isCurator.value
      ? await createCampaign(req)
      : await createPlayerCampaign(req)
    const detail = await getCampaign(created.id)
    campaign.value = detail
    if (allTags.value.length === 0) {
      allTags.value = await getCampaignTags()
    }
    suppressNextCampaignIdWatch = true
    await router.replace({ name: 'campaign-editor', params: { campaignId: created.id } })
    return detail
  } catch (err) {
    actionError.value = getApiErrorMessage(err, 'Failed to create campaign')
    return null
  }
}

async function load() {
  loading.value = true
  error.value = null
  requirementDirtyIds.value = new Set()
  editedLiveCampaign.value = false
  try {
    const c = await getCampaign(campaignId.value)
    campaign.value = c
    void ensureRewardItems()
    if (allTags.value.length === 0) {
      allTags.value = await getCampaignTags()
    }
    if (!selectedId.value && c.difficulties.length > 0) {
      selectedId.value = c.difficulties[0].id
    }
    void loadDifficultyMeta(c.difficulties)
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 404)) {
      error.value = getApiErrorMessage(err, 'Failed to load campaign')
    }
  } finally {
    loading.value = false
  }
}

async function loadDifficultyMeta(difficulties: CampaignDifficultyResponse[]) {
  if (difficulties.length === 0) return
  const { getDifficulty } = await import('@/api/maps')
  const next = new Map(difficultyMeta.value)
  await Promise.all(
    difficulties.map(async (d) => {
      if (next.has(d.id)) return
      try {
        next.set(d.id, await getDifficulty(d.mapDifficultyId))
      } catch {
      }
    }),
  )
  difficultyMeta.value = next
}

onMounted(() => {
  if (isNewMode.value) {
    campaign.value = createPlaceholderCampaign()
    void getCampaignTags()
      .then((t) => {
        if (allTags.value.length === 0) allTags.value = t
      })
      .catch(() => {})
    loading.value = false
    return
  }
  void load()
})

watch(campaignId, (next, prev) => {
  if (next === prev) return
  if (suppressNextCampaignIdWatch) {
    suppressNextCampaignIdWatch = false
    return
  }
  selectedId.value = null
  void load()
})

const isAdmin = computed(() => auth.isAdmin)

const isCurator = computed(() => auth.hasRole('CAMPAIGN_CURATOR'))

const isCreator = computed(() => {
  if (isUnsavedDraft.value && auth.isLoggedIn) return true
  return (
    !!campaign.value?.creatorId
    && !!auth.userId
    && String(campaign.value.creatorId) === String(auth.userId)
  )
})

const canAccess = computed(() => isCurator.value || isCreator.value)

const creatorBlocked = computed(
  () => isCreator.value && !!campaign.value?.seekingCuration && !isCurator.value,
)

const useAdminEndpoint = computed(() => {
  if (!campaign.value) return false
  if (isCreator.value && campaign.value.status === 'DRAFT') return false
  return isCurator.value
})

const editable = computed(() => {
  if (!campaign.value || actionPending.value) return false
  if (isCreator.value && campaign.value.status === 'DRAFT' && !creatorBlocked.value) return true
  if (isCurator.value && (campaign.value.status === 'DRAFT' || campaign.value.status === 'EDITING')) return true
  return false
})

const accent = computed(() => {
  const cat = campaign.value?.tags.find((t) => t.kind === 'CATEGORY')
  if (!cat?.categoryId) return 'var(--accent-overall)'
  const code = categoryStore.getCategoryCode(cat.categoryId)
  if (!code) return 'var(--accent-overall)'
  return categoryStore.getCategoryInfo(code)?.accent ?? 'var(--accent-overall)'
})

const nodeAccents = computed(() => {
  const map = new Map<string, string>()
  for (const d of campaign.value?.difficulties ?? []) {
    const meta = difficultyMeta.value.get(d.id)
    if (!meta) continue
    const code = categoryStore.getCategoryCode(meta.categoryId)
    if (!code) continue
    const a = categoryStore.getCategoryInfo(code)?.accent
    if (a) map.set(d.id, a)
  }
  return map
})

const selectedDifficulty = computed<CampaignDifficultyResponse | null>(() => {
  if (!selectedId.value) return null
  return campaign.value?.difficulties.find((d) => d.id === selectedId.value) ?? null
})

const selectedMeta = computed(() =>
  selectedDifficulty.value
    ? difficultyMeta.value.get(selectedDifficulty.value.id) ?? null
    : null,
)

const tagsByKind = computed(() => {
  const map = new Map<string, CampaignTagResponse[]>()
  for (const t of allTags.value) {
    const arr = map.get(t.kind) ?? []
    arr.push(t)
    map.set(t.kind, arr)
  }
  return map
})

const campaignTagIds = computed(() => new Set(campaign.value?.tags.map((t) => t.id) ?? []))

const sinkCount = computed(() => {
  if (!campaign.value) return 0
  const allTargets = new Set<string>()
  for (const d of campaign.value.difficulties) {
    for (const pid of d.prerequisiteCampaignDifficultyIds ?? []) allTargets.add(pid)
  }
  return campaign.value.difficulties.filter((d) => !allTargets.has(d.id)).length
})

const isTerminal = computed(() => campaign.value?.completionMode === 'TERMINAL')

const canCurate = computed(
  () => !!campaign.value && (!isTerminal.value || sinkCount.value === 1),
)

const statusLabel: Record<string, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  EDITING: 'Editing',
  CURATED: 'Curated',
}

const statusMeaning: Record<string, string> = {
  DRAFT: 'Hidden from the queue; players cannot start. Fully editable.',
  PUBLISHED: 'Visible to players but no XP / items pay out. Locked from edits.',
  EDITING: 'Reopened for changes. Player progress is preserved while you edit.',
  CURATED: 'Live with payouts. Locked from edits.',
}

const creatorStatusMeaning = computed<string | null>(() => {
  if (!campaign.value) return null
  switch (campaign.value.status) {
    case 'DRAFT':
      return campaign.value.seekingCuration
        ? 'Draft, awaiting curator review. Only you can see it until you publish.'
        : 'Draft, only you can see it. Publish to make it playable.'
    case 'PUBLISHED':
      return 'Live and playable. Unpublish to make changes, then publish again.'
    case 'EDITING':
      return 'A curator has this open for review. Unpublish to take it back to a draft you can edit.'
    case 'CURATED':
      return 'Curated and locked. Contact a curator if it needs changes.'
    default:
      return null
  }
})

const formMeta = ref({
  name: '',
  slug: '',
  creatorAlias: '',
  summary: '',
  description: '',
  completionMode: 'TERMINAL' as 'TERMINAL' | 'ALL',
  progressionAgnostic: false,
  playlistExportEnabled: true,
  completionXp: 0,
  backgroundUrl: '',
  seekingCuration: false,
})

function syncFormFromCampaign() {
  if (!campaign.value) return
  formMeta.value = {
    name: campaign.value.name ?? '',
    slug: campaign.value.slug ?? '',
    creatorAlias: campaign.value.creatorAlias ?? campaign.value.creatorName ?? '',
    summary: campaign.value.summary ?? '',
    description: campaign.value.description ?? '',
    completionMode: campaign.value.completionMode,
    progressionAgnostic: campaign.value.progressionAgnostic,
    playlistExportEnabled: campaign.value.playlistExportEnabled,
    completionXp: campaign.value.completionXp ?? 0,
    backgroundUrl: campaign.value.backgroundUrl ?? '',
    seekingCuration: campaign.value.seekingCuration,
  }
}

watch(campaign, syncFormFromCampaign, { immediate: true })

const formNode = ref<{
  requirementType: CampaignRequirementType
  requirementValue: number
  description: string
  checkpointLabel: string
  checkpointAvatarUrl: string
  checkpointColor: string
  checkpointSize: string
  borderColor: string
  borderShape: string
  size: string
  xp: number
}>({
  requirementType: 'ACC',
  requirementValue: 0,
  description: '',
  checkpointLabel: '',
  checkpointAvatarUrl: '',
  checkpointColor: '',
  checkpointSize: '',
  borderColor: '',
  borderShape: '',
  size: '',
  xp: 0,
})

function syncFormFromNode() {
  const d = selectedDifficulty.value
  if (!d) return
  formNode.value = {
    requirementType: d.requirementType,
    requirementValue: d.requirementValue,
    description: d.description ?? '',
    checkpointLabel: d.checkpointLabel ?? '',
    checkpointAvatarUrl: d.checkpointAvatarUrl ?? '',
    checkpointColor: d.checkpointColor ?? '',
    checkpointSize: d.checkpointSize ?? '',
    borderColor: d.borderColor ?? '',
    borderShape: d.borderShape ?? 'hex',
    size: d.size ?? '',
    xp: d.xp ?? 0,
  }
}

watch(selectedDifficulty, syncFormFromNode, { immediate: true })

async function applyCampaignPatch(patch: UpdateCampaignRequest) {
  let c = campaign.value
  if (!c || c.id === '') {
    c = await ensureCampaign()
    if (!c) return
  }
  try {
    actionError.value = null
    const updated = useAdminEndpoint.value
      ? await updateCampaign(c.id, patch)
      : await updatePlayerCampaign(c.id, patch)
    if (campaign.value) {
      campaign.value = { ...campaign.value, ...updated }
    }
  } catch (err) {
    actionError.value = getApiErrorMessage(err, 'Failed to update campaign')
  }
}

async function applyNodePatch(id: string, patch: UpdateCampaignDifficultyRequest) {
  try {
    actionError.value = null
    const updated = useAdminEndpoint.value
      ? await updateCampaignDifficulty(id, patch)
      : await updatePlayerCampaignDifficulty(id, patch)
    if (campaign.value) {
      campaign.value = {
        ...campaign.value,
        difficulties: campaign.value.difficulties.map((d) => (d.id === id ? updated : d)),
      }
    }
  } catch (err) {
    actionError.value = getApiErrorMessage(err, 'Failed to update node')
  }
}

function commitMetaField(field: keyof UpdateCampaignRequest) {
  if (!editable.value || !campaign.value) return
  const value = formMeta.value[field as keyof typeof formMeta.value]
  const original = (campaign.value as unknown as Record<string, unknown>)[field]
  if (value === original) return
  if (typeof value === 'string' && original == null && value === '') return
  void applyCampaignPatch({ [field]: value === '' ? null : value } as UpdateCampaignRequest)
}

function commitNodeField(field: keyof UpdateCampaignDifficultyRequest) {
  const d = selectedDifficulty.value
  if (!editable.value || !d) return
  const value = formNode.value[field as keyof typeof formNode.value]
  const original = (d as unknown as Record<string, unknown>)[field]
  if (value === original) return
  if (typeof value === 'string' && original == null && value === '') return
  if (field === 'requirementType' || field === 'requirementValue') {
    requirementDirtyIds.value.add(d.id)
  }
  const send = value === '' && field !== 'description' ? null : value
  void applyNodePatch(d.id, { [field]: send } as UpdateCampaignDifficultyRequest)
}

function toggleTag(tagId: string) {
  if (!editable.value || !campaign.value) return
  const current = new Set(campaignTagIds.value)
  if (current.has(tagId)) current.delete(tagId)
  else current.add(tagId)
  void applyCampaignPatch({ tagIds: Array.from(current) })
}

function doPlayerPublish() {
  if (!campaign.value) return
  if (editedLiveCampaign.value && requirementDirtyIds.value.size > 0) {
    showRepublishWarning.value = true
    return
  }
  void performPublish()
}

async function performPublish() {
  if (!campaign.value) return
  showRepublishWarning.value = false
  actionPending.value = true
  actionError.value = null
  try {
    await publishPlayerCampaign(campaign.value.id)
    await load()
  } catch (err) {
    actionError.value = getApiErrorMessage(err, 'Failed to publish campaign')
  } finally {
    actionPending.value = false
  }
}

async function doPlayerUnpublish() {
  if (!campaign.value) return
  actionPending.value = true
  actionError.value = null
  try {
    await unpublishPlayerCampaign(campaign.value.id)
    await load()
    editedLiveCampaign.value = true
  } catch (err) {
    actionError.value = getApiErrorMessage(err, 'Failed to unpublish campaign')
  } finally {
    actionPending.value = false
  }
}

async function deleteDraft() {
  if (!campaign.value) return
  if (!window.confirm('Delete this draft? This cannot be undone.')) return
  actionPending.value = true
  actionError.value = null
  try {
    await deletePlayerCampaign(campaign.value.id)
    window.location.assign('/campaigns')
  } catch (err) {
    actionError.value = getApiErrorMessage(err, 'Failed to delete draft')
  } finally {
    actionPending.value = false
  }
}

async function uploadBackground(file: File) {
  if (!campaign.value) return
  await uploadCampaignBackground(campaign.value.id, file, useAdminEndpoint.value)
  await load()
}

async function removeBackground() {
  if (!campaign.value) return
  await deleteCampaignBackground(campaign.value.id, useAdminEndpoint.value)
  await load()
}

async function uploadIcon(file: File) {
  if (!campaign.value) return
  await uploadCampaignIcon(campaign.value.id, file, useAdminEndpoint.value)
  await load()
}

async function removeIcon() {
  if (!campaign.value) return
  await deleteCampaignIcon(campaign.value.id, useAdminEndpoint.value)
  await load()
}

function wouldCreateCycle(fromId: string, toId: string): boolean {
  if (fromId === toId) return true
  const c = campaign.value
  if (!c) return false
  const successors = new Map<string, string[]>()
  for (const d of c.difficulties) {
    for (const pid of d.prerequisiteCampaignDifficultyIds ?? []) {
      const list = successors.get(pid) ?? []
      list.push(d.id)
      successors.set(pid, list)
    }
  }
  const visited = new Set<string>()
  const stack: string[] = [toId]
  while (stack.length > 0) {
    const id = stack.pop() as string
    if (visited.has(id)) continue
    visited.add(id)
    if (id === fromId) return true
    for (const next of successors.get(id) ?? []) stack.push(next)
  }
  return false
}

function nodeLabel(id: string): string {
  const d = campaign.value?.difficulties.find((x) => x.id === id)
  return d?.checkpointLabel || d?.songName || 'node'
}

function setPrereqMode(mode: 'AND' | 'OR') {
  const d = selectedDifficulty.value
  if (!editable.value || !d) return
  if (d.prerequisiteMode === mode) return
  void applyNodePatch(d.id, { prerequisiteMode: mode })
}

async function doPublish() {
  if (!campaign.value) return
  actionPending.value = true
  actionError.value = null
  try {
    await publishCampaign(campaign.value.id)
    await load()
  } catch (err) {
    actionError.value = getApiErrorMessage(err, 'Failed to publish campaign')
  } finally {
    actionPending.value = false
  }
}

async function doReopen() {
  if (!campaign.value) return
  actionPending.value = true
  actionError.value = null
  try {
    await reopenCampaignForEdit(campaign.value.id)
    await load()
  } catch (err) {
    actionError.value = getApiErrorMessage(err, 'Failed to reopen for editing')
  } finally {
    actionPending.value = false
  }
}

async function doCurate() {
  if (!campaign.value) return
  if (isTerminal.value && sinkCount.value !== 1) {
    actionError.value = `Terminal campaigns need exactly one sink node, found ${sinkCount.value}.`
    return
  }
  actionPending.value = true
  actionError.value = null
  try {
    await curateCampaign(campaign.value.id)
    await load()
  } catch (err) {
    actionError.value = getApiErrorMessage(err, 'Failed to curate campaign')
  } finally {
    actionPending.value = false
  }
}

async function doUncurate() {
  if (!campaign.value) return
  actionPending.value = true
  actionError.value = null
  try {
    await uncurateCampaign(campaign.value.id)
    await load()
  } catch (err) {
    actionError.value = getApiErrorMessage(err, 'Failed to uncurate campaign')
  } finally {
    actionPending.value = false
  }
}

async function doDeactivate() {
  if (!campaign.value) return
  if (!window.confirm('Deactivate this campaign? It will be hidden but player progress preserved.')) return
  actionPending.value = true
  actionError.value = null
  try {
    await deactivateCampaign(campaign.value.id)
    await load()
  } catch (err) {
    actionError.value = getApiErrorMessage(err, 'Failed to deactivate campaign')
  } finally {
    actionPending.value = false
  }
}

async function handleMove(payload: { id: string; positionX: number; positionY: number }) {
  if (!campaign.value) return
  const target = campaign.value.difficulties.find((d) => d.id === payload.id)
  if (!target) return
  if (target.positionX === payload.positionX && target.positionY === payload.positionY) return

  const prevX = target.positionX
  const prevY = target.positionY

  campaign.value = {
    ...campaign.value,
    difficulties: campaign.value.difficulties.map((d) =>
      d.id === payload.id
        ? { ...d, positionX: payload.positionX, positionY: payload.positionY }
        : d,
    ),
  }

  try {
    actionError.value = null
    const patch = { positionX: payload.positionX, positionY: payload.positionY }
    if (useAdminEndpoint.value) {
      await updateCampaignDifficulty(payload.id, patch)
    } else {
      await updatePlayerCampaignDifficulty(payload.id, patch)
    }
  } catch (err) {
    actionError.value = getApiErrorMessage(err, 'Failed to move node')
    if (campaign.value) {
      campaign.value = {
        ...campaign.value,
        difficulties: campaign.value.difficulties.map((d) =>
          d.id === payload.id ? { ...d, positionX: prevX, positionY: prevY } : d,
        ),
      }
    }
  }
}

async function persistPrereqs(toId: string, next: string[], prev: string[]) {
  if (!campaign.value) return
  campaign.value = {
    ...campaign.value,
    difficulties: campaign.value.difficulties.map((d) =>
      d.id === toId ? { ...d, prerequisiteCampaignDifficultyIds: next } : d,
    ),
  }
  try {
    actionError.value = null
    const payload = { prerequisiteCampaignDifficultyIds: next }
    const updated = useAdminEndpoint.value
      ? await updateCampaignDifficulty(toId, payload)
      : await updatePlayerCampaignDifficulty(toId, payload)
    if (campaign.value) {
      campaign.value = {
        ...campaign.value,
        difficulties: campaign.value.difficulties.map((d) =>
          d.id === toId ? updated : d,
        ),
      }
    }
  } catch (err) {
    actionError.value = getApiErrorMessage(err, 'Failed to update prerequisites')
    if (campaign.value) {
      campaign.value = {
        ...campaign.value,
        difficulties: campaign.value.difficulties.map((d) =>
          d.id === toId ? { ...d, prerequisiteCampaignDifficultyIds: prev } : d,
        ),
      }
    }
  }
}

function openCampaignItemPicker() {
  if (!editable.value) return
  itemPickerFor.value = 'campaign'
}

function openNodeItemPicker() {
  if (!editable.value || !selectedDifficulty.value) return
  itemPickerFor.value = 'node'
}

async function handleItemPicked(payload: { itemId: string; quantity: number }) {
  if (itemPickerFor.value === 'campaign') {
    await addCompletionItem(payload)
  } else if (itemPickerFor.value === 'node') {
    await addNodeItem(payload)
  }
  itemPickerFor.value = null
}

async function addCompletionItem(payload: { itemId: string; quantity: number }) {
  let c = campaign.value
  if (!c || c.id === '') {
    c = await ensureCampaign()
    if (!c) return
  }
  actionPending.value = true
  actionError.value = null
  try {
    const updated = await addCampaignCompletionItem(c.id, payload)
    if (campaign.value) {
      campaign.value = { ...campaign.value, completionItems: updated }
    }
  } catch (err) {
    actionError.value = getApiErrorMessage(err, 'Failed to add reward')
  } finally {
    actionPending.value = false
  }
}

async function removeCompletionItem(itemId: string) {
  if (!editable.value || !campaign.value) return
  const cId = campaign.value.id
  const prev = campaign.value.completionItems
  campaign.value = {
    ...campaign.value,
    completionItems: prev.filter((i) => i.itemId !== itemId),
  }
  try {
    actionError.value = null
    const updated = await removeCampaignCompletionItem(cId, itemId)
    if (campaign.value) {
      campaign.value = { ...campaign.value, completionItems: updated }
    }
  } catch (err) {
    actionError.value = getApiErrorMessage(err, 'Failed to remove reward')
    if (campaign.value) {
      campaign.value = { ...campaign.value, completionItems: prev }
    }
  }
}

async function addNodeItem(payload: { itemId: string; quantity: number }) {
  const d = selectedDifficulty.value
  if (!editable.value || !d) return
  const dId = d.id
  actionPending.value = true
  actionError.value = null
  try {
    const updated = await addCampaignDifficultyItem(dId, payload)
    if (campaign.value) {
      campaign.value = {
        ...campaign.value,
        difficulties: campaign.value.difficulties.map((row) =>
          row.id === dId ? { ...row, items: updated } : row,
        ),
      }
    }
  } catch (err) {
    actionError.value = getApiErrorMessage(err, 'Failed to add reward')
  } finally {
    actionPending.value = false
  }
}

async function removeNodeItem(itemId: string) {
  const d = selectedDifficulty.value
  if (!editable.value || !d || !campaign.value) return
  const dId = d.id
  const prevItems = d.items
  campaign.value = {
    ...campaign.value,
    difficulties: campaign.value.difficulties.map((row) =>
      row.id === dId ? { ...row, items: prevItems.filter((i) => i.itemId !== itemId) } : row,
    ),
  }
  try {
    actionError.value = null
    const updated = await removeCampaignDifficultyItem(dId, itemId)
    if (campaign.value) {
      campaign.value = {
        ...campaign.value,
        difficulties: campaign.value.difficulties.map((row) =>
          row.id === dId ? { ...row, items: updated } : row,
        ),
      }
    }
  } catch (err) {
    actionError.value = getApiErrorMessage(err, 'Failed to remove reward')
    if (campaign.value) {
      campaign.value = {
        ...campaign.value,
        difficulties: campaign.value.difficulties.map((row) =>
          row.id === dId ? { ...row, items: prevItems } : row,
        ),
      }
    }
  }
}

async function handleConnect(payload: { fromId: string; toId: string }) {
  const target = campaign.value?.difficulties.find((d) => d.id === payload.toId)
  if (!target) return
  const prev = target.prerequisiteCampaignDifficultyIds ?? []
  if (prev.includes(payload.fromId)) return
  if (wouldCreateCycle(payload.fromId, payload.toId)) {
    actionError.value = `Can't connect "${nodeLabel(payload.fromId)}" → "${nodeLabel(payload.toId)}". The reverse path already exists, which would create a cycle.`
    return
  }
  await persistPrereqs(payload.toId, [...prev, payload.fromId], prev)
}

async function handleDisconnect(payload: { fromId: string; toId: string }) {
  const target = campaign.value?.difficulties.find((d) => d.id === payload.toId)
  if (!target) return
  const prev = target.prerequisiteCampaignDifficultyIds ?? []
  if (!prev.includes(payload.fromId)) return
  await persistPrereqs(payload.toId, prev.filter((id) => id !== payload.fromId), prev)
}

function handleEmptyClick() {
  selectedId.value = null
}

function openMapPicker() {
  if (!editable.value) return
  pendingPosition.value = { x: 0, y: 0 }
  showMapPicker.value = true
}

async function handleMapPicked(mapDifficultyId: string) {
  if (!pendingPosition.value) return
  const { x, y } = pendingPosition.value
  const positionX = Math.round(x / (48 * 1.5))
  const offsetY = positionX % 2 !== 0 ? (48 * Math.sqrt(3)) / 2 : 0
  const positionY = Math.round((y - offsetY) / (48 * Math.sqrt(3)))
  const req: AddCampaignDifficultyRequest = {
    mapDifficultyId,
    requirementType: 'ACC',
    requirementValue: 0.95,
    positionX,
    positionY,
    xp: 0,
  }
  actionPending.value = true
  actionError.value = null
  try {
    let c = campaign.value
    if (!c || c.id === '') {
      c = await ensureCampaign()
      if (!c) return
    }
    const created = useAdminEndpoint.value
      ? await addCampaignDifficulty(c.id, req)
      : await addPlayerCampaignDifficulty(c.id, req)
    selectedId.value = created.id
    showMapPicker.value = false
    pendingPosition.value = null
    await load()
  } catch (err) {
    actionError.value = getApiErrorMessage(err, 'Failed to add node')
  } finally {
    actionPending.value = false
  }
}

async function removeSelectedNode() {
  const d = selectedDifficulty.value
  if (!editable.value || !d || !campaign.value) return
  if (!window.confirm(`Remove "${d.songName}" from this campaign?`)) return
  actionPending.value = true
  actionError.value = null
  try {
    if (useAdminEndpoint.value) {
      await deactivateCampaignDifficulty(campaign.value.id, d.id)
    } else {
      await deletePlayerCampaignDifficulty(campaign.value.id, d.id)
    }
    selectedId.value = null
    await load()
  } catch (err) {
    actionError.value = getApiErrorMessage(err, 'Failed to remove node')
  } finally {
    actionPending.value = false
  }
}

function handleSelect(id: string) {
  selectedId.value = id
}

function handleDeselect() {
  if (showMapPicker.value) return
  selectedId.value = null
}

const requirementTypeOptions: Array<{ value: CampaignRequirementType; label: string }> = [
  { value: 'ACC', label: 'Accuracy' },
  { value: 'AP', label: 'AP' },
  { value: 'SCORE', label: 'Score' },
  { value: 'STREAK_115', label: '115 Streak' },
  { value: 'FC', label: 'Full Combo' },
]

const completionModeOptions: Array<{ value: 'TERMINAL' | 'ALL'; label: string }> = [
  { value: 'TERMINAL', label: 'Reach the end (single sink)' },
  { value: 'ALL', label: 'Clear every node' },
]

const requirementValueDisplay = computed<number>({
  get: () => {
    if (formNode.value.requirementType === 'ACC') {
      const v = formNode.value.requirementValue * 100
      return Number.isFinite(v) ? Number(v.toFixed(2)) : 0
    }
    return formNode.value.requirementValue
  },
  set: (v) => {
    if (formNode.value.requirementType === 'ACC') {
      const clamped = Math.max(70, Math.min(100, Number(v) || 70))
      formNode.value.requirementValue = clamped / 100
    } else {
      formNode.value.requirementValue = Number(v) || 0
    }
  },
})

const requirementBounds = computed(() => {
  if (formNode.value.requirementType === 'ACC') return { min: 70, max: 100, step: 0.1, unit: '%' }
  if (formNode.value.requirementType === 'AP') return { min: 0, max: 1000, step: 1, unit: 'AP' }
  if (formNode.value.requirementType === 'STREAK_115') return { min: 0, max: 2000, step: 1, unit: '' }
  if (formNode.value.requirementType === 'FC') return { min: 1, max: 1, step: 1, unit: '' }
  return { min: 0, max: 1_500_000, step: 1000, unit: '' }
})

const isMilestone = ref(false)
let suppressMilestoneAutoOpen = false

watch(
  selectedDifficulty,
  (d) => {
    if (!d) {
      isMilestone.value = false
      return
    }
    isMilestone.value = !!(
      d.checkpointLabel
      || d.checkpointAvatarUrl
      || d.checkpointColor
      || d.checkpointSize
    )
  },
  { immediate: true },
)

watch(
  () => [
    formNode.value.checkpointLabel,
    formNode.value.checkpointAvatarUrl,
    formNode.value.checkpointColor,
    formNode.value.checkpointSize,
  ],
  ([label, avatar, color, size]) => {
    if (suppressMilestoneAutoOpen) return
    if (label || avatar || color || size) isMilestone.value = true
  },
)

function setMilestone(value: boolean) {
  isMilestone.value = value
  if (value) return
  suppressMilestoneAutoOpen = true
  formNode.value.checkpointLabel = ''
  formNode.value.checkpointAvatarUrl = ''
  formNode.value.checkpointColor = ''
  formNode.value.checkpointSize = ''
  const d = selectedDifficulty.value
  if (d) {
    void applyNodePatch(d.id, {
      checkpointLabel: null,
      checkpointAvatarUrl: null,
      checkpointColor: null,
      checkpointSize: null,
    })
  }
  setTimeout(() => { suppressMilestoneAutoOpen = false }, 0)
}

function parseSizeInt(value: string, fallback: number): number {
  const n = parseInt(value, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const FALLBACK_NODE_COLOR = '#f5b800'

const defaultColorHex = computed(() => {
  if (typeof document === 'undefined') return FALLBACK_NODE_COLOR
  const v = getComputedStyle(document.documentElement).getPropertyValue('--accent-overall').trim()
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : FALLBACK_NODE_COLOR
})

const shapeTiles = [
  { value: 'hex', label: 'Hex', path: 'hex' },
  { value: 'square', label: 'Square', path: 'square' },
  { value: 'circle', label: 'Circle', path: 'circle' },
  { value: 'diamond', label: 'Diamond', path: 'diamond' },
] as const

function onCompletionModeChange(value: string) {
  formMeta.value.completionMode = value as 'TERMINAL' | 'ALL'
  commitMetaField('completionMode')
}

function onRequirementTypeChange(value: string) {
  formNode.value.requirementType = value as CampaignRequirementType
  commitNodeField('requirementType')
}

const breadcrumbs = computed<Crumb[]>(() => {
  const title = isUnsavedDraft.value
    ? 'New campaign'
    : (campaign.value?.name || 'Editor')
  return [
    { label: 'Campaigns', to: '/campaigns' },
    { label: title },
  ]
})
</script>

<template>
  <div class="campaign-editor" :style="{ '--page-accent': accent }">
    <template v-if="loading">
      <div class="campaign-editor__loading">
        <SkeletonLoader variant="card" />
        <SkeletonLoader variant="card" />
      </div>
    </template>

    <template v-else-if="error || !campaign">
      <EmptyState icon="!" :message="error ?? 'Campaign not found.'" />
    </template>

    <template v-else-if="!auth.isLoggedIn && !isCurator">
      <EmptyState icon="🔒" message="Sign in to edit a campaign." />
    </template>

    <template v-else-if="!canAccess">
      <EmptyState icon="🔒"
        message="You can only edit campaigns you created, or you'll need curator access." />
    </template>

    <template v-else>
      <main class="campaign-editor__canvas" aria-label="Campaign roadmap">
        <CampaignRoadmap :difficulties="campaign.difficulties" :accent-color="accent"
          :node-accents="nodeAccents" :background-url="campaign.backgroundUrl"
          :show-starfield="!campaign.backgroundUrl" :focus-id="selectedId"
          :default-scale="1.3" :selected-id="selectedId" :editable="editable"
          :mode="canvasMode" @select="handleSelect" @deselect="handleDeselect"
          @move="handleMove" @empty-click="handleEmptyClick" @connect="handleConnect"
          @disconnect="handleDisconnect">
          <template #actions>
            <div v-if="editable" class="campaign-editor__add-cluster" aria-label="Add to roadmap">
              <button type="button" class="campaign-editor__add-btn" @click="openMapPicker">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add node
              </button>
            </div>
          </template>
        </CampaignRoadmap>

        <Breadcrumbs class="campaign-editor__breadcrumbs" :crumbs="breadcrumbs" />

        <Transition name="campaign-editor__banner">
          <BaseBanner v-if="actionError" class="campaign-editor__banner" variant="error" role="alert"
            @close="actionError = null">
            <template #icon>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="13" />
                <line x1="12" y1="16.5" x2="12" y2="16.51" />
              </svg>
            </template>
            <span class="campaign-editor__banner-text">{{ actionError }}</span>
          </BaseBanner>
        </Transition>

        <div v-if="editable" class="campaign-editor__mode-toggle" role="radiogroup"
          aria-label="Canvas mode">
          <button type="button" role="radio" :aria-checked="canvasMode === 'drag'"
            class="campaign-editor__mode-btn"
            :class="{ 'campaign-editor__mode-btn--active': canvasMode === 'drag' }"
            @click="canvasMode = 'drag'">
            Drag
          </button>
          <button type="button" role="radio" :aria-checked="canvasMode === 'connect'"
            class="campaign-editor__mode-btn"
            :class="{ 'campaign-editor__mode-btn--active': canvasMode === 'connect' }"
            @click="canvasMode = 'connect'">
            Connect
          </button>
        </div>
      </main>

      <div class="campaign-editor__floats">
        <aside class="campaign-editor__rail campaign-editor__rail--left" aria-label="Campaign meta">
          <header v-if="!isUnsavedDraft" class="campaign-editor__status">
            <div v-if="!isDraftStatus || (!isAdminRoute && isCreator)"
              class="campaign-editor__status-row">
              <span class="campaign-editor__status-pill"
                :class="`campaign-editor__status-pill--${campaign.status.toLowerCase()}`">
                {{ statusLabel[campaign.status] }}
              </span>
              <span v-if="campaign.seekingCuration" class="campaign-editor__status-flag">
                Seeking review
              </span>
            </div>
            <p v-if="!isAdminRoute && isCreator && creatorStatusMeaning"
              class="campaign-editor__status-meaning">
              {{ creatorStatusMeaning }}
            </p>
            <p v-else-if="!isDraftStatus" class="campaign-editor__status-meaning">
              {{ statusMeaning[campaign.status] }}
            </p>

            <div class="campaign-editor__status-actions">
              <template v-if="!isAdminRoute && isCreator">
                <template v-if="isDraftStatus">
                  <BaseButton size="sm" variant="primary" :loading="actionPending"
                    @click="doPlayerPublish">
                    Publish
                  </BaseButton>
                  <BaseButton size="sm" variant="destructive" :loading="actionPending"
                    @click="deleteDraft">
                    Delete draft
                  </BaseButton>
                </template>
                <BaseButton
                  v-else-if="campaign.status === 'PUBLISHED' || campaign.status === 'EDITING'"
                  size="sm" variant="primary" :loading="actionPending" @click="doPlayerUnpublish">
                  Unpublish to edit
                </BaseButton>
              </template>

              <template v-if="isAdminRoute">
                <BaseButton v-if="isCurator && (isDraftStatus || campaign.status === 'EDITING')"
                  size="sm" :loading="actionPending" @click="doPublish">
                  Publish
                </BaseButton>
                <BaseButton v-if="isCurator && (campaign.status === 'PUBLISHED' || campaign.status === 'CURATED')"
                  size="sm" :loading="actionPending" @click="doReopen">
                  Reopen for editing
                </BaseButton>
                <BaseButton v-if="isCurator && campaign.status !== 'CURATED'"
                  size="sm" variant="primary" :loading="actionPending" :disabled="!canCurate"
                  @click="doCurate">
                  Curate
                </BaseButton>
                <BaseButton v-if="isCurator && campaign.status === 'CURATED'"
                  size="sm" :loading="actionPending" @click="doUncurate">
                  Uncurate
                </BaseButton>
                <BaseButton v-if="isAdmin" size="sm" variant="destructive" :loading="actionPending"
                  @click="doDeactivate">
                  Deactivate
                </BaseButton>
              </template>
            </div>

            <p v-if="isAdminRoute && isTerminal && sinkCount !== 1 && isCurator"
              class="campaign-editor__status-warning">
              Terminal mode needs exactly one sink. You have {{ sinkCount }}.
            </p>
            <p v-if="creatorBlocked" class="campaign-editor__status-warning">
              You flagged this campaign for review. A curator needs to lift the flag before you can edit again.
            </p>
          </header>

          <p v-else class="campaign-editor__status-meaning">
            New draft. Add a node or fill in any field to save it.
          </p>

          <fieldset class="campaign-editor__section" :disabled="!editable">
            <legend class="campaign-editor__section-title">Identity</legend>
            <label class="campaign-editor__field">
              <span>Name</span>
              <input v-model="formMeta.name" type="text" @blur="commitMetaField('name')" />
            </label>
            <label class="campaign-editor__field">
              <span>Creator alias</span>
              <input v-model="formMeta.creatorAlias" type="text"
                :placeholder="campaign.creatorName ?? 'Creator name'"
                @blur="commitMetaField('creatorAlias')" />
              <small>Shown as the campaign's author. Defaults to your name; change it to credit a collaboration.</small>
            </label>
            <label v-if="isCurator" class="campaign-editor__field">
              <span>Slug</span>
              <input v-model="formMeta.slug" type="text" placeholder="auto from name"
                @blur="commitMetaField('slug')" />
            </label>
            <label class="campaign-editor__field">
              <span>Summary</span>
              <input v-model="formMeta.summary" type="text"
                @blur="commitMetaField('summary')" />
            </label>
            <label class="campaign-editor__field">
              <span>Description</span>
              <textarea v-model="formMeta.description" rows="4"
                @blur="commitMetaField('description')" />
            </label>
          </fieldset>

          <fieldset class="campaign-editor__section" :disabled="!editable">
            <legend class="campaign-editor__section-title">Settings</legend>
            <div class="campaign-editor__field">
              <span>Completion mode</span>
              <BaseSelect :model-value="formMeta.completionMode"
                :options="completionModeOptions.map((o) => ({ value: o.value, label: o.label }))"
                @update:model-value="onCompletionModeChange" />
            </div>
            <label class="campaign-editor__check">
              <input type="checkbox" v-model="formMeta.progressionAgnostic"
                @change="commitMetaField('progressionAgnostic')" />
              <span>Progression agnostic (any order)</span>
            </label>
            <label class="campaign-editor__check">
              <input type="checkbox" v-model="formMeta.playlistExportEnabled"
                @change="commitMetaField('playlistExportEnabled')" />
              <span>Playlist export enabled</span>
            </label>
            <label v-if="isCurator" class="campaign-editor__field">
              <span>Completion XP</span>
              <div class="campaign-editor__slider-row">
                <input type="range" min="0" max="50000" step="500"
                  v-model.number="formMeta.completionXp"
                  @change="commitMetaField('completionXp')" />
                <input type="number" min="0" step="100"
                  v-model.number="formMeta.completionXp"
                  @blur="commitMetaField('completionXp')" />
              </div>
              <small>Awarded on completion once curated.</small>
            </label>
          </fieldset>

          <fieldset class="campaign-editor__section" :disabled="!editable">
            <legend class="campaign-editor__section-title">Images</legend>
            <div class="campaign-editor__image-row">
              <ImageUploader label="Background" hint="16:9 hero"
                :image-url="campaign.backgroundUrl" :disabled="!editable"
                :upload-handler="uploadBackground" :remove-handler="removeBackground" />
              <ImageUploader label="Icon" hint="Square card image"
                aspect-ratio="1 / 1" :image-url="campaign.iconUrl" :disabled="!editable"
                :upload-handler="uploadIcon" :remove-handler="removeIcon" />
            </div>
          </fieldset>

          <fieldset class="campaign-editor__section" :disabled="!editable">
            <legend class="campaign-editor__section-title">
              Completion rewards
              <span v-if="campaign.completionItems.length > 0" class="campaign-editor__section-count">
                {{ campaign.completionItems.length }}
              </span>
            </legend>
            <ul v-if="campaign.completionItems.length > 0" class="campaign-editor__reward-list">
              <li v-for="item in campaign.completionItems" :key="item.itemId"
                class="campaign-editor__reward">
                <CampaignRewardItem :name="item.itemName" :quantity="item.quantity"
                  :item="rewardItemsById.get(item.itemId) ?? null">
                  <template v-if="editable" #action>
                    <button type="button" class="campaign-editor__reward-remove"
                      aria-label="Remove reward" @click="removeCompletionItem(item.itemId)">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </template>
                </CampaignRewardItem>
              </li>
            </ul>
            <p v-else class="campaign-editor__hint">
              No rewards yet. Players who complete the campaign get nothing extra.
            </p>
            <button v-if="editable" type="button" class="campaign-editor__add-reward"
              @click="openCampaignItemPicker">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add reward
            </button>
          </fieldset>

          <fieldset v-if="isCurator" class="campaign-editor__section" :disabled="!editable">
            <legend class="campaign-editor__section-title">
              Tags
              <span v-if="campaign.tags.length > 0" class="campaign-editor__section-count">
                {{ campaign.tags.length }}
              </span>
            </legend>
            <div v-for="kind in ['CATEGORY', 'DIFFICULTY', 'THEME', 'GENRE']" :key="kind"
              class="campaign-editor__tag-group">
              <span class="campaign-editor__tag-label">{{ kind.toLowerCase() }}</span>
              <div class="campaign-editor__tag-chips">
                <button v-for="t in tagsByKind.get(kind) ?? []" :key="t.id" type="button"
                  class="campaign-editor__chip"
                  :class="{ 'campaign-editor__chip--active': campaignTagIds.has(t.id) }"
                  @click="toggleTag(t.id)">
                  {{ t.name }}
                </button>
              </div>
            </div>
          </fieldset>
        </aside>

        <aside class="campaign-editor__rail campaign-editor__rail--right" aria-label="Selected node">
          <div v-if="selectedDifficulty" class="campaign-editor__node">
            <div class="campaign-editor__node-song">
              <div class="campaign-editor__node-cover">
                <img v-if="selectedDifficulty.coverUrl" :src="selectedDifficulty.coverUrl"
                  :alt="selectedDifficulty.songName" loading="lazy" />
              </div>
              <div class="campaign-editor__node-song-meta">
                <h2>{{ selectedDifficulty.songName }}</h2>
                <p>{{ selectedDifficulty.songAuthor }} · {{ selectedDifficulty.mapAuthor }}</p>
                <p class="campaign-editor__node-diff">
                  {{ formatDifficulty(selectedDifficulty.difficulty) }}
                  <span v-if="selectedMeta?.complexity != null">· complexity {{ selectedMeta.complexity.toFixed(1) }}</span>
                  <span class="campaign-editor__node-grid">
                    · grid <code>{{ selectedDifficulty.positionX }},{{ selectedDifficulty.positionY }}</code>
                  </span>
                </p>
              </div>
              <BaseButton v-if="editable" size="sm" variant="destructive"
                class="campaign-editor__node-remove"
                :loading="actionPending" @click="removeSelectedNode">
                Remove
              </BaseButton>
            </div>

            <fieldset class="campaign-editor__section" :disabled="!editable">
              <legend class="campaign-editor__section-title">Requirement</legend>
              <div class="campaign-editor__field">
                <span>Type</span>
                <BaseSelect :model-value="formNode.requirementType"
                  :options="requirementTypeOptions.map((o) => ({ value: o.value, label: o.label }))"
                  @update:model-value="onRequirementTypeChange" />
              </div>
              <label v-if="formNode.requirementType !== 'FC'" class="campaign-editor__field">
                <span>Target {{ requirementBounds.unit ? `(${requirementBounds.unit})` : '' }}</span>
                <div class="campaign-editor__slider-row">
                  <input type="range" :min="requirementBounds.min" :max="requirementBounds.max"
                    :step="requirementBounds.step" v-model.number="requirementValueDisplay"
                    @change="commitNodeField('requirementValue')" />
                  <input type="number" :min="requirementBounds.min" :max="requirementBounds.max"
                    :step="requirementBounds.step" v-model.number="requirementValueDisplay"
                    @blur="commitNodeField('requirementValue')" />
                </div>
              </label>
              <label class="campaign-editor__field">
                <span>XP on clear</span>
                <div class="campaign-editor__slider-row">
                  <input type="range" min="0" max="5000" step="50"
                    v-model.number="formNode.xp" @change="commitNodeField('xp')" />
                  <input type="number" min="0" step="10" v-model.number="formNode.xp"
                    @blur="commitNodeField('xp')" />
                </div>
              </label>
              <label class="campaign-editor__field">
                <span>Description <small>(optional)</small></span>
                <textarea v-model="formNode.description" rows="2"
                  @blur="commitNodeField('description')" />
              </label>
            </fieldset>

            <fieldset class="campaign-editor__section" :disabled="!editable">
              <legend class="campaign-editor__section-title">Milestone</legend>
              <label class="campaign-editor__check">
                <input type="checkbox" :checked="isMilestone"
                  @change="setMilestone(($event.target as HTMLInputElement).checked)" />
                <span>Treat this node as a milestone</span>
              </label>
              <p v-if="isMilestone" class="campaign-editor__hint">
                Rewards pay only when a cleared prerequisite path exists.
              </p>
              <template v-if="isMilestone">
                <label class="campaign-editor__field">
                  <span>Label</span>
                  <input v-model="formNode.checkpointLabel" type="text"
                    placeholder="e.g. Rookie"
                    @blur="commitNodeField('checkpointLabel')" />
                </label>
                <label class="campaign-editor__field">
                  <span>Avatar URL <small>(optional)</small></span>
                  <input v-model="formNode.checkpointAvatarUrl" type="url" placeholder="https://..."
                    @blur="commitNodeField('checkpointAvatarUrl')" />
                </label>
                <div class="campaign-editor__field-row">
                  <label class="campaign-editor__field">
                    <span>Band color</span>
                    <div class="campaign-editor__color-row">
                      <input type="color" :value="formNode.checkpointColor || defaultColorHex"
                        @input="formNode.checkpointColor = ($event.target as HTMLInputElement).value"
                        @change="commitNodeField('checkpointColor')" />
                      <button type="button" class="campaign-editor__inline-btn"
                        @click="formNode.checkpointColor = ''; commitNodeField('checkpointColor')">
                        Auto
                      </button>
                    </div>
                  </label>
                  <label class="campaign-editor__field">
                    <span>Band size: {{ parseSizeInt(formNode.checkpointSize, 30) }}px</span>
                    <input type="range" min="14" max="64" step="1"
                      :value="parseSizeInt(formNode.checkpointSize, 30)"
                      @input="formNode.checkpointSize = ($event.target as HTMLInputElement).value"
                      @change="commitNodeField('checkpointSize')" />
                  </label>
                </div>
              </template>
            </fieldset>

            <fieldset class="campaign-editor__section" :disabled="!editable">
              <legend class="campaign-editor__section-title">Shape</legend>
              <label class="campaign-editor__field">
                <span>Border shape</span>
                <div class="campaign-editor__shape-row">
                  <button v-for="t in shapeTiles" :key="t.label" type="button"
                    class="campaign-editor__shape-tile"
                    :class="{ 'campaign-editor__shape-tile--active': formNode.borderShape === t.value }"
                    :aria-label="t.label" :title="t.label"
                    @click="formNode.borderShape = t.value; commitNodeField('borderShape')">
                    <svg width="22" height="22" viewBox="-12 -12 24 24" aria-hidden="true">
                      <polygon v-if="t.path === 'hex'"
                        points="10,0 5,8.66 -5,8.66 -10,0 -5,-8.66 5,-8.66"
                        fill="none" stroke="currentColor" stroke-width="1.6" />
                      <rect v-else-if="t.path === 'square'" x="-9" y="-9" width="18" height="18"
                        fill="none" stroke="currentColor" stroke-width="1.6" />
                      <circle v-else-if="t.path === 'circle'" r="10"
                        fill="none" stroke="currentColor" stroke-width="1.6" />
                      <polygon v-else-if="t.path === 'diamond'"
                        points="0,-10 10,0 0,10 -10,0"
                        fill="none" stroke="currentColor" stroke-width="1.6" />
                    </svg>
                  </button>
                </div>
              </label>
              <div class="campaign-editor__field-row">
                <label class="campaign-editor__field">
                  <span>Border color</span>
                  <div class="campaign-editor__color-row">
                    <input type="color" :value="formNode.borderColor || defaultColorHex"
                      @input="formNode.borderColor = ($event.target as HTMLInputElement).value"
                      @change="commitNodeField('borderColor')" />
                    <button type="button" class="campaign-editor__inline-btn"
                      @click="formNode.borderColor = ''; commitNodeField('borderColor')">
                      Auto
                    </button>
                  </div>
                </label>
                <label class="campaign-editor__field">
                  <span>Node size: {{ parseSizeInt(formNode.size, 48) }}px</span>
                  <input type="range" min="24" max="96" step="1"
                    :value="parseSizeInt(formNode.size, 48)"
                    @input="formNode.size = ($event.target as HTMLInputElement).value"
                    @change="commitNodeField('size')" />
                </label>
              </div>
            </fieldset>

            <fieldset
              v-if="(selectedDifficulty.prerequisiteCampaignDifficultyIds ?? []).length >= 2"
              class="campaign-editor__section" :disabled="!editable">
              <legend class="campaign-editor__section-title">Unlock when</legend>
              <div class="campaign-editor__prereq-mode" role="radiogroup" aria-label="Unlock when">
                <div class="campaign-editor__prereq-mode-toggle">
                  <button type="button" role="radio"
                    :aria-checked="selectedDifficulty.prerequisiteMode !== 'AND'"
                    class="campaign-editor__prereq-mode-btn"
                    :class="{ 'campaign-editor__prereq-mode-btn--active': selectedDifficulty.prerequisiteMode !== 'AND' }"
                    @click="setPrereqMode('OR')">
                    any clears
                  </button>
                  <button type="button" role="radio"
                    :aria-checked="selectedDifficulty.prerequisiteMode === 'AND'"
                    class="campaign-editor__prereq-mode-btn"
                    :class="{ 'campaign-editor__prereq-mode-btn--active': selectedDifficulty.prerequisiteMode === 'AND' }"
                    @click="setPrereqMode('AND')">
                    all clear
                  </button>
                </div>
              </div>
            </fieldset>

            <fieldset class="campaign-editor__section" :disabled="!editable">
              <legend class="campaign-editor__section-title">
                Rewards
                <span v-if="selectedDifficulty.items.length > 0" class="campaign-editor__section-count">
                  {{ selectedDifficulty.items.length }}
                </span>
              </legend>
              <ul v-if="selectedDifficulty.items.length > 0" class="campaign-editor__reward-list">
                <li v-for="item in selectedDifficulty.items" :key="item.itemId"
                  class="campaign-editor__reward">
                  <CampaignRewardItem :name="item.itemName" :quantity="item.quantity"
                    :item="rewardItemsById.get(item.itemId) ?? null">
                    <template v-if="editable" #action>
                      <button type="button" class="campaign-editor__reward-remove"
                        aria-label="Remove reward" @click="removeNodeItem(item.itemId)">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </template>
                  </CampaignRewardItem>
                </li>
              </ul>
              <p v-else class="campaign-editor__hint">
                Players who clear this node only get the XP. Add items to make it sweeter.
              </p>
              <button v-if="editable" type="button" class="campaign-editor__add-reward"
                @click="openNodeItemPicker">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add reward
              </button>
            </fieldset>

          </div>

          <div v-else class="campaign-editor__placeholder">
            <p v-if="editable">Pick a node on the canvas to edit it, or use the Add button at the bottom of the canvas.</p>
            <p v-else>This campaign is locked. Reopen for editing to make changes.</p>
          </div>
        </aside>
      </div>

      <CampaignMapPicker v-if="showMapPicker" :loading="actionPending"
        @close="showMapPicker = false; pendingPosition = null"
        @pick="handleMapPicked" />

      <CampaignItemPicker v-if="itemPickerFor" :loading="actionPending"
        @close="itemPickerFor = null"
        @pick="handleItemPicked" />

      <BaseModal v-if="showRepublishWarning" :open="true" title="Recalculate player progress?"
        @close="showRepublishWarning = false">
        <div class="campaign-editor__warn">
          <p>
            You changed the completion requirement on
            {{ requirementDirtyIds.size }}
            {{ requirementDirtyIds.size === 1 ? 'map' : 'maps' }}.
            Republishing recalculates player progress on
            {{ requirementDirtyIds.size === 1 ? 'it' : 'them' }}:
          </p>
          <ul>
            <li>Players who cleared an affected map under the old requirement lose that completion.</li>
            <li>Anyone who no longer meets the new bar is moved back to in-progress.</li>
            <li v-if="campaign && !campaign.progressionAgnostic">
              Because this campaign is played in order, every map after a changed one is
              recalculated too.
            </li>
          </ul>
        </div>
        <template #footer>
          <BaseButton :disabled="actionPending" @click="showRepublishWarning = false">
            Cancel
          </BaseButton>
          <BaseButton variant="primary" :loading="actionPending" @click="performPublish">
            Publish anyway
          </BaseButton>
        </template>
      </BaseModal>
    </template>
  </div>
</template>

<style scoped>
.campaign-editor {
  position: fixed;
  inset: var(--navbar-height) 0 0 0;
  width: 100%;
  background: var(--bg-base);
  overflow: hidden;
}

.campaign-editor__loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  max-width: 720px;
  margin: var(--space-lg) auto;
  padding: 0 var(--space-md);
}

.campaign-editor__canvas {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.campaign-editor__breadcrumbs {
  position: absolute;
  top: var(--space-md);
  left: var(--space-md);
  z-index: 4;
  pointer-events: auto;
}

.campaign-editor__banner {
  position: absolute;
  top: calc(var(--space-md) + 44px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 6;
  width: min(640px, calc(100% - var(--space-2xl)));
  margin: 0;
  pointer-events: auto;
}

.campaign-editor__banner-text {
  line-height: 1.45;
}

.campaign-editor__banner-enter-active,
.campaign-editor__banner-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.campaign-editor__banner-enter-from,
.campaign-editor__banner-leave-to {
  opacity: 0;
  transform: translate(-50%, -6px);
}

.campaign-editor__add-cluster {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: 4px;
  pointer-events: auto;
}

.campaign-editor__add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--page-accent);
  background: transparent;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.campaign-editor__add-btn:hover {
  background: var(--bg-elevated);
}

.campaign-editor__mode-toggle {
  position: absolute;
  top: var(--space-md);
  left: 50%;
  transform: translateX(-50%);
  z-index: 4;
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: 4px;
}

.campaign-editor__mode-btn {
  padding: 6px 14px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  transition: color 120ms ease, background 120ms ease;
}

.campaign-editor__mode-btn:hover {
  color: var(--text-primary);
}

.campaign-editor__mode-btn--active {
  color: var(--page-accent);
  background: var(--bg-elevated);
}

.campaign-editor__floats {
  position: absolute;
  inset: calc(var(--space-md) + 40px) var(--space-md) var(--space-md);
  display: grid;
  grid-template-columns: minmax(320px, 380px) 1fr minmax(340px, 400px);
  gap: var(--space-md);
  pointer-events: none;
  z-index: 5;
}

.campaign-editor__rail {
  grid-row: 1;
  align-self: stretch;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-lg) var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: 6px;
  pointer-events: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--bg-overlay) transparent;
}

.campaign-editor__rail--left { grid-column: 1; }
.campaign-editor__rail--right { grid-column: 3; }

.campaign-editor__rail::-webkit-scrollbar { width: 6px; }
.campaign-editor__rail::-webkit-scrollbar-thumb {
  background: var(--bg-overlay);
  border-radius: 3px;
}

.campaign-editor__status {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding-bottom: var(--space-lg);
  border-bottom: 1px solid var(--bg-overlay);
}

.campaign-editor__status-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.campaign-editor__status-pill {
  display: inline-flex;
  padding: 4px 10px;
  border-radius: 3px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  border: 1px solid;
}

.campaign-editor__status-pill--draft {
  color: var(--text-secondary);
  border-color: var(--bg-overlay);
}

.campaign-editor__status-pill--published {
  color: var(--info);
  border-color: color-mix(in srgb, var(--info) 50%, transparent);
}

.campaign-editor__status-pill--editing {
  color: var(--warning);
  border-color: color-mix(in srgb, var(--warning) 50%, transparent);
}

.campaign-editor__status-pill--curated {
  color: var(--success);
  border-color: color-mix(in srgb, var(--success) 50%, transparent);
}

.campaign-editor__status-flag {
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--page-accent);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.campaign-editor__status-meaning {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  line-height: 1.5;
}

.campaign-editor__status-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.campaign-editor__status-actions > * {
  flex: 1 1 auto;
}

.campaign-editor__status-warning {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--warning);
  line-height: 1.4;
}

.campaign-editor__warn {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  color: var(--text-secondary);
  line-height: 1.55;
}

.campaign-editor__warn p {
  margin: 0;
  color: var(--text-primary);
}

.campaign-editor__warn ul {
  margin: 0;
  padding-left: 1.1em;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.campaign-editor__status-hint {
  margin: 0;
  padding: 8px 10px;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  line-height: 1.5;
}

.campaign-editor__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin: 0;
  padding: var(--space-lg) 0 0;
  border: none;
  border-top: 1px solid var(--bg-overlay);
}

.campaign-editor__section:first-of-type {
  padding-top: 0;
  border-top: none;
}

.campaign-editor__section[disabled] {
  opacity: 0.6;
  pointer-events: none;
}

.campaign-editor__section-title {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 0;
  margin-bottom: 4px;
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0;
  text-transform: none;
}

.campaign-editor__section-count {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-tertiary);
}

.campaign-editor__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.campaign-editor__field > span {
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.campaign-editor__field > span > small {
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
  margin-left: 4px;
}

.campaign-editor__field input,
.campaign-editor__field textarea,
.campaign-editor__field select {
  width: 100%;
  padding: 8px 10px;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-primary);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  outline: none;
  transition: border-color 120ms ease;
}

.campaign-editor__field textarea {
  resize: vertical;
  min-height: 60px;
  line-height: 1.5;
}

.campaign-editor__field input:focus,
.campaign-editor__field textarea:focus,
.campaign-editor__field select:focus {
  border-color: var(--page-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--page-accent) 20%, transparent);
}

.campaign-editor__field small {
  font-size: 0.625rem;
  color: var(--text-tertiary);
}

.campaign-editor__field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm);
}

.campaign-editor__slider-row {
  display: grid;
  grid-template-columns: 1fr 84px;
  gap: var(--space-sm);
  align-items: center;
}

.campaign-editor__slider-row input[type="range"] {
  width: 100%;
  padding: 0;
  background: transparent;
  border: none;
  accent-color: var(--page-accent);
}

.campaign-editor__color-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.campaign-editor__color-row input[type="color"] {
  width: 44px;
  height: 32px;
  padding: 2px;
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  background: var(--bg-base);
  cursor: pointer;
}

.campaign-editor__inline-btn {
  padding: 6px 10px;
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease;
}

.campaign-editor__inline-btn:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.campaign-editor__image-row {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: var(--space-sm);
}

.campaign-editor__shape-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.campaign-editor__shape-tile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
}

.campaign-editor__shape-tile:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.campaign-editor__shape-tile--active {
  color: var(--page-accent);
  border-color: var(--page-accent);
  background: color-mix(in srgb, var(--page-accent) 12%, transparent);
}

.campaign-editor__check {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-primary);
  cursor: pointer;
}

.campaign-editor__tag-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.campaign-editor__tag-label {
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-tertiary);
  text-transform: capitalize;
}

.campaign-editor__tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.campaign-editor__chip {
  padding: 3px 8px;
  background: transparent;
  border: 1px solid var(--bg-overlay);
  border-radius: 2px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
}

.campaign-editor__chip:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.campaign-editor__chip--active {
  color: var(--page-accent);
  border-color: var(--page-accent);
  background: color-mix(in srgb, var(--page-accent) 12%, transparent);
}

.campaign-editor__node {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.campaign-editor__node-song {
  display: grid;
  grid-template-columns: 56px 1fr auto;
  gap: var(--space-sm);
  align-items: flex-start;
}

.campaign-editor__node-cover {
  width: 56px;
  height: 56px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--bg-elevated);
}

.campaign-editor__node-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.campaign-editor__node-song-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.campaign-editor__node-song-meta h2 {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
}

.campaign-editor__node-song-meta p {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.campaign-editor__node-diff {
  font-size: 0.6875rem !important;
  color: var(--text-tertiary) !important;
}

.campaign-editor__node-grid {
  color: var(--text-tertiary);
}

.campaign-editor__node-grid code {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--text-secondary);
}

.campaign-editor__node-remove {
  align-self: start;
}

.campaign-editor__placeholder {
  padding: var(--space-md) 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  line-height: 1.5;
}

.campaign-editor__placeholder p {
  margin: 0;
}

.campaign-editor__hint {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.campaign-editor__prereq-mode {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.campaign-editor__prereq-mode-toggle {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
}

.campaign-editor__prereq-mode-btn {
  padding: 4px 10px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  transition: color 120ms ease, background 120ms ease;
}

.campaign-editor__prereq-mode-btn:hover {
  color: var(--text-primary);
}

.campaign-editor__prereq-mode-btn--active {
  color: var(--page-accent);
  background: var(--bg-elevated);
}

.campaign-editor__reward-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.campaign-editor__reward {
  padding: 6px 8px;
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
}

.campaign-editor__reward-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 2px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: color 120ms ease, background 120ms ease;
}

.campaign-editor__reward-remove:hover {
  color: var(--error);
  background: color-mix(in srgb, var(--error) 12%, transparent);
}

.campaign-editor__add-reward {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease;
}

.campaign-editor__add-reward:hover {
  color: var(--page-accent);
  border-color: var(--page-accent);
}

@media (max-width: 1100px) {
  .campaign-editor__floats {
    grid-template-columns: minmax(0, 320px) 1fr minmax(0, 320px);
    gap: var(--space-sm);
  }
}

@media (max-width: 860px) {
  .campaign-editor {
    position: static;
    inset: auto;
    overflow: visible;
  }

  .campaign-editor__canvas {
    position: relative;
    height: clamp(360px, 55vh, 560px);
  }

  .campaign-editor__floats {
    position: relative;
    inset: auto;
    grid-template-columns: minmax(0, 1fr);
    padding: var(--space-md);
  }

  .campaign-editor__rail {
    grid-column: 1;
    max-height: none;
  }
}
</style>
