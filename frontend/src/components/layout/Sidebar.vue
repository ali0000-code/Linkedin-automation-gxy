<template>
  <div
    class="flex flex-col h-screen w-[16.5rem] fixed left-0 top-0 z-40 transition-colors duration-300"
    :class="themeStore.isDark ? 'text-white' : 'text-gray-700'"
    :style="themeStore.isDark
      ? 'background: linear-gradient(180deg, #0c1222 0%, #111827 100%)'
      : 'background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border-right: 1px solid #e2e8f0;'"
  >
    <!-- Logo -->
    <div
      class="flex items-center h-16 px-5"
      :style="themeStore.isDark ? 'border-bottom: 1px solid rgba(255,255,255,0.06)' : 'border-bottom: 1px solid #e2e8f0'"
    >
      <div class="flex items-center space-x-3">
        <div class="w-8 h-8 bg-linkedin rounded-lg flex items-center justify-center shadow-lg" style="box-shadow: 0 0 16px rgba(0,119,181,0.3);">
          <span class="text-white font-bold text-sm">LA</span>
        </div>
        <span class="text-base font-semibold tracking-tight" :class="themeStore.isDark ? 'text-white/90' : 'text-gray-900'">LinkedIn Auto</span>
      </div>
    </div>

    <!-- Navigation Menu -->
    <nav class="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto sidebar-scroll">
      <p class="text-[10px] font-semibold uppercase tracking-widest px-3 mb-2" :class="themeStore.isDark ? 'text-white/25' : 'text-gray-400'">Navigation</p>
      <div v-for="item in menuItems" :key="item.name">
        <!-- Main Menu Item with sub-items -->
        <button
          v-if="hasSubItems(item)"
          @click="!item.comingSoon && toggleExpand(item.name)"
          :class="[
            'nav-item w-full justify-between',
            isSubItemActive(item) ? 'nav-item-active' : '',
            item.comingSoon ? 'cursor-not-allowed opacity-40' : ''
          ]"
          :disabled="item.comingSoon"
        >
          <div class="flex items-center space-x-3">
            <component :is="item.icon" />
            <span>{{ item.name }}</span>
          </div>
          <div class="flex items-center space-x-2">
            <span v-if="item.comingSoon" class="text-[10px] bg-white/10 px-1.5 py-0.5 rounded">Soon</span>
            <div v-if="!item.comingSoon" class="transition-transform duration-200" :class="isExpanded(item.name) ? 'rotate-0' : '-rotate-90'">
              <ChevronDownIcon />
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
              'nav-item justify-between',
              isActive ? 'nav-item-active' : '',
              item.comingSoon ? 'cursor-not-allowed opacity-40' : ''
            ]"
          >
            <div class="flex items-center space-x-3">
              <div class="relative">
                <component :is="item.icon" />
                <span
                  v-if="item.name === 'Inbox' && unreadCount > 0"
                  class="absolute -top-1.5 -right-1.5 bg-red-500 text-white badge-count text-[10px]"
                >
                  {{ unreadCount > 9 ? '9+' : unreadCount }}
                </span>
              </div>
              <span>{{ item.name }}</span>
            </div>
            <span v-if="item.comingSoon" class="text-[10px] bg-white/10 px-1.5 py-0.5 rounded">Soon</span>
            <span
              v-if="item.name === 'Inbox' && unreadCount > 0"
              class="bg-red-500/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            >
              {{ unreadCount }}
            </span>
          </a>
        </router-link>

        <!-- Sub Items -->
        <div
          v-if="hasSubItems(item) && isExpanded(item.name) && !item.comingSoon"
          class="ml-3 mt-0.5 space-y-0.5 pl-4"
          style="border-left: 1px solid rgba(255,255,255,0.06);"
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
                'flex items-center px-3 py-2 rounded-md transition-all duration-200 text-[13px]',
                isActive
                  ? 'text-white bg-white/10'
                  : 'text-white/40 hover:text-white/80 hover:bg-white/5'
              ]"
            >
              <span>{{ subItem.name }}</span>
            </a>
          </router-link>
        </div>
      </div>
    </nav>

    <!-- Theme Toggle + User Profile -->
    <div class="px-3 mb-3 space-y-2">
      <!-- Theme Toggle Switch -->
      <div class="flex items-center justify-between px-3 py-2">
        <span class="flex items-center space-x-2 text-[12px]" :class="themeStore.isDark ? 'text-white/40' : 'text-gray-400'">
          <svg v-if="themeStore.isDark" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
          <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span>{{ themeStore.isDark ? 'Dark' : 'Light' }}</span>
        </span>
        <button
          @click="themeStore.toggle()"
          class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 focus:outline-none"
          :class="themeStore.isDark ? 'bg-linkedin' : 'bg-gray-300'"
        >
          <span
            class="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-300"
            :class="themeStore.isDark ? 'translate-x-4' : 'translate-x-0.5'"
          />
        </button>
      </div>

      <!-- User Profile -->
      <div
        class="p-3 rounded-lg transition-colors duration-300"
        :style="themeStore.isDark
          ? 'background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);'
          : 'background: rgba(0,0,0,0.02); border: 1px solid #e2e8f0;'"
      >
        <div class="flex items-center space-x-3">
          <img
            v-if="auth.user?.profile_image_url"
            :src="auth.user.profile_image_url"
            :alt="auth.user.name"
            class="w-9 h-9 rounded-full ring-2"
            :class="themeStore.isDark ? 'ring-white/10' : 'ring-gray-200'"
          />
          <div v-else class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium text-white" style="background: linear-gradient(135deg, #0077b5, #00a0dc);">
            {{ auth.user?.name?.[0]?.toUpperCase() || 'U' }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[13px] font-medium truncate" :class="themeStore.isDark ? 'text-white/90' : 'text-gray-900'">{{ auth.user?.name || 'User' }}</p>
            <p class="text-[11px] truncate" :class="themeStore.isDark ? 'text-white/35' : 'text-gray-400'">{{ auth.user?.email }}</p>
          </div>
        </div>
        <button
          @click="handleLogout"
          class="w-full text-left text-[12px] px-2 py-1.5 mt-2 rounded-md transition-all duration-200"
          :class="themeStore.isDark
            ? 'text-white/30 hover:text-white/70 hover:bg-white/5'
            : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'"
        >
          Sign out
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted, onUnmounted, h } from 'vue'
import { useRoute } from 'vue-router'
import { useQueryClient, useQuery } from '@tanstack/vue-query'
import { useAuthStore } from '../../stores/auth'
import { useThemeStore } from '../../stores/theme'
import { useRouter } from 'vue-router'
import inboxService from '../../services/inbox.service'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const auth = useAuthStore()
const themeStore = useThemeStore()

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

const TemplateIcon = {
  render() {
    return h('svg', { class: 'w-5 h-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' })
    ])
  }
}

const menuItems = [
  { name: 'Home', path: '/dashboard', icon: HomeIcon, comingSoon: false },
  { name: 'Prospects', path: '/prospects', icon: UsersIcon, comingSoon: false },
  { name: 'Campaigns', path: '/campaigns', icon: CampaignIcon, comingSoon: false },
  { name: 'Templates', path: '/templates', icon: TemplateIcon, comingSoon: false },
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
