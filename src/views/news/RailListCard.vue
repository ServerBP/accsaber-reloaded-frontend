<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    imageUrl?: string | null
    meta?: string | null
    badge?: string | null
    badgeAccent?: string
    accent?: string
    active?: boolean
    pinned?: boolean
  }>(),
  {
    imageUrl: null,
    meta: null,
    badge: null,
    badgeAccent: 'var(--accent)',
    accent: 'var(--accent)',
    active: false,
    pinned: false,
  },
)

const emit = defineEmits<{
  select: []
}>()
</script>

<template>
  <button
    type="button"
    class="rail-card"
    :class="{ 'rail-card--active': active }"
    :style="{ '--card-accent': accent }"
    :aria-pressed="active"
    @click="emit('select')"
  >
    <div class="rail-card__thumb">
      <img v-if="imageUrl" :src="imageUrl" :alt="title" loading="lazy" decoding="async" />
      <slot v-else name="fallback" />
    </div>

    <div class="rail-card__body">
      <div class="rail-card__meta">
        <span v-if="badge" class="rail-card__badge" :style="{ '--badge-accent': badgeAccent }">{{ badge }}</span>
        <span v-if="pinned" class="rail-card__pin" aria-label="Pinned">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
          </svg>
        </span>
        <span v-if="meta" class="rail-card__date">{{ meta }}</span>
      </div>
      <span class="rail-card__title">{{ title }}</span>
    </div>
  </button>
</template>

<style scoped>
.rail-card {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: var(--space-sm);
  align-items: stretch;
  width: 100%;
  padding: var(--space-sm);
  text-align: left;
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-left: 2px solid transparent;
  border-radius: var(--radius-card);
  color: inherit;
  cursor: pointer;
  transition: border-color 120ms ease, background 120ms ease;
}

.rail-card:hover {
  border-color: var(--text-tertiary);
  background: var(--bg-elevated);
}

.rail-card--active {
  border-color: var(--text-tertiary);
  border-left-color: var(--text-secondary);
  background: var(--bg-elevated);
}

.rail-card__thumb {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-input);
  overflow: hidden;
  background: var(--bg-elevated);
  flex-shrink: 0;
}

.rail-card__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.rail-card__body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  min-width: 0;
}

.rail-card__meta {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
}

.rail-card__badge {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--badge-accent);
  white-space: nowrap;
}

.rail-card__pin {
  display: inline-flex;
  color: var(--card-accent);
}

.rail-card__date {
  font-size: 0.68rem;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rail-card__title {
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
