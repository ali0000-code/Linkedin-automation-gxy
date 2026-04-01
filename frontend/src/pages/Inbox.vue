<script setup>
/**
 * Inbox - LinkedIn messaging inbox page
 *
 * Two-panel layout: conversation list (left) and chat view (right).
 *
 * Key architectural decisions:
 * - Lightweight polling: every 15s, calls checkConversation() which returns only
 *   { message_count }. Only when count changes does it trigger a full conversation fetch.
 * - Baseline count tracking: lastKnownCountRef stores message count per conversation.
 *   After sending, baseline is bumped +1 to prevent redundant refetch.
 * - Auto-sync on open: when a conversation with zero messages is selected AND extension
 *   is connected, auto-syncs messages from LinkedIn.
 * - Optimistic message sending via useSendMessage's onMutate.
 * - Message scheduling via date/time picker.
 * - Uses inject('extension') for extension state.
 * - Uses onMounted/onUnmounted for setInterval cleanup.
 */

import { ref, computed, watch, inject, onMounted, onUnmounted, nextTick } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import Layout from '../components/layout/Layout.vue'
import Button from '../components/common/Button.vue'
import Spinner from '../components/common/Spinner.vue'
import {
  useConversations,
  useConversation,
  useInboxStats,
  useSendMessage,
  useMarkAsRead,
  useDeleteConversation,
  useSendScheduledMessage,
  useCancelScheduledMessage,
} from '../composables/useInbox'
import inboxService from '../services/inbox.service'

const extension = inject('extension')
const queryClient = useQueryClient()

// State
const selectedConversationId = ref(null)
const isSyncing = ref(false)
const isSyncingMessages = ref(false)
const page = ref(1)
const newMessage = ref('')
const showScheduler = ref(false)
const scheduledDate = ref('')
const scheduledTime = ref('')
const messagesEndRef = ref(null)

// Lightweight polling baseline count tracker (plain ref object)
const lastKnownCountRef = ref({})

// Track which conversations we've already auto-synced
const syncedConversationsRef = ref(new Set())

// Data fetching
const conversationParams = computed(() => ({ page: page.value, per_page: 30 }))
const { data: conversationsData, isLoading, refetch } = useConversations(conversationParams)
const { data: statsData } = useInboxStats()
const { data: conversationData, isLoading: isLoadingConversation } = useConversation(selectedConversationId)
const sendMessageMutation = useSendMessage()
const markAsReadMutation = useMarkAsRead()
const deleteConversationMutation = useDeleteConversation()
const cancelScheduledMutation = useCancelScheduledMessage()
const sendScheduledMutation = useSendScheduledMessage()

const conversations = computed(() => conversationsData.value?.data || [])
const selectedConversation = computed(() => conversationData.value?.conversation)
const messages = computed(() => selectedConversation.value?.messages || [])
const stats = computed(() => statsData.value || {})
const isSending = computed(() => sendMessageMutation.isPending?.value || sendScheduledMutation.isPending?.value)

// Scroll to bottom when messages change
watch(messages, async () => {
  await nextTick()
  messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' })
})

// Auto-sync inbox when page loads (if extension is connected)
onMounted(async () => {
  if (!extension?.isConnected?.value) return
  try {
    const result = await extension.quickSyncInbox()
    if (result?.success) {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['inboxStats'] })
    }
  } catch {
    // Silently ignore
  }
})

// Lightweight polling: every 15s check message count via cheap endpoint
let pollInterval = null

watch(selectedConversationId, (newId) => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }

  if (!newId) return

  pollInterval = setInterval(async () => {
    try {
      const check = await inboxService.checkConversation(newId)
      const lastCount = lastKnownCountRef.value[newId]

      if (lastCount === undefined) {
        // First check -- store baseline
        lastKnownCountRef.value[newId] = check.message_count
      } else if (check.message_count !== lastCount) {
        // Message count changed -- fetch full conversation
        lastKnownCountRef.value[newId] = check.message_count
        queryClient.invalidateQueries({ queryKey: ['conversation', newId] })
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
      }
    } catch {
      // Silently ignore poll errors
    }
  }, 15000)
}, { immediate: true })

// Cleanup interval on unmount
onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
})

// Auto-sync messages when opening a conversation with no messages
watch([selectedConversation, isLoadingConversation], ([conv, loading]) => {
  if (!conv || loading) return
  if (!extension?.isConnected?.value) return
  if (syncedConversationsRef.value.has(conv.id)) return

  if (messages.value.length > 0) {
    syncedConversationsRef.value.add(conv.id)
    return
  }

  const linkedinConvId = conv.linkedin_conversation_id
  const backendConvId = conv.id

  if (linkedinConvId && backendConvId) {
    console.log('[Inbox] Auto-syncing messages for conversation:', backendConvId)
    syncedConversationsRef.value.add(conv.id)

    extension.syncConversationMessages(linkedinConvId, backendConvId)
      .then((result) => {
        console.log('[Inbox] Auto-sync result:', result)
        queryClient.invalidateQueries({ queryKey: ['conversation', backendConvId] })
      })
      .catch((error) => {
        console.error('[Inbox] Auto-sync failed:', error)
        syncedConversationsRef.value.delete(conv.id)
      })
  }
})

// Handlers
const handleSelectConversation = (conversation) => {
  selectedConversationId.value = conversation.id
  // Reset poll baseline for this conversation
  delete lastKnownCountRef.value[conversation.id]
}

const handleSync = async () => {
  isSyncing.value = true
  try {
    await extension.triggerSync('SYNC_INBOX', { limit: 50, includeMessages: false })
    await refetch()
  } catch (error) {
    console.error('Sync failed:', error)
    alert('Sync failed. Make sure you have LinkedIn open in a browser tab and the extension is active.')
  } finally {
    isSyncing.value = false
  }
}

const handleSendMessage = async () => {
  const content = newMessage.value.trim()
  if (!content || isSending.value) return

  const targetConversationId = selectedConversationId.value
  const targetLinkedInConversationId = selectedConversation.value?.linkedin_conversation_id

  if (!targetConversationId || !targetLinkedInConversationId) {
    console.error('Cannot send message: missing conversation ID')
    return
  }

  newMessage.value = ''

  try {
    const result = await sendMessageMutation.mutateAsync({
      conversationId: targetConversationId,
      content,
    })

    if (result?.data?.id) {
      try {
        const sendResult = await extension.sendLinkedInMessage(
          targetLinkedInConversationId,
          content,
          result.data.id
        )
        console.log('LinkedIn API send result:', sendResult)

        // Bump baseline so poll doesn't redundantly refetch
        if (lastKnownCountRef.value[targetConversationId] !== undefined) {
          lastKnownCountRef.value[targetConversationId]++
        }

        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['conversation', targetConversationId] })
        }, 500)
      } catch (extError) {
        console.error('Failed to send via LinkedIn API:', extError)
        alert(extError.message || 'Failed to send message via LinkedIn.')
      }
    }
  } catch (error) {
    console.error('Failed to send message:', error)
    alert('Failed to send message. Please try again.')
  }
}

const handleDeleteConversation = async (id, e) => {
  e.stopPropagation()
  if (!window.confirm('Are you sure you want to delete this conversation?')) return
  try {
    await deleteConversationMutation.mutateAsync(id)
    if (selectedConversationId.value === id) {
      selectedConversationId.value = null
    }
  } catch (error) {
    console.error('Failed to delete conversation:', error)
  }
}

const handleSyncMessages = async () => {
  const targetConversationId = selectedConversationId.value
  const targetLinkedInConversationId = selectedConversation.value?.linkedin_conversation_id
  if (!targetLinkedInConversationId || !targetConversationId) return

  isSyncingMessages.value = true
  try {
    const result = await extension.syncConversationMessages(
      targetLinkedInConversationId,
      targetConversationId
    )
    console.log('Messages synced:', result)
    queryClient.invalidateQueries({ queryKey: ['conversation', targetConversationId] })
  } catch (error) {
    console.error('Failed to sync messages:', error)
    alert('Failed to sync messages. Make sure you are logged into LinkedIn.')
  } finally {
    isSyncingMessages.value = false
  }
}

const handleScheduleMessage = async () => {
  const content = newMessage.value.trim()
  if (!content || !scheduledDate.value || !scheduledTime.value) return

  const scheduledAt = new Date(`${scheduledDate.value}T${scheduledTime.value}`)
  if (scheduledAt <= new Date()) {
    alert('Please select a future date and time')
    return
  }

  const targetConversationId = selectedConversationId.value
  if (!targetConversationId) return

  try {
    await sendScheduledMutation.mutateAsync({
      conversationId: targetConversationId,
      content,
      scheduledAt: scheduledAt.toISOString(),
    })
    queryClient.invalidateQueries({ queryKey: ['conversation', targetConversationId] })
    newMessage.value = ''
    scheduledDate.value = ''
    scheduledTime.value = ''
    showScheduler.value = false
  } catch (error) {
    console.error('Failed to schedule message:', error)
    alert('Failed to schedule message. Please try again.')
  }
}

const handleCancelScheduledMessage = async (messageId) => {
  if (!window.confirm('Are you sure you want to cancel this scheduled message?')) return
  try {
    await cancelScheduledMutation.mutateAsync(messageId)
    queryClient.invalidateQueries({ queryKey: ['conversation', selectedConversationId.value] })
  } catch (error) {
    console.error('Failed to cancel scheduled message:', error)
    alert('Failed to cancel scheduled message. Please try again.')
  }
}

const handleKeyDown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSendMessage()
  }
}

// Helpers
const getMinDate = () => new Date().toISOString().split('T')[0]

const formatRelativeTime = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`
  return date.toLocaleDateString()
}

const formatMessageTime = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const formatScheduledTime = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
</script>

<template>
  <Layout>
    <div class="h-[calc(100vh-120px)] flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-2xl font-bold text-theme-primary">Inbox</h1>
          <p class="text-theme-secondary mt-1">
            {{ stats.total_conversations || 0 }} conversations
            <span v-if="stats.unread_conversations > 0" class="ml-2 text-linkedin font-medium">
              ({{ stats.unread_conversations }} unread)
            </span>
          </p>
        </div>
        <Button
          variant="secondary"
          class="flex items-center space-x-2"
          :disabled="isSyncing"
          @click="handleSync"
        >
          <template v-if="isSyncing">
            <Spinner size="sm" />
            <span>Syncing...</span>
          </template>
          <template v-else>
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Sync Inbox</span>
          </template>
        </Button>
      </div>

      <!-- Main Content -->
      <div class="flex-1 bg-theme-raised rounded-lg shadow-sm border border-theme overflow-hidden flex">
        <!-- Conversation List -->
        <div :class="['w-full md:w-96 border-r border-theme flex flex-col', selectedConversationId ? 'hidden md:flex' : 'flex']">
          <div v-if="isLoading" class="flex items-center justify-center h-64">
            <Spinner size="lg" />
          </div>
          <div v-else-if="conversations.length === 0" class="flex flex-col items-center justify-center h-full text-theme-muted p-8">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 class="mt-4 text-lg font-medium text-theme-primary">No conversations yet</h3>
            <p class="mt-2 text-center">Sync your LinkedIn inbox to see your conversations here.</p>
            <Button class="mt-4" :disabled="isSyncing" @click="handleSync">
              <Spinner v-if="isSyncing" size="sm" />
              <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span class="ml-2">{{ isSyncing ? 'Syncing...' : 'Sync Inbox' }}</span>
            </Button>
          </div>
          <div v-else class="flex-1 overflow-y-auto">
            <div
              v-for="conversation in conversations"
              :key="conversation.id"
              :class="[
                'p-4 border-b border-theme-subtle cursor-pointer transition-colors hover:bg-theme-overlay',
                selectedConversationId === conversation.id ? 'bg-blue-50 border-l-4 border-l-linkedin' : '',
                conversation.is_unread ? 'bg-blue-50/50' : ''
              ]"
              @click="handleSelectConversation(conversation)"
            >
              <div class="flex items-start space-x-3">
                <div class="flex-shrink-0">
                  <img
                    v-if="conversation.participant_avatar_url"
                    :src="conversation.participant_avatar_url"
                    :alt="conversation.participant_name"
                    class="w-12 h-12 rounded-full object-cover"
                  />
                  <div v-else class="w-12 h-12 rounded-full bg-linkedin flex items-center justify-center text-white font-semibold">
                    {{ conversation.participant_name?.charAt(0)?.toUpperCase() || '?' }}
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <h3 :class="['text-sm truncate', conversation.is_unread ? 'font-bold text-theme-primary' : 'font-medium text-theme-secondary']">
                      {{ conversation.participant_name }}
                    </h3>
                    <span class="text-xs text-theme-muted flex-shrink-0 ml-2">
                      {{ formatRelativeTime(conversation.last_message_at) }}
                    </span>
                  </div>
                  <p v-if="conversation.participant_headline" class="text-xs text-theme-muted truncate mt-0.5">
                    {{ conversation.participant_headline }}
                  </p>
                  <p :class="['text-sm truncate mt-1', conversation.is_unread ? 'font-semibold text-theme-primary' : 'text-theme-muted']">
                    {{ conversation.last_message_preview || 'No messages yet' }}
                  </p>
                </div>
                <div v-if="conversation.unread_count > 0" class="flex-shrink-0 bg-linkedin text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {{ conversation.unread_count }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Chat View -->
        <div :class="['flex-1 flex flex-col', selectedConversationId ? 'flex' : 'hidden md:flex']">
          <template v-if="selectedConversationId">
            <div v-if="isLoadingConversation" class="flex items-center justify-center h-full">
              <Spinner size="lg" />
            </div>
            <template v-else-if="selectedConversation">
              <!-- Chat Header -->
              <div class="px-4 py-3 border-b border-theme bg-theme-raised flex items-center space-x-3">
                <button class="md:hidden p-1 hover:bg-theme-overlay rounded-full" @click="selectedConversationId = null">
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <img
                  v-if="selectedConversation.participant_avatar_url"
                  :src="selectedConversation.participant_avatar_url"
                  :alt="selectedConversation.participant_name"
                  class="w-10 h-10 rounded-full object-cover"
                />
                <div v-else class="w-10 h-10 rounded-full bg-linkedin flex items-center justify-center text-white font-semibold">
                  {{ selectedConversation.participant_name?.charAt(0)?.toUpperCase() || '?' }}
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="font-semibold text-theme-primary truncate">{{ selectedConversation.participant_name }}</h3>
                  <p v-if="selectedConversation.participant_headline" class="text-xs text-theme-muted truncate">
                    {{ selectedConversation.participant_headline }}
                  </p>
                </div>
                <button
                  class="p-2 hover:bg-theme-overlay rounded-full text-theme-muted hover:text-linkedin disabled:opacity-50"
                  title="Sync messages from LinkedIn"
                  :disabled="isSyncingMessages"
                  @click="handleSyncMessages"
                >
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <a
                  v-if="selectedConversation.participant_profile_url"
                  :href="selectedConversation.participant_profile_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-linkedin hover:underline text-sm"
                >
                  View Profile
                </a>
              </div>

              <!-- Messages -->
              <div class="flex-1 overflow-y-auto p-4 bg-theme-overlay">
                <div v-if="messages.length === 0" class="text-center text-theme-muted py-8">
                  <p>No messages yet.</p>
                  <p class="text-sm mt-1">Start the conversation!</p>
                </div>
                <template v-else>
                  <div
                    v-for="message in messages"
                    :key="message.id"
                    :class="['flex mb-3', message.is_from_me ? 'justify-end' : 'justify-start']"
                  >
                    <div
                      :class="[
                        'max-w-[70%] rounded-2xl px-4 py-2',
                        message.status === 'scheduled'
                          ? 'bg-amber-100 text-amber-900 border-2 border-amber-300 border-dashed rounded-br-sm'
                          : message.is_from_me
                          ? 'bg-linkedin text-white rounded-br-sm'
                          : 'bg-theme-overlay text-theme-primary rounded-bl-sm'
                      ]"
                    >
                      <p class="text-sm whitespace-pre-wrap break-words">{{ message.content }}</p>
                      <div :class="[
                        'flex items-center justify-end mt-1 space-x-1',
                        message.status === 'scheduled' ? 'text-amber-700' : message.is_from_me ? 'text-white/70' : 'text-theme-muted'
                      ]">
                        <template v-if="message.status === 'scheduled'">
                          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span class="text-xs">Scheduled: {{ formatScheduledTime(message.scheduled_at) }}</span>
                          <button
                            class="ml-2 text-red-600 hover:text-red-800"
                            title="Cancel scheduled message"
                            @click="handleCancelScheduledMessage(message.id)"
                          >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </template>
                        <template v-else>
                          <span class="text-xs">{{ formatMessageTime(message.sent_at) }}</span>
                          <span v-if="message.status === 'pending'" class="text-xs">(Sending...)</span>
                          <span v-if="message.status === 'failed'" class="text-xs text-red-300">(Failed)</span>
                        </template>
                      </div>
                    </div>
                  </div>
                </template>
                <div ref="messagesEndRef" />
              </div>

              <!-- Message Input -->
              <div class="p-4 border-t border-theme bg-theme-raised">
                <div v-if="showScheduler" class="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-medium text-amber-800 flex items-center">
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span class="ml-1">Schedule Message</span>
                    </span>
                    <button class="text-amber-600 hover:text-amber-800" @click="showScheduler = false">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div class="flex items-center space-x-2">
                    <input
                      v-model="scheduledDate"
                      type="date"
                      :min="getMinDate()"
                      class="flex-1 border border-amber-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                    <input
                      v-model="scheduledTime"
                      type="time"
                      class="flex-1 border border-amber-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                    <Button
                      type="button"
                      class="bg-amber-500 hover:bg-amber-600"
                      :disabled="!newMessage.trim() || !scheduledDate || !scheduledTime || isSending"
                      @click="handleScheduleMessage"
                    >
                      Schedule
                    </Button>
                  </div>
                </div>

                <form @submit.prevent="handleSendMessage">
                  <div class="flex items-end space-x-2">
                    <textarea
                      v-model="newMessage"
                      placeholder="Type a message..."
                      rows="1"
                      class="flex-1 border border-theme rounded-lg px-4 py-2 focus:ring-2 focus:ring-linkedin focus:border-transparent resize-none"
                      @keydown="handleKeyDown"
                    />
                    <button
                      type="button"
                      :class="[
                        'p-2 rounded-lg border',
                        showScheduler
                          ? 'bg-amber-100 border-amber-300 text-amber-600'
                          : 'border-theme text-theme-muted hover:bg-theme-overlay'
                      ]"
                      title="Schedule message"
                      @click="showScheduler = !showScheduler"
                    >
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                    <Button
                      type="submit"
                      class="flex-shrink-0"
                      :disabled="!newMessage.trim() || isSending"
                    >
                      <Spinner v-if="isSending" size="sm" />
                      <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </Button>
                  </div>
                  <p class="text-xs text-theme-muted mt-2">
                    Press Enter to send, Shift+Enter for new line.
                  </p>
                </form>
              </div>
            </template>

            <div v-else class="flex items-center justify-center h-full text-theme-muted">
              Conversation not found
            </div>
          </template>

          <div v-else class="flex items-center justify-center h-full text-theme-muted">
            <div class="text-center">
              <svg class="w-5 h-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p class="mt-4">Select a conversation to view messages</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Layout>
</template>
