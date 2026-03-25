<script setup>
/**
 * CampaignsList - Campaign list page with filtering and inline actions
 *
 * Displays all campaigns in a searchable, filterable table with status badges,
 * progress bars, and inline start/pause/delete actions. Stats cards at the top
 * show counts by status (total, active, draft, paused, completed).
 */

import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import Layout from '../components/layout/Layout.vue'
import Button from '../components/common/Button.vue'
import Spinner from '../components/common/Spinner.vue'
import { useCampaigns, useDeleteCampaign, useStartCampaign, usePauseCampaign, useCampaignStats } from '../composables/useCampaigns'

const router = useRouter()
const statusFilter = ref('')
const searchQuery = ref('')

// Fetch campaigns with filters
const { data, isLoading } = useCampaigns(
  computed(() => ({
    status: statusFilter.value,
    search: searchQuery.value,
  }))
)
const campaigns = computed(() => data.value?.data || [])
const pagination = computed(() => data.value?.meta || {})

// Fetch stats
const { data: statsData } = useCampaignStats()
const stats = computed(() => statsData.value?.stats || {})

// Mutations
const { mutate: deleteCampaign } = useDeleteCampaign()
const { mutate: startCampaign } = useStartCampaign()
const { mutate: pauseCampaign } = usePauseCampaign()

const handleDelete = (id, name) => {
  if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
    deleteCampaign(id)
  }
}

const handleStart = (id) => {
  startCampaign(id)
}

const handlePause = (id) => {
  pauseCampaign(id)
}

const getStatusBadgeClass = (status) => {
  const styles = {
    draft: 'bg-gray-100 text-gray-800',
    active: 'bg-green-100 text-green-800',
    paused: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-blue-100 text-blue-800',
    archived: 'bg-gray-100 text-gray-600',
  }
  return styles[status] || ''
}

const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : ''

const progressPercent = (campaign) => {
  return campaign.total_prospects > 0
    ? (campaign.processed_prospects / campaign.total_prospects) * 100
    : 0
}
</script>

<template>
  <Layout>
    <div class="space-y-6">
      <!-- Page Header -->
      <div class="flex justify-between items-start">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p class="text-sm text-gray-600 mt-1">
            Create and manage your LinkedIn outreach campaigns
          </p>
        </div>
        <Button variant="primary" @click="router.push('/campaign/create')">
          + New Campaign
        </Button>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-sm text-gray-600">Total</div>
          <div class="text-2xl font-bold text-gray-900">{{ stats.total || 0 }}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-sm text-gray-600">Active</div>
          <div class="text-2xl font-bold text-green-600">{{ stats.active || 0 }}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-sm text-gray-600">Draft</div>
          <div class="text-2xl font-bold text-gray-600">{{ stats.draft || 0 }}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-sm text-gray-600">Paused</div>
          <div class="text-2xl font-bold text-yellow-600">{{ stats.paused || 0 }}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-sm text-gray-600">Completed</div>
          <div class="text-2xl font-bold text-blue-600">{{ stats.completed || 0 }}</div>
        </div>
      </div>

      <!-- Filters -->
      <div class="bg-white rounded-lg shadow p-4">
        <div class="flex flex-col md:flex-row gap-4">
          <div class="flex-1">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search campaigns..."
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
            />
          </div>
          <div class="w-full md:w-48">
            <select
              v-model="statusFilter"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Campaigns List -->
      <div class="bg-white rounded-lg shadow">
        <div v-if="isLoading" class="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
        <div v-else-if="campaigns.length === 0" class="text-center py-12 px-6">
          <div class="mb-4">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">
            {{ searchQuery || statusFilter ? 'No campaigns found' : 'No campaigns yet' }}
          </h3>
          <p class="text-gray-500 mb-6">
            {{ searchQuery || statusFilter ? 'Try adjusting your filters' : 'Get started by creating your first campaign' }}
          </p>
          <Button v-if="!searchQuery && !statusFilter" variant="primary" @click="router.push('/campaign/create')">
            Create Campaign
          </Button>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prospects</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Daily Limit</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="campaign in campaigns" :key="campaign.id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div class="text-sm font-medium text-gray-900">{{ campaign.name }}</div>
                    <div v-if="campaign.description" class="text-sm text-gray-500 truncate max-w-xs">
                      {{ campaign.description }}
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="['px-2 py-1 text-xs font-semibold rounded-full', getStatusBadgeClass(campaign.status)]">
                    {{ capitalize(campaign.status) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ campaign.total_prospects }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="text-sm text-gray-900">
                      {{ campaign.processed_prospects }}/{{ campaign.total_prospects }}
                    </div>
                    <div class="ml-2 w-24 bg-gray-200 rounded-full h-2">
                      <div
                        class="bg-linkedin h-2 rounded-full"
                        :style="{ width: `${progressPercent(campaign)}%` }"
                      ></div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ campaign.daily_limit }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div class="flex justify-end space-x-2">
                    <button
                      v-if="campaign.status === 'draft'"
                      class="text-green-600 hover:text-green-900"
                      title="Start campaign"
                      @click="handleStart(campaign.id)"
                    >
                      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                      </svg>
                    </button>
                    <button
                      v-if="campaign.status === 'active'"
                      class="text-yellow-600 hover:text-yellow-900"
                      title="Pause campaign"
                      @click="handlePause(campaign.id)"
                    >
                      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                      </svg>
                    </button>
                    <button
                      v-if="campaign.status === 'paused'"
                      class="text-green-600 hover:text-green-900"
                      title="Resume campaign"
                      @click="handleStart(campaign.id)"
                    >
                      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                      </svg>
                    </button>
                    <button
                      class="text-linkedin hover:text-linkedin-dark"
                      title="View details"
                      @click="router.push(`/campaign/${campaign.id}`)"
                    >
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      class="text-red-600 hover:text-red-900"
                      title="Delete campaign"
                      @click="handleDelete(campaign.id, campaign.name)"
                    >
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="pagination.last_page > 1" class="flex justify-between items-center">
        <div class="text-sm text-gray-700">
          Showing {{ pagination.from }} to {{ pagination.to }} of {{ pagination.total }} campaigns
        </div>
        <div class="flex space-x-2">
          <!-- Pagination controls placeholder -->
        </div>
      </div>
    </div>
  </Layout>
</template>
