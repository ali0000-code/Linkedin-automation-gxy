<script setup>
/**
 * Prospects - Prospect management page (split-panel design)
 *
 * Left panel: Tag sidebar with create/edit/delete, bulk selection, and click-to-filter.
 * Right panel: Prospect list with search, status filter, bulk tag assignment, bulk delete.
 *
 * Uses "Load More" infinite scroll instead of traditional pagination:
 * - accumulatedProspects accumulates rows across pages (deduped by ID)
 * - Resetting filters clears accumulated rows and goes back to page 1
 * - Selection persists across loaded pages
 */

import { ref, computed, watch } from 'vue'
import { useProspects, useDeleteProspect, useBulkDeleteProspects, useBulkAttachTags } from '../composables/useProspects'
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from '../composables/useTags'
import { TAG_COLORS, PAGINATION, CONNECTION_STATUS } from '../utils/constants'
import { getErrorMessage } from '../utils/helpers'
import Layout from '../components/layout/Layout.vue'
import ProspectTable from '../components/prospects/ProspectTable.vue'
import ProspectEditModal from '../components/prospects/ProspectEditModal.vue'
import Modal from '../components/common/Modal.vue'
import Input from '../components/common/Input.vue'
import Button from '../components/common/Button.vue'
import Spinner from '../components/common/Spinner.vue'

// Prospects state
const filters = ref({
  search: '',
  connection_status: '',
  tag_id: '',
  page: 1,
  per_page: PAGINATION.DEFAULT_PER_PAGE,
})
const accumulatedProspects = ref([])
const editingProspect = ref(null)
const isEditModalOpen = ref(false)
const isBulkTagModalOpen = ref(false)
const selectedTagIds = ref([])
const isAddProspectsOpen = ref(false)

// Tags state
const isTagModalOpen = ref(false)
const editingTag = ref(null)
const tagFormData = ref({ name: '', color: TAG_COLORS[0] })
const tagError = ref('')
const selectedTags = ref([])

// Global prospect selection
const selectedProspects = ref([])

const toggleProspect = (prospectId) => {
  const idx = selectedProspects.value.indexOf(prospectId)
  if (idx === -1) {
    selectedProspects.value.push(prospectId)
  } else {
    selectedProspects.value.splice(idx, 1)
  }
}

const clearSelectedProspects = () => {
  selectedProspects.value = []
}

// Fetch data
const { data: prospectsData, isLoading: prospectsLoading } = useProspects(filters)
const { data: tagsData, isLoading: tagsLoading } = useTags()

// Mutations
const deleteMutation = useDeleteProspect()
const bulkDeleteMutation = useBulkDeleteProspects()
const bulkAttachTagsMutation = useBulkAttachTags()
const createTagMutation = useCreateTag()
const updateTagMutation = useUpdateTag()
const deleteTagMutation = useDeleteTag()

const prospects = computed(() => prospectsData.value?.data || [])
const meta = computed(() => prospectsData.value?.meta || {})
const tags = computed(() => Array.isArray(tagsData.value) ? tagsData.value : [])

// Accumulate prospects as we load more pages
watch([prospects, () => filters.value.page], ([newProspects, page]) => {
  if (page === 1) {
    accumulatedProspects.value = [...newProspects]
  } else if (newProspects.length > 0) {
    const existingIds = new Set(accumulatedProspects.value.map(p => p.id))
    const unique = newProspects.filter(p => !existingIds.has(p.id))
    accumulatedProspects.value = [...accumulatedProspects.value, ...unique]
  }
})

// ============ PROSPECT HANDLERS ============

const handleFilterChange = (field, value) => {
  filters.value = { ...filters.value, [field]: value, page: 1 }
  accumulatedProspects.value = []
}

const handleLoadMore = () => {
  filters.value = { ...filters.value, page: filters.value.page + 1 }
}

const handleSelectAllLoaded = () => {
  const loadedIds = accumulatedProspects.value.map(p => p.id)
  const allSelected = loadedIds.every(id => selectedProspects.value.includes(id))

  if (allSelected) {
    selectedProspects.value = selectedProspects.value.filter(id => !loadedIds.includes(id))
  } else {
    const newSelection = [...selectedProspects.value]
    loadedIds.forEach(id => {
      if (!newSelection.includes(id)) newSelection.push(id)
    })
    selectedProspects.value = newSelection
  }
}

const handleEdit = (prospect) => {
  editingProspect.value = prospect
  isEditModalOpen.value = true
}

const handleDelete = async (prospect) => {
  if (window.confirm(`Are you sure you want to delete ${prospect.full_name}?`)) {
    try {
      await deleteMutation.mutateAsync(prospect.id)
      accumulatedProspects.value = accumulatedProspects.value.filter(p => p.id !== prospect.id)
    } catch (error) {
      console.error('Delete error:', error)
    }
  }
}

const handleBulkDelete = async () => {
  if (selectedProspects.value.length === 0) return
  const count = selectedProspects.value.length
  if (window.confirm(`Are you sure you want to delete ${count} prospect${count > 1 ? 's' : ''}?`)) {
    try {
      await bulkDeleteMutation.mutateAsync(selectedProspects.value)
      accumulatedProspects.value = accumulatedProspects.value.filter(p => !selectedProspects.value.includes(p.id))
      clearSelectedProspects()
    } catch (error) {
      console.error('Bulk delete error:', error)
    }
  }
}

const handleOpenBulkTagModal = () => {
  selectedTagIds.value = []
  isBulkTagModalOpen.value = true
}

const handleBulkAttachTags = async () => {
  if (selectedProspects.value.length === 0 || selectedTagIds.value.length === 0) return
  try {
    await bulkAttachTagsMutation.mutateAsync({
      prospectIds: selectedProspects.value,
      tagIds: selectedTagIds.value,
    })
    isBulkTagModalOpen.value = false
    selectedTagIds.value = []
    clearSelectedProspects()
  } catch (error) {
    console.error('Bulk attach tags error:', error)
  }
}

const handleToggleTagForAssignment = (tagId) => {
  const idx = selectedTagIds.value.indexOf(tagId)
  if (idx === -1) {
    selectedTagIds.value.push(tagId)
  } else {
    selectedTagIds.value.splice(idx, 1)
  }
}

// ============ TAG HANDLERS ============

const handleCreateTag = () => {
  editingTag.value = null
  tagFormData.value = { name: '', color: TAG_COLORS[0] }
  tagError.value = ''
  isTagModalOpen.value = true
}

const handleEditTag = (tag, e) => {
  e.stopPropagation()
  editingTag.value = tag
  tagFormData.value = { name: tag.name, color: tag.color || TAG_COLORS[0] }
  tagError.value = ''
  isTagModalOpen.value = true
}

const handleTagSubmit = async () => {
  tagError.value = ''
  if (!tagFormData.value.name) {
    tagError.value = 'Tag name is required'
    return
  }
  try {
    if (editingTag.value) {
      await updateTagMutation.mutateAsync({ id: editingTag.value.id, data: tagFormData.value })
    } else {
      await createTagMutation.mutateAsync(tagFormData.value)
    }
    isTagModalOpen.value = false
  } catch (err) {
    console.error('Tag save error:', err)
    tagError.value = getErrorMessage(err)
  }
}

const handleDeleteTag = async (tag, e) => {
  e.stopPropagation()
  if (window.confirm(`Are you sure you want to delete the tag "${tag.name}"?`)) {
    try {
      await deleteTagMutation.mutateAsync(tag.id)
    } catch (error) {
      console.error('Delete error:', error)
    }
  }
}

const handleToggleTag = (tagId) => {
  const idx = selectedTags.value.indexOf(tagId)
  if (idx === -1) {
    selectedTags.value.push(tagId)
  } else {
    selectedTags.value.splice(idx, 1)
  }
}

const handleSelectAllTags = () => {
  if (selectedTags.value.length === tags.value.length) {
    selectedTags.value = []
  } else {
    selectedTags.value = tags.value.map(tag => tag.id)
  }
}

const handleBulkDeleteTags = async () => {
  if (selectedTags.value.length === 0) return
  const count = selectedTags.value.length
  if (window.confirm(`Are you sure you want to delete ${count} tag${count > 1 ? 's' : ''}?`)) {
    try {
      for (const tagId of selectedTags.value) {
        await deleteTagMutation.mutateAsync(tagId)
      }
      selectedTags.value = []
    } catch (error) {
      console.error('Bulk delete error:', error)
    }
  }
}

const handleFilterByTag = (tagId) => {
  const newTagId = tagId === filters.value.tag_id ? '' : tagId
  filters.value = { ...filters.value, tag_id: newTagId, page: 1 }
  accumulatedProspects.value = []
}

const allLoadedSelected = computed(() => {
  const loadedIds = accumulatedProspects.value.map(p => p.id)
  return loadedIds.length > 0 && loadedIds.every(id => selectedProspects.value.includes(id))
})

const hasMore = computed(() => meta.value.current_page < meta.value.last_page)

const filteredTagName = computed(() => {
  if (!filters.value.tag_id) return null
  const tag = tags.value.find(t => t.id === parseInt(filters.value.tag_id))
  return tag?.name || null
})
</script>

<template>
  <Layout>
    <div class="flex gap-6 h-full">
      <!-- LEFT SIDEBAR - TAGS -->
      <div class="w-80 flex-shrink-0">
        <div class="bg-white rounded-lg shadow h-full flex flex-col">
          <!-- Tags Header -->
          <div class="p-4 border-b border-gray-200">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-lg font-semibold text-gray-900">Tags</h2>
              <Button variant="primary" size="sm" @click="handleCreateTag">
                + New
              </Button>
            </div>
            <Button
              v-if="selectedTags.length > 0"
              variant="danger"
              size="sm"
              class="w-full"
              @click="handleBulkDeleteTags"
            >
              Delete ({{ selectedTags.length }})
            </Button>
          </div>

          <!-- Tags List -->
          <div class="flex-1 overflow-y-auto">
            <div v-if="tagsLoading" class="flex justify-center py-8">
              <Spinner />
            </div>
            <div v-else-if="tags.length === 0" class="p-4 text-center text-gray-500 text-sm">
              No tags yet. Create one!
            </div>
            <div v-else class="p-2">
              <!-- Select All -->
              <label class="flex items-center px-3 py-2 hover:bg-gray-50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  :checked="selectedTags.length === tags.length && tags.length > 0"
                  class="w-4 h-4 text-linkedin border-gray-300 rounded focus:ring-linkedin"
                  @change="handleSelectAllTags"
                />
                <span class="ml-2 text-sm font-medium text-gray-700">Select All</span>
              </label>

              <!-- Tag Items -->
              <div
                v-for="tag in tags"
                :key="tag.id"
                :class="[
                  'flex items-center justify-between px-3 py-2 rounded hover:bg-gray-50 cursor-pointer',
                  filters.tag_id === tag.id ? 'bg-blue-50' : ''
                ]"
                @click="handleFilterByTag(tag.id)"
              >
                <div class="flex items-center space-x-2 flex-1">
                  <input
                    type="checkbox"
                    :checked="selectedTags.includes(tag.id)"
                    class="w-4 h-4 text-linkedin border-gray-300 rounded focus:ring-linkedin"
                    @change="handleToggleTag(tag.id)"
                    @click.stop
                  />
                  <div
                    class="w-3 h-3 rounded-full"
                    :style="{ backgroundColor: tag.color }"
                  />
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-900">{{ tag.name }}</p>
                    <p class="text-xs text-gray-500">{{ tag.prospects_count || 0 }} prospects</p>
                  </div>
                </div>
                <div class="flex items-center space-x-1">
                  <button
                    class="p-1 text-gray-400 hover:text-gray-600"
                    @click="handleEditTag(tag, $event)"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    class="p-1 text-gray-400 hover:text-red-600"
                    @click="handleDeleteTag(tag, $event)"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT CONTENT - PROSPECTS -->
      <div class="flex-1 flex flex-col h-[calc(100vh-4rem)]">
        <!-- Fixed Header Section -->
        <div class="space-y-4 flex-shrink-0">
          <!-- Header -->
          <div class="flex justify-between items-center">
            <div>
              <h1 class="text-2xl font-bold text-gray-900">Prospects</h1>
              <p class="text-sm text-gray-600 mt-1">
                {{ meta.total || 0 }} total prospects
                <template v-if="filteredTagName">
                  &bull; Filtered by "{{ filteredTagName }}"
                </template>
              </p>
            </div>
            <div class="flex items-center space-x-2">
              <!-- Add Prospects Dropdown -->
              <div class="relative">
                <Button
                  variant="primary"
                  size="sm"
                  @click="isAddProspectsOpen = !isAddProspectsOpen"
                >
                  <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Prospects
                </Button>

                <template v-if="isAddProspectsOpen">
                  <!-- Backdrop -->
                  <div class="fixed inset-0 z-10" @click="isAddProspectsOpen = false" />

                  <!-- Dropdown -->
                  <div class="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                    <div class="p-4">
                      <h3 class="text-sm font-semibold text-gray-900 mb-3">Add Prospects from LinkedIn</h3>

                      <a
                        href="https://www.linkedin.com/search/results/people/?keywords=%27%27&origin=SWITCH_SEARCH_VERTICAL"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-linkedin transition-colors mb-2"
                        @click="isAddProspectsOpen = false"
                      >
                        <div class="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <svg class="w-5 h-5 text-linkedin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <div class="ml-3">
                          <p class="text-sm font-medium text-gray-900">From Search</p>
                          <p class="text-xs text-gray-500">Search for people on LinkedIn</p>
                        </div>
                      </a>

                      <a
                        href="https://www.linkedin.com/mynetwork/invite-connect/connections/"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-linkedin transition-colors"
                        @click="isAddProspectsOpen = false"
                      >
                        <div class="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <svg class="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <div class="ml-3">
                          <p class="text-sm font-medium text-gray-900">From Network</p>
                          <p class="text-xs text-gray-500">Import your existing connections</p>
                        </div>
                      </a>

                      <div class="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <div class="flex">
                          <svg class="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div class="ml-2">
                            <p class="text-xs font-medium text-amber-800">How to extract prospects:</p>
                            <ol class="text-xs text-amber-700 mt-1 list-decimal list-inside space-y-1">
                              <li>Click a link above to open LinkedIn</li>
                              <li>Open the extension popup</li>
                              <li>Set your extraction limit</li>
                              <li>Click "Extract Prospects"</li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </div>

              <!-- Bulk Actions -->
              <template v-if="selectedProspects.length > 0">
                <Button variant="primary" size="sm" @click="handleOpenBulkTagModal">
                  Assign Tags ({{ selectedProspects.length }})
                </Button>
                <Button variant="danger" size="sm" @click="handleBulkDelete">
                  Delete ({{ selectedProspects.length }})
                </Button>
                <Button variant="secondary" size="sm" @click="clearSelectedProspects">
                  Clear
                </Button>
              </template>
            </div>
          </div>

          <!-- Filters -->
          <div class="bg-white rounded-lg shadow p-4">
            <div class="grid grid-cols-3 gap-4">
              <Input
                placeholder="Search prospects..."
                :model-value="filters.search"
                @update:model-value="handleFilterChange('search', $event)"
              />
              <select
                :value="filters.connection_status"
                class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-linkedin focus:border-linkedin"
                @change="handleFilterChange('connection_status', $event.target.value)"
              >
                <option value="">All Statuses</option>
                <option :value="CONNECTION_STATUS.NOT_CONNECTED">Not Connected</option>
                <option :value="CONNECTION_STATUS.PENDING">Pending</option>
                <option :value="CONNECTION_STATUS.CONNECTED">Connected</option>
              </select>
              <Button
                v-if="filters.tag_id"
                variant="secondary"
                size="sm"
                @click="handleFilterChange('tag_id', '')"
              >
                Clear Tag Filter
              </Button>
            </div>
          </div>

          <!-- Selection Info -->
          <div v-if="selectedProspects.length > 0" class="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p class="text-sm text-blue-800">
              <strong>{{ selectedProspects.length }}</strong> prospect{{ selectedProspects.length > 1 ? 's' : '' }} selected
            </p>
          </div>

          <!-- Select All Loaded -->
          <div v-if="accumulatedProspects.length > 0" class="bg-white rounded-lg shadow p-4">
            <label class="flex items-center">
              <input
                type="checkbox"
                :checked="allLoadedSelected"
                class="w-4 h-4 text-linkedin border-gray-300 rounded focus:ring-linkedin"
                @change="handleSelectAllLoaded"
              />
              <span class="ml-3 text-sm font-medium text-gray-700">
                Select All Loaded ({{ accumulatedProspects.length }})
              </span>
            </label>
          </div>
        </div>

        <!-- Scrollable Prospects List -->
        <div class="flex-1 overflow-y-auto mt-4">
          <div v-if="prospectsLoading && filters.page === 1" class="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
          <div v-else class="space-y-4">
            <ProspectTable
              :prospects="accumulatedProspects"
              :selected-prospects="selectedProspects"
              @toggle-prospect="toggleProspect"
              @edit="handleEdit"
              @delete="handleDelete"
            />

            <!-- Load More Button -->
            <div v-if="hasMore" class="flex justify-center py-6">
              <Button
                variant="secondary"
                :loading="prospectsLoading"
                :disabled="prospectsLoading"
                @click="handleLoadMore"
              >
                {{ prospectsLoading ? 'Loading...' : `Load More (${meta.total - accumulatedProspects.length} remaining)` }}
              </Button>
            </div>

            <div v-if="!hasMore && accumulatedProspects.length > 0" class="text-center py-6 text-gray-500 text-sm">
              You've reached the end of the list
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Prospect Modal -->
    <ProspectEditModal
      v-if="editingProspect"
      :is-open="isEditModalOpen"
      :prospect="editingProspect"
      @close="isEditModalOpen = false"
    />

    <!-- Bulk Tag Assignment Modal -->
    <Modal
      :is-open="isBulkTagModalOpen"
      title="Assign Tags"
      size="md"
      @close="isBulkTagModalOpen = false"
    >
      <div class="space-y-4">
        <p class="text-sm text-gray-600">Select tags to assign:</p>
        <div class="max-h-96 overflow-y-auto space-y-2">
          <label
            v-for="tag in tags"
            :key="tag.id"
            class="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="checkbox"
              :checked="selectedTagIds.includes(tag.id)"
              class="w-4 h-4 text-linkedin border-gray-300 rounded focus:ring-linkedin"
              @change="handleToggleTagForAssignment(tag.id)"
            />
            <div class="w-4 h-4 rounded-full ml-3" :style="{ backgroundColor: tag.color }" />
            <span class="ml-2 text-sm font-medium">{{ tag.name }}</span>
          </label>
        </div>
        <div class="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="secondary" @click="isBulkTagModalOpen = false">Cancel</Button>
          <Button variant="primary" :disabled="selectedTagIds.length === 0" @click="handleBulkAttachTags">
            Assign Tags
          </Button>
        </div>
      </div>
    </Modal>

    <!-- Tag Create/Edit Modal -->
    <Modal
      :is-open="isTagModalOpen"
      :title="editingTag ? 'Edit Tag' : 'Create Tag'"
      size="md"
      @close="isTagModalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="handleTagSubmit">
        <div v-if="tagError" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {{ tagError }}
        </div>
        <Input
          label="Tag Name"
          :model-value="tagFormData.name"
          placeholder="e.g., Hot Lead, CEO"
          required
          @update:model-value="tagFormData.name = $event"
        />
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Color</label>
          <div class="grid grid-cols-8 gap-2">
            <button
              v-for="color in TAG_COLORS"
              :key="color"
              type="button"
              :class="['w-8 h-8 rounded-full', tagFormData.color === color ? 'ring-2 ring-offset-2 ring-linkedin' : '']"
              :style="{ backgroundColor: color }"
              @click="tagFormData.color = color"
            />
          </div>
        </div>
        <div class="flex justify-end space-x-3 pt-4 border-t">
          <Button type="button" variant="secondary" @click="isTagModalOpen = false">Cancel</Button>
          <Button type="submit" variant="primary" :loading="createTagMutation.isPending.value || updateTagMutation.isPending.value">
            {{ editingTag ? 'Update' : 'Create' }}
          </Button>
        </div>
      </form>
    </Modal>
  </Layout>
</template>
