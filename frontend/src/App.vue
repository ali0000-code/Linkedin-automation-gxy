<!--
  Root App Component

  Handles:
  - Token verification on mount (once per token value)
  - Provides extension state to all child components
  - Renders router view
-->
<script setup>
import { onMounted, ref, watch, provide } from 'vue'
import { useAuthStore } from './stores/auth'
import { useThemeStore } from './stores/theme'
import { useExtension } from './composables/useExtension'

const auth = useAuthStore()
const theme = useThemeStore() // Initializes dark class on <html>
const verifiedToken = ref(null)
const extension = useExtension()

// Provide extension state to all child components (like React context)
provide('extension', extension)

// Verify token on mount and when token changes
async function verifyAuth() {
  if (!auth.token || verifiedToken.value === auth.token) return
  verifiedToken.value = auth.token

  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/user`, {
      headers: {
        'Authorization': `Bearer ${auth.token}`,
        'Accept': 'application/json',
      },
    })

    if (response.ok) {
      const data = await response.json()
      auth.setUser(data.data)
    } else {
      auth.clearAuth()
    }
  } catch (error) {
    console.error('[App] Failed to verify auth:', error)
  }
}

onMounted(verifyAuth)
watch(() => auth.token, verifyAuth)
</script>

<template>
  <router-view />
</template>
