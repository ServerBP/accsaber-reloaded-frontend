<script setup lang="ts">
defineProps<{ curated: boolean }>()

const NOTICE = 'Rewards are only handed out once the campaign is curated.'
</script>

<template>
  <span
    v-if="!curated"
    class="campaign-reward-notice"
    role="img"
    :aria-label="NOTICE"
    :title="NOTICE"
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
      <path
        d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
      />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12" y2="17.01" />
    </svg>
  </span>
</template>

<style scoped>
.campaign-reward-notice {
  display: inline-flex;
  align-items: center;
  color: var(--warning);
  cursor: help;
  vertical-align: middle;
}
</style>
