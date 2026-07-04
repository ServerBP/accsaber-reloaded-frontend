import {
  addCampaignBarrier,
  addCampaignDifficulty,
  createCampaign,
  addCampaignText,
  deactivateCampaignBarrier,
  deactivateCampaignDifficulty,
  deactivateCampaignText,
  updateCampaign,
  updateCampaignBarrier,
  updateCampaignDifficulty,
  updateCampaignText,
} from '@/api/admin/campaigns'
import {
  addPlayerCampaignBarrier,
  addPlayerCampaignDifficulty,
  addPlayerCampaignText,
  createPlayerCampaign,
  deletePlayerCampaignBarrier,
  deletePlayerCampaignDifficulty,
  deletePlayerCampaignText,
  getCampaign,
  getCampaignByIdOrSlug,
  getCampaignTags,
  updatePlayerCampaign,
  updatePlayerCampaignBarrier,
  updatePlayerCampaignDifficulty,
  updatePlayerCampaignText,
} from '@/api/campaigns'
import { useCampaignAssets } from './useCampaignAssets'
import { useCampaignCollaborators } from './useCampaignCollaborators'
import { useCampaignLifecycle } from './useCampaignLifecycle'
import { useCampaignRewards } from './useCampaignRewards'
import { ApiError, getApiErrorMessage, parseApiError } from '@/api/client'
import type { Crumb } from '@/components/common/Breadcrumbs.vue'
import { useCampaignDifficultyMeta } from '@/composables/useCampaignDifficultyMeta'
import { useItemCatalog } from '@/composables/useItemCatalog'
import { getCurve } from '@/api/curves'
import { useAuthStore } from '@/stores/auth'
import { useCategoryStore } from '@/stores/categories'
import { calculateAp, reverseApToAccuracyByComplexity } from '@/utils/curveEval'
import { isAdminSubdomain } from '@/utils/subdomain'
import type {
  AddCampaignBarrierRequest,
  AddCampaignDifficultyRequest,
  CampaignTextRequest,
  UpdateCampaignBarrierRequest,
  UpdateCampaignDifficultyRequest,
  UpdateCampaignRequest,
} from '@/types/api/admin'
import type {
  CampaignBarrierResponse,
  CampaignDetailResponse,
  CampaignDifficultyResponse,
  CampaignTagResponse,
  CampaignTextResponse,
} from '@/types/api/campaigns'
import type { CurveResponse } from '@/types/api/categories'
import type { BarrierConditionType, CampaignRequirementType } from '@/types/enums'
import { barrierConditionMeta } from '@/utils/campaignLayout'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export type TrayId =
  | 'status'
  | 'identity'
  | 'settings'
  | 'images'
  | 'completion'
  | 'collaborators'
  | 'tags'
  | 'requirement'
  | 'milestone'
  | 'shape'
  | 'unlock'
  | 'rewards'
  | 'bulk'
  | 'barrierCondition'
  | 'barrierAffected'
  | 'barrierStyle'
  | 'barrierRewards'
  | 'text'

const MAX_BARRIERS = 50
const MAX_TEXTS = 50

export type TrayDef = { id: TrayId; label: string; icon: string; count?: number; tone?: string }

export function useCampaignEditor() {
  const route = useRoute()
  const router = useRouter()
  const auth = useAuthStore()
  const categoryStore = useCategoryStore()
  const { itemsById: rewardItemsById, ensureLoaded: ensureRewardItems } = useItemCatalog()

  const campaign = ref<CampaignDetailResponse | null>(null)
  const allTags = ref<CampaignTagResponse[]>([])
  const { difficultyMeta, loadDifficultyMeta } = useCampaignDifficultyMeta()
  const loading = ref(true)
  const error = ref<string | null>(null)
  const actionPending = ref(false)
  const actionError = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string>>({})

  function clearFieldErrors(keys: string[]) {
    if (keys.length === 0) return
    const next = { ...fieldErrors.value }
    let changed = false
    for (const k of keys) {
      if (k in next) {
        delete next[k]
        changed = true
      }
    }
    if (changed) fieldErrors.value = next
  }

  const INLINE_ERROR_FIELDS = new Set<string>(['backgroundColor'])

  function reportPatchError(err: unknown, fallback: string) {
    const parsed = parseApiError(err, fallback)
    const inline = parsed.fieldErrors.filter((f) => INLINE_ERROR_FIELDS.has(f.field))
    const other = parsed.fieldErrors.filter((f) => !INLINE_ERROR_FIELDS.has(f.field))
    if (inline.length > 0) {
      const next = { ...fieldErrors.value }
      for (const f of inline) next[f.field] = f.message
      fieldErrors.value = next
    }
    if (other.length > 0) {
      actionError.value = other.map((f) => f.message).join(' ')
    } else if (inline.length === 0) {
      actionError.value = parsed.message
    }
  }
  const showMapPicker = ref(false)
  const selectedIds = ref<Set<string>>(new Set())
  const canvasMode = ref<'drag' | 'connect' | 'select'>('drag')
  const requirementDirtyIds = ref(new Set<string>())
  const editedLiveCampaign = ref(false)

  const selectedId = computed<string | null>(() =>
    selectedIds.value.size === 1 ? (selectedIds.value.values().next().value ?? null) : null,
  )
  const selectedIdList = computed<string[]>(() => Array.from(selectedIds.value))
  const selectedCount = computed(() => selectedIds.value.size)
  const isMultiSelect = computed(() => selectedIds.value.size > 1)

  function selectOnly(id: string) {
    selectedIds.value = new Set([id])
  }
  function setSelection(ids: string[]) {
    selectedIds.value = new Set(ids)
  }
  function toggleInSelection(id: string) {
    const next = new Set(selectedIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedIds.value = next
  }
  function clearSelection() {
    selectedIds.value = new Set()
  }

  const SELECTION_STORAGE_PREFIX = 'campaign-editor:selection:'

  function persistSelection() {
    const id = campaign.value?.id
    if (!id || selectedIds.value.size === 0) return
    try {
      localStorage.setItem(SELECTION_STORAGE_PREFIX + id, JSON.stringify([...selectedIds.value]))
    } catch {}
  }

  function restoreSelection(c: CampaignDetailResponse): string[] {
    try {
      const raw = localStorage.getItem(SELECTION_STORAGE_PREFIX + c.id)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      const existing = new Set<string>([
        ...c.difficulties.map((d) => d.id),
        ...c.barriers.map((b) => b.id),
        ...c.texts.map((t) => t.id),
      ])
      return parsed.filter((x): x is string => typeof x === 'string' && existing.has(x))
    } catch {
      return []
    }
  }

  watch(selectedIds, persistSelection)

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
      official: false,
      seekingCuration: false,
      progressionAgnostic: false,
      completionMode: 'TERMINAL',
      legacy: false,
      completionXp: 0,
      playlistExportEnabled: true,
      difficultyCount: 0,
      tags: [],
      backgroundUrl: null,
      backgroundColor: null,
      iconUrl: null,
      submittedAt: null,
      curatedAt: null,
      createdAt: new Date().toISOString(),
      totalUpvotes: 0,
      totalDownvotes: 0,
      voteScore: 0,
      curatorNotes: null,
      difficulties: [],
      barriers: [],
      texts: [],
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
      const created =
        !auth.isLoggedIn && isCurator.value
          ? await createCampaign(req)
          : await createPlayerCampaign(req)
      const detail = await getCampaign(created.id)
      campaign.value = detail
      if (allTags.value.length === 0) {
        allTags.value = await getCampaignTags()
      }
      suppressNextCampaignIdWatch = true
      await router.replace({
        name: 'campaign-editor',
        params: { campaignId: created.slug || created.id },
      })
      return detail
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to create campaign')
      return null
    }
  }

  async function load(silent = false) {
    if (!silent) loading.value = true
    error.value = null
    requirementDirtyIds.value = new Set()
    editedLiveCampaign.value = false
    try {
      const c = await getCampaignByIdOrSlug(campaignId.value)
      campaign.value = c
      void ensureRewardItems()
      void loadCollaborators()
      if (allTags.value.length === 0) {
        allTags.value = await getCampaignTags()
      }
      if (selectedIds.value.size === 0) {
        const restored = restoreSelection(c)
        if (restored.length > 0) setSelection(restored)
        else if (c.difficulties.length > 0) selectOnly(c.difficulties[0].id)
      }
      void loadDifficultyMeta(c.difficulties)
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        error.value = getApiErrorMessage(err, 'Failed to load campaign')
      }
    } finally {
      if (!silent) loading.value = false
    }
  }

  let changeBroadcaster: (() => void) | null = null
  let applyingRemote = 0
  let broadcastTimer: ReturnType<typeof setTimeout> | null = null

  function setChangeBroadcaster(fn: (() => void) | null) {
    changeBroadcaster = fn
  }

  let viewCenterProvider: (() => { x: number; y: number } | null) | null = null

  function setViewCenterProvider(fn: (() => { x: number; y: number } | null) | null) {
    viewCenterProvider = fn
  }

  async function guardedLoad(silent = false) {
    applyingRemote++
    try {
      await load(silent)
    } finally {
      await nextTick()
      applyingRemote--
    }
  }

  function scheduleBroadcast() {
    if (applyingRemote > 0 || !changeBroadcaster) return
    if (broadcastTimer) clearTimeout(broadcastTimer)
    broadcastTimer = setTimeout(() => {
      broadcastTimer = null
      changeBroadcaster?.()
    }, 400)
  }

  watch(campaign, () => {
    scheduleBroadcast()
  })

  onBeforeUnmount(() => {
    if (broadcastTimer) clearTimeout(broadcastTimer)
  })

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
    void guardedLoad()
  })

  watch(campaignId, (next, prev) => {
    if (next === prev) return
    if (suppressNextCampaignIdWatch) {
      suppressNextCampaignIdWatch = false
      return
    }
    clearSelection()
    void guardedLoad()
  })

  watch(
    () => campaign.value?.slug,
    (slug) => {
      if (!slug || isNewMode.value || isUnsavedDraft.value) return
      if (campaignId.value === slug) return
      suppressNextCampaignIdWatch = true
      void router.replace({ name: 'campaign-editor', params: { campaignId: slug } })
    },
  )

  const isAdmin = computed(() => auth.isAdmin)

  const isCurator = computed(() => auth.hasRole('CAMPAIGN_CURATOR'))

  const isCreator = computed(() => {
    if (isUnsavedDraft.value && auth.isLoggedIn) return true
    return (
      !!campaign.value?.creatorId &&
      !!auth.userId &&
      String(campaign.value.creatorId) === String(auth.userId)
    )
  })

  const {
    collaboratorsLoading,
    showCollaboratorPicker,
    activeCollaborators,
    isCollaborator,
    canInviteMore,
    existingCollaboratorIds,
    collaboratorLimit,
    loadCollaborators,
    openCollaboratorPicker,
    handleCollaboratorPicked,
    removeCollaborator,
    leaveCampaign,
  } = useCampaignCollaborators({
    campaign,
    auth,
    isCurator,
    isCreator,
    actionPending,
    actionError,
  })

  const canAccess = computed(
    () => isCurator.value || isCreator.value || isCollaborator.value,
  )

  const creatorBlocked = computed(
    () => isCreator.value && !!campaign.value?.seekingCuration && !isCurator.value,
  )

  const useAdminEndpoint = computed(() => {
    if (!campaign.value) return false
    if (isCreator.value && campaign.value.status === 'DRAFT') return false
    if (isCollaborator.value && campaign.value.status === 'DRAFT') return false
    return isCurator.value
  })

  const editable = computed(() => {
    if (!campaign.value || actionPending.value) return false
    if (isCreator.value && campaign.value.status === 'DRAFT' && !creatorBlocked.value) return true
    if (isCollaborator.value && campaign.value.status === 'DRAFT') return true
    if (
      isCurator.value &&
      (campaign.value.status === 'DRAFT' || campaign.value.status === 'EDITING')
    )
      return true
    return false
  })

  const accent = computed(() => {
    const cats = campaign.value?.tags.filter((t) => t.kind === 'CATEGORY') ?? []
    if (cats.length !== 1 || !cats[0].categoryId) return 'var(--accent-overall)'
    const code = categoryStore.getCategoryCode(cats[0].categoryId)
    if (!code) return 'var(--accent-overall)'
    return categoryStore.getCategoryInfo(code)?.accent ?? 'var(--accent-overall)'
  })

  const nodeAccents = computed(() => {
    const map = new Map<string, string>()
    for (const d of campaign.value?.difficulties ?? []) {
      const custom = d.checkpointColor || d.borderColor
      if (custom) {
        map.set(d.id, custom)
        continue
      }
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

  const barrierById = computed(() => {
    const map = new Map<string, CampaignBarrierResponse>()
    for (const b of campaign.value?.barriers ?? []) map.set(b.id, b)
    return map
  })

  function isBarrierId(id: string): boolean {
    return barrierById.value.has(id)
  }

  const selectedBarrier = computed<CampaignBarrierResponse | null>(() => {
    if (!selectedId.value) return null
    return barrierById.value.get(selectedId.value) ?? null
  })

  const textById = computed(() => {
    const map = new Map<string, CampaignTextResponse>()
    for (const t of campaign.value?.texts ?? []) map.set(t.id, t)
    return map
  })

  function isTextId(id: string): boolean {
    return textById.value.has(id)
  }

  const pendingTextIds = new Set<string>()
  const cancelledTextIds = new Set<string>()
  let tempTextSeq = 0

  function isPendingText(id: string): boolean {
    return pendingTextIds.has(id)
  }

  const selectedText = computed<CampaignTextResponse | null>(() => {
    if (!selectedId.value) return null
    return textById.value.get(selectedId.value) ?? null
  })

  const affectedPickMode = ref(false)
  const barrierPlacementMode = ref(false)

  const hasConnections = computed(() => {
    const c = campaign.value
    if (!c) return false
    return (
      c.difficulties.some((d) => (d.prerequisiteCampaignDifficultyIds?.length ?? 0) > 0) ||
      c.barriers.some((b) => (b.prerequisiteCampaignDifficultyIds?.length ?? 0) > 0)
    )
  })

  const hasBarriers = computed(() => (campaign.value?.barriers.length ?? 0) > 0)

  const canAddBarrier = computed(
    () => editable.value && hasConnections.value && !campaign.value?.progressionAgnostic,
  )

  const selectedMeta = computed(() =>
    selectedDifficulty.value
      ? (difficultyMeta.value.get(selectedDifficulty.value.id) ?? null)
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
    backgroundColor: '',
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
      backgroundColor: campaign.value.backgroundColor ?? '',
      seekingCuration: campaign.value.seekingCuration,
    }
  }

  watch(campaign, syncFormFromCampaign, { immediate: true })

  const formNode = ref<{
    requirementType: CampaignRequirementType
    requirementValue: number
    description: string
    checkpointLabel: string
    checkpointLabelPosition: string
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
    checkpointLabelPosition: '',
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
      checkpointLabelPosition: d.checkpointLabelPosition ?? '',
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

  const formBarrier = ref<{
    conditionType: BarrierConditionType
    conditionValue: number
    description: string
    checkpointLabel: string
    checkpointLabelPosition: string
    checkpointAvatarUrl: string
    checkpointColor: string
    checkpointSize: string
    borderColor: string
    size: string
    xp: number
  }>({
    conditionType: 'AVERAGE_ACC',
    conditionValue: 0.9,
    description: '',
    checkpointLabel: '',
    checkpointLabelPosition: '',
    checkpointAvatarUrl: '',
    checkpointColor: '',
    checkpointSize: '',
    borderColor: '',
    size: '',
    xp: 0,
  })

  function syncFormFromBarrier() {
    const b = selectedBarrier.value
    if (!b) return
    formBarrier.value = {
      conditionType: b.conditionType,
      conditionValue: b.conditionValue ?? 0,
      description: b.description ?? '',
      checkpointLabel: b.checkpointLabel ?? '',
      checkpointLabelPosition: b.checkpointLabelPosition ?? '',
      checkpointAvatarUrl: b.checkpointAvatarUrl ?? '',
      checkpointColor: b.checkpointColor ?? '',
      checkpointSize: b.checkpointSize ?? '',
      borderColor: b.borderColor ?? '',
      size: b.size ?? '',
      xp: b.xp ?? 0,
    }
  }

  watch(selectedBarrier, syncFormFromBarrier, { immediate: true })

  const formText = ref<{
    content: string
    font: string
    scale: number
    color: string
    effects: string
  }>({
    content: '',
    font: '',
    scale: 1,
    color: '',
    effects: '',
  })

  let textContentTimer: ReturnType<typeof setTimeout> | null = null

  function cancelTextContentCommit() {
    if (textContentTimer) {
      clearTimeout(textContentTimer)
      textContentTimer = null
    }
  }

  function onTextContentInput(html: string) {
    formText.value.content = html
    if (!editable.value) return
    cancelTextContentCommit()
    textContentTimer = setTimeout(() => {
      textContentTimer = null
      commitTextField('content')
    }, 500)
  }

  onBeforeUnmount(cancelTextContentCommit)

  let lastSyncedTextId: string | null = null

  function syncFormFromText() {
    const t = selectedText.value
    if (!t) {
      lastSyncedTextId = null
      cancelTextContentCommit()
      return
    }
    if (t.id !== lastSyncedTextId) cancelTextContentCommit()
    lastSyncedTextId = t.id
    formText.value = {
      content: t.content ?? '',
      font: t.font ?? '',
      scale: t.scale ?? 1,
      color: t.color ?? '',
      effects: t.effects ?? '',
    }
  }

  watch(selectedText, syncFormFromText, { immediate: true })

  async function applyCampaignPatch(patch: UpdateCampaignRequest) {
    let c = campaign.value
    if (!c || c.id === '') {
      c = await ensureCampaign()
      if (!c) return
    }
    const keys = Object.keys(patch)
    clearFieldErrors(keys)
    try {
      actionError.value = null
      const updated = useAdminEndpoint.value
        ? await updateCampaign(c.id, patch)
        : await updatePlayerCampaign(c.id, patch)
      if (campaign.value) {
        campaign.value = { ...campaign.value, ...updated }
      }
    } catch (err) {
      reportPatchError(err, 'Failed to update campaign')
    }
  }

  async function applyNodePatch(id: string, patch: UpdateCampaignDifficultyRequest) {
    try {
      actionError.value = null
      const updated = useAdminEndpoint.value
        ? await updateCampaignDifficulty(id, patch)
        : await updatePlayerCampaignDifficulty(id, patch)
      mergeDifficulty(updated)
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to update node')
    }
  }

  async function applyBarrierPatch(id: string, patch: UpdateCampaignBarrierRequest) {
    try {
      actionError.value = null
      const updated = useAdminEndpoint.value
        ? await updateCampaignBarrier(id, patch)
        : await updatePlayerCampaignBarrier(id, patch)
      if (campaign.value) {
        campaign.value = {
          ...campaign.value,
          barriers: campaign.value.barriers.map((b) => (b.id === id ? updated : b)),
        }
      }
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to update barrier')
    }
  }

  function vertexPosition(id: string): { x: number; y: number } | null {
    const b = barrierById.value.get(id)
    if (b) return { x: b.positionX, y: b.positionY }
    const t = textById.value.get(id)
    if (t) return { x: t.positionX, y: t.positionY }
    const d = campaign.value?.difficulties.find((x) => x.id === id)
    return d ? { x: d.positionX, y: d.positionY } : null
  }

  function setVertexPositionLocal(id: string, positionX: number, positionY: number) {
    if (!campaign.value) return
    if (isBarrierId(id)) {
      campaign.value = {
        ...campaign.value,
        barriers: campaign.value.barriers.map((b) =>
          b.id === id ? { ...b, positionX, positionY } : b,
        ),
      }
    } else if (isTextId(id)) {
      campaign.value = {
        ...campaign.value,
        texts: campaign.value.texts.map((t) => (t.id === id ? { ...t, positionX, positionY } : t)),
      }
    } else {
      campaign.value = {
        ...campaign.value,
        difficulties: campaign.value.difficulties.map((d) =>
          d.id === id ? { ...d, positionX, positionY } : d,
        ),
      }
    }
  }

  function patchVertexPosition(id: string, positionX: number, positionY: number) {
    const patch = { positionX, positionY }
    if (isBarrierId(id)) {
      return useAdminEndpoint.value
        ? updateCampaignBarrier(id, patch)
        : updatePlayerCampaignBarrier(id, patch)
    }
    if (isTextId(id)) {
      if (isPendingText(id)) return Promise.resolve()
      return useAdminEndpoint.value
        ? updateCampaignText(id, patch)
        : updatePlayerCampaignText(id, patch)
    }
    return useAdminEndpoint.value
      ? updateCampaignDifficulty(id, patch)
      : updatePlayerCampaignDifficulty(id, patch)
  }

  const CLEARABLE_META_TEXT_FIELDS = new Set<string>(['backgroundColor'])

  function commitMetaField(field: keyof UpdateCampaignRequest) {
    if (!editable.value || !campaign.value) return
    const value = formMeta.value[field as keyof typeof formMeta.value]
    const original = (campaign.value as unknown as Record<string, unknown>)[field]
    if (value === original) return
    if (typeof value === 'string' && original == null && value === '') return
    const send = value === '' && !CLEARABLE_META_TEXT_FIELDS.has(field) ? null : value
    void applyCampaignPatch({ [field]: send } as UpdateCampaignRequest)
  }

  function commitBackgroundColor() {
    formMeta.value.backgroundColor = formMeta.value.backgroundColor.trim()
    commitMetaField('backgroundColor')
  }

  function resetBackgroundColor() {
    formMeta.value.backgroundColor = ''
    commitMetaField('backgroundColor')
  }

  const CLEARABLE_TEXT_FIELDS = new Set<string>([
    'description',
    'checkpointLabel',
    'checkpointAvatarUrl',
    'checkpointColor',
    'checkpointSize',
    'borderColor',
    'size',
  ])

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
    const send = value === '' && !CLEARABLE_TEXT_FIELDS.has(field) ? null : value
    void applyNodePatch(d.id, { [field]: send } as UpdateCampaignDifficultyRequest)
  }

  function mergeDifficulty(updated: CampaignDifficultyResponse) {
    if (!campaign.value) return
    campaign.value = {
      ...campaign.value,
      difficulties: campaign.value.difficulties.map((x) => (x.id === updated.id ? updated : x)),
    }
  }

  async function uploadCheckpointAvatar(file: File) {
    const d = selectedDifficulty.value
    if (!editable.value || !d) return
    const { uploadCampaignCheckpointAvatar } = await import('@/api/cdn')
    mergeDifficulty(await uploadCampaignCheckpointAvatar(d.id, file, useAdminEndpoint.value))
  }

  async function removeCheckpointAvatar() {
    const d = selectedDifficulty.value
    if (!editable.value || !d) return
    const { deleteCampaignCheckpointAvatar } = await import('@/api/cdn')
    mergeDifficulty(await deleteCampaignCheckpointAvatar(d.id, useAdminEndpoint.value))
  }

  function toggleTag(tagId: string) {
    if (!editable.value || !campaign.value) return
    const current = new Set(campaignTagIds.value)
    if (current.has(tagId)) current.delete(tagId)
    else current.add(tagId)
    void applyCampaignPatch({ tagIds: Array.from(current) })
  }

  const {
    showRepublishWarning,
    publishConfirm,
    doPlayerPublish,
    performPublish,
    doPlayerUnpublish,
    performUnpublish,
    deleteDraft,
    doPublish,
    doReopen,
    doCurate,
    doUncurate,
    doDeactivate,
  } = useCampaignLifecycle({
    campaign,
    actionPending,
    actionError,
    load,
    editedLiveCampaign,
    requirementDirtyIds,
  })

  const { uploadBackground, removeBackground, uploadIcon, removeIcon } = useCampaignAssets({
    campaign,
    load,
    useAdminEndpoint,
  })

  function wouldCreateCycle(fromId: string, toId: string): boolean {
    if (fromId === toId) return true
    const c = campaign.value
    if (!c) return false
    const successors = new Map<string, string[]>()
    const addEdges = (id: string, prereqs: string[] | undefined) => {
      for (const pid of prereqs ?? []) {
        const list = successors.get(pid) ?? []
        list.push(id)
        successors.set(pid, list)
      }
    }
    for (const d of c.difficulties) addEdges(d.id, d.prerequisiteCampaignDifficultyIds)
    for (const b of c.barriers) addEdges(b.id, b.prerequisiteCampaignDifficultyIds)
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
    const b = barrierById.value.get(id)
    if (b) return b.checkpointLabel || 'gate'
    const d = campaign.value?.difficulties.find((x) => x.id === id)
    return d?.songName || 'node'
  }

  function vertexPrereqs(id: string): string[] | null {
    const b = barrierById.value.get(id)
    if (b) return b.prerequisiteCampaignDifficultyIds ?? []
    const d = campaign.value?.difficulties.find((x) => x.id === id)
    return d ? (d.prerequisiteCampaignDifficultyIds ?? []) : null
  }

  function setPrereqMode(mode: 'AND' | 'OR') {
    const d = selectedDifficulty.value
    if (!editable.value || !d) return
    if (d.prerequisiteMode === mode) return
    void applyNodePatch(d.id, { prerequisiteMode: mode })
  }

  async function handleMove(payload: { id: string; positionX: number; positionY: number }) {
    if (!campaign.value) return
    const prev = vertexPosition(payload.id)
    if (!prev) return
    if (prev.x === payload.positionX && prev.y === payload.positionY) return

    setVertexPositionLocal(payload.id, payload.positionX, payload.positionY)

    try {
      actionError.value = null
      await patchVertexPosition(payload.id, payload.positionX, payload.positionY)
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to move node')
      setVertexPositionLocal(payload.id, prev.x, prev.y)
    }
  }

  function setPrereqsLocal(toId: string, ids: string[]) {
    if (!campaign.value) return
    if (isBarrierId(toId)) {
      campaign.value = {
        ...campaign.value,
        barriers: campaign.value.barriers.map((b) =>
          b.id === toId ? { ...b, prerequisiteCampaignDifficultyIds: ids } : b,
        ),
      }
    } else {
      campaign.value = {
        ...campaign.value,
        difficulties: campaign.value.difficulties.map((d) =>
          d.id === toId ? { ...d, prerequisiteCampaignDifficultyIds: ids } : d,
        ),
      }
    }
  }

  async function persistPrereqs(toId: string, next: string[], prev: string[]) {
    if (!campaign.value) return
    const barrier = isBarrierId(toId)
    setPrereqsLocal(toId, next)
    try {
      actionError.value = null
      const payload = { prerequisiteCampaignDifficultyIds: next }
      if (barrier) {
        const updated = useAdminEndpoint.value
          ? await updateCampaignBarrier(toId, payload)
          : await updatePlayerCampaignBarrier(toId, payload)
        if (campaign.value) {
          campaign.value = {
            ...campaign.value,
            barriers: campaign.value.barriers.map((b) => (b.id === toId ? updated : b)),
          }
        }
      } else {
        const updated = useAdminEndpoint.value
          ? await updateCampaignDifficulty(toId, payload)
          : await updatePlayerCampaignDifficulty(toId, payload)
        if (campaign.value) {
          campaign.value = {
            ...campaign.value,
            difficulties: campaign.value.difficulties.map((d) => (d.id === toId ? updated : d)),
          }
        }
      }
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to update prerequisites')
      setPrereqsLocal(toId, prev)
    }
  }

  const {
    itemPickerFor,
    canAddNodeReward,
    canAddBarrierReward,
    nodeRewardLimit,
    openCampaignItemPicker,
    openNodeItemPicker,
    openBarrierItemPicker,
    handleItemPicked,
    removeCompletionItem,
    removeNodeItem,
    removeBarrierItem,
  } = useCampaignRewards({
    campaign,
    ensureCampaign,
    actionPending,
    actionError,
    editable,
    selectedDifficulty,
    selectedBarrier,
  })

  async function handleConnect(payload: { fromId: string; toId: string }) {
    const prev = vertexPrereqs(payload.toId)
    if (prev == null) return
    if (prev.includes(payload.fromId)) return
    if (wouldCreateCycle(payload.fromId, payload.toId)) {
      actionError.value = `Can't connect "${nodeLabel(payload.fromId)}" → "${nodeLabel(payload.toId)}". The reverse path already exists, which would create a cycle.`
      return
    }
    await persistPrereqs(payload.toId, [...prev, payload.fromId], prev)
  }

  async function handleDisconnect(payload: { fromId: string; toId: string }) {
    const prev = vertexPrereqs(payload.toId)
    if (prev == null) return
    if (!prev.includes(payload.fromId)) return
    await persistPrereqs(
      payload.toId,
      prev.filter((id) => id !== payload.fromId),
      prev,
    )
  }

  function handleEmptyClick() {
    barrierPlacementMode.value = false
    clearSelection()
  }

  const existingMapDifficultyIds = computed(
    () => new Set((campaign.value?.difficulties ?? []).map((d) => d.mapDifficultyId)),
  )

  function openMapPicker() {
    if (!editable.value) return
    showMapPicker.value = true
  }

  function allocateCells(count: number): Array<{ x: number; y: number }> {
    const occupied = new Set<string>()
    const diffs = campaign.value?.difficulties ?? []
    const barrs = campaign.value?.barriers ?? []
    const txts = campaign.value?.texts ?? []
    let baseY = 0
    let maxY = -Infinity
    for (const d of diffs) {
      occupied.add(`${d.positionX},${d.positionY}`)
      if (d.positionY > maxY) maxY = d.positionY
    }
    for (const b of barrs) {
      occupied.add(`${b.positionX},${b.positionY}`)
      if (b.positionY > maxY) maxY = b.positionY
    }
    for (const t of txts) {
      occupied.add(`${t.positionX},${t.positionY}`)
      if (t.positionY > maxY) maxY = t.positionY
    }

    const cells: Array<{ x: number; y: number }> = []
    const claim = (x: number, y: number) => {
      const key = `${x},${y}`
      if (occupied.has(key)) return
      occupied.add(key)
      cells.push({ x, y })
    }

    const origin = viewCenterProvider?.() ?? null
    if (origin) {
      claim(origin.x, origin.y)
      const maxRing = count + 10
      for (let r = 1; cells.length < count && r <= maxRing; r++) {
        for (let dx = -r; dx <= r && cells.length < count; dx++) {
          for (let dy = -r; dy <= r && cells.length < count; dy++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
            claim(origin.x + dx, origin.y + dy)
          }
        }
      }
      if (cells.length >= count) return cells.slice(0, count)
    }

    if (occupied.size > 0) baseY = maxY + 2
    const perRow = Math.min(6, Math.max(1, count))
    for (let row = 0; cells.length < count && row < count + 4; row++) {
      for (let col = 0; col < perRow && cells.length < count; col++) {
        claim(col, baseY + row * 2)
      }
    }
    return cells
  }

  async function handleMapsPicked(mapDifficultyIds: string[]) {
    if (mapDifficultyIds.length === 0) return
    actionPending.value = true
    actionError.value = null
    try {
      let c = campaign.value
      if (!c || c.id === '') {
        c = await ensureCampaign()
        if (!c) return
      }
      const cells = allocateCells(mapDifficultyIds.length)
      const createdIds: string[] = []
      for (let i = 0; i < mapDifficultyIds.length; i++) {
        const cell = cells[i] ?? { x: i, y: 0 }
        const req: AddCampaignDifficultyRequest = {
          mapDifficultyId: mapDifficultyIds[i],
          requirementType: 'ACC',
          requirementValue: 0.95,
          positionX: cell.x,
          positionY: cell.y,
          xp: 0,
        }
        const created = useAdminEndpoint.value
          ? await addCampaignDifficulty(c.id, req)
          : await addPlayerCampaignDifficulty(c.id, req)
        createdIds.push(created.id)
      }
      if (createdIds.length === 1) {
        selectOnly(createdIds[0])
        activeTray.value = 'requirement'
      } else if (createdIds.length > 1) {
        setSelection(createdIds)
        activeTray.value = 'bulk'
      }
      showMapPicker.value = false
      await load(true)
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to add nodes')
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
      clearSelection()
      await load(true)
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to remove node')
    } finally {
      actionPending.value = false
    }
  }

  async function handleMoveMany(
    payloads: Array<{ id: string; positionX: number; positionY: number }>,
  ) {
    if (!campaign.value || payloads.length === 0) return
    const prevById = new Map<string, { x: number; y: number }>()
    for (const p of payloads) {
      const prev = vertexPosition(p.id)
      if (prev) prevById.set(p.id, prev)
    }
    const moves = payloads.filter((p) => {
      const prev = prevById.get(p.id)
      return prev && (prev.x !== p.positionX || prev.y !== p.positionY)
    })
    if (moves.length === 0) return
    for (const m of moves) setVertexPositionLocal(m.id, m.positionX, m.positionY)
    try {
      actionError.value = null
      await Promise.all(moves.map((m) => patchVertexPosition(m.id, m.positionX, m.positionY)))
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to move nodes')
      for (const m of moves) {
        const prev = prevById.get(m.id)
        if (prev) setVertexPositionLocal(m.id, prev.x, prev.y)
      }
    }
  }

  function vertexTrayFor(id: string | null): TrayId {
    if (id && isBarrierId(id)) return 'barrierCondition'
    if (id && isTextId(id)) return 'text'
    return 'requirement'
  }

  function trayForSelection(id: string): TrayId {
    const current = activeTray.value
    if (isBarrierId(id)) {
      return current && BARRIER_TRAY_IDS.includes(current) ? current : 'barrierCondition'
    }
    if (isTextId(id)) return 'text'
    if (current && NODE_TRAY_IDS.includes(current)) {
      if (current !== 'unlock') return current
      const d = campaign.value?.difficulties.find((x) => x.id === id)
      if ((d?.prerequisiteCampaignDifficultyIds ?? []).length >= 2) return current
    }
    return 'requirement'
  }

  function handleSelect(id: string) {
    if (
      affectedPickMode.value &&
      selectedBarrier.value &&
      !isBarrierId(id) &&
      !isTextId(id)
    ) {
      toggleAffected(id)
      return
    }
    barrierPlacementMode.value = false
    selectOnly(id)
    activeTray.value = trayForSelection(id)
  }

  function handleToggleSelect(id: string) {
    toggleInSelection(id)
    if (selectedIds.value.size >= 2) activeTray.value = 'bulk'
    else if (selectedIds.value.size === 1) activeTray.value = vertexTrayFor(selectedId.value)
  }

  function handleSelectMany(ids: string[]) {
    setSelection(ids)
    if (selectedIds.value.size >= 2) activeTray.value = 'bulk'
    else if (selectedIds.value.size === 1) activeTray.value = vertexTrayFor(selectedId.value)
  }

  function handleDeselect() {
    if (showMapPicker.value) return
    clearSelection()
  }

  const requirementTypeOptions: Array<{ value: CampaignRequirementType; label: string }> = [
    { value: 'ACC', label: 'Accuracy' },
    { value: 'AP', label: 'AP' },
    { value: 'SCORE', label: 'Score' },
    { value: 'STREAK_115', label: '115 Streak' },
    { value: 'FC', label: 'Full Combo' },
    { value: 'RANK', label: 'Leaderboard rank' },
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
      } else if (formNode.value.requirementType === 'SCORE') {
        formNode.value.requirementValue = Math.max(0, Math.min(scoreCap.value, Number(v) || 0))
      } else if (formNode.value.requirementType === 'RANK') {
        formNode.value.requirementValue = Math.max(1, Math.round(Number(v) || 1))
      } else {
        formNode.value.requirementValue = Number(v) || 0
      }
    },
  })

  const scoreCap = computed(() => {
    const maxScore = selectedMeta.value?.maxScore
    return maxScore && maxScore > 0 ? maxScore : 1_500_000
  })

  const requirementBounds = computed(() => {
    if (formNode.value.requirementType === 'ACC') return { min: 70, max: 100, step: 0.1, unit: '%' }
    if (formNode.value.requirementType === 'AP') return { min: 400, max: 1200, step: 1, unit: 'AP' }
    if (formNode.value.requirementType === 'STREAK_115')
      return { min: 0, max: 30, step: 1, unit: '' }
    if (formNode.value.requirementType === 'FC') return { min: 1, max: 1, step: 1, unit: '' }
    if (formNode.value.requirementType === 'RANK')
      return { min: 1, max: 500, step: 1, unit: 'rank' }
    return { min: 0, max: scoreCap.value, step: 1000, unit: '' }
  })

  const requirementNumberBounds = computed(() => {
    if (formNode.value.requirementType === 'AP') {
      return { min: 0, max: Number.MAX_SAFE_INTEGER, step: 1 }
    }
    if (formNode.value.requirementType === 'RANK') {
      return { min: 1, max: Number.MAX_SAFE_INTEGER, step: 1 }
    }
    return requirementBounds.value
  })

  function formatScoreCompact(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
    if (value >= 1_000) return `${Math.round(value / 1_000)}k`
    return String(Math.round(value))
  }

  const scoreCurves = ref(new Map<string, CurveResponse>())
  const pendingCurveIds = new Set<string>()

  async function ensureScoreCurve(curveId: string | undefined) {
    if (!curveId || scoreCurves.value.has(curveId) || pendingCurveIds.has(curveId)) return
    pendingCurveIds.add(curveId)
    try {
      const curve = await getCurve(curveId)
      const next = new Map(scoreCurves.value)
      next.set(curveId, curve)
      scoreCurves.value = next
    } catch {
    } finally {
      pendingCurveIds.delete(curveId)
    }
  }

  function scoreCurveIdFor(categoryId: string | null | undefined): string | undefined {
    return categoryId ? categoryStore.byId.get(categoryId)?.scoreCurve?.id : undefined
  }

  watch(
    () => selectedMeta.value?.categoryId,
    (categoryId) => void ensureScoreCurve(scoreCurveIdFor(categoryId)),
    { immediate: true },
  )

  const requirementEquivalents = computed<Array<{ key: string; text: string }>>(() => {
    const type = formNode.value.requirementType
    if (type !== 'ACC' && type !== 'AP' && type !== 'SCORE') return []
    const meta = selectedMeta.value
    if (!meta) return []
    const complexity = meta.complexity
    const maxScore = meta.maxScore
    const curveId = scoreCurveIdFor(meta.categoryId)
    const curve = curveId ? (scoreCurves.value.get(curveId) ?? null) : null
    const raw = formNode.value.requirementValue

    let acc: number | null = null
    let ap: number | null = null
    let score: number | null = null

    if (type === 'ACC') {
      acc = raw
    } else if (type === 'SCORE') {
      score = raw
      if (maxScore > 0) acc = raw / maxScore
    } else {
      ap = raw
      if (curve && complexity != null) acc = reverseApToAccuracyByComplexity(curve, raw, complexity)
    }

    if (acc != null && Number.isFinite(acc)) {
      if (score == null && maxScore > 0) score = acc * maxScore
      if (ap == null && curve && complexity != null) ap = calculateAp(curve, acc, complexity)
    }

    const out: Array<{ key: string; text: string }> = []
    if (type !== 'ACC' && acc != null && Number.isFinite(acc)) {
      out.push({ key: 'ACC', text: `${(acc * 100).toFixed(2)}%` })
    }
    if (type !== 'AP' && ap != null && Number.isFinite(ap)) {
      out.push({ key: 'AP', text: `${Math.round(ap)} AP` })
    }
    if (type !== 'SCORE' && score != null && Number.isFinite(score)) {
      out.push({ key: 'SCORE', text: `${formatScoreCompact(score)} pts` })
    }
    return out
  })

  const isMilestone = ref(false)
  let suppressMilestoneAutoOpen = false

  let milestoneSyncedNodeId: string | null = null

  watch(
    selectedDifficulty,
    (d) => {
      if (!d) {
        milestoneSyncedNodeId = null
        isMilestone.value = false
        return
      }
      if (d.id === milestoneSyncedNodeId) return
      milestoneSyncedNodeId = d.id
      isMilestone.value = !!(
        d.checkpointLabel ||
        d.checkpointLabelPosition ||
        d.checkpointAvatarUrl ||
        d.checkpointColor ||
        d.checkpointSize
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
        checkpointLabel: '',
        checkpointAvatarUrl: '',
        checkpointColor: '',
        checkpointSize: '',
      })
    }
    setTimeout(() => {
      suppressMilestoneAutoOpen = false
    }, 0)
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

  const sizeTiles = [
    { value: 32, label: 'Small', glyph: 5 },
    { value: 48, label: 'Medium', glyph: 7.5 },
    { value: 64, label: 'Large', glyph: 9.5 },
    { value: 80, label: 'Huge', glyph: 11.5 },
  ] as const

  function onCompletionModeChange(value: string) {
    formMeta.value.completionMode = value as 'TERMINAL' | 'ALL'
    commitMetaField('completionMode')
  }

  function onRequirementTypeChange(value: string) {
    const d = selectedDifficulty.value
    const next = value as CampaignRequirementType
    formNode.value.requirementType = next
    if (
      next === 'RANK' &&
      !(Number.isInteger(formNode.value.requirementValue) && formNode.value.requirementValue >= 1)
    ) {
      formNode.value.requirementValue = 50
      if (editable.value && d) {
        requirementDirtyIds.value.add(d.id)
        void applyNodePatch(d.id, { requirementType: next, requirementValue: 50 })
        return
      }
    }
    commitNodeField('requirementType')
  }

  function resetNodeColor(field: 'checkpointColor' | 'borderColor') {
    formNode.value[field] = ''
    commitNodeField(field)
  }

  function selectBorderShape(value: string) {
    formNode.value.borderShape = value
    commitNodeField('borderShape')
  }

  function selectNodeLabelPosition(value: string) {
    formNode.value.checkpointLabelPosition = value
    commitNodeField('checkpointLabelPosition')
  }

  function selectNodeSize(value: number) {
    formNode.value.size = String(value)
    commitNodeField('size')
  }

  async function applyBulkSize(value: number) {
    if (!editable.value) return
    for (const id of selectedIdList.value) {
      if (isBarrierId(id)) await applyBarrierPatch(id, { size: String(value) })
      else await applyNodePatch(id, { size: String(value) })
    }
  }

  async function applyBulkShape(value: string) {
    if (!editable.value) return
    for (const id of selectedIdList.value) {
      if (isBarrierId(id)) continue
      await applyNodePatch(id, { borderShape: value })
    }
  }

  async function removeSelectedNodes() {
    if (!editable.value || !campaign.value) return
    const ids = selectedIdList.value
    if (ids.length === 0) return
    if (!window.confirm(`Remove ${ids.length} nodes from this campaign?`)) return
    actionPending.value = true
    actionError.value = null
    try {
      for (const id of ids) {
        if (isBarrierId(id)) {
          if (useAdminEndpoint.value) await deactivateCampaignBarrier(campaign.value.id, id)
          else await deletePlayerCampaignBarrier(campaign.value.id, id)
        } else if (isTextId(id)) {
          if (isPendingText(id)) {
            pendingTextIds.delete(id)
            cancelledTextIds.add(id)
          } else if (useAdminEndpoint.value) {
            await deactivateCampaignText(campaign.value.id, id)
          } else {
            await deletePlayerCampaignText(campaign.value.id, id)
          }
        } else if (useAdminEndpoint.value) {
          await deactivateCampaignDifficulty(campaign.value.id, id)
        } else {
          await deletePlayerCampaignDifficulty(campaign.value.id, id)
        }
      }
      clearSelection()
      await load(true)
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to remove nodes')
    } finally {
      actionPending.value = false
    }
  }

  function closeMapPicker() {
    showMapPicker.value = false
  }

  function toggleBarrierPlacement() {
    if (!canAddBarrier.value) return
    affectedPickMode.value = false
    barrierPlacementMode.value = !barrierPlacementMode.value
  }

  function occupiedCells(): Set<string> {
    const set = new Set<string>()
    for (const d of campaign.value?.difficulties ?? []) set.add(`${d.positionX},${d.positionY}`)
    for (const b of campaign.value?.barriers ?? []) set.add(`${b.positionX},${b.positionY}`)
    return set
  }

  function findFreeCellNear(x: number, y: number): { x: number; y: number } {
    const occ = occupiedCells()
    if (!occ.has(`${x},${y}`)) return { x, y }
    for (let r = 1; r <= 8; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
          if (!occ.has(`${x + dx},${y + dy}`)) return { x: x + dx, y: y + dy }
        }
      }
    }
    return { x, y }
  }

  async function placeBarrierOnEdge(payload: { fromId: string; toId: string }) {
    if (!editable.value || campaign.value?.progressionAgnostic) return
    let c = campaign.value
    if (!c || c.id === '') {
      c = await ensureCampaign()
      if (!c) return
    }
    if ((c.barriers?.length ?? 0) >= MAX_BARRIERS) {
      actionError.value = `Campaigns can have at most ${MAX_BARRIERS} barriers.`
      return
    }
    const fromPos = vertexPosition(payload.fromId)
    const toPos = vertexPosition(payload.toId)
    if (!fromPos || !toPos) return
    const targetPrereqs = vertexPrereqs(payload.toId)
    if (targetPrereqs == null) return
    const cell = findFreeCellNear(
      Math.round((fromPos.x + toPos.x) / 2),
      Math.round((fromPos.y + toPos.y) / 2),
    )
    actionPending.value = true
    actionError.value = null
    try {
      const req: AddCampaignBarrierRequest = {
        conditionType: 'AVERAGE_ACC',
        conditionValue: 0.9,
        positionX: cell.x,
        positionY: cell.y,
        prerequisiteCampaignDifficultyIds: [payload.fromId],
        affectedCampaignDifficultyIds: [payload.fromId],
      }
      const created = useAdminEndpoint.value
        ? await addCampaignBarrier(c.id, req)
        : await addPlayerCampaignBarrier(c.id, req)
      const nextPrereqs = targetPrereqs
        .filter((id) => id !== payload.fromId)
        .concat(created.id)
      const rewire = { prerequisiteCampaignDifficultyIds: nextPrereqs }
      if (isBarrierId(payload.toId)) {
        await (useAdminEndpoint.value
          ? updateCampaignBarrier(payload.toId, rewire)
          : updatePlayerCampaignBarrier(payload.toId, rewire))
      } else {
        await (useAdminEndpoint.value
          ? updateCampaignDifficulty(payload.toId, rewire)
          : updatePlayerCampaignDifficulty(payload.toId, rewire))
      }
      barrierPlacementMode.value = false
      await load(true)
      selectOnly(created.id)
      activeTray.value = 'barrierCondition'
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to add barrier')
    } finally {
      actionPending.value = false
    }
  }

  const BARRIER_CLEARABLE_TEXT = new Set<string>([
    'description',
    'checkpointLabel',
    'checkpointAvatarUrl',
    'checkpointColor',
    'checkpointSize',
    'borderColor',
    'size',
  ])

  function commitBarrierField(field: keyof UpdateCampaignBarrierRequest) {
    const b = selectedBarrier.value
    if (!editable.value || !b) return
    const value = formBarrier.value[field as keyof typeof formBarrier.value]
    const original = (b as unknown as Record<string, unknown>)[field]
    if (value === original) return
    if (typeof value === 'string' && original == null && value === '') return
    if (field === 'conditionType' || field === 'conditionValue') {
      requirementDirtyIds.value.add(b.id)
    }
    const send = value === '' && !BARRIER_CLEARABLE_TEXT.has(field) ? null : value
    void applyBarrierPatch(b.id, { [field]: send } as UpdateCampaignBarrierRequest)
  }

  function resetBarrierColor() {
    formBarrier.value.borderColor = ''
    commitBarrierField('borderColor')
  }

  function selectBarrierLabelPosition(value: string) {
    formBarrier.value.checkpointLabelPosition = value
    commitBarrierField('checkpointLabelPosition')
  }

  const barrierConditionOptions: Array<{ value: BarrierConditionType; label: string }> = [
    { value: 'AVERAGE_ACC', label: 'Average accuracy' },
    { value: 'ACC_MAX', label: 'Best accuracy' },
    { value: 'AVERAGE_AP', label: 'Average AP' },
    { value: 'AP_MAX', label: 'Best AP' },
    { value: 'STREAK_115_AVERAGE', label: 'Average 115 streak' },
    { value: 'STREAK_115_MAX', label: 'Best 115 streak' },
    { value: 'AVERAGE_RANK', label: 'Average rank' },
    { value: 'MAX_RANK', label: 'Best rank' },
    { value: 'FC', label: 'Full combo (all)' },
  ]

  const barrierMeta = computed(() => barrierConditionMeta(formBarrier.value.conditionType))

  const barrierValueDisplay = computed<number>({
    get: () => {
      if (barrierMeta.value.metric === 'acc') {
        const v = formBarrier.value.conditionValue * 100
        return Number.isFinite(v) ? Number(v.toFixed(2)) : 0
      }
      return formBarrier.value.conditionValue
    },
    set: (v) => {
      const m = barrierMeta.value
      if (m.metric === 'acc') {
        formBarrier.value.conditionValue = Math.max(0, Math.min(100, Number(v) || 0)) / 100
      } else if (m.metric === 'rank') {
        formBarrier.value.conditionValue = Math.max(1, Math.round(Number(v) || 1))
      } else if (m.metric === 'streak') {
        formBarrier.value.conditionValue = Math.max(0, Math.round(Number(v) || 0))
      } else {
        formBarrier.value.conditionValue = Math.max(0, Number(v) || 0)
      }
    },
  })

  const barrierValueBounds = computed(() => {
    const m = barrierMeta.value.metric
    if (m === 'acc') return { min: 70, max: 100, step: 0.1, unit: '%' }
    if (m === 'ap') return { min: 0, max: 1200, step: 1, unit: 'AP' }
    if (m === 'streak') return { min: 0, max: 30, step: 1, unit: '' }
    if (m === 'rank') return { min: 1, max: 500, step: 1, unit: 'rank' }
    return { min: 0, max: 1, step: 1, unit: '' }
  })

  function onBarrierConditionTypeChange(value: string) {
    const next = value as BarrierConditionType
    const prevMetric = barrierMeta.value.metric
    formBarrier.value.conditionType = next
    const nextMeta = barrierConditionMeta(next)
    const b = selectedBarrier.value
    if (nextMeta.noValue) {
      if (editable.value && b) {
        requirementDirtyIds.value.add(b.id)
        void applyBarrierPatch(b.id, { conditionType: next, conditionValue: null })
        return
      }
    } else if (prevMetric !== nextMeta.metric) {
      const def =
        nextMeta.metric === 'acc'
          ? 0.9
          : nextMeta.metric === 'ap'
            ? 500
            : nextMeta.metric === 'streak'
              ? 8
              : 50
      formBarrier.value.conditionValue = def
      if (editable.value && b) {
        requirementDirtyIds.value.add(b.id)
        void applyBarrierPatch(b.id, { conditionType: next, conditionValue: def })
        return
      }
    }
    commitBarrierField('conditionType')
  }

  function toggleAffectedPickMode() {
    if (!selectedBarrier.value) return
    affectedPickMode.value = !affectedPickMode.value
  }

  function toggleAffected(nodeId: string) {
    const b = selectedBarrier.value
    if (!editable.value || !b) return
    const current = new Set(b.affectedCampaignDifficultyIds ?? [])
    if (current.has(nodeId)) current.delete(nodeId)
    else current.add(nodeId)
    const next = Array.from(current)
    if (campaign.value) {
      campaign.value = {
        ...campaign.value,
        barriers: campaign.value.barriers.map((row) =>
          row.id === b.id ? { ...row, affectedCampaignDifficultyIds: next } : row,
        ),
      }
    }
    void applyBarrierPatch(b.id, { affectedCampaignDifficultyIds: next })
  }

  async function removeSelectedBarrier() {
    const b = selectedBarrier.value
    if (!editable.value || !b || !campaign.value) return
    if (!window.confirm('Remove this barrier from the roadmap?')) return
    actionPending.value = true
    actionError.value = null
    try {
      if (useAdminEndpoint.value) {
        await deactivateCampaignBarrier(campaign.value.id, b.id)
      } else {
        await deletePlayerCampaignBarrier(campaign.value.id, b.id)
      }
      clearSelection()
      await load(true)
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to remove barrier')
    } finally {
      actionPending.value = false
    }
  }

  async function applyTextPatch(id: string, partial: Partial<CampaignTextRequest>) {
    const t = textById.value.get(id)
    if (!t) return
    if (isPendingText(id)) {
      if (campaign.value) {
        campaign.value = {
          ...campaign.value,
          texts: campaign.value.texts.map((x) =>
            x.id === id ? ({ ...x, ...partial } as CampaignTextResponse) : x,
          ),
        }
      }
      return
    }
    const req: CampaignTextRequest = {
      positionX: t.positionX,
      positionY: t.positionY,
      ...partial,
    }
    try {
      actionError.value = null
      const updated = useAdminEndpoint.value
        ? await updateCampaignText(id, req)
        : await updatePlayerCampaignText(id, req)
      if (campaign.value) {
        const merged =
          selectedId.value === id ? { ...updated, content: formText.value.content } : updated
        campaign.value = {
          ...campaign.value,
          texts: campaign.value.texts.map((x) => (x.id === id ? merged : x)),
        }
      }
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to update text')
    }
  }

  function commitTextField(field: 'content' | 'font' | 'scale' | 'color' | 'effects') {
    const t = selectedText.value
    if (!editable.value || !t) return
    const value = formText.value[field]
    const original = (t as unknown as Record<string, unknown>)[field]
    if (value === original) return
    if (typeof value === 'string' && original == null && value === '') return
    void applyTextPatch(t.id, { [field]: value } as Partial<CampaignTextRequest>)
  }

  const TEXT_EFFECTS = ['glow', 'outline', 'shadow'] as const

  function textEffectActive(effect: string): boolean {
    return formText.value.effects.split(/\s+/).includes(effect)
  }

  function toggleTextEffect(effect: string) {
    if (!editable.value) return
    const set = new Set(formText.value.effects.split(/\s+/).filter(Boolean))
    if (set.has(effect)) set.delete(effect)
    else set.add(effect)
    formText.value.effects = Array.from(set).join(' ')
    commitTextField('effects')
  }

  async function addText() {
    if (!editable.value) return
    let c = campaign.value
    if (!c || c.id === '') {
      c = await ensureCampaign()
      if (!c) return
    }
    if ((c.texts?.length ?? 0) >= MAX_TEXTS) {
      actionError.value = `Campaigns can have at most ${MAX_TEXTS} text elements.`
      return
    }
    actionError.value = null
    const [cell] = allocateCells(1)
    const positionX = cell?.x ?? 0
    const positionY = cell?.y ?? 0
    const tempId = `temp-text-${++tempTextSeq}`
    const optimistic: CampaignTextResponse = {
      id: tempId,
      content: 'New text',
      positionX,
      positionY,
      font: null,
      scale: 1,
      color: null,
      effects: null,
    }
    pendingTextIds.add(tempId)
    campaign.value = { ...c, texts: [...(c.texts ?? []), optimistic] }
    selectOnly(tempId)
    activeTray.value = 'text'

    const req: CampaignTextRequest = { content: 'New text', positionX, positionY }
    const request = useAdminEndpoint.value
      ? addCampaignText(c.id, req)
      : addPlayerCampaignText(c.id, req)
    void request.then(
      (created) => finalizeTextCreate(tempId, created),
      (err) => rollbackTextCreate(tempId, err),
    )
  }

  async function finalizeTextCreate(tempId: string, created: CampaignTextResponse) {
    pendingTextIds.delete(tempId)
    if (cancelledTextIds.has(tempId)) {
      cancelledTextIds.delete(tempId)
      const campaignId = campaign.value?.id
      if (campaignId) {
        try {
          if (useAdminEndpoint.value) await deactivateCampaignText(campaignId, created.id)
          else await deletePlayerCampaignText(campaignId, created.id)
        } catch {
          void 0
        }
      }
      return
    }
    const local = campaign.value?.texts.find((t) => t.id === tempId)
    if (!campaign.value || !local) return
    const freshContent = selectedId.value === tempId ? formText.value.content : local.content
    const merged: CampaignTextResponse = {
      ...created,
      content: freshContent,
      positionX: local.positionX,
      positionY: local.positionY,
      font: local.font,
      scale: local.scale,
      color: local.color,
      effects: local.effects,
    }
    campaign.value = {
      ...campaign.value,
      texts: campaign.value.texts.map((t) => (t.id === tempId ? merged : t)),
    }
    if (selectedId.value === tempId) {
      const tray = activeTray.value
      selectOnly(created.id)
      activeTray.value = tray
    }
    const changed =
      freshContent !== created.content ||
      local.positionX !== created.positionX ||
      local.positionY !== created.positionY ||
      (local.font ?? '') !== (created.font ?? '') ||
      (local.scale ?? 1) !== (created.scale ?? 1) ||
      (local.color ?? '') !== (created.color ?? '') ||
      (local.effects ?? '') !== (created.effects ?? '')
    if (changed) {
      await applyTextPatch(created.id, {
        content: merged.content,
        positionX: merged.positionX,
        positionY: merged.positionY,
        font: merged.font ?? '',
        scale: merged.scale ?? 1,
        color: merged.color ?? '',
        effects: merged.effects ?? '',
      })
    }
  }

  function rollbackTextCreate(tempId: string, err: unknown) {
    pendingTextIds.delete(tempId)
    if (campaign.value) {
      campaign.value = {
        ...campaign.value,
        texts: campaign.value.texts.filter((t) => t.id !== tempId),
      }
    }
    if (selectedId.value === tempId) clearSelection()
    actionError.value = getApiErrorMessage(err, 'Failed to add text')
  }

  async function removeSelectedText() {
    const t = selectedText.value
    if (!editable.value || !t || !campaign.value) return
    if (!window.confirm('Remove this text element?')) return
    if (isPendingText(t.id)) {
      pendingTextIds.delete(t.id)
      cancelledTextIds.add(t.id)
      campaign.value = {
        ...campaign.value,
        texts: campaign.value.texts.filter((x) => x.id !== t.id),
      }
      clearSelection()
      return
    }
    actionPending.value = true
    actionError.value = null
    try {
      if (useAdminEndpoint.value) {
        await deactivateCampaignText(campaign.value.id, t.id)
      } else {
        await deletePlayerCampaignText(campaign.value.id, t.id)
      }
      clearSelection()
      await load(true)
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to remove text')
    } finally {
      actionPending.value = false
    }
  }

  const breadcrumbs = computed<Crumb[]>(() => {
    const title = isUnsavedDraft.value ? 'New campaign' : campaign.value?.name || 'Editor'
    return [{ label: 'Campaigns', to: '/campaigns' }, { label: title }]
  })

  const NODE_TRAY_IDS: TrayId[] = ['requirement', 'milestone', 'shape', 'unlock', 'rewards']
  const BARRIER_TRAY_IDS: TrayId[] = [
    'barrierCondition',
    'barrierAffected',
    'barrierStyle',
    'barrierRewards',
  ]

  const activeTray = ref<TrayId | null>(null)

  const campaignTrays = computed<TrayDef[]>(() => {
    const trays: TrayDef[] = [
      { id: 'status', label: 'Status', icon: 'flag', tone: campaign.value?.status.toLowerCase() },
      { id: 'identity', label: 'Identity', icon: 'identity' },
      { id: 'settings', label: 'Settings', icon: 'sliders' },
      { id: 'images', label: 'Images', icon: 'image' },
      {
        id: 'completion',
        label: 'Rewards',
        icon: 'gift',
        count: campaign.value?.completionItems.length ?? 0,
      },
    ]
    if (!isUnsavedDraft.value && (isCreator.value || isCollaborator.value || isCurator.value)) {
      trays.push({
        id: 'collaborators',
        label: 'Collab',
        icon: 'users',
        count: activeCollaborators.value.length,
      })
    }
    if (isCreator.value || isCollaborator.value || isCurator.value) {
      trays.push({
        id: 'tags',
        label: 'Tags',
        icon: 'tag',
        count: campaign.value?.tags.length ?? 0,
      })
    }
    return trays
  })

  const nodeTrays = computed<TrayDef[]>(() => {
    if (isMultiSelect.value) {
      return [{ id: 'bulk', label: 'Selection', icon: 'layers', count: selectedCount.value }]
    }
    if (selectedBarrier.value) {
      const b = selectedBarrier.value
      return [
        { id: 'barrierCondition', label: 'Condition', icon: 'target' },
        {
          id: 'barrierAffected',
          label: 'Affected',
          icon: 'link',
          count: b.affectedCampaignDifficultyIds?.length ?? 0,
        },
        { id: 'barrierStyle', label: 'Style', icon: 'hexagon' },
        { id: 'barrierRewards', label: 'Rewards', icon: 'package', count: b.items.length },
      ]
    }
    if (selectedText.value) {
      return [{ id: 'text', label: 'Text', icon: 'type' }]
    }
    const d = selectedDifficulty.value
    if (!d) return []
    const trays: TrayDef[] = [
      { id: 'requirement', label: 'Goal', icon: 'target' },
      { id: 'milestone', label: 'Milestone', icon: 'award' },
      { id: 'shape', label: 'Shape', icon: 'hexagon' },
    ]
    if ((d.prerequisiteCampaignDifficultyIds ?? []).length >= 2) {
      trays.push({ id: 'unlock', label: 'Unlock', icon: 'link' })
    }
    trays.push({ id: 'rewards', label: 'Rewards', icon: 'package', count: d.items.length })
    return trays
  })

  const trayTitles: Record<TrayId, string> = {
    status: 'Status',
    identity: 'Identity',
    settings: 'Settings',
    images: 'Images',
    completion: 'Completion rewards',
    collaborators: 'Collaborators',
    tags: 'Tags',
    requirement: 'Requirement',
    milestone: 'Milestone',
    shape: 'Shape',
    unlock: 'Unlock when',
    rewards: 'Node rewards',
    bulk: 'Selection',
    barrierCondition: 'Barrier condition',
    barrierAffected: 'Affected nodes',
    barrierStyle: 'Barrier style',
    barrierRewards: 'Barrier rewards',
    text: 'Text element',
  }

  const activeTrayIsNode = computed(
    () => !!activeTray.value && NODE_TRAY_IDS.includes(activeTray.value),
  )

  const activeTrayIsBarrier = computed(
    () => !!activeTray.value && BARRIER_TRAY_IDS.includes(activeTray.value),
  )

  const pickModeBarrierId = computed(() =>
    affectedPickMode.value && selectedBarrier.value ? selectedBarrier.value.id : null,
  )

  function toggleTray(id: TrayId) {
    activeTray.value = activeTray.value === id ? null : id
  }

  watch(activeTray, (tray) => {
    if (tray === 'collaborators') void loadCollaborators()
  })

  function closeTray() {
    activeTray.value = null
  }

  watch(selectedIds, () => {
    if (
      selectedIds.value.size === 0 &&
      (activeTrayIsNode.value ||
        activeTrayIsBarrier.value ||
        activeTray.value === 'text' ||
        activeTray.value === 'bulk')
    ) {
      activeTray.value = null
    }
  })

  watch(selectedId, () => {
    affectedPickMode.value = false
  })

  watch(nodeTrays, (list) => {
    if (activeTray.value === 'unlock' && !list.some((t) => t.id === 'unlock')) {
      activeTray.value = null
    }
  })

  return {
    auth,
    setChangeBroadcaster,
    setViewCenterProvider,
    reloadFromRemote: () => guardedLoad(true),
    rewardItemsById,
    campaign,
    loading,
    error,
    actionPending,
    actionError,
    showMapPicker,
    selectedId,
    selectedIdList,
    selectedCount,
    isMultiSelect,
    existingMapDifficultyIds,
    canvasMode,
    itemPickerFor,
    requirementDirtyIds,
    showRepublishWarning,
    publishConfirm,
    performUnpublish,
    isUnsavedDraft,
    isAdminRoute,
    isDraftStatus,
    isAdmin,
    isCurator,
    isCreator,
    canAccess,
    creatorBlocked,
    editable,
    accent,
    nodeAccents,
    selectedDifficulty,
    selectedMeta,
    tagsByKind,
    campaignTagIds,
    statusLabel,
    statusMeaning,
    creatorStatusMeaning,
    formMeta,
    formNode,
    fieldErrors,
    commitMetaField,
    commitBackgroundColor,
    resetBackgroundColor,
    commitNodeField,
    uploadCheckpointAvatar,
    removeCheckpointAvatar,
    toggleTag,
    doPlayerPublish,
    performPublish,
    doPlayerUnpublish,
    deleteDraft,
    isCollaborator,
    activeCollaborators,
    collaboratorsLoading,
    canInviteMore,
    collaboratorLimit,
    showCollaboratorPicker,
    existingCollaboratorIds,
    openCollaboratorPicker,
    handleCollaboratorPicked,
    removeCollaborator,
    leaveCampaign,
    uploadBackground,
    removeBackground,
    uploadIcon,
    removeIcon,
    setPrereqMode,
    doPublish,
    doReopen,
    doCurate,
    doUncurate,
    doDeactivate,
    handleMove,
    handleMoveMany,
    handleConnect,
    handleDisconnect,
    handleEmptyClick,
    openMapPicker,
    handleMapsPicked,
    removeSelectedNode,
    removeSelectedNodes,
    handleSelect,
    handleSelectMany,
    handleToggleSelect,
    handleDeselect,
    openCampaignItemPicker,
    openNodeItemPicker,
    canAddNodeReward,
    nodeRewardLimit,
    handleItemPicked,
    removeCompletionItem,
    removeNodeItem,
    requirementTypeOptions,
    completionModeOptions,
    requirementValueDisplay,
    requirementBounds,
    requirementNumberBounds,
    requirementEquivalents,
    isMilestone,
    setMilestone,
    parseSizeInt,
    defaultColorHex,
    shapeTiles,
    sizeTiles,
    selectNodeSize,
    applyBulkSize,
    applyBulkShape,
    onCompletionModeChange,
    onRequirementTypeChange,
    resetNodeColor,
    selectBorderShape,
    selectNodeLabelPosition,
    closeMapPicker,
    breadcrumbs,
    activeTray,
    campaignTrays,
    nodeTrays,
    trayTitles,
    activeTrayIsNode,
    activeTrayIsBarrier,
    toggleTray,
    closeTray,
    selectedBarrier,
    formBarrier,
    barrierConditionOptions,
    barrierMeta,
    barrierValueDisplay,
    barrierValueBounds,
    onBarrierConditionTypeChange,
    commitBarrierField,
    resetBarrierColor,
    selectBarrierLabelPosition,
    hasConnections,
    hasBarriers,
    canAddBarrier,
    barrierPlacementMode,
    toggleBarrierPlacement,
    placeBarrierOnEdge,
    removeSelectedBarrier,
    canAddBarrierReward,
    openBarrierItemPicker,
    removeBarrierItem,
    affectedPickMode,
    toggleAffectedPickMode,
    toggleAffected,
    pickModeBarrierId,
    selectedText,
    formText,
    commitTextField,
    onTextContentInput,
    textEffects: TEXT_EFFECTS,
    textEffectActive,
    toggleTextEffect,
    addText,
    removeSelectedText,
  }
}
