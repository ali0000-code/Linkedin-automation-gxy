<script setup>
/**
 * Dashboard - Main dashboard page
 *
 * Displays an overview of the user's LinkedIn automation:
 * - Quick stats cards (prospects, campaigns, today's actions, emails)
 * - Today's activity breakdown with progress bar
 * - Active campaigns with progress indicators
 * - Chrome extension connection status
 */

import { inject } from 'vue'
import { useRouter } from 'vue-router'
import Layout from '../components/layout/Layout.vue'
import Spinner from '../components/common/Spinner.vue'
import { useDashboard } from '../composables/useDashboard'
import { useExtension } from '../composables/useExtension'

const router = useRouter()
const { data, isLoading, error } = useDashboard()
const { isConnected, lastSyncTime } = useExtension()

const colorClasses = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  purple: 'bg-purple-50 text-purple-600',
  amber: 'bg-amber-50 text-amber-600',
}
</script>

<template>
  <Layout>
    <div v-if="isLoading" class="flex justify-center items-center h-64">
      <Spinner size="lg" />
    </div>

    <div v-else-if="error" class="text-center py-12">
      <p class="text-red-600">Failed to load dashboard data</p>
    </div>

    <div v-else class="space-y-6">
      <!-- Page Header -->
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p class="text-sm text-gray-600 mt-1">
          Overview of your LinkedIn automation
        </p>
      </div>

      <!-- Quick Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Total Prospects -->
        <div
          class="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
          @click="router.push('/prospects')"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">Total Prospects</p>
              <p class="text-2xl font-bold text-gray-900 mt-1">{{ (data?.prospects?.total || 0).toLocaleString() }}</p>
              <p class="text-xs text-gray-500 mt-1">{{ data?.prospects?.connected || 0 }} connected</p>
            </div>
            <div class="p-3 rounded-lg bg-blue-50 text-blue-600">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        <!-- Active Campaigns -->
        <div
          class="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
          @click="router.push('/campaign/list')"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">Active Campaigns</p>
              <p class="text-2xl font-bold text-gray-900 mt-1">{{ (data?.campaigns?.active || 0).toLocaleString() }}</p>
              <p class="text-xs text-gray-500 mt-1">{{ data?.campaigns?.total || 0 }} total</p>
            </div>
            <div class="p-3 rounded-lg bg-green-50 text-green-600">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>

        <!-- Today's Actions -->
        <div class="bg-white rounded-lg shadow p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">Today's Actions</p>
              <p class="text-2xl font-bold text-gray-900 mt-1">{{ (data?.today?.completed || 0).toLocaleString() }}</p>
              <p class="text-xs text-gray-500 mt-1">{{ data?.today?.pending || 0 }} pending</p>
            </div>
            <div class="p-3 rounded-lg bg-purple-50 text-purple-600">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
          </div>
        </div>

        <!-- Prospects with Email -->
        <div
          class="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
          @click="router.push('/mail')"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">With Email</p>
              <p class="text-2xl font-bold text-gray-900 mt-1">{{ (data?.prospects?.with_email || 0).toLocaleString() }}</p>
              <p class="text-xs text-gray-500 mt-1">extracted emails</p>
            </div>
            <div class="p-3 rounded-lg bg-amber-50 text-amber-600">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Today's Activity Section -->
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Today's Activity</h2>

        <!-- Progress Bar -->
        <div class="mb-4">
          <div class="flex justify-between text-sm mb-1">
            <span class="text-gray-600">Daily Progress</span>
            <span class="font-medium">
              {{ data?.today?.completed || 0 }} / {{ data?.today?.daily_limit || 50 }} actions
            </span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-3">
            <div
              class="bg-linkedin h-3 rounded-full transition-all duration-300"
              :style="{
                width: `${Math.min(((data?.today?.completed || 0) / (data?.today?.daily_limit || 50)) * 100, 100)}%`,
              }"
            />
          </div>
        </div>

        <!-- Action Breakdown -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
          <div class="text-center p-3 bg-gray-50 rounded-lg">
            <svg class="w-5 h-5 mx-auto text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <p class="text-lg font-semibold text-gray-900">{{ data?.today?.visits || 0 }}</p>
            <p class="text-xs text-gray-500">Visits</p>
          </div>
          <div class="text-center p-3 bg-gray-50 rounded-lg">
            <svg class="w-5 h-5 mx-auto text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <p class="text-lg font-semibold text-gray-900">{{ data?.today?.invites || 0 }}</p>
            <p class="text-xs text-gray-500">Invites</p>
          </div>
          <div class="text-center p-3 bg-gray-50 rounded-lg">
            <svg class="w-5 h-5 mx-auto text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p class="text-lg font-semibold text-gray-900">{{ data?.today?.messages || 0 }}</p>
            <p class="text-xs text-gray-500">Messages</p>
          </div>
          <div class="text-center p-3 bg-gray-50 rounded-lg">
            <svg class="w-5 h-5 mx-auto text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <p class="text-lg font-semibold text-gray-900">{{ data?.today?.follows || 0 }}</p>
            <p class="text-xs text-gray-500">Follows</p>
          </div>
          <div class="text-center p-3 bg-gray-50 rounded-lg">
            <svg class="w-5 h-5 mx-auto text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p class="text-lg font-semibold text-gray-900">{{ data?.today?.emails || 0 }}</p>
            <p class="text-xs text-gray-500">Emails</p>
          </div>
        </div>

        <!-- Next Action -->
        <div v-if="data?.next_action" class="mt-6 pt-4 border-t border-gray-200">
          <div class="flex items-center text-sm text-gray-600">
            <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Next action: <span class="font-medium ml-1 capitalize">{{ data.next_action.action_type }}</span>
            <span class="ml-2 text-gray-500">
              at {{ new Date(data.next_action.scheduled_for).toLocaleTimeString() }}
            </span>
          </div>
        </div>
      </div>

      <!-- Active Campaigns Section -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold text-gray-900">Active Campaigns</h2>
          <button
            @click="router.push('/campaign/list')"
            class="text-sm text-linkedin hover:underline"
          >
            View All
          </button>
        </div>

        <div v-if="data?.active_campaigns?.length === 0" class="text-center py-8 text-gray-500">
          <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p>No active campaigns</p>
          <button
            @click="router.push('/campaign/create')"
            class="mt-2 text-linkedin hover:underline text-sm"
          >
            Create your first campaign
          </button>
        </div>

        <div v-else class="space-y-4">
          <div
            v-for="campaign in data?.active_campaigns"
            :key="campaign.id"
            @click="router.push(`/campaign/${campaign.id}`)"
            class="flex items-center justify-between p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div class="flex-1">
              <div class="flex items-center">
                <h3 class="font-medium text-gray-900">{{ campaign.name }}</h3>
                <span class="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                  Active
                </span>
              </div>
              <p class="text-sm text-gray-500 mt-1">{{ campaign.action_type }}</p>
            </div>

            <div class="flex items-center space-x-6">
              <!-- Progress -->
              <div class="text-right">
                <p class="text-sm font-medium text-gray-900">
                  {{ campaign.completed_prospects }} / {{ campaign.total_prospects }}
                </p>
                <p class="text-xs text-gray-500">prospects</p>
              </div>

              <!-- Progress Bar -->
              <div class="w-24">
                <div class="w-full bg-gray-200 rounded-full h-2">
                  <div
                    class="bg-linkedin h-2 rounded-full"
                    :style="{ width: `${campaign.progress_percent}%` }"
                  />
                </div>
                <p class="text-xs text-gray-500 text-center mt-1">{{ campaign.progress_percent }}%</p>
              </div>

              <!-- Today's Actions -->
              <div class="text-right">
                <p class="text-sm font-medium text-gray-900">{{ campaign.today_actions }}</p>
                <p class="text-xs text-gray-500">today</p>
              </div>

              <!-- Arrow -->
              <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Extension Status Section -->
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Extension Status</h2>
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <div
              class="w-3 h-3 rounded-full mr-3"
              :class="isConnected ? 'bg-green-500' : 'bg-red-500'"
            />
            <div>
              <p class="font-medium text-gray-900">
                {{ isConnected ? 'Connected' : 'Disconnected' }}
              </p>
              <p v-if="lastSyncTime" class="text-sm text-gray-500">
                Last sync: {{ new Date(lastSyncTime).toLocaleString() }}
              </p>
            </div>
          </div>
          <p v-if="!isConnected" class="text-sm text-gray-500">
            Open LinkedIn in Chrome to connect
          </p>
        </div>
      </div>
    </div>
  </Layout>
</template>
