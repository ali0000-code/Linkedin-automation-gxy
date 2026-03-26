<script setup>
/**
 * Settings - User settings page
 *
 * Two configuration sections:
 *
 * 1. Gmail Integration: connect/disconnect Gmail SMTP using an App Password.
 *    Shows connection status, allows updating the app password, and testing the connection.
 *
 * 2. Extension Auth Key: a secret key used to authenticate the Chrome extension.
 *    Supports show/hide toggle (masked by default), copy to clipboard,
 *    and regenerate (which disconnects any extensions using the old key).
 *    The auth key is fetched directly via api.get('/auth/key') on mount.
 */

import { ref, onMounted } from 'vue'
import Layout from '../components/layout/Layout.vue'
import Button from '../components/common/Button.vue'
import Input from '../components/common/Input.vue'
import {
  useGmailSettings,
  useSaveGmailSettings,
  useVerifyGmail,
  useDisconnectGmail,
} from '../composables/useGmailSettings'
import api from '../services/api'

const { data: settings, isLoading } = useGmailSettings()
const saveSettings = useSaveGmailSettings()
const verifyGmail = useVerifyGmail()
const disconnectGmail = useDisconnectGmail()

const email = ref('')
const appPassword = ref('')
const showPassword = ref(false)
const message = ref(null)

// Auth key management state
const authKey = ref(null)
const authKeyLoading = ref(true)
const authKeyVisible = ref(false)
const authKeyCopied = ref(false)
const authKeyRegenerating = ref(false)

// Fetch auth key on mount
onMounted(async () => {
  try {
    const res = await api.get('/auth/key')
    authKey.value = res.data.auth_key
  } catch {
    authKey.value = null
  } finally {
    authKeyLoading.value = false
  }
})

const handleCopyAuthKey = async () => {
  if (!authKey.value) return
  await navigator.clipboard.writeText(authKey.value)
  authKeyCopied.value = true
  setTimeout(() => { authKeyCopied.value = false }, 2000)
}

const handleRegenerateAuthKey = async () => {
  if (!confirm('Regenerating will disconnect any extensions using the current key. Continue?')) return
  authKeyRegenerating.value = true
  try {
    const res = await api.post('/auth/key/regenerate')
    authKey.value = res.data.auth_key
    authKeyVisible.value = true
  } catch {
    alert('Failed to regenerate auth key.')
  } finally {
    authKeyRegenerating.value = false
  }
}

// Handle form submission
const handleSubmit = async () => {
  message.value = null
  const emailToSave = settings.value?.connected ? settings.value.email : email.value

  try {
    await saveSettings.mutateAsync({ email: emailToSave, app_password: appPassword.value })
    message.value = { type: 'success', text: 'Gmail settings saved. Please verify the connection.' }
    appPassword.value = ''
  } catch (error) {
    message.value = {
      type: 'error',
      text: error.response?.data?.message || 'Failed to save Gmail settings.',
    }
  }
}

// Handle verification
const handleVerify = async () => {
  message.value = null
  try {
    const result = await verifyGmail.mutateAsync()
    message.value = {
      type: result.success ? 'success' : 'error',
      text: result.message,
    }
  } catch (error) {
    message.value = {
      type: 'error',
      text: error.response?.data?.message || 'Verification failed.',
    }
  }
}

// Handle disconnect
const handleDisconnect = async () => {
  if (!confirm('Are you sure you want to disconnect Gmail?')) return
  message.value = null
  try {
    await disconnectGmail.mutateAsync()
    message.value = { type: 'success', text: 'Gmail disconnected successfully.' }
    email.value = ''
    appPassword.value = ''
  } catch (error) {
    message.value = {
      type: 'error',
      text: error.response?.data?.message || 'Failed to disconnect Gmail.',
    }
  }
}
</script>

<template>
  <Layout>
    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center min-h-[60vh]">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-linkedin"></div>
    </div>

    <div v-else class="max-w-4xl mx-auto">
      <!-- Page Header -->
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-theme-primary">Settings</h1>
        <p class="text-theme-secondary mt-1">Manage your account settings and integrations.</p>
      </div>

      <!-- Gmail Settings Card -->
      <div class="bg-theme-raised rounded-lg shadow-sm border border-theme">
        <div class="p-6 border-b border-theme">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 class="text-lg font-semibold text-theme-primary">Gmail Integration</h2>
              <p class="text-sm text-theme-muted">Connect your Gmail account to send emails to prospects.</p>
            </div>
            <div v-if="settings?.connected" class="ml-auto flex items-center space-x-2">
              <template v-if="settings.is_verified">
                <svg class="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="text-sm text-green-600 font-medium">Connected</span>
              </template>
              <template v-else>
                <svg class="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="text-sm text-red-600 font-medium">Not Verified</span>
              </template>
            </div>
          </div>
        </div>

        <div class="p-6">
          <!-- Status Message -->
          <div
            v-if="message"
            :class="[
              'mb-6 p-4 rounded-lg',
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            ]"
          >
            {{ message.text }}
          </div>

          <!-- Instructions -->
          <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 class="font-medium text-blue-900 mb-2">How to set up Gmail App Password:</h3>
            <ol class="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Enable 2-Step Verification on your Google Account</li>
              <li>
                Go to
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="underline font-medium"
                >
                  Google App Passwords
                  <svg class="w-4 h-4 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </li>
              <li>Create a new App Password for "Mail" on "Other (Custom name)"</li>
              <li>Copy the 16-character password and paste it below</li>
            </ol>
          </div>

          <!-- Connection Form (not connected) -->
          <form v-if="!settings?.connected" class="space-y-4" @submit.prevent="handleSubmit">
            <Input
              label="Gmail Address"
              type="email"
              placeholder="your.email@gmail.com"
              :model-value="email"
              required
              @update:model-value="email = $event"
            />
            <div class="relative">
              <Input
                label="App Password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="xxxx xxxx xxxx xxxx"
                :model-value="appPassword"
                required
                @update:model-value="appPassword = $event"
              />
              <button
                type="button"
                class="absolute right-3 top-9 text-theme-muted hover:text-theme-secondary"
                @click="showPassword = !showPassword"
              >
                {{ showPassword ? 'Hide' : 'Show' }}
              </button>
            </div>
            <Button type="submit" :loading="saveSettings.isPending.value">
              Connect Gmail
            </Button>
          </form>

          <!-- Connected state -->
          <div v-else class="space-y-4">
            <!-- Connected Email -->
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">Connected Email</label>
              <div class="flex items-center space-x-2">
                <span class="text-theme-primary bg-theme-overlay px-3 py-2 rounded-lg">{{ settings.email }}</span>
                <span v-if="settings.last_verified_at" class="text-xs text-theme-muted">
                  Last verified: {{ new Date(settings.last_verified_at).toLocaleDateString() }}
                </span>
              </div>
            </div>

            <!-- Update Password Form -->
            <form class="pt-4 border-t border-theme" @submit.prevent="handleSubmit">
              <h4 class="font-medium text-theme-primary mb-3">Update App Password</h4>
              <div class="flex space-x-3">
                <div class="flex-1 relative">
                  <Input
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="New App Password"
                    :model-value="appPassword"
                    @update:model-value="appPassword = $event"
                  />
                  <button
                    type="button"
                    class="absolute right-3 top-3 text-theme-muted hover:text-theme-secondary text-sm"
                    @click="showPassword = !showPassword"
                  >
                    {{ showPassword ? 'Hide' : 'Show' }}
                  </button>
                </div>
                <Button
                  type="submit"
                  :disabled="!appPassword"
                  :loading="saveSettings.isPending.value"
                >
                  Update
                </Button>
              </div>
            </form>

            <!-- Action Buttons -->
            <div class="flex space-x-3 pt-4">
              <Button
                variant="secondary"
                :loading="verifyGmail.isPending.value"
                @click="handleVerify"
              >
                Test Connection
              </Button>
              <Button
                variant="danger"
                :loading="disconnectGmail.isPending.value"
                @click="handleDisconnect"
              >
                Disconnect Gmail
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- Extension Auth Key Card -->
      <div class="bg-theme-raised rounded-lg shadow-sm border border-theme mt-6">
        <div class="p-6 border-b border-theme">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div>
              <h2 class="text-lg font-semibold text-theme-primary">Extension Auth Key</h2>
              <p class="text-sm text-theme-muted">Use this key to connect the Chrome extension to your account.</p>
            </div>
          </div>
        </div>

        <div class="p-6">
          <div class="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 class="font-medium text-blue-900 mb-2">How to connect the extension:</h3>
            <ol class="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Copy the auth key below</li>
              <li>Open the extension popup or options page</li>
              <li>Paste the auth key and click Connect</li>
            </ol>
          </div>

          <div v-if="authKeyLoading" class="flex items-center justify-center py-4">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-linkedin"></div>
          </div>

          <div v-else class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-2">Your Auth Key</label>
              <div class="flex items-center space-x-2">
                <code class="flex-1 bg-theme-overlay px-4 py-3 rounded-lg font-mono text-sm tracking-wider select-all">
                  {{ authKeyVisible ? authKey : '••••••••••••••••••••••' }}
                </code>
                <button
                  class="px-3 py-3 text-sm text-theme-secondary hover:text-theme-primary border border-theme rounded-lg hover:bg-theme-overlay"
                  @click="authKeyVisible = !authKeyVisible"
                >
                  {{ authKeyVisible ? 'Hide' : 'Show' }}
                </button>
                <button
                  class="px-3 py-3 text-sm text-theme-secondary hover:text-theme-primary border border-theme rounded-lg hover:bg-theme-overlay flex items-center space-x-1"
                  @click="handleCopyAuthKey"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>{{ authKeyCopied ? 'Copied!' : 'Copy' }}</span>
                </button>
              </div>
            </div>

            <div class="pt-4 border-t border-theme">
              <button
                class="flex items-center space-x-2 text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                :disabled="authKeyRegenerating"
                @click="handleRegenerateAuthKey"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{{ authKeyRegenerating ? 'Regenerating...' : 'Regenerate Auth Key' }}</span>
              </button>
              <p class="text-xs text-theme-muted mt-1">
                This will disconnect any extensions using the current key.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Layout>
</template>
