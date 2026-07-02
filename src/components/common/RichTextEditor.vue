<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import { nextTick, onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    minHeight?: number
    maxHeight?: number
    ariaLabel?: string
    autofocus?: boolean
  }>(),
  { minHeight: 180, maxHeight: 360, ariaLabel: 'Rich text editor', autofocus: false },
)

const emit = defineEmits<{
  'update:modelValue': [html: string]
}>()

const editorRef = ref<HTMLDivElement | null>(null)
const linkComposerOpen = ref(false)
const linkUrl = ref('')
let savedRange: Range | null = null

onMounted(async () => {
  await nextTick()
  if (editorRef.value) {
    editorRef.value.innerHTML = props.modelValue
    if (props.autofocus) editorRef.value.focus()
  }
})

watch(
  () => props.modelValue,
  (val) => {
    const el = editorRef.value
    if (el && el.innerHTML !== val) el.innerHTML = val
  },
)

function emitChange() {
  const el = editorRef.value
  if (el) emit('update:modelValue', el.innerHTML)
}

function focusEditor() {
  editorRef.value?.focus()
}

function runCommand(command: string, value?: string) {
  focusEditor()
  document.execCommand(command, false, value)
  emitChange()
}

function toggleBlock(tag: string) {
  focusEditor()
  document.execCommand('formatBlock', false, tag)
  emitChange()
}

function wrapInTag(tag: 'code' | 'sub' | 'sup') {
  focusEditor()
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return
  const range = selection.getRangeAt(0)
  if (range.collapsed) return
  const node = document.createElement(tag)
  node.textContent = range.toString()
  range.deleteContents()
  range.insertNode(node)
  range.setStartAfter(node)
  range.setEndAfter(node)
  selection.removeAllRanges()
  selection.addRange(range)
  emitChange()
}

function openLinkComposer() {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.toString().length === 0) return
  savedRange = selection.getRangeAt(0).cloneRange()
  linkUrl.value = ''
  linkComposerOpen.value = true
}

function applyLink() {
  const url = linkUrl.value.trim()
  if (!url || !/^https?:\/\//i.test(url)) {
    linkComposerOpen.value = false
    return
  }
  if (savedRange && editorRef.value) {
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(savedRange)
    editorRef.value.focus()
    document.execCommand('createLink', false, url)
    emitChange()
  }
  linkComposerOpen.value = false
  savedRange = null
}

function cancelLink() {
  linkComposerOpen.value = false
  savedRange = null
}

function clearFormatting() {
  focusEditor()
  document.execCommand('removeFormat')
  document.execCommand('unlink')
  emitChange()
}

function wrapSelectionSpan(style: Record<string, string>, className?: string) {
  focusEditor()
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  if (range.collapsed) return
  const span = document.createElement('span')
  if (className) span.className = className
  for (const [k, v] of Object.entries(style)) span.style.setProperty(k, v)
  try {
    span.appendChild(range.extractContents())
    range.insertNode(span)
    sel.removeAllRanges()
    const next = document.createRange()
    next.selectNodeContents(span)
    sel.addRange(next)
  } catch {
    return
  }
  emitChange()
}

const colorSwatches = [
  { value: '#f5b800', title: 'Gold' },
  { value: '#ef4444', title: 'Red' },
  { value: '#eab308', title: 'Yellow' },
  { value: '#22c55e', title: 'Green' },
  { value: '#3b82f6', title: 'Blue' },
  { value: '#a855f7', title: 'Purple' },
  { value: '#4dd9e0', title: 'Cyan' },
]

const sizeSteps = [
  { label: 'A−', value: '0.8em', title: 'Smaller' },
  { label: 'A+', value: '1.5em', title: 'Larger' },
]

const fontSteps = [
  { label: 'Mono', value: 'ui-monospace, monospace', title: 'Monospace' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif', title: 'Serif' },
]

const effectSteps = [
  { key: 'glow', label: 'Glow', title: 'Glow effect' },
  { key: 'outline', label: 'Outline', title: 'Outline effect' },
  { key: 'shadow', label: 'Shadow', title: 'Drop shadow' },
]

interface FormatButton {
  key: string
  label: string
  title: string
  action: () => void
}

const formatGroups: FormatButton[][] = [
  [
    { key: 'b', label: 'B', title: 'Bold', action: () => runCommand('bold') },
    { key: 'i', label: 'I', title: 'Italic', action: () => runCommand('italic') },
    { key: 'u', label: 'U', title: 'Underline', action: () => runCommand('underline') },
    { key: 's', label: 'S', title: 'Strikethrough', action: () => runCommand('strikeThrough') },
    { key: 'code', label: '<>', title: 'Inline code', action: () => wrapInTag('code') },
  ],
  [
    { key: 'h3', label: 'H3', title: 'Heading 3', action: () => toggleBlock('h3') },
    { key: 'h4', label: 'H4', title: 'Heading 4', action: () => toggleBlock('h4') },
    { key: 'p', label: 'P', title: 'Paragraph', action: () => toggleBlock('p') },
  ],
  [
    { key: 'ul', label: '• List', title: 'Bullet list', action: () => runCommand('insertUnorderedList') },
    { key: 'ol', label: '1. List', title: 'Numbered list', action: () => runCommand('insertOrderedList') },
    { key: 'quote', label: '“”', title: 'Blockquote', action: () => toggleBlock('blockquote') },
  ],
]
</script>

<template>
  <div class="rich-editor">
    <div class="rich-editor__toolbar" role="toolbar" :aria-label="ariaLabel" @mousedown.prevent>
      <template v-for="(group, gi) in formatGroups" :key="gi">
        <span v-if="gi > 0" class="rich-editor__tb-divider" />
        <button
          v-for="btn in group"
          :key="btn.key"
          type="button"
          class="rich-editor__tb-btn"
          :title="btn.title"
          :aria-label="btn.title"
          @click="btn.action"
        >
          {{ btn.label }}
        </button>
      </template>
      <span class="rich-editor__tb-divider" />
      <button
        type="button"
        class="rich-editor__tb-btn"
        title="Align left"
        aria-label="Align left"
        @click="runCommand('justifyLeft')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="21" y1="6" x2="3" y2="6" />
          <line x1="15" y1="12" x2="3" y2="12" />
          <line x1="17" y1="18" x2="3" y2="18" />
        </svg>
      </button>
      <button
        type="button"
        class="rich-editor__tb-btn"
        title="Align center"
        aria-label="Align center"
        @click="runCommand('justifyCenter')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="21" y1="6" x2="3" y2="6" />
          <line x1="17" y1="12" x2="7" y2="12" />
          <line x1="19" y1="18" x2="5" y2="18" />
        </svg>
      </button>
      <button
        type="button"
        class="rich-editor__tb-btn"
        title="Align right"
        aria-label="Align right"
        @click="runCommand('justifyRight')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="21" y1="6" x2="3" y2="6" />
          <line x1="21" y1="12" x2="9" y2="12" />
          <line x1="21" y1="18" x2="7" y2="18" />
        </svg>
      </button>
      <span class="rich-editor__tb-divider" />
      <button
        type="button"
        class="rich-editor__tb-btn"
        title="Link selected text"
        aria-label="Link"
        @click="openLinkComposer"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </button>
      <button
        type="button"
        class="rich-editor__tb-btn"
        title="Remove link"
        aria-label="Unlink"
        @click="runCommand('unlink')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M5.17 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          <line x1="8" y1="2" x2="8" y2="5" />
          <line x1="2" y1="8" x2="5" y2="8" />
          <line x1="16" y1="19" x2="16" y2="22" />
          <line x1="19" y1="16" x2="22" y2="16" />
        </svg>
      </button>
      <span class="rich-editor__tb-divider" />
      <button
        v-for="fx in effectSteps"
        :key="fx.key"
        type="button"
        class="rich-editor__tb-btn rich-editor__tb-btn--text"
        :title="fx.title"
        @click="wrapSelectionSpan({}, fx.key)"
      >
        {{ fx.label }}
      </button>
      <span class="rich-editor__tb-divider" />
      <button
        v-for="sz in sizeSteps"
        :key="sz.value"
        type="button"
        class="rich-editor__tb-btn"
        :title="sz.title"
        @click="wrapSelectionSpan({ 'font-size': sz.value })"
      >
        {{ sz.label }}
      </button>
      <button
        v-for="ft in fontSteps"
        :key="ft.value"
        type="button"
        class="rich-editor__tb-btn rich-editor__tb-btn--text"
        :title="ft.title"
        @click="wrapSelectionSpan({ 'font-family': ft.value })"
      >
        {{ ft.label }}
      </button>
      <span class="rich-editor__tb-divider" />
      <button
        v-for="sw in colorSwatches"
        :key="sw.value"
        type="button"
        class="rich-editor__tb-swatch"
        :style="{ background: sw.value }"
        :title="sw.title"
        :aria-label="`Color ${sw.title}`"
        @click="wrapSelectionSpan({ color: sw.value })"
      />
      <span class="rich-editor__tb-spacer" />
      <button
        type="button"
        class="rich-editor__tb-btn rich-editor__tb-btn--text"
        title="Clear formatting"
        aria-label="Clear formatting"
        @click="clearFormatting"
      >
        Clear
      </button>
    </div>

    <div v-if="linkComposerOpen" class="rich-editor__link-row">
      <input
        v-model="linkUrl"
        type="url"
        placeholder="https://example.com"
        class="rich-editor__link-input"
        autofocus
        @keydown.enter.prevent="applyLink"
        @keydown.escape.prevent="cancelLink"
      />
      <BaseButton type="button" size="sm" variant="primary" @click="applyLink">Apply</BaseButton>
      <BaseButton type="button" size="sm" @click="cancelLink">Cancel</BaseButton>
    </div>

    <div
      ref="editorRef"
      class="rich-editor__body"
      contenteditable="true"
      role="textbox"
      aria-multiline="true"
      :aria-label="ariaLabel"
      :style="{ minHeight: minHeight + 'px', maxHeight: maxHeight + 'px' }"
      @input="emitChange"
    />
  </div>
</template>

<style scoped>
.rich-editor {
  display: flex;
  flex-direction: column;
}

.rich-editor__toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--bg-overlay);
  border-bottom: none;
  border-top-left-radius: var(--radius-input);
  border-top-right-radius: var(--radius-input);
  background: var(--bg-base);
}

.rich-editor__tb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 600;
  cursor: pointer;
  border-radius: var(--radius-btn);
  transition:
    background-color 120ms ease,
    color 120ms ease;
}

.rich-editor__tb-btn:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.rich-editor__tb-btn--text {
  font-weight: 500;
  letter-spacing: 0.04em;
}

.rich-editor__tb-swatch {
  width: 18px;
  height: 18px;
  padding: 0;
  margin: 0 1px;
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  cursor: pointer;
  transition: transform 100ms ease;
}

.rich-editor__tb-swatch:hover {
  transform: scale(1.12);
}

.rich-editor__tb-divider {
  width: 1px;
  height: 18px;
  background: var(--bg-overlay);
  margin: 0 4px;
}

.rich-editor__tb-spacer {
  flex: 1;
}

.rich-editor__link-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs);
  border-left: 1px solid var(--bg-overlay);
  border-right: 1px solid var(--bg-overlay);
  background: var(--bg-base);
}

.rich-editor__link-input {
  flex: 1;
  padding: 6px var(--space-sm);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  outline: none;
  transition: border-color 120ms ease;
}

.rich-editor__link-input:focus {
  border-color: var(--accent);
}

.rich-editor__body {
  overflow-y: auto;
  padding: var(--space-md);
  border: 1px solid var(--bg-overlay);
  border-bottom-left-radius: var(--radius-input);
  border-bottom-right-radius: var(--radius-input);
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  line-height: 1.6;
  outline: none;
  transition: border-color 120ms ease;
}

.rich-editor__body:focus {
  border-color: var(--accent);
}

.rich-editor__body :deep(h3) {
  font-size: 1.15rem;
  font-weight: 600;
  margin: 0.6em 0 0.3em;
}

.rich-editor__body :deep(h4) {
  font-size: 1rem;
  font-weight: 600;
  margin: 0.6em 0 0.3em;
}

.rich-editor__body :deep(p) {
  margin: 0 0 0.6em;
}

.rich-editor__body :deep(ul),
.rich-editor__body :deep(ol) {
  padding-left: 1.5em;
  margin: 0 0 0.6em;
}

.rich-editor__body :deep(blockquote) {
  margin: 0 0 0.6em;
  padding: 0 var(--space-md);
  color: var(--text-secondary);
  border-left: 1px solid var(--bg-overlay);
}

.rich-editor__body :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.9em;
  padding: 0 4px;
  border-radius: 3px;
  background: var(--bg-elevated);
  color: var(--accent);
}

.rich-editor__body :deep(a) {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}
</style>
