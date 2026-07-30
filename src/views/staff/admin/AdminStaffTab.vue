<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { StaffUserResponse, CreateStaffUserRequest } from '@/types/api/admin'
import type { StaffRole, StaffUserStatus } from '@/types/enums'
import AdminTable from '@/components/admin/AdminTable.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import UserPicker from '@/components/domain/UserPicker.vue'
import { getApiErrorMessage } from '@/api/client'
import { generatePassword } from '@/utils/credentials'

const users = ref<StaffUserResponse[]>([])
const totalPages = ref(0)
const totalElements = ref(0)
const page = ref(1)
const size = 20
const loading = ref(false)
const actionLoading = ref<Record<string, boolean>>({})
const statusFilter = ref<StaffUserStatus | ''>('')

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'REQUESTED', label: 'Requested' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'DENIED', label: 'Denied' },
]

const showCreateModal = ref(false)
const showEditModal = ref(false)
const showLinkModal = ref(false)
const showPasswordModal = ref(false)
const editTarget = ref<StaffUserResponse | null>(null)
const linkTarget = ref<StaffUserResponse | null>(null)
const passwordTarget = ref<StaffUserResponse | null>(null)

const createMode = ref<'player' | 'manual'>('player')
const createRole = ref<StaffRole>('RANKING')
const createUserId = ref<string | null>(null)
const createUserName = ref('')
const manualForm = ref({ username: '', email: '', password: '' })
const createdCredentials = ref<{ username: string; password: string; role: StaffRole } | null>(null)
const copied = ref(false)
const editRole = ref<StaffRole>('RANKING')
const linkUserId = ref<string | null>(null)
const newPassword = ref('')
const createError = ref('')
const createLoading = ref(false)
const linkLoading = ref(false)
const linkError = ref('')
const passwordLoading = ref(false)
const passwordError = ref('')

const ROLES: StaffRole[] = [
  'MODERATOR',
  'RANKING',
  'RANKING_HEAD',
  'CAMPAIGN_CURATOR',
  'CREATIVE',
  'DEVELOPER',
  'ADMIN',
]
const roleOptions = ROLES.map((r) => ({ value: r, label: r.replace('_', ' ') }))

const PLAYER_LOGIN_ROLES: StaffRole[] = ['RANKING', 'RANKING_HEAD', 'CREATIVE', 'CAMPAIGN_CURATOR']

async function fetchUsers() {
  loading.value = true
  try {
    const { getStaffUsers } = await import('@/api/admin/staff')
    const res = await getStaffUsers({
      page: page.value - 1,
      size,
      status: statusFilter.value || undefined,
    })
    users.value = res.content
    totalPages.value = res.totalPages
    totalElements.value = res.totalElements
  } finally {
    loading.value = false
  }
}

watch(statusFilter, () => {
  page.value = 1
  fetchUsers()
})
fetchUsers()

const canCreate = computed(() =>
  createMode.value === 'player'
    ? !!createUserId.value && !!createUserName.value
    : (!!manualForm.value.username.trim() || !!manualForm.value.email.trim()) &&
      !!manualForm.value.password,
)

function openCreate() {
  createMode.value = 'player'
  createRole.value = 'RANKING'
  createUserId.value = null
  createUserName.value = ''
  manualForm.value = { username: '', email: '', password: '' }
  createdCredentials.value = null
  createError.value = ''
  copied.value = false
  showCreateModal.value = true
}

function onPickPlayer(user: { userId: string; userName: string } | null) {
  createUserName.value = user?.userName ?? ''
}

function buildCreateRequest(): CreateStaffUserRequest {
  if (createMode.value === 'player') {
    return {
      username: createUserName.value,
      password: generatePassword(),
      role: createRole.value,
      userId: createUserId.value ?? undefined,
    }
  }
  return {
    username: manualForm.value.username.trim() || undefined,
    email: manualForm.value.email.trim() || undefined,
    password: manualForm.value.password,
    role: createRole.value,
  }
}

async function createUser() {
  if (!canCreate.value) return
  createLoading.value = true
  createError.value = ''
  try {
    const request = buildCreateRequest()
    const { createStaffUser } = await import('@/api/admin/staff')
    const created = await createStaffUser(request)
    users.value.unshift(created)
    totalElements.value++
    if (createMode.value === 'player') {
      createdCredentials.value = {
        username: created.username,
        password: request.password,
        role: created.role,
      }
    } else {
      showCreateModal.value = false
    }
  } catch (err) {
    createError.value = getApiErrorMessage(err, 'Failed to create staff user.')
  } finally {
    createLoading.value = false
  }
}

async function copyPassword() {
  if (!createdCredentials.value) return
  try {
    await navigator.clipboard.writeText(createdCredentials.value.password)
    copied.value = true
  } catch {
    copied.value = false
  }
}

function openEdit(user: StaffUserResponse) {
  editTarget.value = user
  editRole.value = user.role
  showEditModal.value = true
}

async function saveRole() {
  if (!editTarget.value) return
  const id = editTarget.value.id
  actionLoading.value[id] = true
  try {
    const { updateStaffRole } = await import('@/api/admin/staff')
    const updated = await updateStaffRole(id, { role: editRole.value })
    const idx = users.value.findIndex((u) => u.id === id)
    if (idx !== -1) users.value[idx] = updated
    showEditModal.value = false
  } finally {
    delete actionLoading.value[id]
  }
}

async function toggleActive(user: StaffUserResponse) {
  actionLoading.value[user.id] = true
  try {
    const { updateStaffActive } = await import('@/api/admin/staff')
    const updated = await updateStaffActive(user.id, { active: !user.active })
    const idx = users.value.findIndex((u) => u.id === user.id)
    if (idx !== -1) users.value[idx] = updated
  } finally {
    delete actionLoading.value[user.id]
  }
}

async function setUserStatus(user: StaffUserResponse, status: 'ACCEPTED' | 'DENIED') {
  actionLoading.value[user.id] = true
  try {
    const { updateStaffStatus } = await import('@/api/admin/staff')
    const updated = await updateStaffStatus(user.id, { status })
    const idx = users.value.findIndex((u) => u.id === user.id)
    if (idx !== -1) users.value[idx] = updated
  } finally {
    delete actionLoading.value[user.id]
  }
}

function openLink(user: StaffUserResponse) {
  linkTarget.value = user
  linkUserId.value = user.userId ?? null
  linkError.value = ''
  showLinkModal.value = true
}

async function saveLink() {
  if (!linkTarget.value || !linkUserId.value) return
  const id = linkTarget.value.id
  linkLoading.value = true
  linkError.value = ''
  try {
    const { linkUser } = await import('@/api/admin/staff')
    const updated = await linkUser(id, { userId: linkUserId.value })
    const idx = users.value.findIndex((u) => u.id === id)
    if (idx !== -1) users.value[idx] = updated
    showLinkModal.value = false
  } catch (err) {
    linkError.value = getApiErrorMessage(err, 'Failed to link user.')
  } finally {
    linkLoading.value = false
  }
}

function openPasswordChange(user: StaffUserResponse) {
  passwordTarget.value = user
  newPassword.value = ''
  passwordError.value = ''
  showPasswordModal.value = true
}

async function savePassword() {
  if (!passwordTarget.value || !newPassword.value) return
  passwordLoading.value = true
  passwordError.value = ''
  try {
    const { forceChangePassword } = await import('@/api/admin/staff')
    await forceChangePassword(passwordTarget.value.id, { newPassword: newPassword.value })
    showPasswordModal.value = false
  } catch {
    passwordError.value = 'Failed to change password.'
  } finally {
    passwordLoading.value = false
  }
}

async function removeUser(user: StaffUserResponse) {
  if (!confirm(`Remove ${user.username} from staff? This cannot be undone.`)) return
  actionLoading.value[user.id] = true
  try {
    const { deactivateStaffUser } = await import('@/api/admin/staff')
    await deactivateStaffUser(user.id)
    users.value = users.value.filter((u) => u.id !== user.id)
    totalElements.value--
  } finally {
    delete actionLoading.value[user.id]
  }
}
</script>

<template>
  <div class="tab">
    <div class="tab__header">
      <div>
        <h2 class="tab__title">Staff</h2>
        <p class="tab__meta">{{ totalElements }} staff accounts</p>
      </div>
      <div class="filter-row">
        <BaseSelect v-model="statusFilter" :options="STATUS_OPTIONS" style="width: 160px" />
        <BaseButton variant="primary" @click="openCreate()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        New Staff User
        </BaseButton>
      </div>
    </div>

    <AdminTable :items="users" :loading="loading" :loading-rows="size" empty-message="No staff users">
      <template #head>
        <th>Username</th>
        <th>Email</th>
        <th style="width: 140px">Role</th>
        <th style="width: 100px">Request</th>
        <th style="width: 90px">Active</th>
        <th class="mono" style="width: 130px">Linked Player</th>
        <th class="right">Actions</th>
      </template>
      <template #default="{ item }">
        <td>{{ item.username }}</td>
        <td class="muted">{{ item.email ?? '-' }}</td>
        <td>
          <span class="role-badge" :class="`role-badge--${item.role.toLowerCase().replace('_', '-')}`">
            {{ item.role.replace('_', ' ') }}
          </span>
        </td>
        <td>
          <span class="request-status" :class="`request-status--${item.status?.toLowerCase()}`">
            {{ item.status ?? '-' }}
          </span>
        </td>
        <td>
          <span class="status-dot" :class="item.active ? 'status-dot--active' : 'status-dot--inactive'">
            {{ item.active ? 'Active' : 'Inactive' }}
          </span>
        </td>
        <td class="mono muted">
          <button class="link-btn" @click="openLink(item)">
            {{ item.userId ?? 'Link…' }}
          </button>
        </td>
        <td class="right tight">
          <div class="actions">
            <template v-if="item.status === 'REQUESTED'">
              <BaseButton size="sm" variant="primary" :loading="actionLoading[item.id]" @click="setUserStatus(item, 'ACCEPTED')">Approve</BaseButton>
              <BaseButton size="sm" variant="destructive" :loading="actionLoading[item.id]" @click="setUserStatus(item, 'DENIED')">Deny</BaseButton>
            </template>
            <BaseButton size="sm" @click="openEdit(item)">Role</BaseButton>
            <BaseButton size="sm" @click="openPasswordChange(item)">Password</BaseButton>
            <BaseButton size="sm" :loading="actionLoading[item.id]" @click="toggleActive(item)">
              {{ item.active ? 'Deactivate' : 'Activate' }}
            </BaseButton>
            <BaseButton size="sm" variant="destructive" :loading="actionLoading[item.id]" @click="removeUser(item)">
              Remove
            </BaseButton>
          </div>
        </td>
      </template>
    </AdminTable>

    <PaginationControls :page="page" :total-pages="totalPages" @update:page="(p: number) => { page = p; fetchUsers() }" />
  </div>

  <BaseModal :open="showCreateModal" title="New Staff User" @close="showCreateModal = false">
    <div v-if="createdCredentials" class="modal-form">
      <p v-if="PLAYER_LOGIN_ROLES.includes(createdCredentials.role)" class="created-note">
        <strong>{{ createdCredentials.username }}</strong> is now staff. Their normal AccSaber login
        carries the role on the matching staff site - the password below is only needed for a direct
        staff login.
      </p>
      <p v-else class="created-note">
        <strong>{{ createdCredentials.username }}</strong> is now staff. This role is not carried by a
        player login, so they need the password below to sign in on the staff site.
      </p>
      <div class="form-field">
        <label class="form-label">Generated Password</label>
        <div class="credential">
          <code class="credential__value">{{ createdCredentials.password }}</code>
          <BaseButton size="sm" @click="copyPassword">{{ copied ? 'Copied' : 'Copy' }}</BaseButton>
        </div>
      </div>
    </div>

    <div v-else class="modal-form">
      <div class="mode-switch">
        <button
          type="button"
          class="mode-switch__btn"
          :class="{ 'mode-switch__btn--active': createMode === 'player' }"
          @click="createMode = 'player'"
        >
          From player
        </button>
        <button
          type="button"
          class="mode-switch__btn"
          :class="{ 'mode-switch__btn--active': createMode === 'manual' }"
          @click="createMode = 'manual'"
        >
          Manual
        </button>
      </div>

      <template v-if="createMode === 'player'">
        <div class="form-field">
          <label class="form-label">Player</label>
          <UserPicker v-model="createUserId" @select="onPickPlayer" />
          <span v-if="createUserName" class="form-hint">
            Staff username will be <strong>{{ createUserName }}</strong>. A password is generated
            automatically.
          </span>
        </div>
      </template>

      <template v-else>
        <BaseInput v-model="manualForm.username" label="Username" />
        <BaseInput v-model="manualForm.email" label="Email" type="email" />
        <BaseInput v-model="manualForm.password" label="Password" type="password" autocomplete="new-password" />
      </template>

      <div class="form-field">
        <label class="form-label">Role</label>
        <BaseSelect v-model="createRole" :options="roleOptions" />
      </div>
      <p v-if="createError" class="form-error">{{ createError }}</p>
    </div>

    <template #footer>
      <template v-if="createdCredentials">
        <BaseButton variant="primary" @click="showCreateModal = false">Done</BaseButton>
      </template>
      <template v-else>
        <BaseButton @click="showCreateModal = false">Cancel</BaseButton>
        <BaseButton variant="primary" :loading="createLoading" :disabled="!canCreate" @click="createUser">
          Create
        </BaseButton>
      </template>
    </template>
  </BaseModal>

  <BaseModal :open="showEditModal" :title="`Edit Role - ${editTarget?.username}`" @close="showEditModal = false">
    <div class="modal-form">
      <div class="form-field">
        <label class="form-label">Role</label>
        <BaseSelect v-model="editRole" :options="roleOptions" />
      </div>
    </div>
    <template #footer>
      <BaseButton @click="showEditModal = false">Cancel</BaseButton>
      <BaseButton variant="primary" :loading="actionLoading[editTarget?.id ?? '']" @click="saveRole">Save</BaseButton>
    </template>
  </BaseModal>

  <BaseModal :open="showPasswordModal" :title="`Change Password - ${passwordTarget?.username}`" @close="showPasswordModal = false">
    <div class="modal-form">
      <BaseInput v-model="newPassword" label="New Password" type="password" autocomplete="new-password" />
      <p v-if="passwordError" class="form-error">{{ passwordError }}</p>
    </div>
    <template #footer>
      <BaseButton @click="showPasswordModal = false">Cancel</BaseButton>
      <BaseButton variant="destructive" :loading="passwordLoading" :disabled="!newPassword" @click="savePassword">Change Password</BaseButton>
    </template>
  </BaseModal>

  <BaseModal :open="showLinkModal" :title="`Link Player - ${linkTarget?.username}`" @close="showLinkModal = false">
    <div class="modal-form">
      <div class="form-field">
        <label class="form-label">Player</label>
        <UserPicker v-model="linkUserId" />
      </div>
      <p v-if="linkError" class="form-error">{{ linkError }}</p>
    </div>
    <template #footer>
      <BaseButton @click="showLinkModal = false">Cancel</BaseButton>
      <BaseButton variant="primary" :loading="linkLoading" :disabled="!linkUserId" @click="saveLink">Link</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.tab { display: flex; flex-direction: column; gap: var(--space-lg); }
.tab__header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-lg); flex-wrap: wrap; }
.filter-row { display: flex; align-items: center; gap: var(--space-sm); }
.tab__title { font-size: var(--text-section-heading); font-weight: 600; color: var(--text-primary); margin: 0; }
.tab__meta { font-size: var(--text-caption); color: var(--text-secondary); margin: 2px 0 0; }

.role-badge {
  font-size: var(--text-caption);
  font-family: var(--font-mono);
  font-weight: 500;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid;
}
.role-badge--ranking { color: var(--accent-true-acc); border-color: color-mix(in srgb, var(--accent-true-acc) 30%, transparent); background: color-mix(in srgb, var(--accent-true-acc) 8%, transparent); }
.role-badge--head-ranking { color: var(--accent-low-mid); border-color: color-mix(in srgb, var(--accent-low-mid) 30%, transparent); background: color-mix(in srgb, var(--accent-low-mid) 8%, transparent); }
.role-badge--admin { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 30%, transparent); background: color-mix(in srgb, var(--accent) 8%, transparent); }
.role-badge--creative { color: var(--info); border-color: color-mix(in srgb, var(--info) 30%, transparent); background: color-mix(in srgb, var(--info) 8%, transparent); }

.request-status {
  font-size: var(--text-caption);
  font-family: var(--font-mono);
  font-weight: 500;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid;
}
.request-status--requested { color: var(--warning); border-color: color-mix(in srgb, var(--warning) 30%, transparent); background: color-mix(in srgb, var(--warning) 8%, transparent); }
.request-status--accepted { color: var(--success); border-color: color-mix(in srgb, var(--success) 30%, transparent); background: color-mix(in srgb, var(--success) 8%, transparent); }
.request-status--denied { color: var(--error); border-color: color-mix(in srgb, var(--error) 30%, transparent); background: color-mix(in srgb, var(--error) 8%, transparent); }

.status-dot { font-size: var(--text-caption); font-weight: 500; display: inline-flex; align-items: center; gap: 5px; }
.status-dot::before { content: ''; width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
.status-dot--active { color: var(--success); }
.status-dot--active::before { background: var(--success); }
.status-dot--inactive { color: var(--text-tertiary); }
.status-dot--inactive::before { background: var(--text-tertiary); }

.link-btn {
  background: none;
  border: none;
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: var(--radius-btn);
  transition: color 80ms, background-color 80ms;
}
.link-btn:hover { color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }

.actions { display: flex; align-items: center; justify-content: flex-end; gap: var(--space-sm); }
.modal-form { display: flex; flex-direction: column; gap: var(--space-md); padding: var(--space-sm) 0; }
.form-field { display: flex; flex-direction: column; gap: var(--space-xs); }
.form-label { font-size: var(--text-caption); font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
.form-error { font-size: var(--text-caption); color: var(--error); }
.form-hint { font-size: var(--text-caption); color: var(--text-secondary); }
.form-hint strong { color: var(--text-primary); font-weight: 600; }

.mode-switch { display: flex; gap: var(--space-xs); }
.mode-switch__btn {
  flex: 1;
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 500;
  cursor: pointer;
  transition: color 120ms ease, background-color 120ms ease, border-color 120ms ease;
}
.mode-switch__btn:hover { background: var(--bg-elevated); color: var(--text-primary); }
.mode-switch__btn--active { border-color: var(--accent); color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }

.created-note { font-size: var(--text-body); color: var(--text-secondary); margin: 0; line-height: 1.5; }
.created-note strong { color: var(--text-primary); font-weight: 600; }
.credential { display: flex; align-items: center; gap: var(--space-sm); }
.credential__value {
  flex: 1;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  word-break: break-all;
}
</style>
