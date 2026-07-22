<script setup lang="ts">
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import type { NotificationSettings } from '@/types/api/settings'
import { onMounted, ref } from 'vue'
import SettingsPicker from './SettingsPicker.vue'

const NOTIFICATION_DEFAULTS: NotificationSettings = {
  'notifications.tradeOffer': true,
  'notifications.tradeResolved': true,
  'notifications.marketSold': true,
  'notifications.marketBid': true,
  'notifications.itemEarned': true,
  'notifications.server': true,
}

const CONTROLS: { key: keyof NotificationSettings & string; title: string; hint: string }[] = [
  {
    key: 'notifications.tradeOffer',
    title: 'New trade offers',
    hint: 'Someone sends you a trade offer.',
  },
  {
    key: 'notifications.tradeResolved',
    title: 'Trade offers accepted or declined',
    hint: 'One of your outgoing offers is resolved, either way.',
  },
  {
    key: 'notifications.marketSold',
    title: 'Your market item sells',
    hint: 'A listing of yours is bought or won.',
  },
  {
    key: 'notifications.marketBid',
    title: 'Someone bids on your listing',
    hint: 'A new bid lands on one of your active listings.',
  },
  {
    key: 'notifications.itemEarned',
    title: 'You receive a new item',
    hint: 'Crates, drops, and rewards arriving in your inventory.',
  },
  {
    key: 'notifications.server',
    title: 'Server announcements',
    hint: 'One-line announcements from the AccSaber team.',
  },
]

const ON_OFF_OPTIONS = [
  { value: true, label: 'On' },
  { value: false, label: 'Off' },
]

const settings = ref<NotificationSettings | null>(null)
const saving = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const { getMySettingsGroup } = await import('@/api/settings')
    const res = await getMySettingsGroup<NotificationSettings>('notifications')
    settings.value = { ...NOTIFICATION_DEFAULTS, ...res }
  } catch {
    error.value = "Couldn't load notification settings."
  }
})

async function setToggle(key: keyof NotificationSettings & string, value: boolean) {
  const current = settings.value
  if (!current || saving.value || current[key] === value) return
  const previous = current[key]
  settings.value = { ...current, [key]: value }
  saving.value = true
  error.value = null
  try {
    const { patchMySettingsGroup } = await import('@/api/settings')
    const fresh = await patchMySettingsGroup<NotificationSettings>('notifications', {
      [key]: value,
    })
    settings.value = { ...NOTIFICATION_DEFAULTS, ...fresh }
  } catch {
    settings.value = { ...current, [key]: previous }
    error.value = "Couldn't save notification setting."
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="settings-card">
    <header class="settings-card__header">
      <h2 class="settings-card__title">Notifications</h2>
      <p class="settings-card__desc">
        Choose what shows up under the bell. Notifications only exist on AccSaber itself; nothing
        is ever emailed.
      </p>
    </header>

    <template v-if="settings === null && !error">
      <div v-for="i in 6" :key="i" class="settings-card__skeleton">
        <SkeletonLoader variant="text" :lines="2" />
      </div>
    </template>

    <template v-else-if="settings !== null">
      <div v-for="control in CONTROLS" :key="control.key" class="settings-row">
        <div class="settings-row__label">
          <span class="settings-row__title">{{ control.title }}</span>
          <span class="settings-row__hint">{{ control.hint }}</span>
        </div>
        <SettingsPicker :model-value="settings[control.key] as boolean" :options="ON_OFF_OPTIONS"
          :aria-label="control.title" :disabled="saving"
          @update:model-value="(v) => setToggle(control.key, v as boolean)" />
      </div>
    </template>

    <p v-if="error" class="settings-card__error">{{ error }}</p>

    <p class="settings-card__note">
      Turning a category off stops future notifications of that type. It does not delete ones you
      already received, and turning it back on does not bring back anything sent while it was off.
    </p>
  </section>
</template>

<style scoped>
.settings-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-lg);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
}

.settings-card__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.settings-card__title {
  margin: 0;
  font-size: var(--text-section-heading);
  font-weight: 600;
  color: var(--text-primary);
}

.settings-card__desc {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--text-body);
  line-height: 1.5;
}

.settings-card__error {
  margin: 0;
  color: var(--error);
  font-size: var(--text-caption);
}

.settings-card__note {
  margin: 0;
  padding-top: var(--space-md);
  border-top: 1px solid var(--bg-overlay);
  color: var(--text-tertiary);
  font-size: var(--text-caption);
  line-height: 1.5;
}

.settings-card__skeleton {
  padding: var(--space-sm) 0;
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding: var(--space-md) 0;
  border-top: 1px solid var(--bg-overlay);
}

.settings-row__label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.settings-row__title {
  color: var(--text-primary);
  font-size: var(--text-body);
  font-weight: 500;
}

.settings-row__hint {
  color: var(--text-secondary);
  font-size: var(--text-caption);
}

@media (max-width: 767px) {
  .settings-card {
    padding: var(--space-md);
  }

  .settings-row {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-sm);
  }
}
</style>
