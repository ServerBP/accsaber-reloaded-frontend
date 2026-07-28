<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import { usePageMeta } from '@/composables/usePageMeta'

usePageMeta({
  title: 'Staff Login | AccSaber Admin',
  description: 'Staff sign-in for AccSaber administration.',
})

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const identifier = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!identifier.value || !password.value) return
  loading.value = true
  error.value = ''
  try {
    await auth.login(identifier.value, password.value, 'ADMIN')

    if (!auth.isAdmin) {
      auth.clearStaffAuth()
      error.value = 'Access denied - this panel requires the ADMIN role.'
      return
    }

    const redirect = route.query.redirect as string | undefined
    const safe = redirect && !redirect.startsWith('/login') ? redirect : '/'
    router.push(safe)
  } catch {
    error.value = 'Invalid credentials.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <div class="login-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div>
          <h1 class="login-title">AccSaber Admin</h1>
          <p class="login-subtitle">Administrator access only</p>
        </div>
      </div>

      <form class="login-form" @submit.prevent="handleLogin">
        <BaseInput
          v-model="identifier"
          label="Identifier"
          placeholder="Username or email"
          autocomplete="username"
          :disabled="loading"
        />
        <BaseInput
          v-model="password"
          label="Password"
          type="password"
          placeholder="Password"
          autocomplete="current-password"
          :disabled="loading"
        />

        <div v-if="error" class="login-error" role="alert">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {{ error }}
        </div>

        <BaseButton
          type="submit"
          variant="primary"
          size="lg"
          :loading="loading"
          :disabled="!identifier || !password"
          style="width: 100%"
        >
          Sign In
        </BaseButton>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-base);
  padding: var(--space-lg);
}

.login-card {
  width: 100%;
  max-width: 340px;
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-modal);
  padding: var(--space-xl);
}

.login-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
}

.login-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  border-radius: var(--radius-card);
  flex-shrink: 0;
}

.login-title {
  font-size: var(--text-card-title);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
}

.login-subtitle {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  margin: 2px 0 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.login-error {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: color-mix(in srgb, var(--error) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--error) 25%, transparent);
  border-radius: var(--radius-btn);
  color: var(--error);
  font-size: var(--text-caption);
}
</style>
