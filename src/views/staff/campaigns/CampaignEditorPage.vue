<script setup lang="ts">
import BaseBanner from '@/components/common/BaseBanner.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import Breadcrumbs from '@/components/common/Breadcrumbs.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import CampaignRoadmap from '@/components/domain/CampaignRoadmap.vue'
import { formatDifficulty } from '@/utils/mappers'
import { provide } from 'vue'
import CampaignItemPicker from './CampaignItemPicker.vue'
import CampaignMapPicker from './CampaignMapPicker.vue'
import CampaignTrayRail from './CampaignTrayRail.vue'
import CampaignTrays from './CampaignTrays.vue'
import { CAMPAIGN_EDITOR_KEY } from './campaignEditorContext'
import { useCampaignEditor } from './useCampaignEditor'

const editor = useCampaignEditor()
provide(CAMPAIGN_EDITOR_KEY, editor)

const {
  auth,
  campaign,
  loading,
  error,
  actionPending,
  actionError,
  actionNotice,
  showMapPicker,
  selectedId,
  selectedIdList,
  existingMapDifficultyIds,
  canvasMode,
  itemPickerFor,
  requirementDirtyIds,
  showRepublishWarning,
  isCurator,
  canAccess,
  editable,
  accent,
  nodeAccents,
  selectedDifficulty,
  selectedMeta,
  breadcrumbs,
  handleMove,
  handleMoveMany,
  handleConnect,
  handleDisconnect,
  handleEmptyClick,
  openMapPicker,
  handleMapsPicked,
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
  closeTray,
} = editor
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
      <EmptyState
        icon="🔒"
        message="You can only edit campaigns you created, or you'll need curator access."
      />
    </template>

    <template v-else>
      <main class="campaign-editor__canvas" aria-label="Campaign roadmap">
        <CampaignRoadmap
          :difficulties="campaign.difficulties"
          :accent-color="accent"
          :node-accents="nodeAccents"
          :background-url="campaign.backgroundUrl"
          :show-starfield="!campaign.backgroundUrl"
          :focus-id="selectedId"
          :default-scale="1.3"
          :selected-id="selectedId"
          :selected-ids="selectedIdList"
          :editable="editable"
          :mode="canvasMode"
          @select="handleSelect"
          @select-many="handleSelectMany"
          @toggle-select="handleToggleSelect"
          @deselect="handleDeselect"
          @move="handleMove"
          @move-many="handleMoveMany"
          @empty-click="handleEmptyClick"
          @connect="handleConnect"
          @disconnect="handleDisconnect"
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
            </div>
          </template>
        </CampaignRoadmap>

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

          <Transition name="campaign-editor__banner">
            <BaseBanner
              v-if="actionNotice"
              class="campaign-editor__banner"
              variant="warning"
              role="status"
              @close="actionNotice = null"
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
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="8.01" />
                </svg>
              </template>
              <span class="campaign-editor__banner-text">{{ actionNotice }}</span>
            </BaseBanner>
          </Transition>
        </div>

        <div
          v-if="editable"
          class="campaign-editor__mode-toggle"
          role="radiogroup"
          aria-label="Canvas mode"
        >
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
      </main>

      <CampaignTrayRail />

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
                v-if="selectedDifficulty.coverUrl"
                :src="selectedDifficulty.coverUrl"
                :alt="selectedDifficulty.songName"
                loading="lazy"
              />
            </div>
            <div class="campaign-editor__node-song-meta">
              <h3>{{ selectedDifficulty.songName }}</h3>
              <p>{{ selectedDifficulty.songAuthor }} · {{ selectedDifficulty.mapAuthor }}</p>
              <p class="campaign-editor__node-diff">
                {{ formatDifficulty(selectedDifficulty.difficulty) }}
                <span v-if="selectedMeta?.complexity != null"
                  >· complexity {{ selectedMeta.complexity.toFixed(1) }}</span
                >
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

          <div class="campaign-editor__tray-body">
            <CampaignTrays />
          </div>
        </section>
      </Transition>

      <CampaignMapPicker
        v-if="showMapPicker"
        :loading="actionPending"
        :existing-ids="Array.from(existingMapDifficultyIds)"
        @close="closeMapPicker"
        @pick="handleMapsPicked"
      />

      <CampaignItemPicker
        v-if="itemPickerFor"
        :loading="actionPending"
        @close="itemPickerFor = null"
        @pick="handleItemPicked"
      />

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
