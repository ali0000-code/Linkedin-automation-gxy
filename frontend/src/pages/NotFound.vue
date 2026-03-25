<script setup>
/**
 * NotFound Page (404)
 *
 * Displayed when user navigates to non-existent route.
 */

import { RouterLink } from 'vue-router'
import Button from '../components/common/Button.vue'
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
    <div class="text-center">
      <h1 class="text-6xl font-bold text-gray-900">404</h1>
      <p class="mt-4 text-xl text-gray-600">Page not found</p>
      <p class="mt-2 text-gray-500">
        The page you're looking for doesn't exist.
      </p>
      <div class="mt-6">
        <RouterLink to="/prospects">
          <Button variant="primary">Go to Prospects</Button>
        </RouterLink>
      </div>
    </div>
  </div>
</template>
