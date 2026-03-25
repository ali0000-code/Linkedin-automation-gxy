<script setup>
/**
 * CampaignDetails - Single campaign detail view
 *
 * Displays comprehensive campaign information:
 * - Header with name, status badge, and start/pause/resume actions
 * - Stats grid (total prospects, processed, success, failed)
 * - Visual progress bar
 * - Campaign configuration (daily limit, dates, action steps with templates)
 * - Full prospect list with per-prospect status and current step
 * - Danger zone with delete action
 */

import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Layout from '../components/layout/Layout.vue'
import Button from '../components/common/Button.vue'
import Spinner from '../components/common/Spinner.vue'
import { useCampaign, useDeleteCampaign, useStartCampaign, usePauseCampaign } from '../composables/useCampaigns'

const route = useRoute()
const router = useRouter()
const id = computed(() => route.params.id)

// Fetch campaign details
const { data, isLoading } = useCampaign(id)
const campaign = computed(() => data.value?.campaign)

// Mutations
const { mutate: deleteCampaign } = useDeleteCampaign()
const { mutate: startCampaign } = useStartCampaign()
const { mutate: pauseCampaign } = usePauseCampaign()

const handleDelete = () => {
  if (window.confirm(`Are you sure you want to delete "${campaign.value?.name}"?`)) {
    deleteCampaign(id.value, {
      onSuccess: () => {
        router.push('/campaign/list')
      },
    })
  }
}

const handleStart = () => {
  startCampaign(id.value)
}

const handlePause = () => {
  pauseCampaign(id.value)
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

const progressPercent = computed(() => {
  if (!campaign.value || campaign.value.total_prospects === 0) return 0
  return Math.round((campaign.value.processed_prospects / campaign.value.total_prospects) * 100)
})

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const getProspectStatusClass = (status) => {
  if (status === 'completed') return 'bg-green-100 text-green-800'
  if (status === 'failed') return 'bg-red-100 text-red-800'
  if (status === 'in_progress') return 'bg-blue-100 text-blue-800'
  return 'bg-gray-100 text-gray-800'
}
</script>

<template>
  <Layout>
    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center items-center min-h-screen">
      <Spinner size="lg" />
    </div>

    <!-- Not Found -->
    <div v-else-if="!campaign" class="text-center py-12">
      <h2 class="text-2xl font-bold text-gray-900 mb-2">Campaign Not Found</h2>
      <p class="text-gray-600 mb-6">The campaign you're looking for doesn't exist.</p>
      <Button variant="primary" @click="router.push('/campaign/list')">
        Back to Campaigns
      </Button>
    </div>

    <!-- Campaign Details -->
    <div v-else class="space-y-6">
      <!-- Header -->
      <div class="flex justify-between items-start">
        <div>
          <div class="flex items-center space-x-3 mb-2">
            <h1 class="text-2xl font-bold text-gray-900">{{ campaign.name }}</h1>
            <span :class="['px-3 py-1 text-sm font-semibold rounded-full', getStatusBadgeClass(campaign.status)]">
              {{ capitalize(campaign.status) }}
            </span>
          </div>
          <p v-if="campaign.description" class="text-sm text-gray-600">{{ campaign.description }}</p>
        </div>
        <div class="flex space-x-2">
          <Button v-if="campaign.status === 'draft'" variant="primary" @click="handleStart">
            Start Campaign
          </Button>
          <Button v-if="campaign.status === 'active'" variant="warning" @click="handlePause">
            Pause Campaign
          </Button>
          <Button v-if="campaign.status === 'paused'" variant="primary" @click="handleStart">
            Resume Campaign
          </Button>
          <Button variant="secondary" @click="router.push('/campaign/list')">
            Back to List
          </Button>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-lg shadow p-6">
          <div class="text-sm text-gray-600 mb-1">Total Prospects</div>
          <div class="text-3xl font-bold text-gray-900">{{ campaign.total_prospects }}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <div class="text-sm text-gray-600 mb-1">Processed</div>
          <div class="text-3xl font-bold text-linkedin">{{ campaign.processed_prospects }}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <div class="text-sm text-gray-600 mb-1">Success</div>
          <div class="text-3xl font-bold text-green-600">{{ campaign.success_count }}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <div class="text-sm text-gray-600 mb-1">Failed</div>
          <div class="text-3xl font-bold text-red-600">{{ campaign.failure_count }}</div>
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex justify-between items-center mb-2">
          <h3 class="text-lg font-semibold text-gray-900">Progress</h3>
          <span class="text-sm text-gray-600">{{ progressPercent }}% Complete</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-4">
          <div
            class="bg-linkedin h-4 rounded-full transition-all"
            :style="{ width: `${progressPercent}%` }"
          ></div>
        </div>
      </div>

      <!-- Campaign Details -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Left Column: Campaign Info -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Campaign Information</h3>
          <dl class="space-y-3">
            <div>
              <dt class="text-sm font-medium text-gray-600">Daily Limit</dt>
              <dd class="text-sm text-gray-900">{{ campaign.daily_limit }} actions/day</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-600">Created</dt>
              <dd class="text-sm text-gray-900">{{ formatDate(campaign.created_at) }}</dd>
            </div>
            <div v-if="campaign.started_at">
              <dt class="text-sm font-medium text-gray-600">Started</dt>
              <dd class="text-sm text-gray-900">{{ formatDate(campaign.started_at) }}</dd>
            </div>
            <div v-if="campaign.completed_at">
              <dt class="text-sm font-medium text-gray-600">Completed</dt>
              <dd class="text-sm text-gray-900">{{ formatDate(campaign.completed_at) }}</dd>
            </div>
          </dl>
        </div>

        <!-- Right Column: Campaign Steps -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Campaign Actions</h3>
          <div v-if="campaign.steps && campaign.steps.length > 0" class="space-y-3">
            <div
              v-for="(step, index) in campaign.steps"
              :key="step.id"
              class="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
            >
              <div class="flex-shrink-0 w-6 h-6 bg-linkedin text-white rounded-full flex items-center justify-center text-xs font-semibold">
                {{ index + 1 }}
              </div>
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-900">
                  {{ step.action?.name || 'Unknown Action' }}
                </div>
                <div v-if="step.message_template" class="text-xs text-gray-600 mt-1">
                  Template: {{ step.message_template.name }}
                </div>
                <div v-if="step.delay_days > 0" class="text-xs text-gray-500 mt-1">
                  Delay: {{ step.delay_days }} day(s)
                </div>
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-gray-500">No actions configured</p>
        </div>
      </div>

      <!-- Prospects List -->
      <div class="bg-white rounded-lg shadow">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Prospects in Campaign</h3>
        </div>
        <div v-if="campaign.campaign_prospects && campaign.campaign_prospects.length > 0" class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Step</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Action</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="cp in campaign.campaign_prospects" :key="cp.id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">
                    {{ cp.prospect?.full_name || 'Unknown' }}
                  </div>
                  <div class="text-sm text-gray-500">{{ cp.prospect?.profile_url }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="['px-2 py-1 text-xs font-semibold rounded-full', getProspectStatusClass(cp.status)]">
                    {{ cp.status }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  Step {{ cp.current_step || 0 }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ cp.last_action_at ? new Date(cp.last_action_at).toLocaleDateString() : 'Not started' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="px-6 py-12 text-center text-gray-500">
          <p>No prospects in this campaign yet.</p>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="bg-white rounded-lg shadow p-6 border-2 border-red-200">
        <h3 class="text-lg font-semibold text-red-600 mb-2">Danger Zone</h3>
        <p class="text-sm text-gray-600 mb-4">
          Once you delete a campaign, there is no going back. Please be certain.
        </p>
        <Button variant="danger" @click="handleDelete">
          Delete Campaign
        </Button>
      </div>
    </div>
  </Layout>
</template>
