<script setup lang="ts">
import { onAvatarError, pickAvatarFallback, pickAvatarUrl } from '@/composables/useAvatarFallback'
import { colorForUser } from '@/composables/useCampaignPresence'
import { messageTimeMillis, type UseCampaignChatReturn } from '@/composables/useCampaignChat'
import { useAuthStore } from '@/stores/auth'
import type { CampaignChatMessageResponse } from '@/types/api/campaigns'
import { formatRelativeDate } from '@/utils/formatters'
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{ chat: UseCampaignChatReturn }>()

const emit = defineEmits<{ typing: []; 'typing-stop': [] }>()

const auth = useAuthStore()

const open = ref(false)
const draft = ref('')
const seenIds = ref(new Set<string>())
const scroller = ref<HTMLDivElement | null>(null)

const messages = computed(() => props.chat.messages.value)

const unread = computed(() => {
  if (open.value) return 0
  let n = 0
  for (const m of messages.value) if (!seenIds.value.has(m.id)) n += 1
  return n
})

function markSeen() {
  const list = messages.value
  if (list.length === 0) return
  const next = new Set(seenIds.value)
  let changed = false
  for (const m of list) {
    if (!next.has(m.id)) {
      next.add(m.id)
      changed = true
    }
  }
  if (changed) seenIds.value = next
}

function isSelf(m: CampaignChatMessageResponse): boolean {
  return !!auth.userId && String(m.authorId) === String(auth.userId)
}

function displayTime(m: CampaignChatMessageResponse): string {
  const ms = messageTimeMillis(m.createdAt)
  return ms ? formatRelativeDate(new Date(ms).toISOString()) : 'just now'
}

function isoTime(m: CampaignChatMessageResponse): string {
  const ms = messageTimeMillis(m.createdAt)
  return ms ? new Date(ms).toISOString() : ''
}

function authorColor(m: CampaignChatMessageResponse): string {
  return colorForUser(String(m.authorId))
}

function avatarSrc(m: CampaignChatMessageResponse): string {
  return pickAvatarUrl({ avatarUrl: m.authorAvatarUrl, cdnAvatarUrl: m.authorCdnAvatarUrl })
}

function avatarFallback(m: CampaignChatMessageResponse): string | null {
  return pickAvatarFallback({ avatarUrl: m.authorAvatarUrl, cdnAvatarUrl: m.authorCdnAvatarUrl })
}

function scrollToBottom() {
  const el = scroller.value
  if (el) el.scrollTop = el.scrollHeight
}

function nearBottom(): boolean {
  const el = scroller.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < 80
}

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  void props.chat.loadHistory()
  await nextTick()
  scrollToBottom()
  markSeen()
}

const TOP_THRESHOLD = 64

async function loadMoreAtTop() {
  const el = scroller.value
  if (!el) return
  const prevHeight = el.scrollHeight
  const prevTop = el.scrollTop
  await props.chat.loadOlder()
  await nextTick()
  el.scrollTop = prevTop + (el.scrollHeight - prevHeight)
}

function onScroll() {
  const el = scroller.value
  if (!el) return
  if (el.scrollTop <= TOP_THRESHOLD && props.chat.hasMore.value && !props.chat.loadingMore.value) {
    void loadMoreAtTop()
  }
}

async function onSend() {
  const ok = await props.chat.send(draft.value)
  if (!ok) return
  draft.value = ''
  emit('typing-stop')
  await nextTick()
  scrollToBottom()
  markSeen()
}

watch(
  () => messages.value.length,
  async () => {
    if (!open.value) return
    const stick = nearBottom()
    await nextTick()
    if (stick) scrollToBottom()
    markSeen()
  },
)
</script>

<template>
  <section class="campaign-chat" :class="{ 'campaign-chat--open': open }" aria-label="Team chat">
    <button
      type="button"
      class="campaign-chat__toggle"
      :aria-expanded="open"
      aria-label="Team chat"
      @click="toggle"
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
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span class="campaign-chat__toggle-label">Chat</span>
      <span
        v-if="unread > 0"
        :key="unread"
        class="campaign-chat__badge"
        :aria-label="`${unread} unread ${unread === 1 ? 'message' : 'messages'}`"
        >{{ unread > 99 ? '99+' : unread }}</span
      >
    </button>

    <div v-if="open" class="campaign-chat__panel">
      <header class="campaign-chat__head">
        <h2 class="campaign-chat__title">Team chat</h2>
        <button
          type="button"
          class="campaign-chat__close"
          aria-label="Collapse chat"
          @click="toggle"
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
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </header>

      <div
        ref="scroller"
        class="campaign-chat__log"
        role="log"
        aria-live="polite"
        @scroll.passive="onScroll"
      >
        <div v-if="chat.loading.value && messages.length === 0" class="campaign-chat__state">
          Loading messages…
        </div>

        <div v-if="chat.loadingMore.value" class="campaign-chat__loading-more" aria-live="polite">
          <span class="campaign-chat__spinner" aria-hidden="true" />
          Loading earlier messages…
        </div>

        <p
          v-if="!chat.loading.value && messages.length === 0"
          class="campaign-chat__state campaign-chat__state--empty"
        >
          No messages yet. Say hello to your collaborators.
        </p>

        <article
          v-for="m in messages"
          :key="m.id"
          class="campaign-chat__msg"
          :class="{ 'campaign-chat__msg--self': isSelf(m) }"
          :style="{ '--author-color': authorColor(m) }"
        >
          <span class="campaign-chat__avatar" aria-hidden="true">
            <img
              v-if="avatarSrc(m)"
              :src="avatarSrc(m)"
              :alt="m.authorName"
              loading="lazy"
              @error="onAvatarError(avatarFallback(m))($event)"
            />
            <span v-else class="campaign-chat__avatar-initial">{{ m.authorName.charAt(0) }}</span>
          </span>
          <div class="campaign-chat__bubble">
            <div class="campaign-chat__meta">
              <span class="campaign-chat__author">{{ m.authorName }}</span>
              <time class="campaign-chat__time" :datetime="isoTime(m)">
                {{ displayTime(m) }}
              </time>
            </div>
            <p class="campaign-chat__text">{{ m.content }}</p>
          </div>
        </article>
      </div>

      <div class="campaign-chat__composer">
        <p v-if="chat.error.value" class="campaign-chat__error" role="alert">
          {{ chat.error.value }}
        </p>
        <p v-if="chat.contentError.value" class="campaign-chat__error" role="alert">
          {{ chat.contentError.value }}
        </p>
        <div class="campaign-chat__input-row">
          <textarea
            v-model="draft"
            class="campaign-chat__input"
            rows="1"
            placeholder="Message your collaborators"
            aria-label="Message"
            :aria-invalid="!!chat.contentError.value"
            @focus="emit('typing')"
            @input="emit('typing')"
            @blur="emit('typing-stop')"
            @keydown.enter.exact.prevent="onSend"
          />
          <button
            type="button"
            class="campaign-chat__send"
            aria-label="Send message"
            :disabled="chat.sending.value || draft.trim().length === 0"
            @click="onSend"
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
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.campaign-chat {
  position: absolute;
  right: var(--space-md);
  bottom: var(--space-md);
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-sm);
  pointer-events: none;
}

.campaign-chat__toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-secondary);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: 4px;
  cursor: pointer;
  pointer-events: auto;
  transition:
    color 120ms ease,
    border-color 120ms ease;
}

.campaign-chat__toggle:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.campaign-chat--open .campaign-chat__toggle {
  display: none;
}

.campaign-chat__badge {
  position: absolute;
  top: -7px;
  right: -7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--bg-base);
  background: var(--page-accent, var(--accent));
  border: 2px solid var(--bg-base);
  border-radius: 999px;
  transform-origin: center;
  animation: chat-badge-pop 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes chat-badge-pop {
  from {
    transform: scale(0);
  }
  to {
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .campaign-chat__badge {
    animation: none;
  }
}

.campaign-chat__panel {
  display: flex;
  flex-direction: column;
  width: min(340px, calc(100vw - var(--space-lg)));
  height: min(460px, 60vh);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: 6px;
  overflow: hidden;
  pointer-events: auto;
}

.campaign-chat__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--bg-overlay);
}

.campaign-chat__title {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.campaign-chat__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  color: var(--text-tertiary);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  transition:
    color 120ms ease,
    background 120ms ease;
}

.campaign-chat__close:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.campaign-chat__log {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
  scrollbar-width: thin;
  scrollbar-color: var(--bg-overlay) transparent;
}

.campaign-chat__log::-webkit-scrollbar {
  width: 5px;
}

.campaign-chat__log::-webkit-scrollbar-thumb {
  background: var(--bg-overlay);
  border-radius: 3px;
}

.campaign-chat__state {
  margin: auto;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  text-align: center;
  line-height: 1.5;
}

.campaign-chat__loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 2px 0 4px;
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.campaign-chat__spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--bg-overlay);
  border-top-color: var(--page-accent, var(--accent));
  border-radius: 50%;
  animation: chat-spin 700ms linear infinite;
}

@keyframes chat-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .campaign-chat__spinner {
    animation: none;
  }
}

.campaign-chat__msg {
  display: flex;
  gap: var(--space-sm);
  align-items: flex-start;
  align-self: flex-start;
  max-width: 85%;
}

.campaign-chat__msg--self {
  flex-direction: row-reverse;
  align-self: flex-end;
}

.campaign-chat__avatar {
  box-sizing: border-box;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 2px solid var(--author-color, var(--bg-overlay));
  overflow: hidden;
  background: var(--bg-elevated);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.campaign-chat__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.campaign-chat__avatar-initial {
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.campaign-chat__bubble {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  border-radius: 4px;
}

.campaign-chat__msg--self .campaign-chat__bubble {
  border-color: color-mix(in srgb, var(--author-color, var(--bg-overlay)) 35%, var(--bg-overlay));
}

.campaign-chat__meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-sm);
}

.campaign-chat__author {
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--author-color, var(--text-primary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.campaign-chat__time {
  flex-shrink: 0;
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  color: var(--text-tertiary);
}

.campaign-chat__text {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  line-height: 1.45;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.campaign-chat__composer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--space-sm) var(--space-md) var(--space-md);
  border-top: 1px solid var(--bg-overlay);
}

.campaign-chat__error {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--error);
  line-height: 1.4;
}

.campaign-chat__input-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 34px;
  gap: 6px;
  align-items: end;
}

.campaign-chat__input {
  width: 100%;
  min-height: 34px;
  max-height: 110px;
  padding: 8px 10px;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-primary);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  outline: none;
  resize: none;
  line-height: 1.4;
  transition: border-color 120ms ease;
}

.campaign-chat__input:focus {
  border-color: var(--page-accent, var(--accent));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--page-accent, var(--accent)) 20%, transparent);
}

.campaign-chat__input[aria-invalid='true'] {
  border-color: var(--error);
}

.campaign-chat__send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  color: var(--page-accent, var(--accent));
  background: transparent;
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  cursor: pointer;
  transition:
    color 120ms ease,
    border-color 120ms ease,
    background 120ms ease;
}

.campaign-chat__send:hover:not(:disabled) {
  border-color: var(--page-accent, var(--accent));
  background: color-mix(in srgb, var(--page-accent, var(--accent)) 10%, transparent);
}

.campaign-chat__send:disabled {
  color: var(--text-tertiary);
  cursor: not-allowed;
}

@media (max-width: 860px) {
  .campaign-chat {
    position: fixed;
  }
}
</style>
