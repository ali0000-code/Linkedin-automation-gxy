<script setup>
/**
 * CampaignCreate - Campaign creation page
 *
 * Thin wrapper that provides the page header and renders the CampaignWizard component,
 * which handles the multi-step campaign creation flow.
 */

import Layout from '../components/layout/Layout.vue'
import CampaignWizard from '../components/campaigns/CampaignWizard.vue'
</script>

<template>
  <Layout>
    <div class="space-y-6">
      <!-- Page Header -->
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Create New Campaign</h1>
        <p class="text-sm text-gray-600 mt-1">
          Follow the steps to create your LinkedIn outreach campaign
        </p>
      </div>

      <!-- Wizard -->
      <CampaignWizard />
    </div>
  </Layout>
</template>
