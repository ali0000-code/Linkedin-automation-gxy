<template>
  <!-- Loading State -->
  <div v-if="isLoading" class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
    <div v-for="i in 4" :key="i" class="bg-white rounded-lg shadow p-6">
      <Spinner size="sm" />
    </div>
  </div>

  <!-- Stats Cards -->
  <div v-else class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
    <div
      v-for="(stat, index) in statCards"
      :key="index"
      class="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
    >
      <div :class="['inline-flex items-center justify-center w-12 h-12 rounded-full mb-3', stat.bg]">
        <span :class="['text-2xl font-bold', stat.color]">
          {{ stat.value }}
        </span>
      </div>
      <p class="text-sm text-gray-600">{{ stat.label }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useProspectStats } from '../../composables/useProspects'
import Spinner from '../common/Spinner.vue'

const { data: statsData, isLoading } = useProspectStats()

const stats = computed(() => statsData.value?.stats || {})

const statCards = computed(() => [
  {
    label: 'Total Prospects',
    value: stats.value.total || 0,
    color: 'text-blue-600',
    bg: 'bg-blue-50'
  },
  {
    label: 'Not Connected',
    value: stats.value.not_connected || 0,
    color: 'text-gray-600',
    bg: 'bg-gray-50'
  },
  {
    label: 'Pending',
    value: stats.value.pending || 0,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50'
  },
  {
    label: 'Connected',
    value: stats.value.connected || 0,
    color: 'text-green-600',
    bg: 'bg-green-50'
  }
])
</script>
