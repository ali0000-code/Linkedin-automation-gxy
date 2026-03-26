<template>
  <div class="bg-theme-raised rounded-lg shadow p-4 mb-6">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <!-- Search Input -->
      <div class="md:col-span-2">
        <Input
          type="text"
          placeholder="Search by name, company, or headline..."
          :value="filters.search || ''"
          @input="onFilterChange('search', $event.target.value)"
        />
      </div>

      <!-- Connection Status Filter -->
      <div>
        <select
          class="w-full px-3 py-2 border border-theme rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-linkedin focus:border-linkedin"
          :value="filters.connection_status || ''"
          @change="onFilterChange('connection_status', $event.target.value)"
        >
          <option value="">All Status</option>
          <option
            v-for="status in Object.values(CONNECTION_STATUS)"
            :key="status"
            :value="status"
          >
            {{ CONNECTION_STATUS_LABELS[status] }}
          </option>
        </select>
      </div>

      <!-- Tag Filter -->
      <div>
        <select
          class="w-full px-3 py-2 border border-theme rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-linkedin focus:border-linkedin"
          :value="filters.tag_id || ''"
          @change="onFilterChange('tag_id', $event.target.value)"
        >
          <option value="">All Tags</option>
          <option
            v-for="tag in tags"
            :key="tag.id"
            :value="tag.id"
          >
            {{ tag.name }} ({{ tag.prospects_count }})
          </option>
        </select>
      </div>
    </div>

    <!-- Clear Filters Button -->
    <div v-if="hasActiveFilters" class="mt-4 flex justify-end">
      <button
        @click="onClearFilters"
        class="text-sm text-linkedin hover:text-linkedin-dark font-medium"
      >
        Clear Filters
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useTags } from '../../composables/useTags'
import { CONNECTION_STATUS, CONNECTION_STATUS_LABELS } from '../../utils/constants'
import Input from '../common/Input.vue'

const props = defineProps({
  filters: {
    type: Object,
    required: true
  },
  onFilterChange: {
    type: Function,
    required: true
  },
  onClearFilters: {
    type: Function,
    required: true
  }
})

const { data: tagsData, isLoading: tagsLoading } = useTags()
const tags = computed(() => Array.isArray(tagsData.value) ? tagsData.value : [])

const hasActiveFilters = computed(() => props.filters.search || props.filters.connection_status || props.filters.tag_id)
</script>
