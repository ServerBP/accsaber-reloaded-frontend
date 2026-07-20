<script setup lang="ts">
import StatBlock from '@/components/common/StatBlock.vue'
import SkillLevelPanel from '@/components/domain/SkillLevelPanel.vue'
import ProfileStatsChart from '@/views/profile/ProfileStatsChart.vue'
import { useCategoryStore } from '@/stores/categories'
import type {
  SkillResponse,
  UserAllStatisticsResponse,
  UserCategoryStatisticsResponse,
} from '@/types/api/users'
import type { CategoryCode } from '@/types/display'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  userId: string
  category: CategoryCode
  xpStats?: UserAllStatisticsResponse | null
}>()

const categoryStore = useCategoryStore()
const allTimeData = ref<UserCategoryStatisticsResponse[]>([])
const skill = ref<SkillResponse | null>(null)
const skillLoading = ref(false)

const peakStats = computed(() => {
  const data = allTimeData.value
  if (data.length === 0) return null

  let peakRank = Infinity
  let peakCountryRank = Infinity
  let peakAp = -Infinity

  for (const s of data) {
    if (s.ranking > 0 && s.ranking < peakRank) peakRank = s.ranking
    if (s.countryRanking > 0 && s.countryRanking < peakCountryRank) peakCountryRank = s.countryRanking
    if (s.ap > peakAp) peakAp = s.ap
  }

  return {
    peakRank: peakRank === Infinity ? null : peakRank,
    peakCountryRank: peakCountryRank === Infinity ? null : peakCountryRank,
    peakAp: peakAp === -Infinity ? null : peakAp,
  }
})

const xpAccent = computed(() => categoryStore.getAccent('xp'))

async function fetchAllTimeData() {
  try {
    const { getUserHistoricStatistics } = await import('@/api/users')
    allTimeData.value = await getUserHistoricStatistics(props.userId, {
      category: props.category,
      amount: 120,
      unit: 'mo',
    })
  } catch {
    allTimeData.value = []
  }
}

async function fetchSkill() {
  skillLoading.value = true
  try {
    const { getUserSkill } = await import('@/api/users')
    skill.value = await getUserSkill(props.userId)
  } catch {
    skill.value = null
  } finally {
    skillLoading.value = false
  }
}

watch(
  [() => props.userId, () => props.category],
  () => { fetchAllTimeData() },
  { immediate: true },
)

watch(
  () => props.userId,
  () => { fetchSkill() },
  { immediate: true },
)
</script>

<template>
  <div class="statistics-tab">
    <div class="statistics-tab__top-row">
      <section class="statistics-tab__chart">
        <h3 class="statistics-tab__section-title">History</h3>
        <ProfileStatsChart :user-id="userId" :category="category" />
      </section>

      <section v-if="skill || skillLoading" class="statistics-tab__skill">
        <h3 class="statistics-tab__section-title">Skill Level</h3>
        <SkillLevelPanel :skill="skill" :loading="skillLoading" />
      </section>
    </div>

    <div v-if="peakStats || xpStats" class="statistics-tab__split">
      <section v-if="peakStats" class="statistics-tab__peaks">
        <h3 class="statistics-tab__section-title">Peak Stats</h3>
        <div class="statistics-tab__peaks-grid">
          <StatBlock v-if="peakStats.peakRank != null" label="Peak Global Rank" :value="peakStats.peakRank"
            :decimals="0" />
          <StatBlock v-if="peakStats.peakCountryRank != null" label="Peak Country Rank" :value="peakStats.peakCountryRank"
            :decimals="0" />
          <StatBlock v-if="peakStats.peakAp != null" label="Peak AP" :value="peakStats.peakAp" />
        </div>
      </section>

      <section v-if="xpStats" class="xp-breakdown">
        <h3 class="statistics-tab__section-title">XP Breakdown</h3>
        <StatBlock label="Total XP" :value="xpStats.totalXp" :decimals="0" :accent-color="xpAccent" />
        <div class="xp-breakdown__tree">
          <div class="xp-breakdown__drop" />
          <div class="xp-breakdown__drop" />
          <div class="xp-breakdown__drop" />
          <div class="xp-breakdown__drop" />
          <div class="xp-breakdown__drop" />
        </div>
        <div class="xp-breakdown__sources">
          <StatBlock label="Score XP" :value="xpStats.totalScoreXp" :decimals="0" />
          <StatBlock label="Milestone XP" :value="xpStats.totalMilestoneXp" :decimals="0" />
          <StatBlock label="Set Bonus XP" :value="xpStats.totalMilestoneSetBonusXp" :decimals="0" />
          <StatBlock label="Mission XP" :value="xpStats.totalMissionXp" :decimals="0" />
          <StatBlock label="Campaign XP" :value="xpStats.totalCampaignXp" :decimals="0" />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.statistics-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2xl);
}

.statistics-tab__section-title {
  font-size: var(--text-section-heading);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--space-md) 0;
  text-align: center;
}

.statistics-tab__split {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2xl);
  width: 100%;
}

.statistics-tab__peaks {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 800px;
}

.statistics-tab__peaks-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-sm);
}

.statistics-tab__top-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: start;
  gap: var(--space-lg);
  width: 100%;
  align-self: stretch;
}

.statistics-tab__skill {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.xp-breakdown {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 800px;
}

.xp-breakdown__tree {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  width: 100%;
  height: 28px;
}

.xp-breakdown__drop {
  position: relative;
}

.xp-breakdown__drop::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  width: 1px;
  height: 100%;
  background: var(--text-tertiary);
}

.xp-breakdown__drop:first-child::before,
.xp-breakdown__drop:last-child::before {
  content: '';
  position: absolute;
  top: 0;
  height: 1px;
  background: var(--text-tertiary);
}

.xp-breakdown__drop:first-child::before {
  left: 50%;
  right: 0;
}

.xp-breakdown__drop:last-child::before {
  left: 0;
  right: 50%;
}

.xp-breakdown__drop:nth-child(2)::before,
.xp-breakdown__drop:nth-child(3)::before,
.xp-breakdown__drop:nth-child(4)::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--text-tertiary);
}

.xp-breakdown__sources {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  width: 100%;
}

.xp-breakdown__sources :deep(.stat-block) {
  align-items: center;
}

.statistics-tab__chart {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  min-width: 0;
}

@media (min-width: 1024px) {
  .statistics-tab__split {
    flex-direction: row;
    align-items: flex-start;
    justify-content: center;
  }

  .statistics-tab__split .statistics-tab__peaks,
  .statistics-tab__split .xp-breakdown {
    flex: 1 1 0;
    min-width: 0;
  }
}

@media (max-width: 767px) {
  .statistics-tab__top-row {
    grid-template-columns: 1fr;
  }

  .statistics-tab__skill {
    justify-self: center;
  }

  .xp-breakdown__sources {
    grid-template-columns: 1fr;
  }

  .xp-breakdown__tree {
    display: none;
  }
}
</style>
