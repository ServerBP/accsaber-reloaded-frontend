<script setup lang="ts">
import PseudoLoginModal from '@/components/domain/PseudoLoginModal.vue'
import { useCampaignVote } from '@/composables/useCampaignVote'
import type { CampaignResponse } from '@/types/api/campaigns'
import type { CampaignVoteDirection } from '@/types/enums'
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    campaign: CampaignResponse
    size?: 'sm' | 'md'
  }>(),
  { size: 'sm' },
)

const loginOpen = ref(false)

const { up, down, myVote, error, votable, needsLogin, restricted, toggle } = useCampaignVote(
  () => props.campaign,
)

const totalVotes = computed(() => up.value + down.value)
const scorePct = computed(() => Math.round((props.campaign.voteScore ?? 0) * 100))

function onVote(event: MouseEvent, direction: CampaignVoteDirection) {
  event.preventDefault()
  event.stopPropagation()
  if (restricted.value) return
  if (needsLogin.value) {
    loginOpen.value = true
    return
  }
  void toggle(direction)
}
</script>

<template>
  <div v-if="votable" class="vote" :class="`vote--${size}`">
    <div
      class="vote__group"
      role="group"
      aria-label="Campaign rating"
      :title="restricted ? 'Voting is unavailable for your account' : undefined"
    >
      <button
        type="button"
        class="vote__btn vote__btn--up"
        :class="{ 'vote__btn--active': myVote === 'UP' }"
        :aria-pressed="myVote === 'UP'"
        :aria-label="`Upvote (${up})`"
        :disabled="restricted"
        @click="onVote($event, 'UP')"
      >
        <svg
          class="vote__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 14 12 8 18 14" />
        </svg>
        <span class="vote__count">{{ up.toLocaleString() }}</span>
      </button>
      <span class="vote__divider" aria-hidden="true" />
      <button
        type="button"
        class="vote__btn vote__btn--down"
        :class="{ 'vote__btn--active': myVote === 'DOWN' }"
        :aria-pressed="myVote === 'DOWN'"
        :aria-label="`Downvote (${down})`"
        :disabled="restricted"
        @click="onVote($event, 'DOWN')"
      >
        <svg
          class="vote__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 10 12 16 18 10" />
        </svg>
        <span class="vote__count">{{ down.toLocaleString() }}</span>
      </button>
      <span class="vote__divider" aria-hidden="true" />
      <span
        class="vote__score"
        title="Rating score"
        :aria-label="totalVotes > 0 ? `Rating score ${scorePct}%` : 'No rating yet'"
      >
        {{ totalVotes > 0 ? `${scorePct}%` : '-' }}
      </span>
    </div>

    <Transition name="vote-error">
      <p v-if="error" class="vote__error" role="alert">{{ error }}</p>
    </Transition>

    <PseudoLoginModal v-if="loginOpen" :open="loginOpen" @close="loginOpen = false" />
  </div>
</template>

<style scoped>
.vote {
  position: relative;
  display: inline-flex;
}

.vote__group {
  display: inline-flex;
  align-items: stretch;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  overflow: hidden;
}

.vote__btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    color 120ms ease,
    background 120ms ease;
}

.vote--sm .vote__btn {
  padding: 3px 7px;
}

.vote--md .vote__btn {
  padding: 5px 10px;
}

.vote__btn:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.vote__btn:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--page-accent, var(--accent)) 45%, transparent);
}

.vote__btn--active.vote__btn--up {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 12%, transparent);
}

.vote__btn--active.vote__btn--down {
  color: var(--error);
  background: color-mix(in srgb, var(--error) 12%, transparent);
}

.vote__btn:disabled {
  color: var(--text-tertiary);
  background: transparent;
  cursor: not-allowed;
}

.vote__divider {
  width: 1px;
  background: var(--bg-overlay);
}

.vote__icon {
  flex-shrink: 0;
}

.vote--sm .vote__icon {
  width: 11px;
  height: 11px;
}

.vote--md .vote__icon {
  width: 13px;
  height: 13px;
}

.vote__count {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.vote__score {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 4ch;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  color: var(--text-tertiary);
  cursor: default;
}

.vote--sm .vote__score {
  padding: 3px 7px;
  font-size: 0.6875rem;
}

.vote--md .vote__score {
  padding: 5px 10px;
  font-size: 0.8125rem;
}

.vote--sm .vote__count {
  font-size: 0.6875rem;
}

.vote--md .vote__count {
  font-size: 0.8125rem;
}

.vote__btn--active .vote__count {
  font-weight: 700;
}

.vote__error {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 10;
  margin: 0;
  padding: 4px 8px;
  max-width: 220px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  line-height: 1.35;
  color: var(--error);
  background: var(--bg-elevated);
  border: 1px solid color-mix(in srgb, var(--error) 40%, transparent);
  border-radius: 3px;
  white-space: normal;
}

.vote-error-enter-active {
  transition:
    opacity 150ms ease-out,
    transform 150ms ease-out;
}

.vote-error-leave-active {
  transition: opacity 120ms ease-in;
}

.vote-error-enter-from {
  opacity: 0;
  transform: translateY(-2px);
}

.vote-error-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .vote-error-enter-active,
  .vote-error-leave-active {
    transition: none;
  }
}
</style>
