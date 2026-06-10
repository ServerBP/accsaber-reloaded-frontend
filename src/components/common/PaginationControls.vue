<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'

const props = defineProps<{
  page: number
  totalPages: number
  siblingCount?: number
}>()

const emit = defineEmits<{
  'update:page': [page: number]
}>()

const siblings = computed(() => props.siblingCount ?? 1)

const editingLeft = ref(false)
const editingRight = ref(false)
const jumpInput = ref('')
const leftInputRef = ref<HTMLInputElement | null>(null)
const rightInputRef = ref<HTMLInputElement | null>(null)

const range = computed(() => {
  const current = props.page
  const total = props.totalPages
  const s = siblings.value

  if (total <= 0) return { start: 1, end: 1, showLeftEllipsis: false, showRightEllipsis: false }

  const start = Math.max(1, current - s)
  const end = Math.min(total, current + s)

  return {
    start,
    end,
    showLeftEllipsis: start > 1,
    showRightEllipsis: end < total,
  }
})

const pageNumbers = computed(() => {
  const nums: number[] = []
  for (let i = range.value.start; i <= range.value.end; i++) {
    nums.push(i)
  }
  return nums
})

function openJump(side: 'left' | 'right') {
  jumpInput.value = ''
  if (side === 'left') {
    editingLeft.value = true
    nextTick(() => leftInputRef.value?.focus())
  } else {
    editingRight.value = true
    nextTick(() => rightInputRef.value?.focus())
  }
}

function submitJump() {
  const target = parseInt(jumpInput.value, 10)
  if (!isNaN(target) && target >= 1 && target <= props.totalPages) {
    emit('update:page', target)
  }
  editingLeft.value = false
  editingRight.value = false
  jumpInput.value = ''
}

function cancelJump() {
  editingLeft.value = false
  editingRight.value = false
  jumpInput.value = ''
}
</script>

<template>
  <nav v-if="totalPages > 1" class="pagination" aria-label="Pagination">
    <button class="pagination__nav" :disabled="page <= 1" aria-label="First page" @click="emit('update:page', 1)">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
        <polyline points="7 3 2 8 7 13" />
        <polyline points="13 3 8 8 13 13" />
      </svg>
    </button>

    <template v-if="range.showLeftEllipsis">
      <input v-if="editingLeft" ref="leftInputRef" v-model="jumpInput" class="pagination__jump-input" type="number"
        :min="1" :max="totalPages" :placeholder="`1-${totalPages}`" @keydown.enter="submitJump"
        @keydown.escape="cancelJump" @blur="cancelJump" />
      <button v-else class="pagination__ellipsis" aria-label="Jump to page" @click="openJump('left')">
        &hellip;
      </button>
    </template>

    <button v-for="p in pageNumbers" :key="p" class="pagination__page"
      :class="{ 'pagination__page--active': p === page }" @click="emit('update:page', p)">
      {{ p }}
    </button>

    <template v-if="range.showRightEllipsis">
      <input v-if="editingRight" ref="rightInputRef" v-model="jumpInput" class="pagination__jump-input" type="number"
        :min="1" :max="totalPages" :placeholder="`1-${totalPages}`" @keydown.enter="submitJump"
        @keydown.escape="cancelJump" @blur="cancelJump" />
      <button v-else class="pagination__ellipsis" aria-label="Jump to page" @click="openJump('right')">
        &hellip;
      </button>
    </template>

    <button class="pagination__nav" :disabled="page >= totalPages" aria-label="Last page"
      @click="emit('update:page', totalPages)">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 3 8 8 3 13" />
        <polyline points="9 3 14 8 9 13" />
      </svg>
    </button>
  </nav>
</template>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  justify-content: center;
}

.pagination__nav {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid transparent;
  border-radius: var(--radius-btn);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.pagination__nav:hover:not(:disabled) {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.pagination__nav:disabled {
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.pagination__page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 var(--space-sm);
  border: 1px solid transparent;
  border-radius: var(--radius-btn);
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.pagination__page:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.pagination__page--active {
  background: var(--page-accent, var(--accent));
  color: var(--bg-base);
  font-weight: 600;
}

.pagination__page--active:hover {
  background: var(--page-accent, var(--accent));
  color: var(--bg-base);
}

.pagination__ellipsis {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  border: 1px solid transparent;
  border-radius: var(--radius-btn);
  background: transparent;
  color: var(--text-tertiary);
  font-size: var(--text-caption);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.pagination__ellipsis:hover {
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.pagination__jump-input {
  width: 56px;
  height: 32px;
  padding: 0 var(--space-xs);
  border: 1px solid var(--page-accent, var(--accent));
  border-radius: var(--radius-btn);
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  text-align: center;
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--page-accent, var(--accent)) 20%, transparent);
  -moz-appearance: textfield;
}

.pagination__jump-input::-webkit-inner-spin-button,
.pagination__jump-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
