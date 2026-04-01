<template>
  <header class="bg-theme-raised shadow-sm border-b border-theme">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <!-- Logo and Title -->
        <div class="flex items-center">
          <router-link to="/prospects" class="flex items-center space-x-2">
            <div class="h-8 w-8 bg-linkedin rounded flex items-center justify-center">
              <span class="text-white font-bold text-lg">L</span>
            </div>
            <span class="text-xl font-semibold text-theme-primary">
              LinkedIn Automation
            </span>
          </router-link>
        </div>

        <!-- Navigation Links -->
        <nav class="hidden md:flex items-center space-x-6">
          <router-link
            to="/prospects"
            class="text-theme-secondary hover:text-linkedin font-medium transition-colors"
          >
            Prospects
          </router-link>
          <router-link
            to="/tags"
            class="text-theme-secondary hover:text-linkedin font-medium transition-colors"
          >
            Tags
          </router-link>
        </nav>

        <!-- User Menu -->
        <div class="flex items-center space-x-4">
          <div v-if="user" class="hidden sm:flex items-center space-x-3">
            <div class="text-right">
              <p class="text-sm font-medium text-theme-primary">{{ user.name }}</p>
              <p class="text-xs text-theme-muted">{{ user.email }}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              @click="handleLogout"
              :loading="logoutMutation.isPending.value"
            >
              Logout
            </Button>
          </div>

          <!-- Mobile logout button -->
          <div class="sm:hidden">
            <Button
              variant="ghost"
              size="sm"
              @click="handleLogout"
              :loading="logoutMutation.isPending.value"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { useAuthStore } from '../../stores/auth'
import { useLogout } from '../../composables/useAuth'
import Button from '../common/Button.vue'

const authStore = useAuthStore()
const user = authStore.user
const logoutMutation = useLogout()

const handleLogout = async () => {
  try {
    await logoutMutation.mutateAsync()
  } catch (error) {
    console.error('Logout error:', error)
  }
}
</script>
