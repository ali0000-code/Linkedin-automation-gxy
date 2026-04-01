/**
 * Extension Composable
 *
 * Provides communication with the Chrome extension.
 * Call once in App.vue and provide() to children via inject('extension').
 */
import { ref, onMounted, onUnmounted } from 'vue'

const getExtensionId = () => {
  if (window.__LINKEDIN_AUTOMATION_EXTENSION_ID__) {
    return window.__LINKEDIN_AUTOMATION_EXTENSION_ID__
  }
  return localStorage.getItem('linkedin_automation_extension_id')
}

const sendMessage = (type, data = {}) => {
  return new Promise((resolve, reject) => {
    const extensionId = getExtensionId()
    if (!extensionId) {
      reject(new Error('Extension not found.'))
      return
    }
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      reject(new Error('Chrome runtime not available.'))
      return
    }
    try {
      chrome.runtime.sendMessage(extensionId, { type, ...data }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        if (response?.error) {
          reject(new Error(response.error))
          return
        }
        resolve(response)
      })
    } catch (error) {
      reject(error)
    }
  })
}

export function useExtension() {
  const isConnected = ref(false)
  const isChecking = ref(true)
  const lastSyncTime = ref(null)

  // Single PING on mount
  onMounted(async () => {
    isChecking.value = true
    try {
      const response = await sendMessage('PING')
      isConnected.value = response?.success === true
    } catch {
      isConnected.value = false
    } finally {
      isChecking.value = false
    }
  })

  // Listen for extension ready event
  const handleReady = () => { isConnected.value = true }
  onMounted(() => window.addEventListener('linkedin-automation-extension-ready', handleReady))
  onUnmounted(() => window.removeEventListener('linkedin-automation-extension-ready', handleReady))

  // Command functions
  const triggerSync = async (type, data = {}) => {
    if (!isConnected.value) throw new Error('Extension not connected.')
    return sendMessage(type, data)
  }

  const syncInbox = async (options = {}) => {
    const result = await triggerSync('SYNC_INBOX', {
      limit: options.limit || 50,
      includeMessages: options.includeMessages || false,
    })
    lastSyncTime.value = Date.now()
    return result
  }

  const sendLinkedInMessage = async (linkedinConversationId, content, messageId) => {
    return triggerSync('SEND_LINKEDIN_MESSAGE', { linkedinConversationId, content, messageId })
  }

  const getQueueStatus = () => sendMessage('GET_QUEUE_STATUS')
  const startCampaignQueue = () => sendMessage('START_CAMPAIGN_QUEUE')
  const stopCampaignQueue = (reason = 'User stopped') => sendMessage('STOP_CAMPAIGN_QUEUE', { reason })
  const openConversation = (conversationId) => sendMessage('OPEN_CONVERSATION', { conversationId })

  const checkLinkedInLogin = async () => {
    try {
      const r = await sendMessage('CHECK_LINKEDIN_LOGIN')
      return r?.isLoggedIn || false
    } catch { return false }
  }

  const syncConversationMessages = (linkedinConversationId, backendConversationId) => {
    return sendMessage('SYNC_CONVERSATION_MESSAGES', { conversationId: linkedinConversationId, backendConversationId })
  }

  const checkNewMessages = async () => {
    try {
      const r = await sendMessage('GET_NEW_MESSAGES_STATUS')
      return { hasNewMessages: r?.hasNewMessages || false, count: r?.count || 0, timestamp: r?.timestamp || 0 }
    } catch {
      return { hasNewMessages: false, count: 0, timestamp: 0 }
    }
  }

  const quickSyncInbox = async () => {
    try { return await sendMessage('QUICK_SYNC_INBOX') }
    catch { return { success: false } }
  }

  const getSyncStatus = async () => {
    try { return await sendMessage('GET_SYNC_STATUS') }
    catch { return { success: false, lastSync: 0, isAutoSyncActive: false } }
  }

  return {
    isConnected, isChecking, lastSyncTime,
    triggerSync, syncInbox, sendLinkedInMessage,
    getQueueStatus, startCampaignQueue, stopCampaignQueue,
    openConversation, checkLinkedInLogin, syncConversationMessages,
    checkNewMessages, quickSyncInbox, getSyncStatus,
  }
}
