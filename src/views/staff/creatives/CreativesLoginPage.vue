<script setup lang="ts">
import { usePageMeta } from '@/composables/usePageMeta'
import { creativesDashboardRoute } from '@/router'
import { useAuthStore } from '@/stores/auth'
import StaffLoginCard from '@/views/staff/StaffLoginCard.vue'
import type { StaffRole } from '@/types/enums'

usePageMeta({
  title: 'Login | AccSaber Creatives',
  description: 'Sign-in for AccSaber creatives.',
})

const auth = useAuthStore()

const PASSWORD_ROLES: StaffRole[] = ['CREATIVE', 'ADMIN']
</script>

<template>
  <StaffLoginCard
    title="AccSaber Creatives"
    subtitle="Creative team access"
    intro="Log in with the account you already use on AccSaber. Your creative role is attached automatically once an administrator has granted it."
    denied-note="You are signed in, but your account does not have creative access yet. Ask an administrator to grant you the CREATIVE role."
    :granted="auth.hasCreativeAccess"
    :dashboard-route="creativesDashboardRoute"
    :password-roles="PASSWORD_ROLES"
  />
</template>
