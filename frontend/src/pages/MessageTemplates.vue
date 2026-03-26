<script setup>
/**
 * MessageTemplates - Manage LinkedIn message templates for campaigns.
 *
 * Three types: Invitation Messages, Direct Messages, and Email Templates.
 * Left sidebar selects the type, right panel shows template CRUD with
 * bulk selection and delete.
 */

import { ref, computed, watch } from 'vue'
import Layout from '../components/layout/Layout.vue'
import Button from '../components/common/Button.vue'
import Spinner from '../components/common/Spinner.vue'
import TemplateCreateModal from '../components/templates/TemplateCreateModal.vue'
import TemplateEditModal from '../components/templates/TemplateEditModal.vue'
import { useTemplates, useDeleteTemplate, useBulkDeleteTemplates } from '../composables/useTemplates'

const activeType = ref('invitation')
const showCreateModal = ref(false)
const editingTemplate = ref(null)
const selectedTemplates = ref([])

// Fetch templates filtered by active type
const { data, isLoading } = useTemplates(activeType)
const templates = computed(() => data.value?.templates || [])

// Delete mutations
const { mutate: deleteTemplate } = useDeleteTemplate()
const { mutate: bulkDeleteTemplates } = useBulkDeleteTemplates()

// Clear selection when switching template types
const handleTypeChange = (type) => {
  activeType.value = type
  selectedTemplates.value = []
}

const handleDelete = (id) => {
  if (window.confirm('Are you sure you want to delete this template?')) {
    deleteTemplate(id)
  }
}

const handleToggleTemplate = (id) => {
  const idx = selectedTemplates.value.indexOf(id)
  if (idx === -1) {
    selectedTemplates.value.push(id)
  } else {
    selectedTemplates.value.splice(idx, 1)
  }
}

const handleSelectAll = () => {
  if (selectedTemplates.value.length === templates.value.length) {
    selectedTemplates.value = []
  } else {
    selectedTemplates.value = templates.value.map(t => t.id)
  }
}

const handleBulkDelete = () => {
  if (window.confirm(`Are you sure you want to delete ${selectedTemplates.value.length} template(s)?`)) {
    bulkDeleteTemplates(selectedTemplates.value, {
      onSuccess: () => {
        selectedTemplates.value = []
      },
    })
  }
}

const templateTypes = [
  {
    id: 'invitation',
    name: 'Invitation Messages',
    description: 'Invitation Messages are sent as a note when connecting with someone on LinkedIn. These messages have a 300 character limit.',
    emptyTitle: 'No Invitation Templates',
    emptyDescription: 'Create your first invitation message template to use in connection requests',
    buttonText: 'Create Invitation Template',
  },
  {
    id: 'message',
    name: 'Direct Messages',
    description: 'Direct Messages are sent to your existing LinkedIn connections. These can be longer and more detailed than invitation messages.',
    emptyTitle: 'No Message Templates',
    emptyDescription: 'Create your first direct message template to use in your campaigns',
    buttonText: 'Create Message Template',
  },
  {
    id: 'email',
    name: 'Email Templates',
    description: 'Email Templates are used to send emails to prospects. Requires an extracted email address and Gmail SMTP connection.',
    emptyTitle: 'No Email Templates',
    emptyDescription: 'Create your first email template to send emails to prospects',
    buttonText: 'Create Email Template',
  },
]

const activeTemplateType = computed(() => templateTypes.find(type => type.id === activeType.value))
</script>

<template>
  <Layout>
    <div class="flex h-[calc(100vh-4rem)]">
      <!-- Left Sidebar - Template Types -->
      <div class="w-80 bg-theme-raised border-r border-theme flex flex-col">
        <!-- Sidebar Header -->
        <div class="p-6 border-b border-theme">
          <h2 class="text-lg font-semibold text-theme-primary">Template Types</h2>
          <p class="text-sm text-theme-secondary mt-1">Select a template type to manage</p>
        </div>

        <!-- Template Types List -->
        <div class="flex-1 overflow-y-auto p-4">
          <div class="space-y-2">
            <button
              v-for="type in templateTypes"
              :key="type.id"
              :class="[
                'w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors',
                activeType === type.id
                  ? 'bg-linkedin text-white'
                  : 'text-theme-secondary hover:bg-theme-overlay'
              ]"
              @click="handleTypeChange(type.id)"
            >
              <div :class="activeType === type.id ? 'text-white' : 'text-theme-muted'">
                <!-- Invitation icon -->
                <svg v-if="type.id === 'invitation'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                <!-- Message icon -->
                <svg v-else-if="type.id === 'message'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <!-- Email icon -->
                <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span class="font-medium text-left">{{ type.name }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Right Content - Templates -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- Header Section - Fixed -->
        <div class="flex-shrink-0 bg-theme-raised border-b border-theme p-6">
          <div class="flex justify-between items-start">
            <div>
              <h1 class="text-2xl font-bold text-theme-primary">{{ activeTemplateType.name }}</h1>
              <p class="text-sm text-theme-secondary mt-1">
                Create and manage your {{ activeTemplateType.name.toLowerCase() }}
              </p>
            </div>
            <Button variant="primary" @click="showCreateModal = true">
              + New Template
            </Button>
          </div>

          <!-- Info Banner -->
          <div class="mt-4">
            <div class="bg-blue-50 border-l-4 border-linkedin p-4">
              <div class="flex">
                <div class="flex-shrink-0">
                  <svg class="h-5 w-5 text-linkedin" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm text-blue-700">
                    <strong>{{ activeTemplateType.name }}</strong>: {{ activeTemplateType.description }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Templates List - Scrollable -->
        <div class="flex-1 overflow-y-auto bg-theme-overlay p-6">
          <div v-if="isLoading" class="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
          <div v-else-if="templates.length === 0" class="bg-theme-raised rounded-lg shadow">
            <!-- Empty State -->
            <div class="text-center py-12 px-6">
              <div class="mb-4 flex justify-center">
                <div class="text-theme-muted">
                  <svg v-if="activeType === 'invitation'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  <svg v-else-if="activeType === 'message'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <h3 class="text-lg font-medium text-theme-primary mb-2">{{ activeTemplateType.emptyTitle }}</h3>
              <p class="text-theme-muted mb-6">{{ activeTemplateType.emptyDescription }}</p>
              <Button variant="primary" @click="showCreateModal = true">
                {{ activeTemplateType.buttonText }}
              </Button>
            </div>
          </div>
          <template v-else>
            <!-- Bulk Actions Bar -->
            <div v-if="templates.length > 0" class="bg-theme-raised rounded-lg shadow p-4 mb-4">
              <div class="flex items-center justify-between">
                <label class="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    :checked="selectedTemplates.length === templates.length && templates.length > 0"
                    class="w-4 h-4 text-linkedin border-theme rounded focus:ring-linkedin"
                    @change="handleSelectAll"
                  />
                  <span class="ml-3 text-sm font-medium text-theme-secondary">
                    Select All ({{ templates.length }})
                  </span>
                </label>
                <Button v-if="selectedTemplates.length > 0" variant="danger" @click="handleBulkDelete">
                  Delete Selected ({{ selectedTemplates.length }})
                </Button>
              </div>
            </div>

            <!-- Templates List -->
            <div class="space-y-4">
              <div
                v-for="template in templates"
                :key="template.id"
                class="bg-theme-raised rounded-lg shadow p-6 hover:shadow-md transition-shadow border border-theme-subtle"
              >
                <div class="flex items-start space-x-4">
                  <!-- Checkbox -->
                  <input
                    type="checkbox"
                    :checked="selectedTemplates.includes(template.id)"
                    class="mt-1 w-4 h-4 text-linkedin border-theme rounded focus:ring-linkedin"
                    @change="handleToggleTemplate(template.id)"
                  />

                  <!-- Template Content -->
                  <div class="flex-1">
                    <h3 class="text-lg font-semibold text-theme-primary mb-2">{{ template.name }}</h3>
                    <div v-if="template.type === 'email' && template.subject" class="mb-2 px-3 py-1 bg-purple-50 rounded-lg inline-block">
                      <span class="text-sm text-purple-700">
                        <strong>Subject:</strong> {{ template.subject }}
                      </span>
                    </div>
                    <p class="text-theme-secondary whitespace-pre-wrap break-words">{{ template.content }}</p>
                    <div class="mt-3 flex items-center space-x-4 text-sm text-theme-muted">
                      <span>{{ template.content.length }} characters</span>
                      <span>&bull;</span>
                      <span>Created {{ new Date(template.created_at).toLocaleDateString() }}</span>
                    </div>
                  </div>

                  <!-- Action Buttons -->
                  <div class="flex items-center space-x-2">
                    <button
                      class="text-linkedin hover:text-linkedin-dark p-2 rounded transition-colors"
                      title="Edit template"
                      @click="editingTemplate = template"
                    >
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      class="text-red-600 hover:text-red-700 p-2 rounded transition-colors"
                      title="Delete template"
                      @click="handleDelete(template.id)"
                    >
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Create Template Modal -->
    <TemplateCreateModal
      :is-open="showCreateModal"
      :type="activeType"
      @close="showCreateModal = false"
    />

    <!-- Edit Template Modal -->
    <TemplateEditModal
      :is-open="!!editingTemplate"
      :template="editingTemplate"
      @close="editingTemplate = null"
    />
  </Layout>
</template>
