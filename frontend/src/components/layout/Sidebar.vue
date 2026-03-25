<template>
  <div class="flex flex-col h-screen bg-gray-900 text-white w-64 fixed left-0 top-0">
    <!-- Logo -->
    <div class="flex items-center justify-center h-16 border-b border-gray-800">
      <div class="flex items-center space-x-2">
        <div class="w-8 h-8 bg-linkedin rounded-lg flex items-center justify-center">
          <span class="text-white font-bold text-lg">L</span>
        </div>
        <span class="text-xl font-bold">LinkedIn Auto</span>
      </div>
    </div>

    <!-- Navigation Menu -->
    <nav class="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
      <div v-for="item in menuItems" :key="item.name">
        <!-- Main Menu Item with sub-items -->
        <button
          v-if="hasSubItems(item)"
          @click="!item.comingSoon && toggleExpand(item.name)"
          :class="[
            'w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors',
            isSubItemActive(item)
              ? 'bg-linkedin/20 text-white'
              : 'text-gray-300 hover:bg-gray-800 hover:text-white',
            item.comingSoon ? 'cursor-not-allowed opacity-60' : ''
          ]"
          :disabled="item.comingSoon"
        >
          <div class="flex items-center space-x-3">
            <component :is="item.icon" />
            <span class="font-medium">{{ item.name }}</span>
          </div>
          <div class="flex items-center space-x-2">
            <span v-if="item.comingSoon" class="text-xs bg-gray-700 px-2 py-1 rounded">Soon</span>
            <div v-if="!item.comingSoon" class="transition-transform">
              <ChevronDownIcon v-if="isExpanded(item.name)" />
              <ChevronRightIcon v-else />
            </div>
          </div>
        </button>

        <!-- Main Menu Item without sub-items -->
        <router-link
          v-else
          :to="item.path"
          custom
          v-slot="{ isActive, navigate }"
        >
          <a
            @click="item.comingSoon ? $event.preventDefault() : navigate($event)"
            :href="item.path"
            :class="[
              'flex items-center justify-between px-4 py-3 rounded-lg transition-colors',
              isActive
                ? 'bg-linkedin text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white',
              item.comingSoon ? 'cursor-not-allowed opacity-60' : ''
            ]"
          >
            <div class="flex items-center space-x-3">
              <div class="relative">
                <component :is="item.icon" />
                <!-- Unread badge for Inbox -->
                <span
                  v-if="item.name === 'Inbox' && unreadCount > 0"
                  class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center"
                >
                  {{ unreadCount > 9 ? '9+' : unreadCount }}
                </span>
              </div>
              <span class="font-medium">{{ item.name }}</span>
            </div>
            <span v-if="item.comingSoon" class="text-xs bg-gray-700 px-2 py-1 rounded">Soon</span>
            <!-- Also show count next to Inbox text -->
            <span
              v-if="item.name === 'Inbox' && unreadCount > 0"
              class="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full"
            >
              {{ unreadCount }}
            </span>
          </a>
        </router-link>

        <!-- Sub Items -->
        <div
          v-if="hasSubItems(item) && isExpanded(item.name) && !item.comingSoon"
          class="ml-4 mt-1 space-y-1"
        >
          <router-link
            v-for="subItem in item.subItems"
            :key="subItem.path"
            :to="subItem.path"
            custom
            v-slot="{ isActive, navigate }"
          >
            <a
              @click="navigate($event)"
              :href="subItem.path"
              :class="[
                'flex items-center px-4 py-2 rounded-lg transition-colors text-sm',
                isActive
                  ? 'bg-linkedin text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              ]"
            >
              <span class="ml-6">{{ subItem.name }}</span>
            </a>
          </router-link>
        </div>
      </div>
    </nav>

    <!-- User Profile Section -->
    <div class="border-t border-gray-800 p-4">
      <div class="flex items-center space-x-3 mb-3">
        <img v-if="auth.user?.profile_image_url" :src="auth.user.profile_image_url" :alt="auth.user.name" class="w-10 h-10 rounded-full" />
        <div v-else class="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
          <span class="text-sm font-medium">{{ auth.user?.name?.[0]?.toUpperCase() || 'U' }}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">{{ auth.user?.name || 'User' }}</p>
          <p class="text-xs text-gray-400 truncate">{{ auth.user?.email }}</p>
        </div>
      </div>
      <button @click="handleLogout" class="w-full text-left text-sm text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800">
        Logout
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted, onUnmounted, h } from 'vue'
import { useRoute } from 'vue-router'
import { useQueryClient, useQuery } from '@tanstack/vue-query'
import { useAuthStore } from '../../stores/auth'
import { useRouter } from 'vue-router'
import inboxService from '../../services/inbox.service'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const auth = useAuthStore()

const handleLogout = async () => {
  try {
    const api = (await import('../../services/api')).default
    await api.post('/logout')
  } catch {}
  auth.clearAuth()
  router.push('/login')
}
const expandedItems = ref(['Campaign']) // Campaign expanded by default

// Use inject for extension (replacing useExtension hook)
const extension = inject('extension', { isConnected: ref(false), checkNewMessages: async () => ({}) })
const { isConnected, checkNewMessages } = extension

// Use useQuery directly for inbox stats (replacing useInboxStats hook)
const { data: stats } = useQuery({
  queryKey: ['inboxStats'],
  queryFn: () => inboxService.getStats(),
})

const unreadCount = computed(() => stats.value?.unread_conversations || 0)

// Poll the extension for new messages every 30 seconds
let pollInterval = null

onMounted(() => {
  if (!isConnected.value) return

  const checkForNewMessages = async () => {
    try {
      const result = await checkNewMessages()
      if (result.hasNewMessages && result.count > 0) {
        queryClient.invalidateQueries({ queryKey: ['inboxStats'] })
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
      }
    } catch (e) {
      // Silently ignore -- extension may be temporarily unreachable
    }
  }

  checkForNewMessages()
  pollInterval = setInterval(checkForNewMessages, 30000)
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})

// Simple SVG Icon components defined inline
const HomeIcon = {
  render() {
    return h('svg', { class: 'w-5 h-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' })
    ])
  }
}

const UsersIcon = {
  render() {
    return h('svg', { class: 'w-5 h-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' })
    ])
  }
}

const CampaignIcon = {
  render() {
    return h('svg', { class: 'w-5 h-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' })
    ])
  }
}

const InboxIcon = {
  render() {
    return h('svg', { class: 'w-5 h-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4' })
    ])
  }
}

const MailIcon = {
  render() {
    return h('svg', { class: 'w-5 h-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' })
    ])
  }
}

const SettingsIcon = {
  render() {
    return h('svg', { class: 'w-5 h-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }),
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' })
    ])
  }
}

const ChevronDownIcon = {
  render() {
    return h('svg', { class: 'w-4 h-4', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M19 9l-7 7-7-7' })
    ])
  }
}

const ChevronRightIcon = {
  render() {
    return h('svg', { class: 'w-4 h-4', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M9 5l7 7-7 7' })
    ])
  }
}

const menuItems = [
  { name: 'Home', path: '/dashboard', icon: HomeIcon, comingSoon: false },
  { name: 'Prospects', path: '/prospects', icon: UsersIcon, comingSoon: false },
  {
    name: 'Campaign',
    icon: CampaignIcon,
    comingSoon: false,
    subItems: [
      { name: 'Campaigns List', path: '/campaign/list' },
      { name: 'Message Templates', path: '/campaign/templates' }
    ]
  },
  { name: 'Mail', path: '/mail', icon: MailIcon, comingSoon: false },
  { name: 'Inbox', path: '/inbox', icon: InboxIcon, comingSoon: false },
  { name: 'Settings', path: '/settings', icon: SettingsIcon, comingSoon: false },
]

const hasSubItems = (item) => item.subItems && item.subItems.length > 0

const isSubItemActive = (item) => {
  return hasSubItems(item) && item.subItems.some(sub => route.path === sub.path)
}

const toggleExpand = (itemName) => {
  if (expandedItems.value.includes(itemName)) {
    expandedItems.value = expandedItems.value.filter(name => name !== itemName)
  } else {
    expandedItems.value = [...expandedItems.value, itemName]
  }
}

const isExpanded = (itemName) => expandedItems.value.includes(itemName)
</script>
