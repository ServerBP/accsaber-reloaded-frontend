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
import type { Crumb } from '@/components/common/Breadcrumbs.vue'
import { useItemCatalog } from '@/composables/useItemCatalog'
import { getCurve } from '@/api/curves'
import { useAuthStore } from '@/stores/auth'
import { useCategoryStore } from '@/stores/categories'
import { calculateAp, reverseApToAccuracyByComplexity } from '@/utils/curveEval'
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
import type { CurveResponse } from '@/types/api/categories'
import type { PublicMapDifficultyResponse } from '@/types/api/maps'
import type { CampaignRequirementType } from '@/types/enums'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export type TrayId =
  | 'status'
  | 'identity'
  | 'settings'
  | 'images'
  | 'completion'
  | 'tags'
  | 'requirement'
  | 'milestone'
  | 'shape'
  | 'unlock'
  | 'rewards'
  | 'bulk'

export type TrayDef = { id: TrayId; label: string; icon: string; count?: number; tone?: string }

export function useCampaignEditor() {
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
  const actionNotice = ref<string | null>(null)
  const showMapPicker = ref(false)
  const selectedIds = ref<Set<string>>(new Set())
  const canvasMode = ref<'drag' | 'connect' | 'select'>('drag')
  const itemPickerFor = ref<'campaign' | 'node' | null>(null)
  const requirementDirtyIds = ref(new Set<string>())
  const editedLiveCampaign = ref(false)
  const showRepublishWarning = ref(false)

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
      if (selectedIds.value.size === 0 && c.difficulties.length > 0) {
        selectOnly(c.difficulties[0].id)
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
        } catch {}
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
    clearSelection()
    void load()
  })

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
    if (
      isCurator.value &&
      (campaign.value.status === 'DRAFT' || campaign.value.status === 'EDITING')
    )
      return true
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

  const sinkCount = computed(() => {
    if (!campaign.value) return 0
    const allTargets = new Set<string>()
    for (const d of campaign.value.difficulties) {
      for (const pid of d.prerequisiteCampaignDifficultyIds ?? []) allTargets.add(pid)
    }
    return campaign.value.difficulties.filter((d) => !allTargets.has(d.id)).length
  })

  const isTerminal = computed(() => campaign.value?.completionMode === 'TERMINAL')

  const canCurate = computed(() => !!campaign.value && (!isTerminal.value || sinkCount.value === 1))

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

  function commitAvatarUrl() {
    const d = selectedDifficulty.value
    if (!editable.value || !d) return
    const url = formNode.value.checkpointAvatarUrl.trim()
    formNode.value.checkpointAvatarUrl = url
    if (!url || url === (d.checkpointAvatarUrl ?? '')) {
      commitNodeField('checkpointAvatarUrl')
      return
    }
    const probe = new Image()
    probe.onload = () => {
      if (formNode.value.checkpointAvatarUrl !== url) return
      commitNodeField('checkpointAvatarUrl')
    }
    probe.onerror = () => {
      if (formNode.value.checkpointAvatarUrl !== url) return
      const fallback = selectedMeta.value?.cdnCoverUrl || selectedMeta.value?.coverUrl || d.coverUrl
      formNode.value.checkpointAvatarUrl = fallback
      actionNotice.value =
        "That avatar image couldn't load, so the map's cover is being used instead."
      void applyNodePatch(d.id, { checkpointAvatarUrl: fallback })
    }
    probe.src = url
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
    if (
      !window.confirm('Deactivate this campaign? It will be hidden but player progress preserved.')
    )
      return
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
          difficulties: campaign.value.difficulties.map((d) => (d.id === toId ? updated : d)),
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

  const NODE_REWARD_LIMIT = 3

  const canAddNodeReward = computed(
    () => !!selectedDifficulty.value && selectedDifficulty.value.items.length < NODE_REWARD_LIMIT,
  )

  function openCampaignItemPicker() {
    if (!editable.value) return
    itemPickerFor.value = 'campaign'
  }

  function openNodeItemPicker() {
    if (!editable.value || !canAddNodeReward.value) return
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
    if (!editable.value || !d || d.items.length >= NODE_REWARD_LIMIT) return
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
    await persistPrereqs(
      payload.toId,
      prev.filter((id) => id !== payload.fromId),
      prev,
    )
  }

  function handleEmptyClick() {
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
    let baseY = 0
    if (diffs.length > 0) {
      let maxY = -Infinity
      for (const d of diffs) {
        occupied.add(`${d.positionX},${d.positionY}`)
        if (d.positionY > maxY) maxY = d.positionY
      }
      baseY = maxY + 2
    }
    const perRow = Math.min(6, Math.max(1, count))
    const cells: Array<{ x: number; y: number }> = []
    for (let row = 0; cells.length < count && row < count + 4; row++) {
      for (let col = 0; col < perRow && cells.length < count; col++) {
        const x = col
        const y = baseY + row * 2
        const key = `${x},${y}`
        if (occupied.has(key)) continue
        occupied.add(key)
        cells.push({ x, y })
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
      await load()
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
      await load()
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
    const prevById = new Map(
      campaign.value.difficulties.map((d) => [d.id, { x: d.positionX, y: d.positionY }]),
    )
    const moves = payloads.filter((p) => {
      const prev = prevById.get(p.id)
      return prev && (prev.x !== p.positionX || prev.y !== p.positionY)
    })
    if (moves.length === 0) return
    const moveById = new Map(moves.map((m) => [m.id, m]))
    campaign.value = {
      ...campaign.value,
      difficulties: campaign.value.difficulties.map((d) => {
        const m = moveById.get(d.id)
        return m ? { ...d, positionX: m.positionX, positionY: m.positionY } : d
      }),
    }
    try {
      actionError.value = null
      await Promise.all(
        moves.map((m) => {
          const patch = { positionX: m.positionX, positionY: m.positionY }
          return useAdminEndpoint.value
            ? updateCampaignDifficulty(m.id, patch)
            : updatePlayerCampaignDifficulty(m.id, patch)
        }),
      )
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to move nodes')
      if (campaign.value) {
        campaign.value = {
          ...campaign.value,
          difficulties: campaign.value.difficulties.map((d) => {
            const prev = prevById.get(d.id)
            return prev ? { ...d, positionX: prev.x, positionY: prev.y } : d
          }),
        }
      }
    }
  }

  function handleSelect(id: string) {
    selectOnly(id)
    activeTray.value = 'requirement'
  }

  function handleToggleSelect(id: string) {
    toggleInSelection(id)
    if (selectedIds.value.size >= 2) activeTray.value = 'bulk'
    else if (selectedIds.value.size === 1) activeTray.value = 'requirement'
  }

  function handleSelectMany(ids: string[]) {
    setSelection(ids)
    if (selectedIds.value.size >= 2) activeTray.value = 'bulk'
    else if (selectedIds.value.size === 1) activeTray.value = 'requirement'
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
    return { min: 0, max: scoreCap.value, step: 1000, unit: '' }
  })

  const requirementNumberBounds = computed(() => {
    if (formNode.value.requirementType === 'AP') {
      return { min: 0, max: Number.MAX_SAFE_INTEGER, step: 1 }
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

  watch(
    selectedDifficulty,
    (d) => {
      if (!d) {
        isMilestone.value = false
        return
      }
      isMilestone.value = !!(
        d.checkpointLabel ||
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
    formNode.value.requirementType = value as CampaignRequirementType
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

  function selectNodeSize(value: number) {
    formNode.value.size = String(value)
    commitNodeField('size')
  }

  async function applyBulkSize(value: number) {
    if (!editable.value) return
    for (const id of selectedIdList.value) {
      await applyNodePatch(id, { size: String(value) })
    }
  }

  async function applyBulkShape(value: string) {
    if (!editable.value) return
    for (const id of selectedIdList.value) {
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
        if (useAdminEndpoint.value) {
          await deactivateCampaignDifficulty(campaign.value.id, id)
        } else {
          await deletePlayerCampaignDifficulty(campaign.value.id, id)
        }
      }
      clearSelection()
      await load()
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to remove nodes')
    } finally {
      actionPending.value = false
    }
  }

  function closeMapPicker() {
    showMapPicker.value = false
  }

  const breadcrumbs = computed<Crumb[]>(() => {
    const title = isUnsavedDraft.value ? 'New campaign' : campaign.value?.name || 'Editor'
    return [{ label: 'Campaigns', to: '/campaigns' }, { label: title }]
  })

  const NODE_TRAY_IDS: TrayId[] = ['requirement', 'milestone', 'shape', 'unlock', 'rewards']

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
    if (isCurator.value) {
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
    tags: 'Tags',
    requirement: 'Requirement',
    milestone: 'Milestone',
    shape: 'Shape',
    unlock: 'Unlock when',
    rewards: 'Node rewards',
    bulk: 'Selection',
  }

  const activeTrayIsNode = computed(
    () => !!activeTray.value && NODE_TRAY_IDS.includes(activeTray.value),
  )

  function toggleTray(id: TrayId) {
    activeTray.value = activeTray.value === id ? null : id
  }

  function closeTray() {
    activeTray.value = null
  }

  watch(selectedIds, () => {
    if (selectedIds.value.size === 0 && (activeTrayIsNode.value || activeTray.value === 'bulk')) {
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
    rewardItemsById,
    campaign,
    loading,
    error,
    actionPending,
    actionError,
    actionNotice,
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
    sinkCount,
    isTerminal,
    canCurate,
    statusLabel,
    statusMeaning,
    creatorStatusMeaning,
    formMeta,
    formNode,
    commitMetaField,
    commitNodeField,
    commitAvatarUrl,
    toggleTag,
    doPlayerPublish,
    performPublish,
    doPlayerUnpublish,
    deleteDraft,
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
    nodeRewardLimit: NODE_REWARD_LIMIT,
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
    closeMapPicker,
    breadcrumbs,
    activeTray,
    campaignTrays,
    nodeTrays,
    trayTitles,
    activeTrayIsNode,
    toggleTray,
    closeTray,
  }
}
