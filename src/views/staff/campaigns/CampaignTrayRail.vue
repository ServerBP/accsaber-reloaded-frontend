<script setup lang="ts">
import CampaignTrayIcon from './CampaignTrayIcon.vue'
import { useCampaignEditorContext } from './campaignEditorContext'

const { campaignTrays, nodeTrays, activeTray, selectedDifficulty, toggleTray } =
  useCampaignEditorContext()
</script>

<template>
  <aside class="campaign-editor__tray-rail" aria-label="Editor trays">
    <div class="campaign-editor__tray-group">
      <span class="campaign-editor__tray-group-label">Campaign</span>
      <button
        v-for="tray in campaignTrays"
        :key="tray.id"
        type="button"
        class="campaign-editor__tray-btn"
        :class="[
          { 'campaign-editor__tray-btn--active': activeTray === tray.id },
          tray.id === 'status' && tray.tone ? `campaign-editor__tray-btn--${tray.tone}` : '',
        ]"
        :aria-pressed="activeTray === tray.id"
        @click="toggleTray(tray.id)"
      >
        <CampaignTrayIcon :name="tray.icon" />
        <span class="campaign-editor__tray-btn-label">{{ tray.label }}</span>
        <span v-if="tray.count" class="campaign-editor__tray-count">{{ tray.count }}</span>
      </button>
    </div>

    <div class="campaign-editor__tray-group">
      <span class="campaign-editor__tray-group-label">Node</span>
      <p v-if="!selectedDifficulty" class="campaign-editor__tray-empty">Select a node</p>
      <button
        v-for="tray in nodeTrays"
        v-else
        :key="tray.id"
        type="button"
        class="campaign-editor__tray-btn"
        :class="{ 'campaign-editor__tray-btn--active': activeTray === tray.id }"
        :aria-pressed="activeTray === tray.id"
        @click="toggleTray(tray.id)"
      >
        <CampaignTrayIcon :name="tray.icon" />
        <span class="campaign-editor__tray-btn-label">{{ tray.label }}</span>
        <span v-if="tray.count" class="campaign-editor__tray-count">{{ tray.count }}</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.campaign-editor__tray-rail {
  position: absolute;
  top: calc(var(--space-md) + 44px);
  left: var(--space-md);
  bottom: var(--space-md);
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  width: 76px;
  padding: var(--space-sm);
  background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
  border: 1px solid var(--bg-overlay);
  border-radius: 6px;
  overflow-y: auto;
  overflow-x: hidden;
  pointer-events: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--bg-overlay) transparent;
}

.campaign-editor__tray-rail::-webkit-scrollbar {
  width: 5px;
}
.campaign-editor__tray-rail::-webkit-scrollbar-thumb {
  background: var(--bg-overlay);
  border-radius: 3px;
}

.campaign-editor__tray-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.campaign-editor__tray-group + .campaign-editor__tray-group {
  padding-top: var(--space-sm);
  border-top: 1px solid var(--bg-overlay);
}

.campaign-editor__tray-group-label {
  padding: 0 2px 2px;
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.campaign-editor__tray-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    color 120ms ease,
    background 120ms ease,
    border-color 120ms ease;
}

.campaign-editor__tray-btn--draft {
  color: var(--text-secondary);
}
.campaign-editor__tray-btn--published {
  color: var(--info);
}
.campaign-editor__tray-btn--editing {
  color: var(--warning);
}
.campaign-editor__tray-btn--curated {
  color: var(--success);
}

.campaign-editor__tray-btn:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.campaign-editor__tray-btn--active,
.campaign-editor__tray-btn--active:hover {
  color: var(--page-accent);
  background: color-mix(in srgb, var(--page-accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--page-accent) 45%, transparent);
}

.campaign-editor__tray-btn-label {
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.1;
  text-align: center;
}

.campaign-editor__tray-count {
  position: absolute;
  top: 4px;
  right: 6px;
  min-width: 15px;
  height: 15px;
  padding: 0 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 0.5625rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-overlay);
  border-radius: 999px;
}

.campaign-editor__tray-empty {
  margin: 0;
  padding: 4px 2px;
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 500;
  color: var(--text-tertiary);
  line-height: 1.3;
  text-align: center;
}

@media (max-width: 860px) {
  .campaign-editor__tray-rail {
    position: relative;
    top: auto;
    left: auto;
    bottom: auto;
    flex-direction: row;
    width: auto;
    margin: var(--space-md) var(--space-md) 0;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .campaign-editor__tray-group {
    flex-direction: row;
    align-items: center;
  }

  .campaign-editor__tray-group + .campaign-editor__tray-group {
    padding-top: 0;
    padding-left: var(--space-sm);
    border-top: none;
    border-left: 1px solid var(--bg-overlay);
  }

  .campaign-editor__tray-group-label {
    align-self: center;
    padding: 0 4px 0 0;
  }
}
</style>
