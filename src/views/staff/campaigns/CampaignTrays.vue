<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import ImageUploader from '@/components/common/ImageUploader.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import RichTextEditor from '@/components/common/RichTextEditor.vue'
import CampaignRewardItem from '@/components/domain/CampaignRewardItem.vue'
import CountryFlag from '@/components/domain/CountryFlag.vue'
import CampaignBackgroundPlacer from './CampaignBackgroundPlacer.vue'
import CampaignBoundsField from './CampaignBoundsField.vue'
import CampaignEditorNote from './CampaignEditorNote.vue'
import CampaignEditorTile from './CampaignEditorTile.vue'
import CampaignFieldHint from './CampaignFieldHint.vue'
import CampaignPluginWarning from './CampaignPluginWarning.vue'
import CampaignTargetRow from './CampaignTargetRow.vue'
import CampaignShapeGlyph from './CampaignShapeGlyph.vue'
import CampaignLabelPositionPicker from './CampaignLabelPositionPicker.vue'
import { useCampaignEditorContext } from './campaignEditorContext'
import { onAvatarError } from '@/composables/useAvatarFallback'
import { resolveSize } from '@/utils/campaignLayout'
import { PLUGIN_FIRST_TARGET_NOTE, PLUGIN_ZERO_BOUND_NOTE } from '@/utils/campaignPlugin'
import type { CampaignTargetMode } from '@/types/enums'
import { computed, ref } from 'vue'

const fontOptions = [
  { value: '', label: 'Default' },
  { value: 'DM Sans', label: 'DM Sans' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'mono', label: 'Monospace' },
  { value: 'serif', label: 'Serif' },
]

const {
  campaign,
  activeTray,
  isUnsavedDraft,
  isDraftStatus,
  curatable,
  isCurationRoute,
  isAdmin,
  isCurator,
  isCreator,
  editingLiveCampaign,
  statusLabel,
  statusMeaning,
  creatorStatusMeaning,
  actionPending,
  editable,
  formMeta,
  fieldErrors,
  commitMetaField,
  commitBackgroundColor,
  resetBackgroundColor,
  completionModeOptions,
  onCompletionModeChange,
  uploadBackground,
  removeBackground,
  uploadIcon,
  removeIcon,
  commitBackgroundPlacement,
  rewardItemsById,
  removeCompletionItem,
  openCampaignItemPicker,
  tagsByKind,
  campaignTagIds,
  toggleTag,
  doPlayerPublish,
  deleteDraft,
  isCollaborator,
  activeCollaborators,
  collaboratorsLoading,
  canInviteMore,
  collaboratorLimit,
  openCollaboratorPicker,
  removeCollaborator,
  leaveCampaign,
  doPlayerUnpublish,
  doPublish,
  doReopen,
  doCurate,
  doUncurate,
  doToggleLoved,
  doToggleOfficial,
  doDeactivate,
  selectedDifficulty,
  selectedNodeApRankBlocked,
  apRankBlockedNodeIds,
  openRepoint,
  refreshNodeVersion,
  formNode,
  requirementTypeOptions,
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
  handleSelect,
  modifierOptions,
  nodeModifierById,
  cycleNodeModifier,
  commitNodeField,
  uploadCheckpointAvatar,
  removeCheckpointAvatar,
  uploadNodeBorder,
  removeNodeBorder,
  selectNodeBorderLayer,
  isMilestone,
  setMilestone,
  commitMilestoneLabel,
  defaultColorHex,
  resetNodeColor,
  shapeTiles,
  sizeTiles,
  selectBorderShape,
  selectNodeLabelPosition,
  selectNodeSize,
  selectedCount,
  applyBulkSize,
  applyBulkShape,
  removeSelectedNodes,
  setPrereqMode,
  removeNodeItem,
  openNodeItemPicker,
  canAddNodeReward,
  nodeRewardLimit,
  hasBarriers,
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
  affectedPickMode,
  toggleAffectedPickMode,
  toggleAffected,
  setBarrierPrereqMode,
  resetBarrierColor,
  selectBarrierLabelPosition,
  canAddBarrierReward,
  openBarrierItemPicker,
  removeBarrierItem,
  selectedText,
  formText,
  commitTextField,
  onTextContentInput,
  textEffects,
  textEffectActive,
  toggleTextEffect,
  selectedEdge,
  formConnection,
  connectionColorError,
  commitConnectionColor,
  resetConnectionColor,
} = useCampaignEditorContext()

const affectedNodeList = computed(() => {
  const b = selectedBarrier.value
  const c = campaign.value
  if (!b || !c) return []
  const byId = new Map(c.difficulties.map((d) => [d.id, d]))
  return b.affectedCampaignDifficultyIds.map((id) => ({
    id,
    name: byId.get(id)?.songName ?? 'Unknown node',
  }))
})

const requirementOptions = computed(() =>
  selectedNodeApRankBlocked.value
    ? requirementTypeOptions.filter((o) => o.value !== 'AP' && o.value !== 'RANK')
    : requirementTypeOptions,
)

const MODIFIER_STATE_WORD: Record<string, string> = {
  REQUIRED: 'required',
  FORBIDDEN: 'forbidden',
}

const modifierChips = computed(() =>
  modifierOptions.value.map((m) => {
    const state = nodeModifierById.value.get(m.id) ?? null
    return {
      id: m.id,
      code: m.code,
      state,
      label: `${m.name}: ${state ? MODIFIER_STATE_WORD[state] : 'not constrained'}`,
    }
  }),
)

const MARKDOWN_HINT = 'Markdown is supported here.'

const TARGET_MODES: Array<{ value: CampaignTargetMode; label: string }> = [
  { value: 'AND', label: 'All of' },
  { value: 'OR', label: 'Any of' },
]

const isMultiTarget = computed(() => targetRows.value.length > 1)

const targetsBombHits = computed(() =>
  targetRows.value.some((r) => r.requirementType === 'BOMB_HITS'),
)

const dragTargetIndex = ref<number | null>(null)

function onTargetDragEnter(index: number) {
  const from = dragTargetIndex.value
  if (from === null || from === index) return
  if (reorderTargets(from, index)) dragTargetIndex.value = index
}

function onTargetDrop() {
  if (dragTargetIndex.value === null) return
  dragTargetIndex.value = null
  commitTargets()
}

const barrierConditionHint = computed(() => {
  const meta = barrierMeta.value
  if (meta.noValue) {
    const verb =
      formBarrier.value.conditionType === 'PASS' ? 'passed (no No-Fail)' : 'full-comboed'
    return `Opens once every affected node has been ${verb}.`
  }
  if (meta.metric === 'count') {
    return `Opens once the player has completed this many of the ${affectedNodeList.value.length} affected nodes, each cleared by its own requirement. The cap is the number of affected nodes.`
  }
  if (meta.metric === 'bombs') {
    return 'Averaged over the affected nodes, and higher passes. For "at most N bombs", set the upper bound instead of the lower one.'
  }
  if (meta.metric === 'mistakes') {
    return 'Bad cuts + misses, averaged over each affected node\'s fewest-mistakes run. For "at most N mistakes", set the upper bound instead of the lower one.'
  }
  if (meta.lowerBetter) {
    return `Lower is better. Opens when the ${meta.agg} leaderboard rank across the affected nodes reaches this position or better.`
  }
  return `Aggregated over the affected nodes (${meta.agg}). Higher clears the gate.`
})

const AP_RANK_BARRIER_TYPES = ['AVERAGE_AP', 'AP_MAX', 'AVERAGE_RANK', 'MAX_RANK']

const barrierAffectsApRankBlocked = computed(() => {
  const b = selectedBarrier.value
  if (!b) return false
  return b.affectedCampaignDifficultyIds.some((id) => apRankBlockedNodeIds.value.has(id))
})

const barrierConditionOptionsFiltered = computed(() =>
  barrierAffectsApRankBlocked.value
    ? barrierConditionOptions.filter((o) => !AP_RANK_BARRIER_TYPES.includes(o.value))
    : barrierConditionOptions,
)

const defaultBarrierColor = computed(() => {
  if (typeof document === 'undefined') return '#eab308'
  const v = getComputedStyle(document.documentElement).getPropertyValue('--warning').trim()
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : '#eab308'
})

const HEX6 = /^#[0-9a-fA-F]{6}$/

const backgroundSwatch = computed(() => {
  const v = formMeta.value.backgroundColor.trim()
  return HEX6.test(v) ? v : defaultColorHex.value
})

const connectionSwatch = computed(() => {
  const v = formConnection.value.color.trim()
  if (HEX6.test(v)) return v
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v}`
  return defaultColorHex.value
})
</script>

<template>
  <template v-if="activeTray === 'status'">
    <header v-if="!isUnsavedDraft && campaign" class="campaign-editor__status">
      <div
        v-if="!isDraftStatus || (!isCurationRoute && isCreator)"
        class="campaign-editor__status-row"
      >
        <span
          class="campaign-editor__status-pill"
          :class="`campaign-editor__status-pill--${campaign.status.toLowerCase()}`"
        >
          {{ statusLabel[campaign.status] }}
        </span>
      </div>
      <p
        v-if="!isCurationRoute && isCreator && creatorStatusMeaning"
        class="campaign-editor__status-meaning"
      >
        {{ creatorStatusMeaning }}
      </p>
      <p v-else-if="!isDraftStatus" class="campaign-editor__status-meaning">
        {{ statusMeaning[campaign.status] }}
      </p>

      <div class="campaign-editor__status-actions">
        <template v-if="!isCurationRoute && isCreator">
          <template v-if="isDraftStatus">
            <BaseButton
              size="sm"
              variant="primary"
              :loading="actionPending"
              @click="doPlayerPublish"
            >
              Publish
            </BaseButton>
            <BaseButton
              size="sm"
              variant="destructive"
              :loading="actionPending"
              @click="deleteDraft"
            >
              Delete draft
            </BaseButton>
          </template>
          <BaseButton
            v-else-if="campaign.status === 'PUBLISHED' || campaign.status === 'EDITING'"
            size="sm"
            variant="primary"
            :loading="actionPending"
            @click="doPlayerUnpublish"
          >
            Unpublish to edit
          </BaseButton>
        </template>

        <template v-if="isCurationRoute">
          <BaseButton
            v-if="isCurator && (isDraftStatus || campaign.status === 'EDITING')"
            size="sm"
            :loading="actionPending"
            @click="doPublish"
          >
            Publish
          </BaseButton>
          <BaseButton
            v-if="isCurator && (campaign.status === 'PUBLISHED' || campaign.status === 'CURATED')"
            size="sm"
            :loading="actionPending"
            @click="doReopen"
          >
            Reopen for editing
          </BaseButton>
          <BaseButton
            v-if="isCurator && curatable"
            size="sm"
            variant="primary"
            :loading="actionPending"
            @click="doCurate"
          >
            Curate
          </BaseButton>
          <BaseButton
            v-if="isCurator && campaign.status === 'CURATED'"
            size="sm"
            :loading="actionPending"
            @click="doUncurate"
          >
            Uncurate
          </BaseButton>
          <BaseButton
            v-if="isCurator && !isDraftStatus"
            size="sm"
            :loading="actionPending"
            @click="doToggleLoved"
          >
            {{ campaign.loved ? 'Remove loved' : 'Mark loved' }}
          </BaseButton>
          <BaseButton
            v-if="isAdmin"
            size="sm"
            :loading="actionPending"
            @click="doToggleOfficial"
          >
            {{ campaign.official ? 'Remove official' : 'Make official' }}
          </BaseButton>
          <BaseButton
            v-if="isAdmin"
            size="sm"
            variant="destructive"
            :loading="actionPending"
            @click="doDeactivate"
          >
            Deactivate
          </BaseButton>
        </template>
      </div>

      <CampaignEditorNote v-if="editingLiveCampaign">
        This campaign is live and paying out. Edits apply immediately, and changing a requirement
        re-settles player completions on that node and everything after it.
      </CampaignEditorNote>

      <CampaignPluginWarning
        :show="fractionalVertexCount > 0"
        :detail="`${fractionalVertexCount} element${fractionalVertexCount === 1 ? '' : 's'} sit on fractional grid coordinates. Turn the grid lock on and re-drag them onto whole units to make this campaign loadable again.`"
      />

      <section v-if="campaignAudit.paysOut" class="campaign-editor__audit">
        <h3 class="campaign-editor__audit-title">Payout</h3>

        <dl class="campaign-editor__audit-stats">
          <div>
            <dt>Nodes</dt>
            <dd>{{ campaignAudit.nodeCount }}</dd>
          </div>
          <div>
            <dt>Milestones</dt>
            <dd>{{ campaignAudit.milestoneCount }}</dd>
          </div>
          <div>
            <dt>Barriers</dt>
            <dd>{{ campaignAudit.barrierCount }}</dd>
          </div>
          <div>
            <dt>Avg XP / node</dt>
            <dd>{{ campaignAudit.avgXpPerNode.toLocaleString() }}</dd>
          </div>
          <div>
            <dt>Node XP range</dt>
            <dd>
              {{ campaignAudit.minNodeXp.toLocaleString() }} -
              {{ campaignAudit.maxNodeXp.toLocaleString() }}
            </dd>
          </div>
          <div>
            <dt>Total XP</dt>
            <dd
              :class="{
                'campaign-editor__audit-over': campaignAudit.totalXp > campaignAudit.xpBudget,
              }"
              :title="`Recommended at most ${campaignAudit.xpBudget.toLocaleString()} XP for ${campaignAudit.nodeCount} nodes`"
            >
              {{ campaignAudit.totalXp.toLocaleString() }}
              <small>/ {{ campaignAudit.xpBudget.toLocaleString() }}</small>
            </dd>
          </div>
          <div>
            <dt>Item awards</dt>
            <dd
              :class="{
                'campaign-editor__audit-over':
                  campaignAudit.rewardCount > campaignAudit.rewardBudget,
              }"
              :title="`Recommended at most ${campaignAudit.rewardBudget} item awards for ${campaignAudit.nodeCount} nodes`"
            >
              {{ campaignAudit.rewardCount }}
              <small>/ {{ campaignAudit.rewardBudget }}</small>
            </dd>
          </div>
        </dl>

        <p
          v-if="campaignAudit.barrierXp || campaignAudit.completionXp"
          class="campaign-editor__hint"
        >
          Nodes {{ campaignAudit.nodeXp.toLocaleString() }} · Barriers
          {{ campaignAudit.barrierXp.toLocaleString() }} · Completion
          {{ campaignAudit.completionXp.toLocaleString() }}
        </p>

        <ul v-if="campaignAudit.rewards.length > 0" class="campaign-editor__reward-list">
          <li
            v-for="reward in campaignAudit.rewards"
            :key="reward.itemId"
            class="campaign-editor__reward"
          >
            <CampaignRewardItem
              :name="reward.itemName"
              :quantity="reward.quantity"
              :item="rewardItemsById.get(reward.itemId) ?? null"
            />
          </li>
        </ul>

        <CampaignEditorNote v-for="issue in campaignAudit.issues" :key="issue.key">
          {{ issue.message }}
          <span v-if="issue.refs.length > 0" class="campaign-editor__audit-refs">
            <button
              v-for="vertex in issue.refs"
              :key="vertex.id"
              type="button"
              class="campaign-editor__audit-ref"
              @click="handleSelect(vertex.id)"
            >
              {{ vertex.label }}
            </button>
          </span>
        </CampaignEditorNote>
      </section>
    </header>

    <p v-else class="campaign-editor__status-meaning">
      New draft. Add a node or fill in any field to save it.
    </p>
  </template>

  <fieldset
    v-else-if="activeTray === 'identity' && campaign"
    class="campaign-editor__section"
    :disabled="!editable"
  >
    <label class="campaign-editor__field">
      <span>Name</span>
      <input v-model="formMeta.name" type="text" @blur="commitMetaField('name')" />
    </label>
    <label class="campaign-editor__field">
      <span>Creator alias</span>
      <input
        v-model="formMeta.creatorAlias"
        type="text"
        :placeholder="campaign.creatorName ?? 'Creator name'"
        @blur="commitMetaField('creatorAlias')"
      />
      <small
        >Shown as the campaign's author. Defaults to your name; change it to credit a
        collaboration.</small
      >
    </label>
    <label class="campaign-editor__field">
      <span>Slug</span>
      <input
        v-model="formMeta.slug"
        type="text"
        placeholder="auto from name"
        @blur="commitMetaField('slug')"
      />
    </label>
    <label class="campaign-editor__field">
      <span>Summary</span>
      <input v-model="formMeta.summary" type="text" @blur="commitMetaField('summary')" />
    </label>
    <label class="campaign-editor__field">
      <span>Description <CampaignFieldHint :text="MARKDOWN_HINT" /></span>
      <textarea v-model="formMeta.description" rows="4" @blur="commitMetaField('description')" />
    </label>
  </fieldset>

  <fieldset
    v-else-if="activeTray === 'settings'"
    class="campaign-editor__section"
    :disabled="!editable"
  >
    <div class="campaign-editor__field">
      <span>Completion mode</span>
      <BaseSelect
        :model-value="formMeta.completionMode"
        :options="completionModeOptions.map((o) => ({ value: o.value, label: o.label }))"
        @update:model-value="onCompletionModeChange"
      />
    </div>
    <label class="campaign-editor__check" :class="{ 'campaign-editor__check--disabled': hasBarriers }">
      <input
        type="checkbox"
        v-model="formMeta.progressionAgnostic"
        :disabled="hasBarriers"
        @change="commitMetaField('progressionAgnostic')"
      />
      <span>Progression agnostic (any order)</span>
    </label>
    <p v-if="hasBarriers" class="campaign-editor__hint">
      Remove the campaign's barriers first. Gates only work in an ordered campaign.
    </p>
    <label class="campaign-editor__check">
      <input
        type="checkbox"
        v-model="formMeta.playlistExportEnabled"
        @change="commitMetaField('playlistExportEnabled')"
      />
      <span>Playlist export enabled</span>
    </label>
    <label class="campaign-editor__field">
      <span>
        Background color
        <CampaignFieldHint
          text="Hex, named, or rgb/hsl. Tints the roadmap backdrop; leave empty for the default."
        />
      </span>
      <div class="campaign-editor__color-row">
        <input
          type="color"
          aria-label="Background color swatch"
          :value="backgroundSwatch"
          @input="formMeta.backgroundColor = ($event.target as HTMLInputElement).value"
          @change="commitBackgroundColor"
        />
        <input
          class="campaign-editor__color-text"
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="#a855f7 · rebeccapurple · rgb(…)"
          :aria-invalid="!!fieldErrors.backgroundColor"
          v-model="formMeta.backgroundColor"
          @blur="commitBackgroundColor"
          @keydown.enter.prevent="commitBackgroundColor"
        />
        <button type="button" class="campaign-editor__inline-btn" @click="resetBackgroundColor">
          Auto
        </button>
      </div>
      <p v-if="fieldErrors.backgroundColor" class="campaign-editor__field-error" role="alert">
        {{ fieldErrors.backgroundColor }}
      </p>
    </label>
  </fieldset>

  <fieldset
    v-else-if="activeTray === 'images' && campaign"
    class="campaign-editor__section"
    :disabled="!editable"
  >
    <div class="campaign-editor__image-row">
      <ImageUploader
        label="Background"
        hint="16:9 hero"
        :image-url="campaign.backgroundUrl"
        :disabled="!editable"
        :upload-handler="uploadBackground"
        :remove-handler="removeBackground"
      />
      <ImageUploader
        label="Icon"
        hint="Square card image"
        aspect-ratio="1 / 1"
        :image-url="campaign.iconUrl"
        :disabled="!editable"
        :upload-handler="uploadIcon"
        :remove-handler="removeIcon"
      />
    </div>
    <div v-if="campaign.backgroundUrl" class="campaign-editor__field">
      <span>Background placement</span>
      <CampaignBackgroundPlacer
        :image-url="campaign.backgroundUrl"
        :placement="campaign.background"
        :disabled="!editable"
        @commit="commitBackgroundPlacement"
      />
    </div>
  </fieldset>

  <fieldset
    v-else-if="activeTray === 'completion' && campaign"
    class="campaign-editor__section"
    :disabled="!editable"
  >
    <CampaignEditorNote v-if="campaign.status !== 'CURATED'">
      Rewards are only handed out once the campaign is curated.
    </CampaignEditorNote>
    <label class="campaign-editor__field">
      <span>
        Completion XP
        <CampaignFieldHint text="Awarded on completion, once the campaign is curated." />
      </span>
      <div class="campaign-editor__slider-row">
        <input
          type="range"
          min="0"
          max="50000"
          step="500"
          v-model.number="formMeta.completionXp"
          @change="commitMetaField('completionXp')"
        />
        <input
          type="number"
          min="0"
          step="100"
          v-model.number="formMeta.completionXp"
          @blur="commitMetaField('completionXp')"
        />
      </div>
    </label>
    <ul v-if="campaign.completionItems.length > 0" class="campaign-editor__reward-list">
      <li
        v-for="item in campaign.completionItems"
        :key="item.itemId"
        class="campaign-editor__reward"
      >
        <CampaignRewardItem
          :name="item.itemName"
          :quantity="item.quantity"
          :item="rewardItemsById.get(item.itemId) ?? null"
        >
          <template v-if="editable" #action>
            <button
              type="button"
              class="campaign-editor__reward-remove"
              aria-label="Remove reward"
              @click="removeCompletionItem(item.itemId)"
            >
              <svg
                width="12"
                height="12"
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
          </template>
        </CampaignRewardItem>
      </li>
    </ul>
    <p v-else class="campaign-editor__hint">
      No rewards yet. Players who complete the campaign get nothing extra.
    </p>
    <button
      v-if="editable"
      type="button"
      class="campaign-editor__add-reward"
      @click="openCampaignItemPicker"
    >
      <svg
        width="12"
        height="12"
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
      Add reward
    </button>
  </fieldset>

  <fieldset v-else-if="activeTray === 'collaborators' && campaign" class="campaign-editor__section">
    <div class="campaign-editor__collab-owner">
      <span class="campaign-editor__collab-owner-tag">Owner</span>
      <span class="campaign-editor__collab-owner-name">{{
        campaign.creatorAlias || campaign.creatorName || 'You'
      }}</span>
    </div>

    <div
      v-if="collaboratorsLoading && activeCollaborators.length === 0"
      class="campaign-editor__collab-skeletons"
    >
      <SkeletonLoader v-for="i in 2" :key="i" variant="table-row" />
    </div>

    <ul v-else-if="activeCollaborators.length > 0" class="campaign-editor__collab-list">
      <li v-for="c in activeCollaborators" :key="c.id" class="campaign-editor__collab">
        <span class="campaign-editor__collab-avatar">
          <img
            v-if="c.userCdnAvatarUrl || c.userAvatarUrl"
            :src="c.userCdnAvatarUrl ?? c.userAvatarUrl ?? ''"
            :alt="c.userName"
            loading="lazy"
            @error="onAvatarError(c.userCdnAvatarUrl && c.userAvatarUrl && c.userCdnAvatarUrl !== c.userAvatarUrl ? c.userAvatarUrl : null)($event)"
          />
        </span>
        <span class="campaign-editor__collab-meta">
          <span class="campaign-editor__collab-name">{{ c.userName }}</span>
          <span class="campaign-editor__collab-sub">
            <CountryFlag v-if="c.userCountry" :country="c.userCountry" />
            <span
              class="campaign-editor__collab-status"
              :class="`campaign-editor__collab-status--${c.status.toLowerCase()}`"
            >
              {{ c.status === 'PENDING' ? 'Invited' : 'Collaborator' }}
            </span>
          </span>
        </span>
        <button
          v-if="isCreator"
          type="button"
          class="campaign-editor__reward-remove"
          :aria-label="`Remove ${c.userName}`"
          @click="removeCollaborator(c.userId)"
        >
          <svg
            width="12"
            height="12"
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
      </li>
    </ul>

    <p v-else-if="isCreator" class="campaign-editor__hint">
      No collaborators yet. Invite a player to build this campaign together.
    </p>
    <p v-else class="campaign-editor__hint">You're helping edit this campaign.</p>

    <button
      v-if="isCreator && canInviteMore"
      type="button"
      class="campaign-editor__add-reward"
      @click="openCollaboratorPicker"
    >
      <svg
        width="12"
        height="12"
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
      Invite collaborator
    </button>
    <p v-else-if="isCreator" class="campaign-editor__hint">
      Collaborator limit of {{ collaboratorLimit }} reached.
    </p>

    <BaseButton
      v-if="isCollaborator"
      size="sm"
      variant="destructive"
      :loading="actionPending"
      @click="leaveCampaign"
    >
      Leave campaign
    </BaseButton>
  </fieldset>

  <fieldset
    v-else-if="activeTray === 'tags'"
    class="campaign-editor__section"
    :disabled="!editable"
  >
    <div
      v-for="kind in ['CATEGORY', 'DIFFICULTY', 'THEME', 'GENRE']"
      :key="kind"
      class="campaign-editor__tag-group"
    >
      <span class="campaign-editor__tag-label">{{ kind.toLowerCase() }}</span>
      <div class="campaign-editor__tag-chips">
        <button
          v-for="t in tagsByKind.get(kind) ?? []"
          :key="t.id"
          type="button"
          class="campaign-editor__chip"
          :class="{ 'campaign-editor__chip--active': campaignTagIds.has(t.id) }"
          @click="toggleTag(t.id)"
        >
          {{ t.name }}
        </button>
      </div>
    </div>
  </fieldset>

  <fieldset
    v-else-if="activeTray === 'requirement'"
    class="campaign-editor__section"
    :disabled="!editable"
  >
    <div v-if="isMultiTarget" class="campaign-editor__field">
      <span>
        Clears when
        <CampaignFieldHint
          text="All of: every objective must be met by one score. Any of: meeting a single objective clears the node."
        />
      </span>
      <div class="campaign-editor__prereq-mode-toggle" role="radiogroup" aria-label="Objective mode">
        <button
          v-for="mode in TARGET_MODES"
          :key="mode.value"
          type="button"
          role="radio"
          :aria-checked="formTargetMode === mode.value"
          class="campaign-editor__prereq-mode-btn"
          :class="{ 'campaign-editor__prereq-mode-btn--active': formTargetMode === mode.value }"
          @click="setTargetMode(mode.value)"
        >
          {{ mode.label }}
        </button>
      </div>
    </div>

    <ul class="campaign-editor__targets">
      <template v-for="row in targetRows" :key="row.key">
        <li
          v-if="row.index > 0"
          class="campaign-editor__target-join"
          :class="`campaign-editor__target-join--${formTargetMode.toLowerCase()}`"
          aria-hidden="true"
        >
          {{ formTargetMode }}
        </li>
        <CampaignTargetRow
          :row="row"
          :type-options="requirementOptions"
          :multi="isMultiTarget"
          :disabled="!editable"
          @type="setTargetType(row.index, $event)"
          @update:lower="setTargetBound(row.index, 'requirementValue', $event)"
          @update:upper="setTargetBound(row.index, 'requirementValueMax', $event)"
          @commit="commitTargets"
          @remove="removeTarget(row.index)"
          @move="moveTarget(row.index, row.index + $event)"
          @grab="dragTargetIndex = row.index"
          @enter="onTargetDragEnter(row.index)"
          @drop="onTargetDrop"
        />
      </template>
    </ul>

    <button
      v-if="canAddTarget"
      type="button"
      class="campaign-editor__add-reward"
      @click="addTarget"
    >
      <svg
        width="12"
        height="12"
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
      Add objective
    </button>

    <p v-if="selectedNodeApRankBlocked" class="campaign-editor__hint">
      This map isn't ranked (imported campaign map, or still in the ranking queue). AP and leaderboard-rank requirements are unavailable.
    </p>
    <p v-if="isMultiTarget" class="campaign-editor__hint">{{ PLUGIN_FIRST_TARGET_NOTE }}</p>
    <CampaignEditorNote v-if="targetsBombHits">
      Bomb counts come from BeatLeader only. A ScoreSaber-sourced score carries no bomb data and can never clear that objective.
    </CampaignEditorNote>
    <CampaignPluginWarning :show="targetsUnreadable" />

    <div class="campaign-editor__field">
      <span>
        Modifiers <small>(optional)</small>
        <CampaignFieldHint
          text="Click to cycle unset, required, forbidden. A score only counts here if it used every required modifier and none of the forbidden ones. Anything unlisted is free."
        />
      </span>
      <div class="campaign-editor__tag-chips">
        <button
          v-for="m in modifierChips"
          :key="m.id"
          type="button"
          class="campaign-editor__mod"
          :class="{
            'campaign-editor__mod--required': m.state === 'REQUIRED',
            'campaign-editor__mod--forbidden': m.state === 'FORBIDDEN',
          }"
          :aria-label="m.label"
          :title="m.label"
          @click="cycleNodeModifier(m.id)"
        >
          {{ m.code }}
        </button>
      </div>
    </div>
    <label class="campaign-editor__field">
      <span>
        Description <small>(optional)</small>
        <CampaignFieldHint :text="MARKDOWN_HINT" />
      </span>
      <textarea v-model="formNode.description" rows="2" @blur="commitNodeField('description')" />
    </label>
    <div v-if="editable && selectedDifficulty" class="campaign-editor__field">
      <div class="campaign-editor__btn-row">
        <BaseButton
          v-if="selectedDifficulty.beatsaverCode"
          size="sm"
          :loading="actionPending"
          title="Re-fetches the latest BeatSaver upload for this same map and repoints to its newest leaderboard IDs. Only this campaign's node changes."
          @click="refreshNodeVersion"
        >
          Refresh version
        </BaseButton>
        <BaseButton
          size="sm"
          title="Pick a different map or version by hand. Only this campaign's node changes."
          @click="openRepoint(selectedDifficulty.id)"
        >
          Change map / version
        </BaseButton>
      </div>
    </div>
  </fieldset>

  <fieldset
    v-else-if="activeTray === 'milestone'"
    class="campaign-editor__section"
    :disabled="!editable"
  >
    <label class="campaign-editor__check">
      <input
        type="checkbox"
        :checked="isMilestone"
        @change="setMilestone(($event.target as HTMLInputElement).checked)"
      />
      <span>Treat this node as a milestone</span>
      <CampaignFieldHint text="Rewards pay only when a cleared prerequisite path exists." />
    </label>
    <template v-if="isMilestone">
      <label class="campaign-editor__field">
        <span>Label</span>
        <input
          v-model="formNode.checkpointLabel"
          type="text"
          placeholder="e.g. Rookie"
          @blur="commitMilestoneLabel()"
        />
      </label>
      <div class="campaign-editor__field">
        <span>Label position</span>
        <CampaignLabelPositionPicker
          :model-value="formNode.checkpointLabelPosition"
          @select="selectNodeLabelPosition"
        />
      </div>
      <div class="campaign-editor__avatar-upload">
        <ImageUploader
          label="Avatar"
          hint="Square, optional"
          aspect-ratio="1 / 1"
          :image-url="selectedDifficulty?.checkpointAvatarUrl || null"
          :disabled="!editable"
          :upload-handler="uploadCheckpointAvatar"
          :remove-handler="removeCheckpointAvatar"
        />
      </div>
      <div class="campaign-editor__field-row">
        <label class="campaign-editor__field">
          <span>Band color</span>
          <div class="campaign-editor__color-row">
            <input
              type="color"
              :value="formNode.checkpointColor || defaultColorHex"
              @input="formNode.checkpointColor = ($event.target as HTMLInputElement).value"
              @change="commitNodeField('checkpointColor')"
            />
            <button
              type="button"
              class="campaign-editor__inline-btn"
              @click="resetNodeColor('checkpointColor')"
            >
              Auto
            </button>
          </div>
        </label>
        <label class="campaign-editor__field">
          <span>Band size: {{ resolveSize(formNode.checkpointSize, 30) }}px</span>
          <input
            type="range"
            min="14"
            max="64"
            step="1"
            :value="resolveSize(formNode.checkpointSize, 30)"
            @input="formNode.checkpointSize = Number(($event.target as HTMLInputElement).value)"
            @change="commitNodeField('checkpointSize')"
          />
        </label>
      </div>
    </template>
  </fieldset>

  <fieldset
    v-else-if="activeTray === 'shape'"
    class="campaign-editor__section"
    :disabled="!editable"
  >
    <div class="campaign-editor__field">
      <span>Border shape</span>
      <div class="campaign-editor__shape-row">
        <CampaignEditorTile
          v-for="t in shapeTiles"
          :key="t.label"
          :active="formNode.borderShape === t.value"
          :label="t.label"
          @select="selectBorderShape(t.value)"
        >
          <CampaignShapeGlyph :shape="t.value" />
        </CampaignEditorTile>
      </div>
    </div>
    <div class="campaign-editor__field">
      <span>Node size: {{ resolveSize(formNode.size, 48) }}px</span>
      <div class="campaign-editor__shape-row">
        <CampaignEditorTile
          v-for="t in sizeTiles"
          :key="t.value"
          :active="resolveSize(formNode.size, 48) === t.value"
          :label="`${t.label} (${t.value}px)`"
          @select="selectNodeSize(t.value)"
        >
          <CampaignShapeGlyph shape="hex" :radius="t.glyph" />
        </CampaignEditorTile>
      </div>
      <input
        type="range"
        min="24"
        max="96"
        step="1"
        :value="resolveSize(formNode.size, 48)"
        @input="formNode.size = Number(($event.target as HTMLInputElement).value)"
        @change="commitNodeField('size')"
      />
    </div>
    <label class="campaign-editor__field">
      <span>Border color</span>
      <div class="campaign-editor__color-row">
        <input
          type="color"
          :value="formNode.borderColor || defaultColorHex"
          @input="formNode.borderColor = ($event.target as HTMLInputElement).value"
          @change="commitNodeField('borderColor')"
        />
        <button
          type="button"
          class="campaign-editor__inline-btn"
          @click="resetNodeColor('borderColor')"
        >
          Auto
        </button>
      </div>
    </label>
    <div class="campaign-editor__avatar-upload">
      <ImageUploader
        label="Border art"
        hint="Frame or GIF"
        aspect-ratio="1 / 1"
        :image-url="selectedDifficulty?.nodeBorderUrl || null"
        :disabled="!editable"
        :upload-handler="uploadNodeBorder"
        :remove-handler="removeNodeBorder"
      />
    </div>
    <div v-if="selectedDifficulty?.nodeBorderUrl" class="campaign-editor__field">
      <span>
        Border layer
        <CampaignFieldHint
          text="Over frames the node and its own transparency decides how much cover shows through. Behind turns it into a backplate that spills past the node edge."
        />
      </span>
      <div class="campaign-editor__prereq-mode-toggle" role="radiogroup" aria-label="Border layer">
        <button
          type="button"
          role="radio"
          :aria-checked="formNode.nodeBorderLayer !== 'BELOW'"
          class="campaign-editor__prereq-mode-btn"
          :class="{
            'campaign-editor__prereq-mode-btn--active': formNode.nodeBorderLayer !== 'BELOW',
          }"
          @click="selectNodeBorderLayer('ABOVE')"
        >
          over cover
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="formNode.nodeBorderLayer === 'BELOW'"
          class="campaign-editor__prereq-mode-btn"
          :class="{
            'campaign-editor__prereq-mode-btn--active': formNode.nodeBorderLayer === 'BELOW',
          }"
          @click="selectNodeBorderLayer('BELOW')"
        >
          behind cover
        </button>
      </div>
    </div>
  </fieldset>

  <fieldset
    v-else-if="activeTray === 'bulk'"
    class="campaign-editor__section"
    :disabled="!editable"
  >
    <p class="campaign-editor__hint">
      {{ selectedCount }} nodes selected. Changes apply to all of them.
    </p>
    <div class="campaign-editor__field">
      <span>Node size</span>
      <div class="campaign-editor__shape-row">
        <CampaignEditorTile
          v-for="t in sizeTiles"
          :key="t.value"
          :label="`${t.label} (${t.value}px)`"
          @select="applyBulkSize(t.value)"
        >
          <CampaignShapeGlyph shape="hex" :radius="t.glyph" />
        </CampaignEditorTile>
      </div>
    </div>
    <div class="campaign-editor__field">
      <span>Border shape</span>
      <div class="campaign-editor__shape-row">
        <CampaignEditorTile
          v-for="t in shapeTiles"
          :key="t.label"
          :label="t.label"
          @select="applyBulkShape(t.value)"
        >
          <CampaignShapeGlyph :shape="t.value" />
        </CampaignEditorTile>
      </div>
    </div>
    <BaseButton
      size="sm"
      variant="destructive"
      :loading="actionPending"
      @click="removeSelectedNodes"
    >
      Remove {{ selectedCount }} nodes
    </BaseButton>
  </fieldset>

  <fieldset
    v-else-if="activeTray === 'unlock' && selectedDifficulty"
    class="campaign-editor__section"
    :disabled="!editable"
  >
    <div class="campaign-editor__prereq-mode" role="radiogroup" aria-label="Unlock when">
      <div class="campaign-editor__prereq-mode-toggle">
        <button
          type="button"
          role="radio"
          :aria-checked="selectedDifficulty.prerequisiteMode !== 'AND'"
          class="campaign-editor__prereq-mode-btn"
          :class="{
            'campaign-editor__prereq-mode-btn--active':
              selectedDifficulty.prerequisiteMode !== 'AND',
          }"
          @click="setPrereqMode('OR')"
        >
          any clears
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="selectedDifficulty.prerequisiteMode === 'AND'"
          class="campaign-editor__prereq-mode-btn"
          :class="{
            'campaign-editor__prereq-mode-btn--active':
              selectedDifficulty.prerequisiteMode === 'AND',
          }"
          @click="setPrereqMode('AND')"
        >
          all clear
        </button>
      </div>
    </div>
  </fieldset>

  <fieldset
    v-else-if="activeTray === 'rewards' && selectedDifficulty"
    class="campaign-editor__section"
    :disabled="!editable"
  >
    <CampaignEditorNote v-if="campaign && campaign.status !== 'CURATED'">
      Rewards are only handed out once the campaign is curated.
    </CampaignEditorNote>
    <label class="campaign-editor__field">
      <span>XP on clear</span>
      <div class="campaign-editor__slider-row">
        <input
          type="range"
          min="0"
          max="5000"
          step="50"
          v-model.number="formNode.xp"
          @change="commitNodeField('xp')"
        />
        <input
          type="number"
          min="0"
          step="10"
          v-model.number="formNode.xp"
          @blur="commitNodeField('xp')"
        />
      </div>
    </label>
    <ul v-if="selectedDifficulty.items.length > 0" class="campaign-editor__reward-list">
      <li
        v-for="item in selectedDifficulty.items"
        :key="item.itemId"
        class="campaign-editor__reward"
      >
        <CampaignRewardItem
          :name="item.itemName"
          :quantity="item.quantity"
          :item="rewardItemsById.get(item.itemId) ?? null"
        >
          <template v-if="editable" #action>
            <button
              type="button"
              class="campaign-editor__reward-remove"
              aria-label="Remove reward"
              @click="removeNodeItem(item.itemId)"
            >
              <svg
                width="12"
                height="12"
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
          </template>
        </CampaignRewardItem>
      </li>
    </ul>
    <p v-else class="campaign-editor__hint">
      Players who clear this node only get the XP. Add items to make it sweeter.
    </p>
    <button
      v-if="editable && canAddNodeReward"
      type="button"
      class="campaign-editor__add-reward"
      @click="openNodeItemPicker"
    >
      <svg
        width="12"
        height="12"
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
      Add reward
    </button>
    <p v-else-if="editable" class="campaign-editor__hint">
      Limit of {{ nodeRewardLimit }} item rewards per node reached.
    </p>
  </fieldset>

  <fieldset
    v-else-if="activeTray === 'barrierCondition' && selectedBarrier"
    class="campaign-editor__section"
    :disabled="!editable"
  >
    <div class="campaign-editor__field">
      <span>Condition <CampaignFieldHint :text="barrierConditionHint" /></span>
      <BaseSelect
        :model-value="formBarrier.conditionType"
        :options="barrierConditionOptionsFiltered.map((o) => ({ value: o.value, label: o.label }))"
        @update:model-value="onBarrierConditionTypeChange"
      />
    </div>
    <CampaignPluginWarning :show="barrierUnreadable" />
    <p v-if="barrierZeroBound" class="campaign-editor__hint">{{ PLUGIN_ZERO_BOUND_NOTE }}</p>
    <p v-if="barrierAffectsApRankBlocked" class="campaign-editor__hint">
      This gate affects a map that isn't ranked (campaign import or ranking queue), so AP
      and rank based conditions are unavailable.
    </p>
    <div
      v-if="!barrierMeta.noValue"
      class="campaign-editor__field"
      :class="{ 'campaign-editor__field--disabled': barrierMeta.metric === 'count' && barrierValueBounds.max <= 1 }"
    >
      <CampaignBoundsField
        :lower="barrierLowerDisplay"
        :upper="barrierUpperDisplay"
        :min="barrierValueBounds.min"
        :max="barrierValueBounds.max"
        :step="barrierValueBounds.step"
        :unit="barrierValueBounds.unit"
        :disabled="barrierMeta.metric === 'count' && barrierValueBounds.max <= 1"
        single-label="Goal"
        @update:lower="setBarrierBound('conditionValue', $event)"
        @update:upper="setBarrierBound('conditionValueMax', $event)"
        @commit="commitBarrierBounds"
      />
    </div>
    <p
      v-if="barrierMeta.metric === 'count' && affectedNodeList.length <= 1"
      class="campaign-editor__hint"
    >
      This gate only measures
      {{ affectedNodeList.length }}
      {{ affectedNodeList.length === 1 ? 'node' : 'nodes' }}, so the target is locked at
      {{ affectedNodeList.length || 1 }}. Add more affected nodes (Affected tab) to raise the cap.
    </p>
    <label class="campaign-editor__field">
      <span>
        Description <small>(optional)</small>
        <CampaignFieldHint :text="MARKDOWN_HINT" />
      </span>
      <textarea
        v-model="formBarrier.description"
        rows="2"
        @blur="commitBarrierField('description')"
      />
    </label>
  </fieldset>

  <fieldset
    v-else-if="activeTray === 'barrierAffected' && selectedBarrier"
    class="campaign-editor__section"
    :disabled="!editable"
  >
    <button
      type="button"
      class="campaign-editor__pick-toggle"
      :class="{ 'campaign-editor__pick-toggle--active': affectedPickMode }"
      title="Pick the nodes this gate measures. Separate from its connections: a gate can sit across the whole path but score only a section."
      @click="toggleAffectedPickMode"
    >
      <span class="campaign-editor__pick-dot" aria-hidden="true" />
      {{ affectedPickMode ? 'Picking… click nodes on the canvas' : 'Pick on canvas' }}
    </button>
    <ul v-if="affectedNodeList.length > 0" class="campaign-editor__affected-list">
      <li v-for="n in affectedNodeList" :key="n.id" class="campaign-editor__affected-item">
        <span class="campaign-editor__affected-name">{{ n.name }}</span>
        <button
          v-if="editable"
          type="button"
          class="campaign-editor__reward-remove"
          :aria-label="`Remove ${n.name}`"
          @click="toggleAffected(n.id)"
        >
          <svg
            width="12"
            height="12"
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
      </li>
    </ul>
    <p v-else class="campaign-editor__hint">
      No nodes yet. The gate can't be evaluated until it measures at least one node.
    </p>
    <div class="campaign-editor__field">
      <span>
        Opens when
        <CampaignFieldHint
          v-if="barrierMeta.metric === 'count'"
          text="This gates the connections feeding the gate, not the affected nodes above: a map-count gate always counts completions rather than aggregating a metric."
        />
      </span>
      <div
        class="campaign-editor__prereq-mode-toggle"
        role="radiogroup"
        aria-label="Gate opens when"
      >
        <button
          type="button"
          role="radio"
          :aria-checked="selectedBarrier.prerequisiteMode !== 'AND'"
          class="campaign-editor__prereq-mode-btn"
          :class="{
            'campaign-editor__prereq-mode-btn--active':
              selectedBarrier.prerequisiteMode !== 'AND',
          }"
          @click="setBarrierPrereqMode('OR')"
        >
          any clears
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="selectedBarrier.prerequisiteMode === 'AND'"
          class="campaign-editor__prereq-mode-btn"
          :class="{
            'campaign-editor__prereq-mode-btn--active':
              selectedBarrier.prerequisiteMode === 'AND',
          }"
          @click="setBarrierPrereqMode('AND')"
        >
          all clear
        </button>
      </div>
    </div>
  </fieldset>

  <fieldset
    v-else-if="activeTray === 'barrierStyle' && selectedBarrier"
    class="campaign-editor__section"
    :disabled="!editable"
  >
    <div class="campaign-editor__field">
      <span>Gate length: {{ resolveSize(formBarrier.size, 48) }}px</span>
      <input
        type="range"
        min="32"
        max="120"
        step="1"
        :value="resolveSize(formBarrier.size, 48)"
        @input="formBarrier.size = Number(($event.target as HTMLInputElement).value)"
        @change="commitBarrierField('size')"
      />
    </div>
    <label class="campaign-editor__field">
      <span>Gate color</span>
      <div class="campaign-editor__color-row">
        <input
          type="color"
          :value="formBarrier.borderColor || defaultBarrierColor"
          @input="formBarrier.borderColor = ($event.target as HTMLInputElement).value"
          @change="commitBarrierField('borderColor')"
        />
        <button type="button" class="campaign-editor__inline-btn" @click="resetBarrierColor">
          Auto
        </button>
      </div>
    </label>
    <label class="campaign-editor__field">
      <span>Label <small>(optional)</small></span>
      <input
        v-model="formBarrier.checkpointLabel"
        type="text"
        placeholder="e.g. Section clear"
        @blur="commitBarrierField('checkpointLabel')"
      />
    </label>
    <div class="campaign-editor__field">
      <span>Label position</span>
      <CampaignLabelPositionPicker
        :model-value="formBarrier.checkpointLabelPosition"
        @select="selectBarrierLabelPosition"
      />
    </div>
  </fieldset>

  <fieldset
    v-else-if="activeTray === 'barrierRewards' && selectedBarrier"
    class="campaign-editor__section"
    :disabled="!editable"
  >
    <CampaignEditorNote v-if="campaign && campaign.status !== 'CURATED'">
      Rewards are only handed out once the campaign is curated.
    </CampaignEditorNote>
    <label class="campaign-editor__field">
      <span>XP on clear</span>
      <div class="campaign-editor__slider-row">
        <input
          type="range"
          min="0"
          max="5000"
          step="50"
          v-model.number="formBarrier.xp"
          @change="commitBarrierField('xp')"
        />
        <input
          type="number"
          min="0"
          step="10"
          v-model.number="formBarrier.xp"
          @blur="commitBarrierField('xp')"
        />
      </div>
    </label>
    <ul v-if="selectedBarrier.items.length > 0" class="campaign-editor__reward-list">
      <li v-for="item in selectedBarrier.items" :key="item.itemId" class="campaign-editor__reward">
        <CampaignRewardItem
          :name="item.itemName"
          :quantity="item.quantity"
          :item="rewardItemsById.get(item.itemId) ?? null"
        >
          <template v-if="editable" #action>
            <button
              type="button"
              class="campaign-editor__reward-remove"
              aria-label="Remove reward"
              @click="removeBarrierItem(item.itemId)"
            >
              <svg
                width="12"
                height="12"
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
          </template>
        </CampaignRewardItem>
      </li>
    </ul>
    <p v-else class="campaign-editor__hint">Clearing this gate only grants the XP. Add items too.</p>
    <button
      v-if="editable && canAddBarrierReward"
      type="button"
      class="campaign-editor__add-reward"
      @click="openBarrierItemPicker"
    >
      <svg
        width="12"
        height="12"
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
      Add reward
    </button>
  </fieldset>

  <fieldset
    v-else-if="activeTray === 'text' && selectedText"
    class="campaign-editor__section"
    :disabled="!editable"
  >
    <div class="campaign-editor__field" @focusout="commitTextField('content')">
      <span>Content</span>
      <RichTextEditor
        :model-value="formText.content"
        :min-height="120"
        :max-height="240"
        aria-label="Text content"
        @update:model-value="onTextContentInput"
      />
    </div>
    <div class="campaign-editor__field">
      <span>Font</span>
      <BaseSelect
        :model-value="formText.font"
        :options="fontOptions"
        @update:model-value="
          (v: string) => {
            formText.font = v
            commitTextField('font')
          }
        "
      />
    </div>
    <label class="campaign-editor__field">
      <span>Scale: {{ formText.scale.toFixed(1) }}×</span>
      <input
        type="range"
        min="0.5"
        max="3"
        step="0.1"
        v-model.number="formText.scale"
        @change="commitTextField('scale')"
      />
    </label>
    <label class="campaign-editor__field">
      <span>Color</span>
      <div class="campaign-editor__color-row">
        <input
          type="color"
          :value="formText.color || defaultColorHex"
          @input="formText.color = ($event.target as HTMLInputElement).value"
          @change="commitTextField('color')"
        />
        <button
          type="button"
          class="campaign-editor__inline-btn"
          @click="
            () => {
              formText.color = ''
              commitTextField('color')
            }
          "
        >
          Auto
        </button>
      </div>
    </label>
    <div class="campaign-editor__field">
      <span>Effects</span>
      <div class="campaign-editor__tag-chips">
        <button
          v-for="fx in textEffects"
          :key="fx"
          type="button"
          class="campaign-editor__chip"
          :class="{ 'campaign-editor__chip--active': textEffectActive(fx) }"
          @click="toggleTextEffect(fx)"
        >
          {{ fx }}
        </button>
      </div>
    </div>
  </fieldset>

  <fieldset
    v-else-if="activeTray === 'connection' && selectedEdge"
    class="campaign-editor__section"
    :disabled="!editable"
  >
    <label class="campaign-editor__field">
      <span>
        Connection color
        <CampaignFieldHint text="Hex or named color. Leave empty for the default arrow color." />
      </span>
      <div class="campaign-editor__color-row">
        <input
          type="color"
          aria-label="Connection color swatch"
          :value="connectionSwatch"
          @input="formConnection.color = ($event.target as HTMLInputElement).value"
          @change="commitConnectionColor"
        />
        <input
          class="campaign-editor__color-text"
          type="text"
          autocomplete="off"
          spellcheck="false"
          maxlength="33"
          placeholder="#f5b800 · gold"
          :aria-invalid="!!connectionColorError"
          v-model="formConnection.color"
          @blur="commitConnectionColor"
          @keydown.enter.prevent="commitConnectionColor"
        />
        <button type="button" class="campaign-editor__inline-btn" @click="resetConnectionColor">
          Auto
        </button>
      </div>
      <p v-if="connectionColorError" class="campaign-editor__field-error" role="alert">
        {{ connectionColorError }}
      </p>
    </label>
  </fieldset>
</template>

<style scoped>
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

.campaign-editor__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.campaign-editor__field > span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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
}

.campaign-editor__field--disabled {
  opacity: 0.55;
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

.campaign-editor__btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.campaign-editor__slider-row {
  display: grid;
  grid-template-columns: 1fr 84px;
  gap: var(--space-sm);
  align-items: center;
}

.campaign-editor__slider-row input[type='range'] {
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

.campaign-editor__color-row input[type='color'] {
  width: 44px;
  height: 32px;
  flex-shrink: 0;
  padding: 2px;
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  background: var(--bg-base);
  cursor: pointer;
}

.campaign-editor__color-text {
  flex: 1;
  min-width: 0;
  width: auto;
  font-family: var(--font-mono);
}

.campaign-editor__color-text[aria-invalid='true'] {
  border-color: var(--error);
}

.campaign-editor__field-error {
  margin: 2px 0 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--error);
  line-height: 1.4;
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
  transition:
    color 120ms ease,
    border-color 120ms ease;
}

.campaign-editor__inline-btn:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
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

.campaign-editor__check--disabled {
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.campaign-editor__hint {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
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
  transition:
    color 120ms ease,
    background 120ms ease;
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
  transition:
    color 120ms ease,
    border-color 120ms ease;
}

.campaign-editor__add-reward:hover {
  color: var(--page-accent);
  border-color: var(--page-accent);
}

.campaign-editor__status {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
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

.campaign-editor__audit {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--bg-overlay);
}

.campaign-editor__audit-title {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.campaign-editor__audit-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px var(--space-sm);
  margin: 0;
}

.campaign-editor__audit-stats dt {
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.campaign-editor__audit-stats dd {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-primary);
}

.campaign-editor__audit-stats dd small {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.campaign-editor__audit-over,
.campaign-editor__audit-over small {
  color: var(--warning);
}

.campaign-editor__audit-refs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.campaign-editor__audit-ref {
  max-width: 100%;
  padding: 2px 6px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 600;
  color: inherit;
  background: transparent;
  border: 1px solid color-mix(in srgb, currentColor 40%, transparent);
  border-radius: 2px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background 120ms ease;
}

.campaign-editor__audit-ref:hover {
  background: color-mix(in srgb, currentColor 14%, transparent);
}

.campaign-editor__avatar-upload {
  max-width: 180px;
}

.campaign-editor__image-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
}

.campaign-editor__image-row :deep(.image-uploader) {
  width: 100%;
  max-width: 320px;
}

.campaign-editor__image-row :deep(.image-uploader:last-child) {
  max-width: 200px;
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
  transition:
    color 120ms ease,
    border-color 120ms ease,
    background 120ms ease;
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

.campaign-editor__mod {
  padding: 3px 8px;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-tertiary);
  background: transparent;
  border: 1px solid var(--bg-overlay);
  border-radius: 2px;
  cursor: pointer;
  transition:
    color 120ms ease,
    border-color 120ms ease,
    background 120ms ease;
}

.campaign-editor__mod:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.campaign-editor__mod--required {
  color: var(--success);
  border-color: color-mix(in srgb, var(--success) 55%, transparent);
  background: color-mix(in srgb, var(--success) 10%, transparent);
}

.campaign-editor__mod--forbidden {
  color: var(--error);
  border-color: color-mix(in srgb, var(--error) 55%, transparent);
  background: color-mix(in srgb, var(--error) 10%, transparent);
  text-decoration: line-through;
}

.campaign-editor__targets {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.campaign-editor__target-join {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--text-tertiary);
}

.campaign-editor__target-join::before,
.campaign-editor__target-join::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--bg-overlay);
}

.campaign-editor__target-join--or {
  color: var(--page-accent);
}

.campaign-editor__shape-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
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
  transition:
    color 120ms ease,
    background 120ms ease;
}

.campaign-editor__prereq-mode-btn:hover {
  color: var(--text-primary);
}

.campaign-editor__prereq-mode-btn--active {
  color: var(--page-accent);
  background: var(--bg-elevated);
}

.campaign-editor__collab-owner {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 8px 10px;
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
}

.campaign-editor__collab-owner-tag {
  flex-shrink: 0;
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.campaign-editor__collab-owner-name {
  min-width: 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.campaign-editor__collab-skeletons {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.campaign-editor__collab-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.campaign-editor__collab {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  gap: var(--space-sm);
  align-items: center;
  padding: 6px 8px;
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
}

.campaign-editor__collab-avatar {
  width: 34px;
  height: 34px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--bg-elevated);
}

.campaign-editor__collab-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.campaign-editor__collab-meta {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.campaign-editor__collab-name {
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.campaign-editor__collab-sub {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.6875rem;
}

.campaign-editor__collab-status {
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.campaign-editor__collab-status--pending {
  color: var(--warning);
}

.campaign-editor__collab-status--accepted {
  color: var(--page-accent);
}

.campaign-editor__pick-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  align-self: flex-start;
  padding: 7px 12px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  cursor: pointer;
  transition:
    color 120ms ease,
    border-color 120ms ease,
    background 120ms ease;
}

.campaign-editor__pick-toggle:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.campaign-editor__pick-toggle--active {
  color: var(--warning);
  border-color: var(--warning);
  background: color-mix(in srgb, var(--warning) 12%, transparent);
}

.campaign-editor__pick-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.5;
}

.campaign-editor__pick-toggle--active .campaign-editor__pick-dot {
  opacity: 1;
  animation: pick-pulse 1.4s ease-in-out infinite;
}

@keyframes pick-pulse {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .campaign-editor__pick-toggle--active .campaign-editor__pick-dot {
    animation: none;
  }
}

.campaign-editor__affected-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.campaign-editor__affected-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: 5px 8px;
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
}

.campaign-editor__affected-name {
  min-width: 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
