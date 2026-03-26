<script setup>
/**
 * Mail - Email management page
 *
 * Displays sent emails with filtering and search.
 * Shows extraction results modal when email campaigns complete.
 * Supports CRUD, bulk operations, and template application.
 */

import { ref, computed, watch, onMounted } from 'vue'
import Layout from '../components/layout/Layout.vue'
import Button from '../components/common/Button.vue'
import Spinner from '../components/common/Spinner.vue'
import {
  useMails,
  useMailStats,
  usePendingExtractions,
  useQueueFromCampaign,
  useDiscardExtraction,
  useSendEmail,
  useSendBulk,
  useDeleteEmail,
  useDeleteBulk,
  useUpdateEmail,
  useCreateEmail,
} from '../composables/useMail'
import { useTemplates } from '../composables/useTemplates'
import { prospectService } from '../services/prospect.service'

// State
const status = ref('')
const search = ref('')
const searchInput = ref('')
const page = ref(1)
const selectedEmail = ref(null)
const showExtractionModal = ref(false)
const selectedCampaign = ref(null)
const selectedIds = ref([])
const editingEmail = ref(null)
const showCreateModal = ref(false)
const prospectsWithEmail = ref([])

// Edit modal state
const editSubject = ref('')
const editBody = ref('')
const editTemplateId = ref('')

// Create modal state
const createToEmail = ref('')
const createSubject = ref('')
const createBody = ref('')
const createTemplateId = ref('')
const createSelectedProspect = ref(null)

// Extraction modal state
const extractionTemplateId = ref('')
const showChangeTemplate = ref(false)

// Fetch prospects when create modal opens
watch(showCreateModal, async (val) => {
  if (val) {
    try {
      const prospects = await prospectService.getProspectsWithEmail()
      prospectsWithEmail.value = prospects
    } catch (err) {
      console.error('Error fetching prospects with email:', err)
    }
  }
})

const mailParams = computed(() => ({
  status: status.value || undefined,
  search: search.value || undefined,
  page: page.value,
  per_page: 20,
}))

const { data: mailsData, isLoading, error } = useMails(mailParams)
const { data: statsData, isLoading: statsLoading } = useMailStats()
const { data: pendingExtractions } = usePendingExtractions()
const { data: templatesData } = useTemplates('email')
const queueMutation = useQueueFromCampaign()
const discardMutation = useDiscardExtraction()
const sendEmailMutation = useSendEmail()
const sendBulkMutation = useSendBulk()
const deleteEmailMutation = useDeleteEmail()
const deleteBulkMutation = useDeleteBulk()
const updateEmailMutation = useUpdateEmail()
const createEmailMutation = useCreateEmail()

const stats = computed(() => statsData.value || {})
const emailTemplates = computed(() => {
  const tpls = templatesData.value?.templates || []
  return Array.isArray(tpls) ? tpls.filter(t => t.type === 'email') : []
})

// Show modal when there are pending extractions
watch(pendingExtractions, (val) => {
  if (val?.campaigns?.length > 0 && !showExtractionModal.value && !selectedCampaign.value) {
    selectedCampaign.value = val.campaigns[0]
    extractionTemplateId.value = val.campaigns[0]?.template?.id || ''
    showExtractionModal.value = true
  }
})

const handleSearch = () => {
  search.value = searchInput.value
  page.value = 1
}

const handleStatusFilter = (newStatus) => {
  status.value = newStatus
  page.value = 1
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString()
}

// Extraction modal handlers
const handleSendNow = async (templateId) => {
  if (!selectedCampaign.value) return
  if (!templateId) {
    console.error('Template is required to send emails')
    return
  }
  try {
    await queueMutation.mutateAsync({
      campaignId: selectedCampaign.value.id,
      templateId: parseInt(templateId),
      sendNow: true,
    })
    showExtractionModal.value = false
    selectedCampaign.value = null
  } catch (error) {
    console.error('Failed to send emails:', error)
  }
}

const handleSendLater = async (templateId) => {
  if (!selectedCampaign.value) return
  try {
    await queueMutation.mutateAsync({
      campaignId: selectedCampaign.value.id,
      templateId: templateId ? parseInt(templateId) : null,
      sendNow: false,
    })
    showExtractionModal.value = false
    selectedCampaign.value = null
  } catch (error) {
    console.error('Failed to save emails:', error)
  }
}

const handleDiscard = async () => {
  if (!selectedCampaign.value) return
  try {
    await discardMutation.mutateAsync(selectedCampaign.value.id)
    showExtractionModal.value = false
    selectedCampaign.value = null
  } catch (error) {
    console.error('Failed to discard extraction:', error)
  }
}

const handleCloseExtractionModal = () => {
  showExtractionModal.value = false
}

// Edit email handlers
const handleEditEmail = (email, e) => {
  e.stopPropagation()
  editingEmail.value = email
  editSubject.value = email?.subject || ''
  editBody.value = email?.body || ''
  editTemplateId.value = ''
}

const handleApplyEditTemplate = () => {
  if (!editTemplateId.value) return
  const template = emailTemplates.value.find(t => t.id === parseInt(editTemplateId.value))
  if (template) {
    editSubject.value = template.subject || ''
    let content = template.content || ''
    if (editingEmail.value?.prospect) {
      const p = editingEmail.value.prospect
      const firstName = p.full_name?.split(' ')[0] || ''
      const lastName = p.full_name?.split(' ').slice(1).join(' ') || ''
      content = content
        .replace(/{firstName}/g, firstName)
        .replace(/{lastName}/g, lastName)
        .replace(/{fullName}/g, p.full_name || '')
        .replace(/{email}/g, p.email || editingEmail.value.to_email || '')
        .replace(/{company}/g, p.company || '')
        .replace(/{headline}/g, p.headline || '')
        .replace(/{location}/g, p.location || '')
    }
    editBody.value = content
  }
}

const handleSaveEdit = async () => {
  if (!editingEmail.value) return
  try {
    await updateEmailMutation.mutateAsync({
      emailId: editingEmail.value.id,
      data: { subject: editSubject.value, body: editBody.value },
    })
    editingEmail.value = null
  } catch (error) {
    console.error('Failed to update email:', error)
  }
}

// Create email handlers
const handleProspectSelect = (e) => {
  const prospectId = e.target.value
  if (prospectId) {
    const prospect = prospectsWithEmail.value.find(p => p.id === parseInt(prospectId))
    if (prospect) {
      createSelectedProspect.value = prospect
      createToEmail.value = prospect.email
    }
  } else {
    createSelectedProspect.value = null
    createToEmail.value = ''
  }
}

const handleApplyCreateTemplate = () => {
  if (!createTemplateId.value) return
  const template = emailTemplates.value.find(t => t.id === parseInt(createTemplateId.value))
  if (template) {
    createSubject.value = template.subject || ''
    let content = template.content || ''
    if (createSelectedProspect.value) {
      const p = createSelectedProspect.value
      const firstName = p.full_name?.split(' ')[0] || ''
      const lastName = p.full_name?.split(' ').slice(1).join(' ') || ''
      content = content
        .replace(/{firstName}/g, firstName)
        .replace(/{lastName}/g, lastName)
        .replace(/{fullName}/g, p.full_name || '')
        .replace(/{email}/g, p.email || '')
        .replace(/{company}/g, p.company || '')
        .replace(/{headline}/g, p.headline || '')
        .replace(/{location}/g, p.location || '')
    }
    createBody.value = content
  }
}

const handleCreateEmail = async () => {
  try {
    await createEmailMutation.mutateAsync({
      to_email: createToEmail.value,
      subject: createSubject.value,
      body: createBody.value,
    })
    showCreateModal.value = false
    createToEmail.value = ''
    createSubject.value = ''
    createBody.value = ''
    createTemplateId.value = ''
    createSelectedProspect.value = null
  } catch (error) {
    console.error('Failed to create email:', error)
  }
}

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

// Single actions
const handleSendSingle = async (emailId, e) => {
  e.stopPropagation()
  try {
    await sendEmailMutation.mutateAsync(emailId)
  } catch (error) {
    console.error('Failed to send email:', error)
  }
}

const handleDeleteSingle = async (emailId, e) => {
  e.stopPropagation()
  if (!window.confirm('Are you sure you want to delete this email?')) return
  try {
    await deleteEmailMutation.mutateAsync(emailId)
  } catch (error) {
    console.error('Failed to delete email:', error)
  }
}

// Bulk actions
const handleBulkSend = async () => {
  if (selectedIds.value.length === 0) return
  try {
    await sendBulkMutation.mutateAsync(selectedIds.value)
    selectedIds.value = []
  } catch (error) {
    console.error('Failed to send emails:', error)
  }
}

const handleBulkDelete = async () => {
  if (selectedIds.value.length === 0) return
  if (!window.confirm(`Are you sure you want to delete ${selectedIds.value.length} email(s)?`)) return
  try {
    await deleteBulkMutation.mutateAsync(selectedIds.value)
    selectedIds.value = []
  } catch (error) {
    console.error('Failed to delete emails:', error)
  }
}

const handleSelectAll = (e) => {
  if (e.target.checked) {
    selectedIds.value = (mailsData.value?.data || []).map(email => email.id)
  } else {
    selectedIds.value = []
  }
}

const handleSelectRow = (emailId, e) => {
  e.stopPropagation()
  const idx = selectedIds.value.indexOf(emailId)
  if (idx === -1) {
    selectedIds.value.push(emailId)
  } else {
    selectedIds.value.splice(idx, 1)
  }
}

const isAllSelected = computed(() => {
  const data = mailsData.value?.data || []
  return data.length > 0 && data.every(email => selectedIds.value.includes(email.id))
})

const sendableSelectedIds = computed(() => {
  return selectedIds.value.filter(id => {
    const email = (mailsData.value?.data || []).find(e => e.id === id)
    return email && email.status !== 'sent'
  })
})

const extractionCurrentTemplate = computed(() => {
  if (!selectedCampaign.value) return null
  if (extractionTemplateId.value) {
    return emailTemplates.value.find(t => t.id === parseInt(extractionTemplateId.value)) || selectedCampaign.value.template
  }
  return selectedCampaign.value.template
})

const getStatusConfig = (st) => {
  const config = {
    sent: { bg: 'bg-green-100', text: 'text-green-800' },
    failed: { bg: 'bg-red-100', text: 'text-red-800' },
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    draft: { bg: 'bg-theme-overlay', text: 'text-theme-primary' },
  }
  return config[st] || config.pending
}
</script>

<template>
  <Layout>
    <div class="space-y-6">
      <!-- Page Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-theme-primary">Mail</h1>
          <p class="text-theme-secondary mt-1">View and track your sent emails.</p>
        </div>
        <div class="flex items-center space-x-3">
          <Button class="flex items-center space-x-2" @click="showCreateModal = true">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>New Email</span>
          </Button>
          <Button
            v-if="pendingExtractions?.campaigns?.length > 0"
            variant="secondary"
            class="flex items-center space-x-2"
            @click="selectedCampaign = pendingExtractions.campaigns[0]; extractionTemplateId = pendingExtractions.campaigns[0]?.template?.id || ''; showExtractionModal = true"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span>{{ pendingExtractions.campaigns.length }} Pending</span>
          </Button>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div v-if="statsLoading" class="col-span-4 flex justify-center py-8">
          <Spinner size="lg" />
        </div>
        <template v-else>
          <div class="bg-theme-raised rounded-lg shadow-sm border border-theme p-4">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p class="text-2xl font-bold text-theme-primary">{{ stats.sent || 0 }}</p>
                <p class="text-sm text-theme-muted">Total Sent</p>
              </div>
            </div>
          </div>
          <div class="bg-theme-raised rounded-lg shadow-sm border border-theme p-4">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center bg-green-100 text-green-600">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p class="text-2xl font-bold text-theme-primary">{{ stats.today_sent || 0 }}</p>
                <p class="text-sm text-theme-muted">Sent Today</p>
              </div>
            </div>
          </div>
          <div class="bg-theme-raised rounded-lg shadow-sm border border-theme p-4">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center bg-red-100 text-red-600">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p class="text-2xl font-bold text-theme-primary">{{ stats.failed || 0 }}</p>
                <p class="text-sm text-theme-muted">Failed</p>
              </div>
            </div>
          </div>
          <div class="bg-theme-raised rounded-lg shadow-sm border border-theme p-4">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center bg-yellow-100 text-yellow-600">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p class="text-2xl font-bold text-theme-primary">{{ stats.pending || 0 }}</p>
                <p class="text-sm text-theme-muted">Pending</p>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Filters -->
      <div class="bg-theme-raised rounded-lg shadow-sm border border-theme p-4">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div class="flex space-x-2">
            <Button :variant="status === '' ? 'primary' : 'secondary'" size="sm" @click="handleStatusFilter('')">All</Button>
            <Button :variant="status === 'sent' ? 'primary' : 'secondary'" size="sm" @click="handleStatusFilter('sent')">Sent</Button>
            <Button :variant="status === 'failed' ? 'primary' : 'secondary'" size="sm" @click="handleStatusFilter('failed')">Failed</Button>
            <Button :variant="status === 'pending' ? 'primary' : 'secondary'" size="sm" @click="handleStatusFilter('pending')">Pending</Button>
          </div>
          <form class="flex space-x-2" @submit.prevent="handleSearch">
            <div class="relative">
              <input
                v-model="searchInput"
                type="text"
                placeholder="Search by email or subject..."
                class="pl-10 pr-4 py-2 border border-theme rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent w-64"
              />
              <div class="absolute left-3 top-2.5">
                <svg class="w-5 h-5 text-theme-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            <Button type="submit" size="sm">Search</Button>
            <Button
              v-if="search"
              type="button"
              variant="secondary"
              size="sm"
              @click="search = ''; searchInput = ''; page = 1"
            >
              Clear
            </Button>
          </form>
        </div>
      </div>

      <!-- Bulk Action Bar -->
      <div v-if="selectedIds.length > 0" class="bg-linkedin rounded-lg p-4 flex items-center justify-between text-white">
        <span class="font-medium">{{ selectedIds.length }} email(s) selected</span>
        <div class="flex space-x-3">
          <Button
            v-if="sendableSelectedIds.length > 0"
            variant="secondary"
            size="sm"
            class="bg-theme-raised text-linkedin hover:bg-theme-overlay"
            :disabled="sendBulkMutation.isPending.value"
            @click="handleBulkSend"
          >
            <Spinner v-if="sendBulkMutation.isPending.value" size="sm" />
            <template v-else>
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span class="ml-1">Send ({{ sendableSelectedIds.length }})</span>
            </template>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            class="bg-red-500 text-white hover:bg-red-600 border-red-500"
            :disabled="deleteBulkMutation.isPending.value"
            @click="handleBulkDelete"
          >
            <Spinner v-if="deleteBulkMutation.isPending.value" size="sm" />
            <template v-else>
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span class="ml-1">Delete ({{ selectedIds.length }})</span>
            </template>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            class="bg-transparent text-white hover:bg-theme-raised/10 border-white"
            @click="selectedIds = []"
          >
            Cancel
          </Button>
        </div>
      </div>

      <!-- Email List -->
      <div class="bg-theme-raised rounded-lg shadow-sm border border-theme overflow-hidden">
        <div v-if="isLoading" class="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
        <div v-else-if="error" class="text-center py-12 text-red-600">
          Failed to load emails. Please try again.
        </div>
        <div v-else-if="!mailsData?.data?.length" class="text-center py-12 text-theme-muted">
          <div class="w-12 h-12 mx-auto text-theme-muted mb-3">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p>No emails found.</p>
        </div>
        <template v-else>
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-theme-overlay">
              <tr>
                <th class="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    :checked="isAllSelected"
                    class="w-4 h-4 text-linkedin border-theme rounded focus:ring-linkedin"
                    @change="handleSelectAll"
                  />
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-theme-muted uppercase tracking-wider">Recipient</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-theme-muted uppercase tracking-wider">Subject</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-theme-muted uppercase tracking-wider">Status</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-theme-muted uppercase tracking-wider">Campaign</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-theme-muted uppercase tracking-wider">Date</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-theme-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-theme-raised divide-y divide-gray-200">
              <tr
                v-for="email in mailsData.data"
                :key="email.id"
                :class="['hover:bg-theme-overlay cursor-pointer', selectedIds.includes(email.id) ? 'bg-blue-50' : '']"
                @click="selectedEmail = email"
              >
                <td class="px-4 py-4 w-10" @click.stop>
                  <input
                    type="checkbox"
                    :checked="selectedIds.includes(email.id)"
                    class="w-4 h-4 text-linkedin border-theme rounded focus:ring-linkedin"
                    @change="handleSelectRow(email.id, $event)"
                  />
                </td>
                <td class="px-4 py-4 whitespace-nowrap">
                  <div>
                    <p class="text-sm font-medium text-theme-primary">{{ email.prospect?.full_name || 'Unknown' }}</p>
                    <p class="text-sm text-theme-muted">{{ email.to_email }}</p>
                  </div>
                </td>
                <td class="px-4 py-4">
                  <p class="text-sm text-theme-primary truncate max-w-xs">{{ email.subject || '(No subject)' }}</p>
                </td>
                <td class="px-4 py-4 whitespace-nowrap">
                  <span :class="['inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium', getStatusConfig(email.status).bg, getStatusConfig(email.status).text]">
                    <span class="capitalize">{{ email.status }}</span>
                  </span>
                </td>
                <td class="px-4 py-4 whitespace-nowrap">
                  <p class="text-sm text-theme-muted">{{ email.campaign?.name || '-' }}</p>
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-theme-muted">
                  {{ formatDate(email.sent_at || email.created_at) }}
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-right">
                  <div class="flex items-center justify-end space-x-2">
                    <button
                      v-if="email.status !== 'sent'"
                      class="p-1.5 text-theme-muted hover:bg-gray-200 hover:text-theme-secondary rounded transition-colors"
                      title="Edit email"
                      @click="handleEditEmail(email, $event)"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      v-if="email.status !== 'sent'"
                      class="p-1.5 text-linkedin hover:bg-linkedin hover:text-white rounded transition-colors disabled:opacity-50"
                      title="Send email"
                      :disabled="sendEmailMutation.isPending.value"
                      @click="handleSendSingle(email.id, $event)"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                    <button
                      class="p-1.5 text-red-500 hover:bg-red-500 hover:text-white rounded transition-colors disabled:opacity-50"
                      title="Delete email"
                      :disabled="deleteEmailMutation.isPending.value"
                      @click="handleDeleteSingle(email.id, $event)"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Pagination -->
          <div v-if="mailsData?.meta" class="px-6 py-4 border-t border-theme flex items-center justify-between">
            <p class="text-sm text-theme-muted">
              Showing {{ ((mailsData.meta.current_page - 1) * mailsData.meta.per_page) + 1 }} to
              {{ Math.min(mailsData.meta.current_page * mailsData.meta.per_page, mailsData.meta.total) }} of
              {{ mailsData.meta.total }} emails
            </p>
            <div class="flex space-x-2">
              <Button variant="secondary" size="sm" :disabled="page === 1" @click="page--">Previous</Button>
              <Button variant="secondary" size="sm" :disabled="page === mailsData.meta.last_page" @click="page++">Next</Button>
            </div>
          </div>
        </template>
      </div>

      <!-- Email Detail Modal -->
      <div v-if="selectedEmail" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-theme-raised rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
          <div class="px-6 py-4 border-b border-theme flex items-center justify-between">
            <h3 class="text-lg font-semibold text-theme-primary">Email Details</h3>
            <button class="text-theme-muted hover:text-theme-secondary" @click="selectedEmail = null">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="p-6 overflow-y-auto max-h-[60vh]">
            <div class="space-y-4">
              <div>
                <label class="text-xs text-theme-muted uppercase">To</label>
                <p class="text-theme-primary">{{ selectedEmail.prospect?.full_name }} &lt;{{ selectedEmail.to_email }}&gt;</p>
              </div>
              <div>
                <label class="text-xs text-theme-muted uppercase">Subject</label>
                <p class="text-theme-primary font-medium">{{ selectedEmail.subject }}</p>
              </div>
              <div>
                <label class="text-xs text-theme-muted uppercase">Status</label>
                <div class="mt-1">
                  <span :class="['inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium', getStatusConfig(selectedEmail.status).bg, getStatusConfig(selectedEmail.status).text]">
                    <span class="capitalize">{{ selectedEmail.status }}</span>
                  </span>
                </div>
              </div>
              <div v-if="selectedEmail.error_message">
                <label class="text-xs text-theme-muted uppercase">Error</label>
                <p class="text-red-600 text-sm">{{ selectedEmail.error_message }}</p>
              </div>
              <div>
                <label class="text-xs text-theme-muted uppercase">Message</label>
                <div class="mt-2 p-4 bg-theme-overlay rounded-lg border border-theme">
                  <p class="text-theme-primary whitespace-pre-wrap">{{ selectedEmail.body }}</p>
                </div>
              </div>
              <div class="flex space-x-6 text-sm text-theme-muted">
                <div>
                  <label class="text-xs text-theme-muted uppercase">Sent At</label>
                  <p>{{ formatDate(selectedEmail.sent_at || selectedEmail.created_at) }}</p>
                </div>
                <div v-if="selectedEmail.campaign">
                  <label class="text-xs text-theme-muted uppercase">Campaign</label>
                  <p>{{ selectedEmail.campaign.name }}</p>
                </div>
              </div>
            </div>
          </div>
          <div class="px-6 py-4 border-t border-theme flex justify-end">
            <Button variant="secondary" @click="selectedEmail = null">Close</Button>
          </div>
        </div>
      </div>

      <!-- Extraction Results Modal -->
      <div v-if="showExtractionModal && selectedCampaign" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-theme-raised rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-hidden">
          <div class="px-6 py-4 border-b border-theme bg-linkedin text-white">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <h3 class="text-lg font-semibold">Email Extraction Complete</h3>
              </div>
              <button class="text-white hover:text-gray-200" @click="handleCloseExtractionModal">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p class="text-sm text-blue-100 mt-1">Campaign: {{ selectedCampaign.name }}</p>
          </div>
          <div class="p-6 overflow-y-auto max-h-[50vh]">
            <div class="grid grid-cols-2 gap-4 mb-6">
              <div class="bg-green-50 rounded-lg p-4 text-center">
                <p class="text-3xl font-bold text-green-600">{{ selectedCampaign.with_email_count }}</p>
                <p class="text-sm text-green-700">Emails Found</p>
              </div>
              <div class="bg-theme-overlay rounded-lg p-4 text-center">
                <p class="text-3xl font-bold text-theme-secondary">{{ selectedCampaign.without_email_count }}</p>
                <p class="text-sm text-theme-secondary">Not Found</p>
              </div>
            </div>
            <div v-if="selectedCampaign.with_email_count > 0" class="mb-6">
              <div class="flex items-center justify-between mb-2">
                <label class="block text-sm font-medium text-theme-secondary">Email Template</label>
                <button type="button" class="text-sm text-linkedin hover:underline" @click="showChangeTemplate = !showChangeTemplate">
                  {{ showChangeTemplate ? 'Cancel' : 'Change Template' }}
                </button>
              </div>
              <select
                v-if="showChangeTemplate"
                v-model="extractionTemplateId"
                class="w-full border border-theme rounded-lg px-3 py-2 focus:ring-2 focus:ring-linkedin focus:border-transparent"
              >
                <option v-for="template in emailTemplates" :key="template.id" :value="template.id">{{ template.name }}</option>
              </select>
              <div v-else-if="extractionCurrentTemplate" class="bg-theme-overlay rounded-lg p-3 border border-theme">
                <p class="font-medium text-theme-primary">{{ extractionCurrentTemplate.name }}</p>
                <p v-if="extractionCurrentTemplate.subject" class="text-sm text-theme-secondary mt-1">Subject: {{ extractionCurrentTemplate.subject }}</p>
              </div>
              <div v-else class="text-sm text-yellow-700 bg-yellow-50 p-3 rounded-lg">
                No template selected. You can save as draft and add a template later, or select one now.
                <button type="button" class="ml-2 text-linkedin underline" @click="showChangeTemplate = true">Select Template</button>
              </div>
            </div>
            <div v-if="selectedCampaign.prospects_with_email?.length > 0" class="mb-4">
              <h4 class="text-sm font-medium text-theme-secondary mb-2 flex items-center">
                <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Prospects with Email ({{ selectedCampaign.with_email_count }})
              </h4>
              <div class="bg-theme-overlay rounded-lg max-h-32 overflow-y-auto">
                <ul class="divide-y divide-gray-200">
                  <li v-for="prospect in selectedCampaign.prospects_with_email" :key="prospect.id" class="px-3 py-2 flex justify-between items-center">
                    <span class="text-sm text-theme-primary">{{ prospect.full_name }}</span>
                    <span class="text-sm text-theme-muted">{{ prospect.email }}</span>
                  </li>
                </ul>
              </div>
            </div>
            <div v-if="selectedCampaign.prospects_without_email?.length > 0">
              <h4 class="text-sm font-medium text-theme-secondary mb-2 flex items-center">
                <span class="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                Prospects without Email ({{ selectedCampaign.without_email_count }})
              </h4>
              <div class="bg-theme-overlay rounded-lg max-h-32 overflow-y-auto">
                <ul class="divide-y divide-gray-200">
                  <li v-for="prospect in selectedCampaign.prospects_without_email" :key="prospect.id" class="px-3 py-2">
                    <span class="text-sm text-theme-secondary">{{ prospect.full_name }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div class="px-6 py-4 border-t border-theme bg-theme-overlay">
            <div v-if="selectedCampaign.with_email_count > 0" class="flex flex-col sm:flex-row gap-3">
              <Button variant="secondary" class="flex-1" :disabled="queueMutation.isPending.value || discardMutation.isPending.value" @click="handleDiscard">Don't Save</Button>
              <Button variant="secondary" class="flex-1" :disabled="queueMutation.isPending.value || discardMutation.isPending.value" @click="handleSendLater(extractionTemplateId || null)">
                <Spinner v-if="queueMutation.isPending.value" size="sm" />
                <span v-else>Save as Draft</span>
              </Button>
              <Button class="flex-1" :disabled="queueMutation.isPending.value || discardMutation.isPending.value || (!extractionTemplateId && !selectedCampaign.template)" @click="handleSendNow(extractionTemplateId || selectedCampaign.template?.id)">
                <Spinner v-if="queueMutation.isPending.value" size="sm" />
                <span v-else>Send Now</span>
              </Button>
            </div>
            <div v-else class="flex justify-end">
              <Button variant="secondary" @click="handleCloseExtractionModal">Close</Button>
            </div>
            <p v-if="!extractionTemplateId && !selectedCampaign.template && selectedCampaign.with_email_count > 0" class="text-xs text-theme-muted mt-2 text-center">
              Template is required to send emails. Save as draft to add one later.
            </p>
          </div>
        </div>
      </div>

      <!-- Edit Email Modal -->
      <div v-if="editingEmail" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-theme-raised rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-hidden">
          <div class="px-6 py-4 border-b border-theme">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-theme-primary">Edit Email</h3>
              <button class="text-theme-muted hover:text-theme-secondary" @click="editingEmail = null">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p class="text-sm text-theme-muted mt-1">To: {{ editingEmail.prospect?.full_name || editingEmail.to_email }}</p>
          </div>
          <div class="p-6 overflow-y-auto max-h-[55vh] space-y-4">
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">Apply Template</label>
              <div class="flex space-x-2">
                <select v-model="editTemplateId" class="flex-1 border border-theme rounded-lg px-3 py-2 focus:ring-2 focus:ring-linkedin focus:border-transparent">
                  <option value="">Select a template...</option>
                  <option v-for="t in emailTemplates" :key="t.id" :value="t.id">{{ t.name }}</option>
                </select>
                <Button variant="secondary" :disabled="!editTemplateId" @click="handleApplyEditTemplate">Apply</Button>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">Subject <span class="text-red-500">*</span></label>
              <input v-model="editSubject" type="text" class="w-full border border-theme rounded-lg px-3 py-2 focus:ring-2 focus:ring-linkedin focus:border-transparent" placeholder="Enter email subject..." />
            </div>
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">Message <span class="text-red-500">*</span></label>
              <textarea v-model="editBody" rows="10" class="w-full border border-theme rounded-lg px-3 py-2 focus:ring-2 focus:ring-linkedin focus:border-transparent resize-none" placeholder="Enter your email message..." />
            </div>
            <div class="text-xs text-theme-muted bg-theme-overlay p-3 rounded-lg">
              <strong>Tip:</strong> Use placeholders like {firstName}, {lastName}, {fullName}, {company}, {headline} in templates for personalization.
            </div>
          </div>
          <div class="px-6 py-4 border-t border-theme bg-theme-overlay flex justify-end space-x-3">
            <Button variant="secondary" @click="editingEmail = null">Cancel</Button>
            <Button :disabled="updateEmailMutation.isPending.value || !editSubject.trim() || !editBody.trim()" @click="handleSaveEdit">
              <Spinner v-if="updateEmailMutation.isPending.value" size="sm" />
              <span v-else>Save Changes</span>
            </Button>
          </div>
        </div>
      </div>

      <!-- Create Email Modal -->
      <div v-if="showCreateModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-theme-raised rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-hidden">
          <div class="px-6 py-4 border-b border-theme bg-linkedin text-white">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                <h3 class="text-lg font-semibold">New Email</h3>
              </div>
              <button class="text-white hover:text-gray-200" @click="showCreateModal = false">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div class="p-6 overflow-y-auto max-h-[55vh] space-y-4">
            <div v-if="prospectsWithEmail.length > 0">
              <label class="block text-sm font-medium text-theme-secondary mb-1">Select Prospect</label>
              <select class="w-full border border-theme rounded-lg px-3 py-2 focus:ring-2 focus:ring-linkedin focus:border-transparent" @change="handleProspectSelect">
                <option value="">-- Select a prospect or enter email manually --</option>
                <option v-for="prospect in prospectsWithEmail" :key="prospect.id" :value="prospect.id">
                  {{ prospect.full_name }} ({{ prospect.email }})
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">Recipient Email <span class="text-red-500">*</span></label>
              <input v-model="createToEmail" type="email" class="w-full border border-theme rounded-lg px-3 py-2 focus:ring-2 focus:ring-linkedin focus:border-transparent" placeholder="recipient@example.com" />
            </div>
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">Apply Template (Optional)</label>
              <div class="flex space-x-2">
                <select v-model="createTemplateId" class="flex-1 border border-theme rounded-lg px-3 py-2 focus:ring-2 focus:ring-linkedin focus:border-transparent">
                  <option value="">Select a template...</option>
                  <option v-for="t in emailTemplates" :key="t.id" :value="t.id">{{ t.name }}</option>
                </select>
                <Button variant="secondary" :disabled="!createTemplateId" @click="handleApplyCreateTemplate">Apply</Button>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">Subject <span class="text-red-500">*</span></label>
              <input v-model="createSubject" type="text" class="w-full border border-theme rounded-lg px-3 py-2 focus:ring-2 focus:ring-linkedin focus:border-transparent" placeholder="Enter email subject..." />
            </div>
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">Message <span class="text-red-500">*</span></label>
              <textarea v-model="createBody" rows="10" class="w-full border border-theme rounded-lg px-3 py-2 focus:ring-2 focus:ring-linkedin focus:border-transparent resize-none" placeholder="Enter your email message..." />
            </div>
          </div>
          <div class="px-6 py-4 border-t border-theme bg-theme-overlay flex justify-end space-x-3">
            <Button variant="secondary" @click="showCreateModal = false">Cancel</Button>
            <Button :disabled="createEmailMutation.isPending.value || !isValidEmail(createToEmail) || !createSubject.trim() || !createBody.trim()" @click="handleCreateEmail">
              <Spinner v-if="createEmailMutation.isPending.value" size="sm" />
              <span v-else>Create Email</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  </Layout>
</template>
