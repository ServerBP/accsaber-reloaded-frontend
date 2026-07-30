<script setup lang="ts">
import { usePageMeta } from '@/composables/usePageMeta'
import { curationDashboardRoute } from '@/router'
import { useAuthStore } from '@/stores/auth'
import StaffLoginCard from '@/views/staff/StaffLoginCard.vue'

usePageMeta({
  title: 'Login | AccSaber Curation',
  description: 'Sign-in for AccSaber campaign curators.',
})

const auth = useAuthStore()
</script>

<template>
  <StaffLoginCard
    title="AccSaber Curation"
    subtitle="Campaign curation access"
    intro="Log in with the account you already use on AccSaber. Your curator role is attached automatically once an administrator has granted it."
    denied-note="You are signed in, but your account is not a campaign curator yet. Ask an administrator to grant you the CAMPAIGN CURATOR role."
    :granted="auth.hasCurationAccess"
    :dashboard-route="curationDashboardRoute"
  />
</template>
