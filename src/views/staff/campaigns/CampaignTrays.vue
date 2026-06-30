<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import ImageUploader from '@/components/common/ImageUploader.vue'
import CampaignRewardItem from '@/components/domain/CampaignRewardItem.vue'
import CampaignEditorTile from './CampaignEditorTile.vue'
import CampaignShapeGlyph from './CampaignShapeGlyph.vue'
import { useCampaignEditorContext } from './campaignEditorContext'

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
  commitMetaField,
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
  commitAvatarUrl,
  isMilestone,
  setMilestone,
  defaultColorHex,
  resetNodeColor,
  parseSizeInt,
  shapeTiles,
  sizeTiles,
  selectBorderShape,
  selectNodeSize,
  selectedCount,
  applyBulkSize,
  applyBulkShape,
  removeSelectedNodes,
  setPrereqMode,
  removeNodeItem,
  openNodeItemPicker,
} = useCampaignEditorContext()
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
    <label v-if="isCurator" class="campaign-editor__field">
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
    <label class="campaign-editor__check">
      <input
        type="checkbox"
        v-model="formMeta.progressionAgnostic"
        @change="commitMetaField('progressionAgnostic')"
      />
      <span>Progression agnostic (any order)</span>
    </label>
    <label class="campaign-editor__check">
      <input
        type="checkbox"
        v-model="formMeta.playlistExportEnabled"
        @change="commitMetaField('playlistExportEnabled')"
      />
      <span>Playlist export enabled</span>
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
      <label class="campaign-editor__field">
        <span>Avatar URL <small>(optional)</small></span>
        <input
          v-model="formNode.checkpointAvatarUrl"
          type="url"
          placeholder="https://..."
          @blur="commitAvatarUrl"
        />
      </label>
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
      v-if="editable"
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

.campaign-editor__image-row {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: var(--space-sm);
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
</style>
