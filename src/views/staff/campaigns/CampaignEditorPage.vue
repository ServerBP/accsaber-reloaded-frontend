<script setup lang="ts">
import BaseBanner from '@/components/common/BaseBanner.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import Breadcrumbs from '@/components/common/Breadcrumbs.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import CampaignPresenceActionGlyph from '@/components/domain/CampaignPresenceActionGlyph.vue'
import CampaignRoadmap from '@/components/domain/CampaignRoadmap.vue'
import ComplexityBadge from '@/components/domain/ComplexityBadge.vue'
import { formatDifficulty } from '@/utils/mappers'
import {
  colorForUser,
  useCampaignPresence,
  type PresenceAction,
  type PresenceKind,
  type PresencePeer,
} from '@/composables/useCampaignPresence'
import { useCampaignChat } from '@/composables/useCampaignChat'
import { pickCoverUrl } from '@/composables/useAvatarFallback'
import { useThemeStore } from '@/stores/theme'
import { readBackdropConfig } from '@/utils/themeBackdrop'
import { computed, onMounted, provide, ref } from 'vue'
import CampaignChatPanel from './CampaignChatPanel.vue'
import CampaignPluginWarning from './CampaignPluginWarning.vue'
import CampaignCollaboratorPicker from './CampaignCollaboratorPicker.vue'
import CampaignItemPicker from './CampaignItemPicker.vue'
import CampaignMapPicker from './CampaignMapPicker.vue'
import CampaignGlobalMapSearch from './CampaignGlobalMapSearch.vue'
import CampaignTrayRail from './CampaignTrayRail.vue'
import CampaignTrays from './CampaignTrays.vue'
import CampaignTutorialModal from './CampaignTutorialModal.vue'
import { CAMPAIGN_EDITOR_KEY } from './campaignEditorContext'
import { useCampaignEditor } from './useCampaignEditor'
import { useCampaignTutorial } from './useCampaignTutorial'

const editor = useCampaignEditor()
provide(CAMPAIGN_EDITOR_KEY, editor)

const {
  auth,
  campaign,
  loading,
  error,
  actionPending,
  actionError,
  showMapPicker,
  selectedId,
  selectedIdList,
  canvasMode,
  gridLock,
  toggleGridLock,
  itemPickerFor,
  showCollaboratorPicker,
  existingCollaboratorIds,
  handleCollaboratorPicked,
  requirementDirtyIds,
  showRepublishWarning,
  isCurator,
  isCreator,
  isCollaborator,
  isUnsavedDraft,
  canAccess,
  editable,
  publishConfirm,
  performUnpublish,
  accent,
  nodeAccents,
  selectedDifficulty,
  breadcrumbs,
  handleMove,
  handleMoveMany,
  handleConnect,
  handleDisconnect,
  handleEmptyClick,
  selectedEdge,
  selectedEdgeEndpoints,
  handleEdgeSelect,
  openMapPicker,
  handleMapsPicked,
  submitGlobalAdd,
  campaignGenreBeatsaverSlugs,
  usedMapDifficultyIds,
  unrankedNodes,
  showRepoint,
  closeRepoint,
  submitRepoint,
  removeSelectedNode,
  handleSelect,
  handleSelectMany,
  handleToggleSelect,
  handleDeselect,
  handleItemPicked,
  performPublish,
  closeMapPicker,
  activeTray,
  trayTitles,
  activeTrayIsNode,
  activeTrayIsBarrier,
  closeTray,
  hasConnections,
  canAddBarrier,
  barrierPlacementMode,
  toggleBarrierPlacement,
  placeBarrierOnEdge,
  selectedBarrier,
  removeSelectedBarrier,
  pickModeBarrierId,
  addText,
  selectedText,
  removeSelectedText,
  reloadFromRemote,
  setChangeBroadcaster,
  setViewCenterProvider,
} = editor

const roadmapRef = ref<InstanceType<typeof CampaignRoadmap> | null>(null)
setViewCenterProvider(() => roadmapRef.value?.getViewCenterCell() ?? null)

const themeStore = useThemeStore()
const themeBackdropActive = computed(() => readBackdropConfig(themeStore.activeTokens) !== null)

const selectedCover = computed(() => pickCoverUrl(selectedDifficulty.value))

const { showTutorial, openTutorial, closeTutorial, maybeAutoShow } = useCampaignTutorial()

onMounted(() => {
  void maybeAutoShow(auth.userId)
})

const campaignIdRef = computed(() => campaign.value?.id ?? null)

const chat = useCampaignChat(campaignIdRef)

const canChat = computed(() => (isCreator.value || isCollaborator.value) && !isUnsavedDraft.value)

const { peers: presencePeers, sendCursor, sendCursorOff, sendChange, sendTyping, sendTypingStop } =
  useCampaignPresence(campaignIdRef, editable, {
    onRemoteChange: () => void reloadFromRemote(),
    onChat: (message) => chat.ingest(message),
  })
setChangeBroadcaster(sendChange)

const selfAction = ref<PresenceAction>('move')
const selfTyping = ref(false)

const selfPeer = computed<PresencePeer | null>(() => {
  const id = auth.userId
  if (!id) return null
  return {
    userId: id,
    name: auth.userProfile?.name ?? 'You',
    avatarUrl: auth.userProfile?.avatarUrl ?? '',
    color: colorForUser(id),
    x: null,
    y: null,
    action: selfAction.value,
    targetId: null,
    kind: null,
    tray: null,
    typing: selfTyping.value,
    lastSeen: 0,
    lastCursorAt: 0,
  }
})

const displayPeers = computed<PresencePeer[]>(() => {
  const self = editable.value ? selfPeer.value : null
  return self ? [self, ...presencePeers.value] : presencePeers.value
})

function onSelfTyping() {
  selfTyping.value = true
  sendTyping()
}

function onSelfTypingStop() {
  selfTyping.value = false
  sendTypingStop()
}

function onCursorMove(payload: {
  x: number
  y: number
  action: PresenceAction
  targetId: string | null
  kind: PresenceKind
  tray: string | null
}) {
  selfAction.value = payload.action
  sendCursor(payload.x, payload.y, payload.action, payload.targetId, payload.kind, payload.tray)
}

const TRAY_ACTIVITY: Record<string, string> = {
  rewards: 'Establishing rewards',
  completion: 'Establishing rewards',
  barrierRewards: 'Establishing rewards',
  requirement: 'Setting a goal',
  unlock: 'Setting a goal',
  text: 'Writing text',
  shape: 'Styling a node',
  barrierCondition: 'Configuring a barrier',
  barrierAffected: 'Configuring a barrier',
  barrierStyle: 'Configuring a barrier',
  milestone: 'Linking a milestone',
  tags: 'Tagging the campaign',
  identity: 'Editing campaign details',
  settings: 'Editing campaign details',
  images: 'Editing campaign details',
  status: 'Editing campaign details',
}

function peerActivity(p: PresencePeer): string {
  if (p.typing) return 'Typing in chat…'
  if (p.action === 'connect') return 'Connecting nodes'
  if (p.action === 'place') return 'Building a barrier'
  if (p.action === 'drag') {
    if (p.kind === 'barrier') return 'Moving a barrier'
    if (p.kind === 'text') return 'Moving text'
    return 'Moving a node'
  }
  if (p.action === 'edit' || p.action === 'select') {
    if (p.tray && TRAY_ACTIVITY[p.tray]) return TRAY_ACTIVITY[p.tray]
    if (p.kind === 'text') return 'Writing text'
    if (p.kind === 'barrier') return 'Editing a barrier'
    if (p.kind === 'node') return 'Editing a node'
    return 'Editing fields'
  }
  return 'Looking around'
}
</script>

<template>
  <div
    class="campaign-editor"
    :class="{ 'campaign-editor--backdrop': themeBackdropActive }"
    :style="{ '--page-accent': accent }"
  >
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
      <EmptyState
        icon="🔒"
        message="You can only edit campaigns you created, or you'll need curator access."
      />
    </template>

    <template v-else>
      <main class="campaign-editor__canvas" aria-label="Campaign roadmap">
        <CampaignRoadmap
          ref="roadmapRef"
          :difficulties="campaign.difficulties"
          :barriers="campaign.barriers"
          :texts="campaign.texts"
          :accent-color="accent"
          :node-accents="nodeAccents"
          :background-url="campaign.backgroundUrl"
          :background-color="campaign.backgroundColor"
          :background-placement="campaign.background"
          :show-starfield="!campaign.backgroundUrl"
          :focus-id="selectedId"
          :follow-focus="false"
          :default-scale="1.3"
          :selected-id="selectedId"
          :selected-ids="selectedIdList"
          :selected-edge="selectedEdge"
          :highlight-barrier-id="pickModeBarrierId"
          :barrier-placement="barrierPlacementMode"
          :active-tray="activeTray"
          :presence-peers="presencePeers"
          :editable="editable"
          :grid-lock="gridLock"
          :flag-missing-rewards="true"
          :mode="canvasMode"
          @cursormove="onCursorMove"
          @cursoroff="sendCursorOff"
          @select="handleSelect"
          @select-many="handleSelectMany"
          @toggle-select="handleToggleSelect"
          @deselect="handleDeselect"
          @move="handleMove"
          @move-many="handleMoveMany"
          @empty-click="handleEmptyClick"
          @connect="handleConnect"
          @disconnect="handleDisconnect"
          @edge-select="handleEdgeSelect"
          @place-barrier="placeBarrierOnEdge"
        >
          <template #actions>
            <div v-if="editable" class="campaign-editor__add-cluster" aria-label="Add to roadmap">
              <button type="button" class="campaign-editor__add-btn" @click="openMapPicker">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add node
              </button>
              <button
                type="button"
                class="campaign-editor__add-btn"
                :class="{ 'campaign-editor__add-btn--barrier': barrierPlacementMode }"
                :disabled="!canAddBarrier"
                :title="
                  campaign.progressionAgnostic
                    ? 'Barriers need an ordered campaign. Turn off progression-agnostic in Settings'
                    : !hasConnections
                      ? 'Connect two nodes first, then drop a gate on the arrow'
                      : ''
                "
                @click="toggleBarrierPlacement"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <line x1="12" y1="3" x2="12" y2="21" />
                  <line x1="7" y1="6" x2="17" y2="6" />
                  <line x1="7" y1="18" x2="17" y2="18" />
                </svg>
                {{ barrierPlacementMode ? 'Pick an arrow' : 'Add barrier' }}
              </button>
              <button type="button" class="campaign-editor__add-btn" @click="addText">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="4 7 4 4 20 4 20 7" />
                  <line x1="9" y1="20" x2="15" y2="20" />
                  <line x1="12" y1="4" x2="12" y2="20" />
                </svg>
                Add text
              </button>
            </div>
          </template>
        </CampaignRoadmap>

        <div
          v-if="displayPeers.length"
          class="campaign-editor__presence"
          aria-label="Collaborators editing now"
        >
          <span
            v-for="p in displayPeers.slice(0, 6)"
            :key="p.userId"
            class="campaign-editor__presence-avatar"
            :class="{ 'campaign-editor__presence-avatar--typing': p.typing }"
            :style="{ '--peer-color': p.color }"
          >
            <img v-if="p.avatarUrl" :src="p.avatarUrl" :alt="p.name" />
            <span v-else class="campaign-editor__presence-initial">{{ p.name.charAt(0) }}</span>
            <span class="campaign-editor__presence-status" aria-hidden="true">
              <span v-if="p.typing" class="campaign-editor__presence-dots">
                <i></i><i></i><i></i>
              </span>
              <svg
                v-else
                class="campaign-editor__presence-glyph"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-primary)"
                stroke-width="2.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <CampaignPresenceActionGlyph :action="p.action" />
              </svg>
            </span>
            <span class="campaign-editor__presence-tip">
              <strong>{{ p.userId === auth.userId ? 'You' : p.name }}</strong>
              <span>{{ peerActivity(p) }}</span>
            </span>
          </span>
          <span v-if="displayPeers.length > 6" class="campaign-editor__presence-more">
            +{{ displayPeers.length - 6 }}
          </span>
        </div>

        <Breadcrumbs class="campaign-editor__breadcrumbs" :crumbs="breadcrumbs" />

        <div class="campaign-editor__banners">
          <Transition name="campaign-editor__banner">
            <BaseBanner
              v-if="actionError"
              class="campaign-editor__banner"
              variant="error"
              role="alert"
              @close="actionError = null"
            >
              <template #icon>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="13" />
                  <line x1="12" y1="16.5" x2="12" y2="16.51" />
                </svg>
              </template>
              <span class="campaign-editor__banner-text">{{ actionError }}</span>
            </BaseBanner>
          </Transition>
        </div>

        <div v-if="editable" class="campaign-editor__toolbar">
          <div class="campaign-editor__mode-toggle" role="radiogroup" aria-label="Canvas mode">
            <button
              type="button"
              role="radio"
              :aria-checked="canvasMode === 'drag'"
              class="campaign-editor__mode-btn"
              :class="{ 'campaign-editor__mode-btn--active': canvasMode === 'drag' }"
              @click="canvasMode = 'drag'"
            >
              Drag
            </button>
            <button
              type="button"
              role="radio"
              :aria-checked="canvasMode === 'connect'"
              class="campaign-editor__mode-btn"
              :class="{ 'campaign-editor__mode-btn--active': canvasMode === 'connect' }"
              @click="canvasMode = 'connect'"
            >
              Connect
            </button>
            <button
              type="button"
              role="radio"
              :aria-checked="canvasMode === 'select'"
              class="campaign-editor__mode-btn"
              :class="{ 'campaign-editor__mode-btn--active': canvasMode === 'select' }"
              @click="canvasMode = 'select'"
            >
              Select
            </button>
          </div>

          <button
            type="button"
            class="campaign-editor__grid-lock"
            :class="{ 'campaign-editor__grid-lock--off': !gridLock }"
            :aria-pressed="gridLock"
            :title="
              gridLock
                ? 'Elements snap to whole grid units. Hold Alt while dragging to place freely.'
                : 'Free placement is on, so elements can overlap. Hold Alt while dragging to snap.'
            "
            @click="toggleGridLock"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path v-if="gridLock" d="M8 11V7a4 4 0 0 1 8 0v4" />
              <path v-else d="M8 11V7a4 4 0 0 1 7.5-2" />
            </svg>
            {{ gridLock ? 'Grid' : 'Free' }}
          </button>
        </div>

        <CampaignPluginWarning
          class="campaign-editor__toolbar-warning"
          detail="Free placement puts elements on fractional coordinates."
          :show="editable && !gridLock"
        />

        <CampaignChatPanel
          v-if="canChat"
          :chat="chat"
          @typing="onSelfTyping"
          @typing-stop="onSelfTypingStop"
        />
      </main>

      <CampaignTrayRail @tutorial="openTutorial" />

      <Transition name="campaign-editor__tray">
        <section v-if="activeTray" class="campaign-editor__tray" aria-label="Editor tray">
          <header class="campaign-editor__tray-head">
            <h2 class="campaign-editor__tray-title">{{ trayTitles[activeTray] }}</h2>
            <button
              type="button"
              class="campaign-editor__tray-close"
              aria-label="Close tray"
              @click="closeTray"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>

          <div v-if="activeTrayIsNode && selectedDifficulty" class="campaign-editor__node-song">
            <div class="campaign-editor__node-cover">
              <img
                v-if="selectedCover"
                :src="selectedCover"
                :alt="selectedDifficulty.songName"
                loading="lazy"
              />
            </div>
            <div class="campaign-editor__node-song-meta">
              <h3>{{ selectedDifficulty.songName }}</h3>
              <p>{{ selectedDifficulty.songAuthor }} · {{ selectedDifficulty.mapAuthor }}</p>
              <p class="campaign-editor__node-diff">
                {{ formatDifficulty(selectedDifficulty.difficulty) }}
                <span v-if="selectedDifficulty.complexity != null">·</span>
                <ComplexityBadge v-if="selectedDifficulty.complexity != null"
                  :complexity="selectedDifficulty.complexity" />
                <span class="campaign-editor__node-grid">
                  · grid
                  <code>{{ selectedDifficulty.positionX }},{{ selectedDifficulty.positionY }}</code>
                </span>
              </p>
            </div>
            <BaseButton
              v-if="editable"
              size="sm"
              variant="destructive"
              class="campaign-editor__node-remove"
              :loading="actionPending"
              @click="removeSelectedNode"
            >
              Remove
            </BaseButton>
          </div>

          <div
            v-if="activeTrayIsBarrier && selectedBarrier"
            class="campaign-editor__barrier-head"
          >
            <span class="campaign-editor__barrier-head-icon" aria-hidden="true">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="12" y1="3" x2="12" y2="21" />
                <line x1="7" y1="6" x2="17" y2="6" />
                <line x1="7" y1="18" x2="17" y2="18" />
              </svg>
            </span>
            <div class="campaign-editor__barrier-head-meta">
              <h3>Barrier gate</h3>
              <p>
                grid
                <code>{{ selectedBarrier.positionX }},{{ selectedBarrier.positionY }}</code>
              </p>
            </div>
            <BaseButton
              v-if="editable"
              size="sm"
              variant="destructive"
              :loading="actionPending"
              @click="removeSelectedBarrier"
            >
              Remove
            </BaseButton>
          </div>

          <div v-if="activeTray === 'text' && selectedText" class="campaign-editor__barrier-head">
            <span
              class="campaign-editor__barrier-head-icon campaign-editor__barrier-head-icon--text"
              aria-hidden="true"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="4 7 4 4 20 4 20 7" />
                <line x1="9" y1="20" x2="15" y2="20" />
                <line x1="12" y1="4" x2="12" y2="20" />
              </svg>
            </span>
            <div class="campaign-editor__barrier-head-meta">
              <h3>Text element</h3>
              <p>
                grid
                <code>{{ selectedText.positionX }},{{ selectedText.positionY }}</code>
              </p>
            </div>
            <BaseButton
              v-if="editable"
              size="sm"
              variant="destructive"
              :loading="actionPending"
              @click="removeSelectedText"
            >
              Remove
            </BaseButton>
          </div>

          <div
            v-if="activeTray === 'connection' && selectedEdge && selectedEdgeEndpoints"
            class="campaign-editor__barrier-head"
          >
            <span class="campaign-editor__barrier-head-icon" aria-hidden="true">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="5" y1="19" x2="16" y2="8" />
                <polyline points="10 8 16 8 16 14" />
              </svg>
            </span>
            <div class="campaign-editor__barrier-head-meta">
              <h3>Connection</h3>
              <p>{{ selectedEdgeEndpoints.from }} → {{ selectedEdgeEndpoints.to }}</p>
            </div>
            <BaseButton
              v-if="editable"
              size="sm"
              variant="destructive"
              :loading="actionPending"
              @click="handleDisconnect(selectedEdge)"
            >
              Disconnect
            </BaseButton>
          </div>

          <div class="campaign-editor__tray-body">
            <CampaignTrays />
          </div>
        </section>
      </Transition>

      <CampaignMapPicker
        v-if="showMapPicker"
        :loading="actionPending"
        :global-submit="submitGlobalAdd"
        :initial-genre-slugs="campaignGenreBeatsaverSlugs"
        :used-difficulty-ids="usedMapDifficultyIds"
        @close="closeMapPicker"
        @pick="handleMapsPicked"
      />

      <BaseModal
        v-if="showRepoint"
        :open="true"
        title="Change map / version"
        max-width="900px"
        @close="closeRepoint"
      >
        <CampaignGlobalMapSearch mode="repoint" :submit="submitRepoint" />
      </BaseModal>

      <CampaignItemPicker
        v-if="itemPickerFor"
        :loading="actionPending"
        :unrestricted="!!campaign?.official"
        @close="itemPickerFor = null"
        @pick="handleItemPicked"
      />

      <CampaignCollaboratorPicker
        v-if="showCollaboratorPicker"
        :loading="actionPending"
        :existing-ids="Array.from(existingCollaboratorIds)"
        @close="showCollaboratorPicker = false"
        @pick="handleCollaboratorPicked"
      />

      <CampaignTutorialModal v-if="showTutorial" :accent="accent" @close="closeTutorial" />

      <BaseModal
        v-if="publishConfirm"
        :open="true"
        :title="publishConfirm === 'publish' ? 'Publish this campaign?' : 'Unpublish this campaign?'"
        @close="publishConfirm = null"
      >
        <div class="campaign-editor__warn">
          <template v-if="publishConfirm === 'publish'">
            <p>
              Publishing makes your campaign public. Any player will be able to find it and start it.
            </p>
            <p>
              Make sure everything is final before you go live: maps, goals, rewards, artwork, and
              text.
            </p>
            <div v-if="unrankedNodes.length" class="campaign-editor__warn-unranked">
              <p>
                Heads up: {{ unrankedNodes.length }}
                {{ unrankedNodes.length === 1 ? 'map is' : 'maps are' }} not ranked
                (imported campaign maps, or still in the ranking queue). You can publish, but this
                campaign will be <strong>uncuratable</strong> (it can't become an official curated
                campaign) while {{ unrankedNodes.length === 1 ? 'it stays' : 'they stay' }} unranked:
              </p>
              <ul>
                <li v-for="n in unrankedNodes" :key="n.id">{{ n.songName }}</li>
              </ul>
              <p>Are you OK to proceed?</p>
            </div>
          </template>
          <template v-else>
            <p>Unpublishing takes your campaign offline and resets every player's progress on it.</p>
            <p>Anyone who started or completed it will have to begin again when it returns.</p>
          </template>
        </div>
        <template #footer>
          <BaseButton :disabled="actionPending" @click="publishConfirm = null">Cancel</BaseButton>
          <BaseButton
            v-if="publishConfirm === 'publish'"
            variant="primary"
            :loading="actionPending"
            @click="performPublish"
          >
            Publish
          </BaseButton>
          <BaseButton v-else variant="destructive" :loading="actionPending" @click="performUnpublish">
            Unpublish
          </BaseButton>
        </template>
      </BaseModal>

      <BaseModal
        v-if="showRepublishWarning"
        :open="true"
        title="Recalculate player progress?"
        @close="showRepublishWarning = false"
      >
        <div class="campaign-editor__warn">
          <p>
            You changed the completion requirement on
            {{ requirementDirtyIds.size }}
            {{ requirementDirtyIds.size === 1 ? 'map' : 'maps' }}. Republishing recalculates player
            progress on {{ requirementDirtyIds.size === 1 ? 'it' : 'them' }}:
          </p>
          <ul>
            <li>
              Players who cleared an affected map under the old requirement lose that completion.
            </li>
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

.campaign-editor--backdrop {
  background: transparent;
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

.campaign-editor__presence {
  position: absolute;
  top: var(--space-md);
  right: var(--space-md);
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 4;
  pointer-events: none;
}

.campaign-editor__presence-avatar {
  position: relative;
  width: 38px;
  height: 38px;
  border-radius: 7px;
  border: 2px solid var(--peer-color);
  background: var(--bg-elevated);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  transition: transform 120ms ease;
}

.campaign-editor__presence-avatar:hover {
  transform: translateY(2px) scale(1.08);
  z-index: 5;
}

.campaign-editor__presence-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.campaign-editor__presence-avatar--typing {
  border-color: var(--peer-color);
}

.campaign-editor__presence-status {
  position: absolute;
  bottom: -6px;
  right: -6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: var(--peer-color);
  border: 1.5px solid var(--bg-base);
  border-radius: 999px;
}

.campaign-editor__presence-glyph {
  width: 11px;
  height: 11px;
}

.campaign-editor__presence-dots {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.campaign-editor__presence-dots i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--text-primary);
  animation: presence-typing 1.2s ease-in-out infinite;
}

.campaign-editor__presence-dots i:nth-child(2) {
  animation-delay: 0.2s;
}

.campaign-editor__presence-dots i:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes presence-typing {
  0%,
  60%,
  100% {
    opacity: 0.3;
  }
  30% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .campaign-editor__presence-dots i {
    animation: none;
    opacity: 0.85;
  }
}

.campaign-editor__presence-tip {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  display: none;
  flex-direction: column;
  gap: 1px;
  padding: 6px 10px;
  white-space: nowrap;
  background: var(--bg-elevated);
  border: 1px solid var(--peer-color);
  border-radius: 4px;
  z-index: 10;
}

.campaign-editor__presence-avatar:hover .campaign-editor__presence-tip {
  display: flex;
}

.campaign-editor__presence-tip strong {
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-primary);
}

.campaign-editor__presence-tip span {
  font-size: 0.6875rem;
  color: var(--peer-color);
}

.campaign-editor__presence-initial {
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
}

.campaign-editor__presence-more {
  margin-left: 6px;
  font-size: var(--text-caption);
  color: var(--text-secondary);
  font-weight: 600;
}

.campaign-editor__banners {
  position: absolute;
  top: calc(var(--space-md) + 44px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 6;
  width: min(640px, calc(100% - var(--space-2xl)));
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  pointer-events: none;
}

.campaign-editor__banner {
  margin: 0;
  pointer-events: auto;
}

.campaign-editor__banner-text {
  line-height: 1.45;
}

.campaign-editor__banner-enter-active,
.campaign-editor__banner-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.campaign-editor__banner-enter-from,
.campaign-editor__banner-leave-to {
  opacity: 0;
  transform: translateY(-6px);
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
  transition:
    background 120ms ease,
    color 120ms ease;
}

.campaign-editor__add-btn:hover {
  background: var(--bg-elevated);
}

.campaign-editor__add-btn:disabled {
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.campaign-editor__add-btn:disabled:hover {
  background: transparent;
}

.campaign-editor__add-btn--barrier,
.campaign-editor__add-btn--barrier:hover {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 14%, transparent);
}

.campaign-editor__toolbar {
  position: absolute;
  top: var(--space-md);
  left: 50%;
  transform: translateX(-50%);
  z-index: 4;
  display: inline-flex;
  align-items: stretch;
  gap: 6px;
}

.campaign-editor__mode-toggle {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: 4px;
}

.campaign-editor__toolbar-warning {
  position: absolute;
  top: calc(var(--space-md) + 44px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 4;
  max-width: 420px;
  background: color-mix(in srgb, var(--error) 12%, var(--bg-surface));
  pointer-events: none;
}

.campaign-editor__grid-lock {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-secondary);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: 4px;
  cursor: pointer;
  transition:
    color 120ms ease,
    border-color 120ms ease,
    background 120ms ease;
}

.campaign-editor__grid-lock:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.campaign-editor__grid-lock--off,
.campaign-editor__grid-lock--off:hover {
  color: var(--warning);
  border-color: var(--warning);
  background: color-mix(in srgb, var(--warning) 12%, var(--bg-surface));
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
  transition:
    color 120ms ease,
    background 120ms ease;
}

.campaign-editor__mode-btn:hover {
  color: var(--text-primary);
}

.campaign-editor__mode-btn--active {
  color: var(--page-accent);
  background: var(--bg-elevated);
}

.campaign-editor__tray {
  position: absolute;
  top: calc(var(--space-md) + 44px);
  left: calc(var(--space-md) + 76px + var(--space-sm));
  bottom: var(--space-md);
  z-index: 5;
  display: flex;
  flex-direction: column;
  width: clamp(300px, 26vw, 360px);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: 6px;
  overflow: hidden;
  pointer-events: auto;
}

.campaign-editor__tray-enter-active,
.campaign-editor__tray-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
}

.campaign-editor__tray-enter-from,
.campaign-editor__tray-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

.campaign-editor__tray-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-md) var(--space-sm);
  border-bottom: 1px solid var(--bg-overlay);
}

.campaign-editor__tray-title {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.campaign-editor__tray-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  color: var(--text-tertiary);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  transition:
    color 120ms ease,
    background 120ms ease;
}

.campaign-editor__tray-close:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.campaign-editor__tray > .campaign-editor__node-song {
  padding: var(--space-md) var(--space-md) var(--space-sm);
  border-bottom: 1px solid var(--bg-overlay);
}

.campaign-editor__tray-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-md);
  scrollbar-width: thin;
  scrollbar-color: var(--bg-overlay) transparent;
}

.campaign-editor__tray-body::-webkit-scrollbar {
  width: 5px;
}
.campaign-editor__tray-body::-webkit-scrollbar-thumb {
  background: var(--bg-overlay);
  border-radius: 3px;
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

.campaign-editor__node-song-meta h3 {
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

.campaign-editor__tray > .campaign-editor__barrier-head {
  padding: var(--space-md) var(--space-md) var(--space-sm);
  border-bottom: 1px solid var(--bg-overlay);
}

.campaign-editor__barrier-head {
  display: grid;
  grid-template-columns: 40px 1fr auto;
  gap: var(--space-sm);
  align-items: center;
}

.campaign-editor__barrier-head-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning) 40%, transparent);
  border-radius: 4px;
}

.campaign-editor__barrier-head-icon--text {
  color: var(--page-accent);
  background: color-mix(in srgb, var(--page-accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--page-accent) 40%, transparent);
}

.campaign-editor__barrier-head-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.campaign-editor__barrier-head-meta h3 {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.campaign-editor__barrier-head-meta p {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.campaign-editor__barrier-head-meta code {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--text-secondary);
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

.campaign-editor__warn-unranked {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
  border: 1px solid color-mix(in srgb, var(--warning) 35%, transparent);
  background: color-mix(in srgb, var(--warning) 8%, transparent);
  border-radius: var(--radius-card);
}

.campaign-editor__warn-unranked ul {
  max-height: 160px;
  overflow-y: auto;
  scrollbar-width: thin;
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

  .campaign-editor__tray {
    position: relative;
    top: auto;
    left: auto;
    bottom: auto;
    width: auto;
    margin: var(--space-sm) var(--space-md) var(--space-md);
    max-height: 70vh;
  }
}

@media (prefers-reduced-motion: reduce) {
  .campaign-editor__tray-enter-active,
  .campaign-editor__tray-leave-active {
    transition: opacity 120ms ease;
  }

  .campaign-editor__tray-enter-from,
  .campaign-editor__tray-leave-to {
    transform: none;
  }
}
</style>
