<script setup>
/**
 * LinkedInCallback Component
 *
 * Handles the OAuth callback after LinkedIn authorization.
 *
 * The backend redirects here with the token in a URL fragment (hash):
 *   /auth/callback#token=xxx
 *
 * Flow:
 * 1. Parse token from window.location.hash
 * 2. Fetch user profile from /api/user using the token
 * 3. Store token + user in auth store (persists to localStorage)
 * 4. Navigate to /dashboard
 */

import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import Spinner from '../components/common/Spinner.vue'

const router = useRouter()
const authStore = useAuthStore()
const error = ref(null)
const isProcessing = ref(true)

onMounted(async () => {
  try {
    // Extract token from URL fragment (#token=xxx)
    const hash = window.location.hash
    const params = new URLSearchParams(hash.substring(1))
    const token = params.get('token')

    // Check for error in query string
    const queryParams = new URLSearchParams(window.location.search)
    const errorMessage = queryParams.get('error')

    if (errorMessage) {
      error.value = decodeURIComponent(errorMessage)
      isProcessing.value = false
      return
    }

    if (!token) {
      error.value = 'No authentication token received. Please try again.'
      isProcessing.value = false
      return
    }

    // Fetch user data with the token
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch user data')
    }

    const userData = await response.json()

    // Store token and user data
    authStore.setToken(token)
    authStore.setUser(userData.data)

    // Redirect to dashboard
    router.replace('/dashboard')
  } catch (err) {
    console.error('OAuth callback error:', err)
    error.value = err.message || 'An error occurred during authentication'
    isProcessing.value = false
  }
})
</script>

<template>
  <!-- Error state -->
  <div v-if="error" class="min-h-screen flex items-center justify-center bg-theme-overlay">
    <div class="max-w-md w-full bg-theme-raised shadow-lg rounded-lg p-8">
      <div class="text-center">
        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
          <svg
            class="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-theme-primary mb-2">
          Authentication Failed
        </h3>
        <p class="text-sm text-theme-muted mb-6">{{ error }}</p>
        <button
          @click="router.push('/login')"
          class="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Try Again
        </button>
      </div>
    </div>
  </div>

  <!-- Loading state -->
  <div v-else class="min-h-screen flex items-center justify-center bg-theme-overlay">
    <div class="text-center">
      <Spinner size="lg" />
      <p class="mt-4 text-theme-secondary">Completing authentication...</p>
      <p class="mt-2 text-sm text-theme-muted">Please wait while we set up your account</p>
    </div>
  </div>
</template>
