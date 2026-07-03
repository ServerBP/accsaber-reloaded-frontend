<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import ImageUploader from '@/components/common/ImageUploader.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import RichTextEditor from '@/components/common/RichTextEditor.vue'
import CampaignRewardItem from '@/components/domain/CampaignRewardItem.vue'
import CountryFlag from '@/components/domain/CountryFlag.vue'
import CampaignEditorTile from './CampaignEditorTile.vue'
import CampaignShapeGlyph from './CampaignShapeGlyph.vue'
import CampaignLabelPositionPicker from './CampaignLabelPositionPicker.vue'
import { useCampaignEditorContext } from './campaignEditorContext'
import { onAvatarError } from '@/composables/useAvatarFallback'
import { computed } from 'vue'

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
  isAdminRoute,
  isAdmin,
  isCurator,
  isCreator,
  isTerminal,
  sinkCount,
  canCurate,
  creatorBlocked,
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
  doDeactivate,
  selectedDifficulty,
  formNode,
  requirementTypeOptions,
  onRequirementTypeChange,
  requirementBounds,
  requirementNumberBounds,
  requirementEquivalents,
  requirementValueDisplay,
  commitNodeField,
  uploadCheckpointAvatar,
  removeCheckpointAvatar,
  isMilestone,
  setMilestone,
  defaultColorHex,
  resetNodeColor,
  parseSizeInt,
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
  barrierValueDisplay,
  barrierValueBounds,
  onBarrierConditionTypeChange,
  commitBarrierField,
  affectedPickMode,
  toggleAffectedPickMode,
  toggleAffected,
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
</script>

<template>
  <template v-if="activeTray === 'status'">
    <header v-if="!isUnsavedDraft && campaign" class="campaign-editor__status">
      <div
        v-if="!isDraftStatus || (!isAdminRoute && isCreator)"
        class="campaign-editor__status-row"
      >
        <span
          class="campaign-editor__status-pill"
          :class="`campaign-editor__status-pill--${campaign.status.toLowerCase()}`"
        >
          {{ statusLabel[campaign.status] }}
        </span>
        <span v-if="campaign.seekingCuration" class="campaign-editor__status-flag">
          Seeking review
        </span>
      </div>
      <p
        v-if="!isAdminRoute && isCreator && creatorStatusMeaning"
        class="campaign-editor__status-meaning"
      >
        {{ creatorStatusMeaning }}
      </p>
      <p v-else-if="!isDraftStatus" class="campaign-editor__status-meaning">
        {{ statusMeaning[campaign.status] }}
      </p>

      <div class="campaign-editor__status-actions">
        <template v-if="!isAdminRoute && isCreator">
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

        <template v-if="isAdminRoute">
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
            v-if="isCurator && campaign.status !== 'CURATED'"
            size="sm"
            variant="primary"
            :loading="actionPending"
            :disabled="!canCurate"
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

      <p
        v-if="isAdminRoute && isTerminal && sinkCount !== 1 && isCurator"
        class="campaign-editor__status-warning"
      >
        Terminal mode needs exactly one sink. You have {{ sinkCount }}.
      </p>
      <p v-if="creatorBlocked" class="campaign-editor__status-warning">
        You flagged this campaign for review. A curator needs to lift the flag before you can edit
        again.
      </p>
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
      <span>Description</span>
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
      <span>Background color</span>
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
      <small>Hex, named, or rgb/hsl. Tints the roadmap backdrop; leave empty for the default.</small>
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
  </fieldset>

  <fieldset
    v-else-if="activeTray === 'completion' && campaign"
    class="campaign-editor__section"
    :disabled="!editable"
  >
    <p v-if="campaign.status !== 'CURATED'" class="campaign-editor__reward-note">
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
        <path
          d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
        />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12" y2="17.01" />
      </svg>
      <span>Rewards are only handed out once the campaign is curated.</span>
    </p>
    <label v-if="isCurator" class="campaign-editor__field">
      <span>Completion XP</span>
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
      <small>Awarded on completion once curated.</small>
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

    <div v-if="collaboratorsLoading" class="campaign-editor__collab-skeletons">
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
    <div class="campaign-editor__field">
      <span>Type</span>
      <BaseSelect
        :model-value="formNode.requirementType"
        :options="requirementTypeOptions.map((o) => ({ value: o.value, label: o.label }))"
        @update:model-value="onRequirementTypeChange"
      />
    </div>
    <label v-if="formNode.requirementType !== 'FC'" class="campaign-editor__field">
      <span>Target {{ requirementBounds.unit ? `(${requirementBounds.unit})` : '' }}</span>
      <div class="campaign-editor__slider-row">
        <input
          type="range"
          :min="requirementBounds.min"
          :max="requirementBounds.max"
          :step="requirementBounds.step"
          v-model.number="requirementValueDisplay"
          @change="commitNodeField('requirementValue')"
        />
        <input
          type="number"
          :min="requirementNumberBounds.min"
          :max="requirementNumberBounds.max"
          :step="requirementNumberBounds.step"
          v-model.number="requirementValueDisplay"
          @blur="commitNodeField('requirementValue')"
        />
      </div>
      <p v-if="requirementEquivalents.length" class="campaign-editor__equiv">
        <span class="campaign-editor__equiv-approx" aria-hidden="true">≈</span>
        <template v-for="(e, i) in requirementEquivalents" :key="e.key">
          <span v-if="i > 0" class="campaign-editor__equiv-sep" aria-hidden="true">·</span>
          <span class="campaign-editor__equiv-val">{{ e.text }}</span>
        </template>
      </p>
    </label>
    <p v-if="formNode.requirementType === 'RANK'" class="campaign-editor__hint">
      Lower is better. Cleared when the player's leaderboard rank on the map is this position or
      better (rank ≤ target).
    </p>
    <label class="campaign-editor__field">
      <span>Description <small>(optional)</small></span>
      <textarea v-model="formNode.description" rows="2" @blur="commitNodeField('description')" />
    </label>
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
    </label>
    <p v-if="isMilestone" class="campaign-editor__hint">
      Rewards pay only when a cleared prerequisite path exists.
    </p>
    <template v-if="isMilestone">
      <label class="campaign-editor__field">
        <span>Label</span>
        <input
          v-model="formNode.checkpointLabel"
          type="text"
          placeholder="e.g. Rookie"
          @blur="commitNodeField('checkpointLabel')"
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
          <span>Band size: {{ parseSizeInt(formNode.checkpointSize, 30) }}px</span>
          <input
            type="range"
            min="14"
            max="64"
            step="1"
            :value="parseSizeInt(formNode.checkpointSize, 30)"
            @input="formNode.checkpointSize = ($event.target as HTMLInputElement).value"
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
    <label class="campaign-editor__field">
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
    </label>
    <div class="campaign-editor__field">
      <span>Node size: {{ parseSizeInt(formNode.size, 48) }}px</span>
      <div class="campaign-editor__shape-row">
        <CampaignEditorTile
          v-for="t in sizeTiles"
          :key="t.value"
          :active="parseSizeInt(formNode.size, 48) === t.value"
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
        :value="parseSizeInt(formNode.size, 48)"
        @input="formNode.size = ($event.target as HTMLInputElement).value"
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
  </fieldset>

  <fieldset
    v-else-if="activeTray === 'bulk'"
    class="campaign-editor__section"
    :disabled="!editable"
  >
    <p class="campaign-editor__hint">
      {{ selectedCount }} nodes selected. Changes apply to all of them.
    </p>
    <label class="campaign-editor__field">
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
    </label>
    <label class="campaign-editor__field">
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
    </label>
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
    <p v-if="campaign && campaign.status !== 'CURATED'" class="campaign-editor__reward-note">
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
        <path
          d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
        />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12" y2="17.01" />
      </svg>
      <span>Rewards are only handed out once the campaign is curated.</span>
    </p>
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
      <span>Condition</span>
      <BaseSelect
        :model-value="formBarrier.conditionType"
        :options="barrierConditionOptions.map((o) => ({ value: o.value, label: o.label }))"
        @update:model-value="onBarrierConditionTypeChange"
      />
    </div>
    <label v-if="!barrierMeta.noValue" class="campaign-editor__field">
      <span>Target {{ barrierValueBounds.unit ? `(${barrierValueBounds.unit})` : '' }}</span>
      <div class="campaign-editor__slider-row">
        <input
          type="range"
          :min="barrierValueBounds.min"
          :max="barrierValueBounds.max"
          :step="barrierValueBounds.step"
          v-model.number="barrierValueDisplay"
          @change="commitBarrierField('conditionValue')"
        />
        <input
          type="number"
          :min="barrierValueBounds.min"
          :step="barrierValueBounds.step"
          v-model.number="barrierValueDisplay"
          @blur="commitBarrierField('conditionValue')"
        />
      </div>
    </label>
    <p v-if="barrierMeta.noValue" class="campaign-editor__hint">
      Opens once every affected node has been full-comboed.
    </p>
    <p v-else-if="barrierMeta.lowerBetter" class="campaign-editor__hint">
      Lower is better. Opens when the {{ barrierMeta.agg }} leaderboard rank across the affected
      nodes reaches this position or better.
    </p>
    <p v-else class="campaign-editor__hint">
      Aggregated over the affected nodes ({{ barrierMeta.agg }}). Higher clears the gate.
    </p>
    <label class="campaign-editor__field">
      <span>Description <small>(optional)</small></span>
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
    <p class="campaign-editor__hint">
      Pick the nodes this gate measures. Separate from its connections: a gate can sit across the
      whole path but score only a section.
    </p>
    <button
      type="button"
      class="campaign-editor__pick-toggle"
      :class="{ 'campaign-editor__pick-toggle--active': affectedPickMode }"
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
  </fieldset>

  <fieldset
    v-else-if="activeTray === 'barrierStyle' && selectedBarrier"
    class="campaign-editor__section"
    :disabled="!editable"
  >
    <div class="campaign-editor__field">
      <span>Gate length: {{ parseSizeInt(formBarrier.size, 48) }}px</span>
      <input
        type="range"
        min="32"
        max="120"
        step="1"
        :value="parseSizeInt(formBarrier.size, 48)"
        @input="formBarrier.size = ($event.target as HTMLInputElement).value"
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
    <p v-if="campaign && campaign.status !== 'CURATED'" class="campaign-editor__reward-note">
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
        <path
          d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
        />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12" y2="17.01" />
      </svg>
      <span>Rewards are only handed out once the campaign is curated.</span>
    </p>
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

.campaign-editor__slider-row input[type='range'] {
  width: 100%;
  padding: 0;
  background: transparent;
  border: none;
  accent-color: var(--page-accent);
}

.campaign-editor__equiv {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px;
  margin: 2px 0 0;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--text-secondary);
}

.campaign-editor__equiv-approx,
.campaign-editor__equiv-sep {
  color: var(--text-tertiary);
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

.campaign-editor__reward-note {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  padding: 7px 9px;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  line-height: 1.4;
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning) 30%, transparent);
  border-radius: 3px;
}

.campaign-editor__reward-note svg {
  flex-shrink: 0;
  margin-top: 1px;
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
