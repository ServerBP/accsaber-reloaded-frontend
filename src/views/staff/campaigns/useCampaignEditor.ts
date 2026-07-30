import { createCampaign } from '@/api/admin/campaigns'
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
  importCampaignMap,
  movePlayerCampaignElements,
  updateCampaignDifficultyMap,
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
import type { PublicMapDifficultyResponse } from '@/types/api/maps'
import { useItemCatalog } from '@/composables/useItemCatalog'
import { getCurve } from '@/api/curves'
import { useAuthStore } from '@/stores/auth'
import { useCategoryStore } from '@/stores/categories'
import { calculateAp, reverseApToAccuracyByComplexity } from '@/utils/curveEval'
import {
  enumToBsDifficulty,
  fetchBeatSaverMap,
  fetchMapLeaderboardIndex,
} from '@/utils/beatsaver'
import { isCurationSurface } from '@/utils/subdomain'
import type {
  AddCampaignBarrierRequest,
  AddCampaignDifficultyRequest,
  CampaignBackgroundPlacementInput,
  CampaignModifierInput,
  CampaignTextRequest,
  UpdateCampaignBarrierRequest,
  UpdateCampaignDifficultyRequest,
  UpdateCampaignRequest,
} from '@/types/api/admin'
import type {
  CampaignBackgroundPlacement,
  CampaignBarrierResponse,
  CampaignDetailResponse,
  CampaignDifficultyResponse,
  CampaignPrerequisiteResponse,
  CampaignTagResponse,
  CampaignTargetResponse,
  CampaignTextResponse,
  ImportCampaignMapRequest,
} from '@/types/api/campaigns'
import type { CurveResponse } from '@/types/api/categories'
import type {
  BarrierConditionType,
  CampaignBoundClear,
  CampaignModifierRequirement,
  CampaignNodeBorderLayer,
  CampaignRequirementType,
  CampaignStatus,
  CampaignTargetMode,
} from '@/types/enums'
import { useModifierStore } from '@/stores/modifiers'
import {
  barrierConditionMeta,
  CONNECTION_COLOR_RE,
  formatScoreCompact,
  hasValidBounds,
  isMilestoneNode,
  MAX_PREREQUISITES_PER_NODE,
  prereqIds,
  toPrerequisiteInputs,
} from '@/utils/campaignLayout'
import { auditCampaign } from '@/utils/campaignAudit'
import {
  countFractionalVertices,
  isUnreadableCondition,
  isUnreadableRequirement,
  isZeroBound,
} from '@/utils/campaignPlugin'
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
  | 'connection'

const MAX_BARRIERS = 100
const MAX_TEXTS = 100

export type TrayDef = { id: TrayId; label: string; icon: string; count?: number; tone?: string }

export interface CampaignTargetRow {
  key: string
  index: number
  requirementType: CampaignRequirementType
  lower: number | null
  upper: number | null
  bounds: { min: number; max: number; step: number; unit: string }
  numberBounds: { min: number; max: number }
  hasBounds: boolean
  hint: string
  equivalents: Array<{ key: string; text: string }>
  unreadable: boolean
  zeroBound: boolean
  invalid: boolean
}

export function useCampaignEditor() {
  const route = useRoute()
  const router = useRouter()
  const auth = useAuthStore()
  const categoryStore = useCategoryStore()
  const modifierStore = useModifierStore()
  const { itemsById: rewardItemsById, ensureLoaded: ensureRewardItems } = useItemCatalog()

  const campaign = ref<CampaignDetailResponse | null>(null)
  const allTags = ref<CampaignTagResponse[]>([])
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

  const GRID_LOCK_STORAGE_KEY = 'campaign-editor:grid-lock'

  function readGridLock(): boolean {
    try {
      return localStorage.getItem(GRID_LOCK_STORAGE_KEY) !== '0'
    } catch {
      return true
    }
  }

  const gridLock = ref(readGridLock())

  function toggleGridLock() {
    gridLock.value = !gridLock.value
    try {
      localStorage.setItem(GRID_LOCK_STORAGE_KEY, gridLock.value ? '1' : '0')
    } catch {}
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

  const isCurationRoute = isCurationSurface

  const isDraftStatus = computed(() => campaign.value?.status === 'DRAFT')

  const curatable = computed(
    () => campaign.value?.status === 'PUBLISHED' || campaign.value?.status === 'EDITING',
  )

  let suppressNextCampaignIdWatch = false

  function createPlaceholderCampaign(): CampaignDetailResponse {
    return {
      id: '',
      creatorId: auth.userId,
      creatorName: null,
      creatorAlias: null,
      name: '',
      slug: '',
      summary: null,
      description: null,
      status: 'DRAFT',
      official: false,
      progressionAgnostic: false,
      completionMode: 'TERMINAL',
      legacy: false,
      completionXp: 0,
      playlistExportEnabled: true,
      difficultyCount: 0,
      tags: [],
      backgroundUrl: null,
      backgroundColor: null,
      background: null,
      iconUrl: null,
      curatedAt: null,
      curatedBy: null,
      loved: false,
      lovedAt: null,
      lovedBy: null,
      createdAt: new Date().toISOString(),
      totalUpvotes: 0,
      totalDownvotes: 0,
      voteScore: 0,
      totalXp: null,
      totalRewardCount: null,
      rewards: null,
      curatorNotes: null,
      difficulties: [],
      barriers: [],
      texts: [],
      completionItems: [],
    }
  }

  let creatingCampaign: Promise<CampaignDetailResponse | null> | null = null

  async function ensureCampaign(): Promise<CampaignDetailResponse | null> {
    if (campaign.value && campaign.value.id !== '') return campaign.value
    if (creatingCampaign) return creatingCampaign
    creatingCampaign = createCampaignNow()
    try {
      return await creatingCampaign
    } finally {
      creatingCampaign = null
    }
  }

  async function createCampaignNow(): Promise<CampaignDetailResponse | null> {
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
    void modifierStore.fetchModifiers()
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

  const isAdmin = computed(() => auth.hasRole('ADMIN'))

  const isCurator = computed(() => auth.hasRole('CAMPAIGN_CURATOR'))

  const isCreator = computed(() => {
    if (isUnsavedDraft.value && auth.isLoggedIn) return true
    return !!campaign.value?.creatorId && campaign.value.creatorId === auth.userId
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

  const isSavedDraft = computed(
    () => !!campaign.value && !isUnsavedDraft.value && campaign.value.status === 'DRAFT',
  )

  const canAccess = computed(() => {
    if (isCreator.value || isCollaborator.value || isAdmin.value) return true
    return isCurator.value && !isSavedDraft.value
  })

  const CURATOR_EDITABLE_STATUSES = new Set<CampaignStatus>(['EDITING', 'CURATED'])

  const editable = computed(() => {
    if (!campaign.value || actionPending.value) return false
    if (campaign.value.status === 'DRAFT') {
      if (isCreator.value || isCollaborator.value || isAdmin.value) return true
      return isCurator.value && isUnsavedDraft.value
    }
    return isCurator.value && CURATOR_EDITABLE_STATUSES.has(campaign.value.status)
  })

  const editingLiveCampaign = computed(
    () => editable.value && campaign.value?.status === 'CURATED',
  )

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
      if (!d.categoryId) continue
      const code = categoryStore.getCategoryCode(d.categoryId)
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

  const selectedEdge = ref<{ fromId: string; toId: string } | null>(null)

  const selectedEdgePrereq = computed<CampaignPrerequisiteResponse | null>(() => {
    const edge = selectedEdge.value
    if (!edge) return null
    const prereqs = vertexPrereqs(edge.toId)
    return (
      prereqs?.find((p) => p.comesFromCampaignDifficultyId === edge.fromId) ?? null
    )
  })

  const selectedEdgeEndpoints = computed<{ from: string; to: string } | null>(() => {
    const edge = selectedEdge.value
    if (!edge) return null
    return { from: nodeLabel(edge.fromId), to: nodeLabel(edge.toId) }
  })

  const formConnection = ref({ color: '' })
  const connectionColorError = ref<string | null>(null)

  watch(
    selectedEdgePrereq,
    (p) => {
      formConnection.value = { color: p?.color ?? '' }
      connectionColorError.value = null
    },
    { immediate: true },
  )

  watch(campaign, () => {
    if (selectedEdge.value && !selectedEdgePrereq.value) selectedEdge.value = null
  })

  function handleEdgeSelect(payload: { fromId: string; toId: string }) {
    if (!editable.value) return
    barrierPlacementMode.value = false
    affectedPickMode.value = false
    clearSelection()
    selectedEdge.value = payload
    activeTray.value = 'connection'
  }

  function commitConnectionColor() {
    const edge = selectedEdge.value
    const current = selectedEdgePrereq.value
    if (!editable.value || !edge || !current) return
    const value = formConnection.value.color.trim()
    formConnection.value.color = value
    if (!CONNECTION_COLOR_RE.test(value)) {
      connectionColorError.value =
        'Use a hex value (with or without #) or a named color, max 32 characters.'
      return
    }
    connectionColorError.value = null
    if (value === (current.color ?? '')) return
    const prev = vertexPrereqs(edge.toId)
    if (!prev) return
    const next = prev.map((p) =>
      p.comesFromCampaignDifficultyId === edge.fromId ? { ...p, color: value || null } : p,
    )
    void persistPrereqs(edge.toId, next, prev)
  }

  function resetConnectionColor() {
    formConnection.value.color = ''
    commitConnectionColor()
  }

  const hasConnections = computed(() => {
    const c = campaign.value
    if (!c) return false
    return (
      c.difficulties.some((d) => (d.prerequisites?.length ?? 0) > 0) ||
      c.barriers.some((b) => (b.prerequisites?.length ?? 0) > 0)
    )
  })

  const hasBarriers = computed(() => (campaign.value?.barriers.length ?? 0) > 0)

  const canAddBarrier = computed(
    () => editable.value && hasConnections.value && !campaign.value?.progressionAgnostic,
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
    PUBLISHED: 'Visible to players but no XP / items pay out. Waiting on curation.',
    EDITING: 'Reopened for changes. Player progress is preserved while you edit.',
    CURATED: 'Live with payouts. Curator edits apply immediately.',
  }

  const creatorStatusMeaning = computed<string | null>(() => {
    if (!campaign.value) return null
    switch (campaign.value.status) {
      case 'DRAFT':
        return 'Draft, only you can see it. Publish to make it playable.'
      case 'PUBLISHED':
        return 'Live and playable, and in front of the curators. Unpublish to make changes, then publish again.'
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
    }
  }

  watch(campaign, syncFormFromCampaign, { immediate: true })

  const formNode = ref<{
    description: string
    checkpointLabel: string
    checkpointLabelPosition: string
    checkpointAvatarUrl: string
    checkpointColor: string
    checkpointSize: number | null
    nodeBorderLayer: CampaignNodeBorderLayer
    borderColor: string
    borderShape: string
    size: number | null
    xp: number
  }>({
    description: '',
    checkpointLabel: '',
    checkpointLabelPosition: '',
    checkpointAvatarUrl: '',
    checkpointColor: '',
    checkpointSize: null,
    nodeBorderLayer: 'ABOVE',
    borderColor: '',
    borderShape: '',
    size: null,
    xp: 0,
  })

  function syncFormFromNode() {
    const d = selectedDifficulty.value
    if (!d) return
    formNode.value = {
      description: d.description ?? '',
      checkpointLabel: d.checkpointLabel ?? '',
      checkpointLabelPosition: d.checkpointLabelPosition ?? '',
      checkpointAvatarUrl: d.checkpointAvatarUrl ?? '',
      checkpointColor: d.checkpointColor ?? '',
      checkpointSize: d.checkpointSize,
      nodeBorderLayer: d.nodeBorderLayer,
      borderColor: d.borderColor ?? '',
      borderShape: d.borderShape ?? 'hex',
      size: d.size,
      xp: d.xp ?? 0,
    }
  }

  interface TargetDraft {
    key: string
    requirementType: CampaignRequirementType
    requirementValue: number | null
    requirementValueMax: number | null
  }

  const MAX_TARGETS = 8

  const formTargets = ref<TargetDraft[]>([])
  const formTargetMode = ref<CampaignTargetMode>('AND')
  let targetKeySeq = 0

  function toTargetDraft(target: CampaignTargetResponse): TargetDraft {
    return {
      key: `target-${++targetKeySeq}`,
      requirementType: target.requirementType,
      requirementValue: target.requirementValue,
      requirementValueMax: target.requirementValueMax,
    }
  }

  function syncFormFromTargets() {
    const d = selectedDifficulty.value
    if (!d) return
    formTargets.value = d.targets.map(toTargetDraft)
    formTargetMode.value = d.targetMode
  }

  watch(
    selectedDifficulty,
    () => {
      syncFormFromNode()
      syncFormFromTargets()
    },
    { immediate: true },
  )

  const formBarrier = ref<{
    conditionType: BarrierConditionType
    conditionValue: number | null
    conditionValueMax: number | null
    description: string
    checkpointLabel: string
    checkpointLabelPosition: string
    checkpointAvatarUrl: string
    checkpointColor: string
    checkpointSize: number | null
    borderColor: string
    size: number | null
    xp: number
  }>({
    conditionType: 'AVERAGE_ACC',
    conditionValue: 0.9,
    conditionValueMax: null,
    description: '',
    checkpointLabel: '',
    checkpointLabelPosition: '',
    checkpointAvatarUrl: '',
    checkpointColor: '',
    checkpointSize: null,
    borderColor: '',
    size: null,
    xp: 0,
  })

  function syncFormFromBarrier() {
    const b = selectedBarrier.value
    if (!b) return
    formBarrier.value = {
      conditionType: b.conditionType,
      conditionValue: b.conditionValue,
      conditionValueMax: b.conditionValueMax,
      description: b.description ?? '',
      checkpointLabel: b.checkpointLabel ?? '',
      checkpointLabelPosition: b.checkpointLabelPosition ?? '',
      checkpointAvatarUrl: b.checkpointAvatarUrl ?? '',
      checkpointColor: b.checkpointColor ?? '',
      checkpointSize: b.checkpointSize,
      borderColor: b.borderColor ?? '',
      size: b.size,
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
      const updated = await updatePlayerCampaign(c.id, patch)
      if (campaign.value) {
        const merged = { ...campaign.value, ...updated }
        if (patch.background !== undefined) {
          merged.background = Object.keys(patch.background).length > 0
            ? (patch.background as CampaignBackgroundPlacement)
            : null
        }
        campaign.value = merged
      }
    } catch (err) {
      reportPatchError(err, 'Failed to update campaign')
    }
  }

  async function applyNodePatch(id: string, patch: UpdateCampaignDifficultyRequest) {
    try {
      actionError.value = null
      const updated = await updatePlayerCampaignDifficulty(id, patch)
      mergeDifficulty(updated)
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to update node')
    }
  }

  async function applyBarrierPatch(id: string, patch: UpdateCampaignBarrierRequest) {
    try {
      actionError.value = null
      const updated = await updatePlayerCampaignBarrier(id, patch)
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
    if (isBarrierId(id)) return updatePlayerCampaignBarrier(id, patch)
    if (isTextId(id)) {
      if (isPendingText(id)) return Promise.resolve()
      return updatePlayerCampaignText(id, patch)
    }
    return updatePlayerCampaignDifficulty(id, patch)
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
    'borderColor',
  ])

  function commitNodeField(field: keyof UpdateCampaignDifficultyRequest) {
    const d = selectedDifficulty.value
    if (!editable.value || !d) return
    const value = formNode.value[field as keyof typeof formNode.value]
    const original = (d as unknown as Record<string, unknown>)[field]
    if (value === original) return
    if (typeof value === 'string' && original == null && value === '') return
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
    mergeDifficulty(await uploadCampaignCheckpointAvatar(d.id, file))
  }

  async function removeCheckpointAvatar() {
    const d = selectedDifficulty.value
    if (!editable.value || !d) return
    const { deleteCampaignCheckpointAvatar } = await import('@/api/cdn')
    mergeDifficulty(await deleteCampaignCheckpointAvatar(d.id))
  }

  async function uploadNodeBorder(file: File) {
    const d = selectedDifficulty.value
    if (!editable.value || !d) return
    const { uploadCampaignNodeBorder } = await import('@/api/cdn')
    mergeDifficulty(await uploadCampaignNodeBorder(d.id, file))
  }

  async function removeNodeBorder() {
    const d = selectedDifficulty.value
    if (!editable.value || !d) return
    const { deleteCampaignNodeBorder } = await import('@/api/cdn')
    mergeDifficulty(await deleteCampaignNodeBorder(d.id))
  }

  function selectNodeBorderLayer(layer: CampaignNodeBorderLayer) {
    formNode.value.nodeBorderLayer = layer
    commitNodeField('nodeBorderLayer')
  }

  function commitBackgroundPlacement(placement: CampaignBackgroundPlacementInput) {
    if (!editable.value || !campaign.value?.backgroundUrl) return
    void applyCampaignPatch({ background: placement })
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
    doToggleLoved,
    doToggleOfficial,
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
  })

  function wouldCreateCycle(fromId: string, toId: string): boolean {
    if (fromId === toId) return true
    const c = campaign.value
    if (!c) return false
    const successors = new Map<string, string[]>()
    const addEdges = (id: string, prereqs: CampaignPrerequisiteResponse[] | undefined) => {
      for (const pid of prereqIds(prereqs)) {
        const list = successors.get(pid) ?? []
        list.push(id)
        successors.set(pid, list)
      }
    }
    for (const d of c.difficulties) addEdges(d.id, d.prerequisites)
    for (const b of c.barriers) addEdges(b.id, b.prerequisites)
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

  function vertexPrereqs(id: string): CampaignPrerequisiteResponse[] | null {
    const b = barrierById.value.get(id)
    if (b) return b.prerequisites ?? []
    const d = campaign.value?.difficulties.find((x) => x.id === id)
    return d ? (d.prerequisites ?? []) : null
  }

  function setPrereqMode(mode: 'AND' | 'OR') {
    const d = selectedDifficulty.value
    if (!editable.value || !d) return
    if (d.prerequisiteMode === mode) return
    void applyNodePatch(d.id, { prerequisiteMode: mode })
  }

  const OCCUPIED_CELL_STATUSES = new Set([409, 422])

  function reportMoveError(err: unknown, fallback: string) {
    if (err instanceof ApiError && OCCUPIED_CELL_STATUSES.has(err.status)) {
      actionError.value =
        'Something is already there. Drop it on an empty spot, or turn the grid lock off to place freely.'
      return
    }
    actionError.value = getApiErrorMessage(err, fallback)
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
      reportMoveError(err, 'Failed to move node')
      setVertexPositionLocal(payload.id, prev.x, prev.y)
    }
  }

  function setPrereqsLocal(toId: string, entries: CampaignPrerequisiteResponse[]) {
    if (!campaign.value) return
    if (isBarrierId(toId)) {
      campaign.value = {
        ...campaign.value,
        barriers: campaign.value.barriers.map((b) =>
          b.id === toId ? { ...b, prerequisites: entries } : b,
        ),
      }
    } else {
      campaign.value = {
        ...campaign.value,
        difficulties: campaign.value.difficulties.map((d) =>
          d.id === toId ? { ...d, prerequisites: entries } : d,
        ),
      }
    }
  }

  async function persistPrereqs(
    toId: string,
    next: CampaignPrerequisiteResponse[],
    prev: CampaignPrerequisiteResponse[],
  ) {
    if (!campaign.value) return
    const barrier = isBarrierId(toId)
    setPrereqsLocal(toId, next)
    try {
      actionError.value = null
      const payload = { prerequisites: toPrerequisiteInputs(next) }
      if (barrier) {
        const updated = await updatePlayerCampaignBarrier(toId, payload)
        if (campaign.value) {
          campaign.value = {
            ...campaign.value,
            barriers: campaign.value.barriers.map((b) => (b.id === toId ? updated : b)),
          }
        }
      } else {
        const updated = await updatePlayerCampaignDifficulty(toId, payload)
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
    if (prev.some((p) => p.comesFromCampaignDifficultyId === payload.fromId)) return
    if (prev.length >= MAX_PREREQUISITES_PER_NODE) {
      actionError.value = `"${nodeLabel(payload.toId)}" already has the maximum of ${MAX_PREREQUISITES_PER_NODE} incoming connections.`
      return
    }
    if (wouldCreateCycle(payload.fromId, payload.toId)) {
      actionError.value = `Can't connect "${nodeLabel(payload.fromId)}" → "${nodeLabel(payload.toId)}". The reverse path already exists, which would create a cycle.`
      return
    }
    await persistPrereqs(
      payload.toId,
      [...prev, { comesFromCampaignDifficultyId: payload.fromId, color: null }],
      prev,
    )
  }

  async function handleDisconnect(payload: { fromId: string; toId: string }) {
    const prev = vertexPrereqs(payload.toId)
    if (prev == null) return
    if (!prev.some((p) => p.comesFromCampaignDifficultyId === payload.fromId)) return
    if (
      selectedEdge.value?.fromId === payload.fromId &&
      selectedEdge.value?.toId === payload.toId
    ) {
      selectedEdge.value = null
    }
    await persistPrereqs(
      payload.toId,
      prev.filter((p) => p.comesFromCampaignDifficultyId !== payload.fromId),
      prev,
    )
  }

  function handleEmptyClick() {
    barrierPlacementMode.value = false
    selectedEdge.value = null
    clearSelection()
  }

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

  async function addNodesForDifficultyIds(
    mapDifficultyIds: string[],
    opts: { keepOpen?: boolean } = {},
  ): Promise<string[]> {
    if (mapDifficultyIds.length === 0) return []
    actionPending.value = true
    actionError.value = null
    try {
      let c = campaign.value
      if (!c || c.id === '') {
        c = await ensureCampaign()
        if (!c) return []
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
        const created = await addPlayerCampaignDifficulty(c.id, req)
        createdIds.push(created.id)
      }
      if (!opts.keepOpen) {
        if (createdIds.length === 1) {
          selectOnly(createdIds[0])
          activeTray.value = 'requirement'
        } else if (createdIds.length > 1) {
          setSelection(createdIds)
          activeTray.value = 'bulk'
        }
        showMapPicker.value = false
      }
      await load(true)
      return createdIds
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to add nodes')
      return []
    } finally {
      actionPending.value = false
    }
  }

  async function handleMapsPicked(picked: PublicMapDifficultyResponse[]) {
    await addNodesForDifficultyIds(picked.map((d) => d.id))
  }

  async function submitGlobalAdd(
    ids: ImportCampaignMapRequest,
  ): Promise<{ attached: boolean }> {
    const result = await importCampaignMap(ids)
    await addNodesForDifficultyIds([result.id], { keepOpen: true })
    return { attached: result.status !== 'CAMPAIGN' }
  }

  const showRepoint = ref(false)
  const repointNodeId = ref<string | null>(null)

  function openRepoint(nodeId: string) {
    if (!editable.value) return
    repointNodeId.value = nodeId
    showRepoint.value = true
  }

  function closeRepoint() {
    showRepoint.value = false
    repointNodeId.value = null
  }

  async function submitRepoint(
    ids: ImportCampaignMapRequest,
  ): Promise<{ attached: boolean }> {
    const nodeId = repointNodeId.value
    if (!nodeId) throw new Error('No node selected to repoint')
    actionPending.value = true
    actionError.value = null
    try {
      await updateCampaignDifficultyMap(nodeId, ids)
      await load(true)
      closeRepoint()
      return { attached: false }
    } finally {
      actionPending.value = false
    }
  }

  function nodeApRankBlocked(d: CampaignDifficultyResponse): boolean {
    if (d.status != null) return d.status !== 'RANKED'
    return d.categoryId == null
  }

  const selectedNodeApRankBlocked = computed(
    () => selectedDifficulty.value != null && nodeApRankBlocked(selectedDifficulty.value),
  )

  const apRankBlockedNodeIds = computed(() => {
    const ids = new Set<string>()
    for (const d of campaign.value?.difficulties ?? []) {
      if (nodeApRankBlocked(d)) ids.add(d.id)
    }
    return ids
  })

  const usedMapDifficultyIds = computed(() =>
    (campaign.value?.difficulties ?? []).map((d) => d.mapDifficultyId),
  )

  const unrankedNodes = computed(() =>
    (campaign.value?.difficulties ?? [])
      .filter((d) => nodeApRankBlocked(d))
      .map((d) => ({ id: d.id, songName: d.songName })),
  )

  async function refreshNodeVersion() {
    const d = selectedDifficulty.value
    if (!editable.value || !d) return
    if (!d.beatsaverCode) {
      actionError.value = 'This node has no BeatSaver code to refresh from.'
      return
    }
    if (
      !window.confirm(
        `Refresh "${d.songName}" to the latest BeatSaver version? This repoints the node at the newest BeatLeader and ScoreSaber leaderboard IDs for this difficulty.`,
      )
    ) {
      return
    }
    actionPending.value = true
    actionError.value = null
    try {
      const map = await fetchBeatSaverMap(d.beatsaverCode)
      const hash = map.versions[0]?.hash
      if (!hash) throw new Error('Could not resolve the latest version from BeatSaver.')
      const index = await fetchMapLeaderboardIndex(hash)
      const key = `${enumToBsDifficulty(d.difficulty)}-${d.characteristic}`
      const bl = index.bl.get(key) ?? null
      const ssRaw = index.ss.get(key)
      const ss = ssRaw != null ? String(ssRaw) : null
      if (!bl || !ss) {
        actionError.value =
          'The latest version has no BeatLeader or ScoreSaber leaderboard for this difficulty.'
        return
      }
      const ids: ImportCampaignMapRequest = { blLeaderboardId: bl, ssLeaderboardId: ss }
      await updateCampaignDifficultyMap(d.id, ids)
      await load(true)
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to refresh version')
    } finally {
      actionPending.value = false
    }
  }

  const GENRE_SLUG_OVERRIDES: Record<string, string> = {
    'r&b': 'rnb',
    'video game': 'video-game',
  }

  function toBeatsaverGenreSlug(name: string): string {
    const key = name.toLowerCase()
    if (GENRE_SLUG_OVERRIDES[key]) return GENRE_SLUG_OVERRIDES[key]
    return key
      .replace(/&/g, ' ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const campaignGenreBeatsaverSlugs = computed(() =>
    (campaign.value?.tags ?? [])
      .filter((t) => t.kind === 'GENRE')
      .map((t) => toBeatsaverGenreSlug(t.name))
      .filter(Boolean),
  )

  async function removeSelectedNode() {
    const d = selectedDifficulty.value
    if (!editable.value || !d || !campaign.value) return
    if (!window.confirm(`Remove "${d.songName}" from this campaign?`)) return
    actionPending.value = true
    actionError.value = null
    try {
      await deletePlayerCampaignDifficulty(campaign.value.id, d.id)
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
    const persisted = moves.filter((m) => !isPendingText(m.id))
    if (persisted.length === 0) return
    try {
      actionError.value = null
      await movePlayerCampaignElements(campaign.value.id, persisted)
    } catch (err) {
      reportMoveError(err, 'Failed to move nodes')
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
      if ((d?.prerequisites ?? []).length >= 2) return current
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
    selectedEdge.value = null
    selectOnly(id)
    activeTray.value = trayForSelection(id)
  }

  function handleToggleSelect(id: string) {
    selectedEdge.value = null
    toggleInSelection(id)
    if (selectedIds.value.size >= 2) activeTray.value = 'bulk'
    else if (selectedIds.value.size === 1) activeTray.value = vertexTrayFor(selectedId.value)
  }

  function handleSelectMany(ids: string[]) {
    selectedEdge.value = null
    setSelection(ids)
    if (selectedIds.value.size >= 2) activeTray.value = 'bulk'
    else if (selectedIds.value.size === 1) activeTray.value = vertexTrayFor(selectedId.value)
  }

  function handleDeselect() {
    if (showMapPicker.value) return
    selectedEdge.value = null
    clearSelection()
  }

  const requirementTypeOptions: Array<{ value: CampaignRequirementType; label: string }> = [
    { value: 'ACC', label: 'Accuracy' },
    { value: 'AP', label: 'AP' },
    { value: 'SCORE', label: 'Score' },
    { value: 'STREAK_115', label: '115 Streak' },
    { value: 'COMBO', label: 'Max combo' },
    { value: 'BOMB_HITS', label: 'Bombs hit' },
    { value: 'FC', label: 'Full Combo' },
    { value: 'PASS', label: 'Pass (no No-Fail)' },
    { value: 'RANK', label: 'Leaderboard rank' },
  ]

  const completionModeOptions: Array<{ value: 'TERMINAL' | 'ALL'; label: string }> = [
    { value: 'TERMINAL', label: 'Reach the end (single sink)' },
    { value: 'ALL', label: 'Clear every node' },
  ]

  const scoreCap = computed(() => {
    const maxScore = selectedDifficulty.value?.maxScore
    return maxScore && maxScore > 0 ? maxScore : 1_500_000
  })

  const comboCap = computed(() => {
    const maxCombo = selectedDifficulty.value?.maxCombo
    return maxCombo && maxCombo > 0 ? maxCombo : 2000
  })

  type RequirementMetric = 'acc' | 'ap' | 'score' | 'streak' | 'rank' | 'flag' | 'combo' | 'bombs'

  const REQUIREMENT_METRIC: Record<CampaignRequirementType, RequirementMetric> = {
    ACC: 'acc',
    AP: 'ap',
    SCORE: 'score',
    STREAK_115: 'streak',
    RANK: 'rank',
    FC: 'flag',
    PASS: 'flag',
    COMBO: 'combo',
    BOMB_HITS: 'bombs',
  }

  function requirementBoundsFor(metric: RequirementMetric) {
    switch (metric) {
      case 'acc':
        return { min: 70, max: 100, step: 0.1, unit: '%' }
      case 'ap':
        return { min: 400, max: 1200, step: 1, unit: 'AP' }
      case 'streak':
        return { min: 0, max: 30, step: 1, unit: '' }
      case 'rank':
        return { min: 1, max: 500, step: 1, unit: 'rank' }
      case 'combo':
        return { min: 0, max: comboCap.value, step: 1, unit: 'combo' }
      case 'bombs':
        return { min: 0, max: 20, step: 1, unit: 'bombs' }
      case 'flag':
        return { min: 1, max: 1, step: 1, unit: '' }
      default:
        return { min: 0, max: scoreCap.value, step: 1000, unit: '' }
    }
  }

  function requirementNumberBoundsFor(
    metric: RequirementMetric,
    bounds: { min: number; max: number },
  ) {
    if (metric === 'ap') return { min: 0, max: Number.MAX_SAFE_INTEGER }
    if (metric === 'rank') return { min: 1, max: Number.MAX_SAFE_INTEGER }
    if (metric === 'bombs') return { min: 0, max: Number.MAX_SAFE_INTEGER }
    return { min: bounds.min, max: bounds.max }
  }

  function defaultRequirementValue(metric: RequirementMetric): number {
    switch (metric) {
      case 'acc':
        return 0.95
      case 'ap':
        return 500
      case 'streak':
        return 8
      case 'rank':
        return 50
      case 'combo':
        return Math.round(comboCap.value * 0.8)
      case 'bombs':
        return 0
      case 'flag':
        return 1
      default:
        return Math.round(scoreCap.value * 0.9)
    }
  }

  function toDisplayValue(metric: string, raw: number | null): number | null {
    if (raw == null) return null
    return metric === 'acc' ? Number((raw * 100).toFixed(2)) : raw
  }

  function fromDisplayValue(metric: string, display: number | null): number | null {
    if (display == null) return null
    return metric === 'acc' ? display / 100 : display
  }

  interface BoundsDiff {
    value?: number
    valueMax?: number
    clear?: CampaignBoundClear[]
  }

  function diffBounds(
    nextValue: number | null,
    nextMax: number | null,
    currentValue: number | null,
    currentMax: number | null,
  ): BoundsDiff | null {
    const diff: BoundsDiff = {}
    const clear: CampaignBoundClear[] = []
    if (nextValue == null) {
      if (currentValue != null) clear.push('VALUE')
    } else if (nextValue !== currentValue) {
      diff.value = nextValue
    }
    if (nextMax == null) {
      if (currentMax != null) clear.push('VALUE_MAX')
    } else if (nextMax !== currentMax) {
      diff.valueMax = nextMax
    }
    if (clear.length > 0) diff.clear = clear
    return Object.keys(diff).length > 0 ? diff : null
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
    () => selectedDifficulty.value?.categoryId,
    (categoryId) => void ensureScoreCurve(scoreCurveIdFor(categoryId)),
    { immediate: true },
  )

  function requirementEquivalentsFor(target: TargetDraft): Array<{ key: string; text: string }> {
    const type = target.requirementType
    if (type !== 'ACC' && type !== 'AP' && type !== 'SCORE') return []
    const d = selectedDifficulty.value
    if (!d) return []
    const complexity = d.complexity
    const maxScore = d.maxScore
    const curveId = scoreCurveIdFor(d.categoryId)
    const curve = curveId ? (scoreCurves.value.get(curveId) ?? null) : null
    const raw = target.requirementValue
    if (raw == null) return []

    let acc: number | null = null
    let ap: number | null = null
    let score: number | null = null

    if (type === 'ACC') {
      acc = raw
    } else if (type === 'SCORE') {
      score = raw
      if (maxScore != null && maxScore > 0) acc = raw / maxScore
    } else {
      ap = raw
      if (curve && complexity != null) acc = reverseApToAccuracyByComplexity(curve, raw, complexity)
    }

    if (acc != null && Number.isFinite(acc)) {
      if (score == null && maxScore != null && maxScore > 0) score = acc * maxScore
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
  }

  const DEFAULT_MILESTONE_LABEL = 'Milestone'

  const isMilestone = ref(false)

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
      isMilestone.value = isMilestoneNode(d)
    },
    { immediate: true },
  )

  watch(
    () => formNode.value.checkpointLabel,
    (label) => {
      if (label.trim()) isMilestone.value = true
    },
  )

  function setMilestone(value: boolean) {
    isMilestone.value = value
    const d = selectedDifficulty.value
    if (value) {
      if (formNode.value.checkpointLabel.trim()) return
      formNode.value.checkpointLabel = DEFAULT_MILESTONE_LABEL
      if (d) void applyNodePatch(d.id, { checkpointLabel: DEFAULT_MILESTONE_LABEL })
      return
    }
    formNode.value.checkpointLabel = ''
    if (d) void applyNodePatch(d.id, { checkpointLabel: '' })
  }

  function commitMilestoneLabel() {
    const label = formNode.value.checkpointLabel.trim()
    formNode.value.checkpointLabel = label || DEFAULT_MILESTONE_LABEL
    commitNodeField('checkpointLabel')
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

  const modifierOptions = computed(() =>
    [...modifierStore.modifiers].sort((a, b) => a.name.localeCompare(b.name)),
  )

  const nodeModifierById = computed(() => {
    const map = new Map<string, CampaignModifierRequirement>()
    for (const m of selectedDifficulty.value?.modifiers ?? []) map.set(m.modifier.id, m.requirement)
    return map
  })

  const NEXT_MODIFIER_REQUIREMENT: Record<string, CampaignModifierRequirement | null> = {
    unset: 'REQUIRED',
    REQUIRED: 'FORBIDDEN',
    FORBIDDEN: null,
  }

  function cycleNodeModifier(modifierId: string) {
    const d = selectedDifficulty.value
    if (!editable.value || !d) return
    const next = NEXT_MODIFIER_REQUIREMENT[nodeModifierById.value.get(modifierId) ?? 'unset']
    const modifiers: CampaignModifierInput[] = d.modifiers
      .filter((m) => m.modifier.id !== modifierId)
      .map((m) => ({ modifierId: m.modifier.id, requirement: m.requirement }))
    if (next) modifiers.push({ modifierId, requirement: next })
    requirementDirtyIds.value.add(d.id)
    void applyNodePatch(d.id, { modifiers })
  }

  const DEFAULT_REQUIREMENT_MAX: Partial<Record<RequirementMetric, number>> = { bombs: 3 }

  function newTargetDraft(type: CampaignRequirementType): TargetDraft {
    const metric = REQUIREMENT_METRIC[type]
    return {
      key: `target-${++targetKeySeq}`,
      requirementType: type,
      requirementValue: defaultRequirementValue(metric),
      requirementValueMax: DEFAULT_REQUIREMENT_MAX[metric] ?? null,
    }
  }

  function targetHasValidBounds(target: TargetDraft): boolean {
    if (REQUIREMENT_METRIC[target.requirementType] === 'flag') return true
    return hasValidBounds(target.requirementValue, target.requirementValueMax)
  }

  function commitTargets() {
    const d = selectedDifficulty.value
    if (!editable.value || !d) return
    if (!formTargets.value.every(targetHasValidBounds)) return
    requirementDirtyIds.value.add(d.id)
    void applyNodePatch(d.id, {
      targetMode: formTargetMode.value,
      targets: formTargets.value.map((t) => ({
        requirementType: t.requirementType,
        requirementValue: t.requirementValue,
        requirementValueMax: t.requirementValueMax,
      })),
    })
  }

  const canAddTarget = computed(
    () => editable.value && formTargets.value.length < MAX_TARGETS,
  )

  function addTarget() {
    if (!canAddTarget.value) return
    formTargets.value = [...formTargets.value, newTargetDraft('ACC')]
    commitTargets()
  }

  function removeTarget(index: number) {
    if (!editable.value || formTargets.value.length <= 1) return
    formTargets.value = formTargets.value.filter((_, i) => i !== index)
    commitTargets()
  }

  function reorderTargets(from: number, to: number): boolean {
    if (!editable.value || from === to) return false
    if (to < 0 || to >= formTargets.value.length) return false
    const next = [...formTargets.value]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    formTargets.value = next
    return true
  }

  function moveTarget(from: number, to: number) {
    if (reorderTargets(from, to)) commitTargets()
  }

  function setTargetMode(mode: CampaignTargetMode) {
    if (!editable.value || formTargetMode.value === mode) return
    formTargetMode.value = mode
    commitTargets()
  }

  function setTargetType(index: number, value: string) {
    const target = formTargets.value[index]
    const next = value as CampaignRequirementType
    if (!target || target.requirementType === next) return
    const metric = REQUIREMENT_METRIC[next]
    target.requirementType = next
    target.requirementValue = defaultRequirementValue(metric)
    target.requirementValueMax = DEFAULT_REQUIREMENT_MAX[metric] ?? null
    commitTargets()
  }

  function setTargetBound(
    index: number,
    field: 'requirementValue' | 'requirementValueMax',
    display: number | null,
  ) {
    const target = formTargets.value[index]
    if (!target) return
    target[field] = fromDisplayValue(REQUIREMENT_METRIC[target.requirementType], display)
  }

  function requirementTypeHint(type: CampaignRequirementType): string {
    switch (type) {
      case 'RANK':
        return "Lower is better. Cleared when the player's leaderboard rank on the map is this position or better."
      case 'PASS':
        return 'Cleared by any legitimate pass - a completion without the No-Fail modifier.'
      case 'COMBO':
        return `An absolute note count, not a percentage. This map tops out at ${comboCap.value}.`
      default:
        return ''
    }
  }

  const targetRows = computed<CampaignTargetRow[]>(() =>
    formTargets.value.map((t, index) => {
      const metric = REQUIREMENT_METRIC[t.requirementType]
      const bounds = requirementBoundsFor(metric)
      return {
        key: t.key,
        index,
        requirementType: t.requirementType,
        lower: toDisplayValue(metric, t.requirementValue),
        upper: toDisplayValue(metric, t.requirementValueMax),
        bounds,
        numberBounds: requirementNumberBoundsFor(metric, bounds),
        hasBounds: metric !== 'flag',
        hint: requirementTypeHint(t.requirementType),
        equivalents: requirementEquivalentsFor(t),
        unreadable: isUnreadableRequirement(t.requirementType),
        zeroBound: isZeroBound(t.requirementValue, t.requirementValueMax),
        invalid: !targetHasValidBounds(t),
      }
    }),
  )

  const targetsUnreadable = computed(() => targetRows.value.some((r) => r.unreadable))

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
    formNode.value.size = value
    commitNodeField('size')
  }

  async function applyBulkSize(value: number) {
    if (!editable.value) return
    for (const id of selectedIdList.value) {
      if (isBarrierId(id)) await applyBarrierPatch(id, { size: value })
      else await applyNodePatch(id, { size: value })
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
          await deletePlayerCampaignBarrier(campaign.value.id, id)
        } else if (isTextId(id)) {
          if (isPendingText(id)) {
            pendingTextIds.delete(id)
            cancelledTextIds.add(id)
          } else {
            await deletePlayerCampaignText(campaign.value.id, id)
          }
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
    const replacedEdge = targetPrereqs.find(
      (p) => p.comesFromCampaignDifficultyId === payload.fromId,
    )
    const edgeColor = replacedEdge?.color ?? null
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
        prerequisites: [
          {
            comesFromCampaignDifficultyId: payload.fromId,
            ...(edgeColor ? { color: edgeColor } : {}),
          },
        ],
        affectedCampaignDifficultyIds: [payload.fromId],
      }
      const created = await addPlayerCampaignBarrier(c.id, req)
      const nextPrereqs = targetPrereqs
        .filter((p) => p.comesFromCampaignDifficultyId !== payload.fromId)
        .concat({ comesFromCampaignDifficultyId: created.id, color: edgeColor })
      const rewire = { prerequisites: toPrerequisiteInputs(nextPrereqs) }
      if (isBarrierId(payload.toId)) {
        await updatePlayerCampaignBarrier(payload.toId, rewire)
      } else {
        await updatePlayerCampaignDifficulty(payload.toId, rewire)
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
    'borderColor',
  ])

  function commitBarrierField(field: keyof UpdateCampaignBarrierRequest) {
    const b = selectedBarrier.value
    if (!editable.value || !b) return
    const value = formBarrier.value[field as keyof typeof formBarrier.value]
    const original = (b as unknown as Record<string, unknown>)[field]
    if (value === original) return
    if (typeof value === 'string' && original == null && value === '') return
    if (field === 'conditionType') requirementDirtyIds.value.add(b.id)
    const send = value === '' && !BARRIER_CLEARABLE_TEXT.has(field) ? null : value
    void applyBarrierPatch(b.id, { [field]: send } as UpdateCampaignBarrierRequest)
  }

  function commitBarrierBounds() {
    const b = selectedBarrier.value
    if (!editable.value || !b) return
    if (
      !barrierMeta.value.noValue &&
      !hasValidBounds(formBarrier.value.conditionValue, formBarrier.value.conditionValueMax)
    ) {
      return
    }
    const diff = diffBounds(
      formBarrier.value.conditionValue,
      formBarrier.value.conditionValueMax,
      b.conditionValue,
      b.conditionValueMax,
    )
    if (!diff) return
    requirementDirtyIds.value.add(b.id)
    void applyBarrierPatch(b.id, {
      conditionValue: diff.value,
      conditionValueMax: diff.valueMax,
      clear: diff.clear,
    })
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
    { value: 'AVERAGE_COMBO', label: 'Average combo' },
    { value: 'AVERAGE_BOMB_HITS', label: 'Average bombs hit' },
    { value: 'AVERAGE_RANK', label: 'Average rank' },
    { value: 'MAX_RANK', label: 'Best rank' },
    { value: 'FC', label: 'Full combo (all)' },
    { value: 'PASS', label: 'Pass all (no No-Fail)' },
    { value: 'COMPLETION_COUNT', label: 'Maps completed' },
  ]

  const barrierMeta = computed(() => barrierConditionMeta(formBarrier.value.conditionType))

  const barrierUnreadable = computed(() => isUnreadableCondition(formBarrier.value.conditionType))

  const barrierZeroBound = computed(() =>
    isZeroBound(formBarrier.value.conditionValue, formBarrier.value.conditionValueMax),
  )

  const fractionalVertexCount = computed(() => countFractionalVertices(campaign.value))

  const campaignAudit = computed(() => auditCampaign(campaign.value))

  const barrierAffectedCount = computed(
    () => selectedBarrier.value?.affectedCampaignDifficultyIds.length ?? 0,
  )

  const barrierCountMax = computed(() => Math.max(1, barrierAffectedCount.value))

  const barrierLowerDisplay = computed(() =>
    toDisplayValue(barrierMeta.value.metric, formBarrier.value.conditionValue),
  )

  const barrierUpperDisplay = computed(() =>
    toDisplayValue(barrierMeta.value.metric, formBarrier.value.conditionValueMax),
  )

  function setBarrierBound(field: 'conditionValue' | 'conditionValueMax', display: number | null) {
    formBarrier.value[field] = fromDisplayValue(barrierMeta.value.metric, display)
  }

  const barrierValueBounds = computed(() => {
    switch (barrierMeta.value.metric) {
      case 'acc':
        return { min: 70, max: 100, step: 0.1, unit: '%' }
      case 'ap':
        return { min: 0, max: 1200, step: 1, unit: 'AP' }
      case 'streak':
        return { min: 0, max: 30, step: 1, unit: '' }
      case 'rank':
        return { min: 1, max: 500, step: 1, unit: 'rank' }
      case 'count':
        return { min: 1, max: barrierCountMax.value, step: 1, unit: 'maps' }
      case 'combo':
        return { min: 0, max: 2000, step: 1, unit: 'combo' }
      case 'bombs':
        return { min: 0, max: 20, step: 1, unit: 'bombs' }
      default:
        return { min: 0, max: 1, step: 1, unit: '' }
    }
  })

  function defaultBarrierValue(metric: string): number {
    switch (metric) {
      case 'acc':
        return 0.9
      case 'ap':
        return 500
      case 'streak':
        return 8
      case 'rank':
        return 50
      case 'count':
        return barrierCountMax.value
      case 'combo':
        return 500
      default:
        return 0
    }
  }

  const DEFAULT_BARRIER_MAX: Record<string, number> = { bombs: 3 }

  function onBarrierConditionTypeChange(value: string) {
    const next = value as BarrierConditionType
    const prevMetric = barrierMeta.value.metric
    formBarrier.value.conditionType = next
    const nextMeta = barrierConditionMeta(next)
    const b = selectedBarrier.value
    if (nextMeta.noValue) {
      formBarrier.value.conditionValue = null
      if (editable.value && b) {
        requirementDirtyIds.value.add(b.id)
        void applyBarrierPatch(b.id, { conditionType: next, conditionValue: null })
        return
      }
    } else if (prevMetric !== nextMeta.metric) {
      const nextValue = defaultBarrierValue(nextMeta.metric)
      const nextMax = DEFAULT_BARRIER_MAX[nextMeta.metric] ?? null
      formBarrier.value.conditionValue = nextValue
      formBarrier.value.conditionValueMax = nextMax
      if (editable.value && b) {
        requirementDirtyIds.value.add(b.id)
        void applyBarrierPatch(b.id, {
          conditionType: next,
          conditionValue: nextValue,
          conditionValueMax: nextMax ?? undefined,
          clear: nextMax == null && b.conditionValueMax != null ? ['VALUE_MAX'] : undefined,
        })
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
    const patch: UpdateCampaignBarrierRequest = { affectedCampaignDifficultyIds: next }
    if (
      b.conditionType === 'COMPLETION_COUNT' &&
      next.length > 0 &&
      (b.conditionValue ?? 1) > next.length
    ) {
      patch.conditionValue = next.length
      formBarrier.value.conditionValue = next.length
      requirementDirtyIds.value.add(b.id)
    }
    if (campaign.value) {
      campaign.value = {
        ...campaign.value,
        barriers: campaign.value.barriers.map((row) =>
          row.id === b.id
            ? {
                ...row,
                affectedCampaignDifficultyIds: next,
                conditionValue: patch.conditionValue ?? row.conditionValue,
              }
            : row,
        ),
      }
    }
    void applyBarrierPatch(b.id, patch)
  }

  function setBarrierPrereqMode(mode: 'AND' | 'OR') {
    const b = selectedBarrier.value
    if (!editable.value || !b) return
    if (b.prerequisiteMode === mode) return
    void applyBarrierPatch(b.id, { prerequisiteMode: mode })
  }

  async function removeSelectedBarrier() {
    const b = selectedBarrier.value
    if (!editable.value || !b || !campaign.value) return
    if (!window.confirm('Remove this barrier from the roadmap?')) return
    actionPending.value = true
    actionError.value = null
    try {
      await deletePlayerCampaignBarrier(campaign.value.id, b.id)
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
      const updated = await updatePlayerCampaignText(id, req)
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
    const request = addPlayerCampaignText(c.id, req)
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
          await deletePlayerCampaignText(campaignId, created.id)
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
      await deletePlayerCampaignText(campaign.value.id, t.id)
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
    if (selectedEdge.value) {
      return [{ id: 'connection', label: 'Style', icon: 'link' }]
    }
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
    if ((d.prerequisites ?? []).length >= 2) {
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
    connection: 'Connection',
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

  watch(selectedEdge, (edge) => {
    if (!edge && activeTray.value === 'connection') {
      activeTray.value = null
    }
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
    canvasMode,
    gridLock,
    toggleGridLock,
    itemPickerFor,
    requirementDirtyIds,
    showRepublishWarning,
    publishConfirm,
    performUnpublish,
    isUnsavedDraft,
    isCurationRoute,
    isDraftStatus,
    curatable,
    isAdmin,
    isCurator,
    isCreator,
    canAccess,
    editable,
    editingLiveCampaign,
    accent,
    nodeAccents,
    selectedDifficulty,
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
    uploadNodeBorder,
    removeNodeBorder,
    selectNodeBorderLayer,
    commitBackgroundPlacement,
    modifierOptions,
    nodeModifierById,
    cycleNodeModifier,
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
    doToggleLoved,
    doToggleOfficial,
    doDeactivate,
    handleMove,
    handleMoveMany,
    handleConnect,
    handleDisconnect,
    handleEmptyClick,
    selectedEdge,
    selectedEdgeEndpoints,
    formConnection,
    connectionColorError,
    handleEdgeSelect,
    commitConnectionColor,
    resetConnectionColor,
    openMapPicker,
    handleMapsPicked,
    submitGlobalAdd,
    campaignGenreBeatsaverSlugs,
    selectedNodeApRankBlocked,
    apRankBlockedNodeIds,
    usedMapDifficultyIds,
    unrankedNodes,
    showRepoint,
    openRepoint,
    closeRepoint,
    submitRepoint,
    refreshNodeVersion,
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
    targetRows,
    targetsUnreadable,
    formTargetMode,
    canAddTarget,
    addTarget,
    removeTarget,
    moveTarget,
    setTargetMode,
    setTargetType,
    setTargetBound,
    reorderTargets,
    commitTargets,
    barrierUnreadable,
    barrierZeroBound,
    fractionalVertexCount,
    campaignAudit,
    isMilestone,
    setMilestone,
    commitMilestoneLabel,
    defaultColorHex,
    shapeTiles,
    sizeTiles,
    selectNodeSize,
    applyBulkSize,
    applyBulkShape,
    onCompletionModeChange,
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
    barrierLowerDisplay,
    barrierUpperDisplay,
    setBarrierBound,
    commitBarrierBounds,
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
    setBarrierPrereqMode,
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
