<template>
  <div v-if="prospects.length === 0" class="bg-white rounded-lg shadow p-12 text-center">
    <p class="text-gray-500">No prospects found</p>
  </div>

  <div v-else class="bg-white rounded-lg shadow overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-3 py-3 text-left">
              <!-- Checkbox column -->
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Prospect
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Email
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tags
            </th>
            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr
            v-for="prospect in prospects"
            :key="prospect.id"
            class="hover:bg-gray-50 transition-colors"
          >
            <!-- Checkbox -->
            <td class="px-3 py-4 whitespace-nowrap">
              <input
                type="checkbox"
                :checked="selectedProspects.includes(prospect.id)"
                @change="onToggleProspect(prospect.id)"
                class="w-4 h-4 text-linkedin border-gray-300 rounded focus:ring-linkedin"
              />
            </td>

            <!-- Prospect Info -->
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <!-- Avatar -->
                <div class="flex-shrink-0 h-10 w-10">
                  <img
                    v-if="prospect.profile_image_url"
                    class="h-10 w-10 rounded-full object-cover"
                    :src="prospect.profile_image_url"
                    :alt="prospect.full_name"
                  />
                  <div
                    v-else
                    class="h-10 w-10 rounded-full bg-linkedin flex items-center justify-center"
                  >
                    <span class="text-white font-medium">
                      {{ getInitials(prospect.full_name) }}
                    </span>
                  </div>
                </div>

                <!-- Name and Headline -->
                <div class="ml-4">
                  <div class="text-sm font-medium text-gray-900">
                    <a
                      :href="prospect.profile_url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="hover:text-linkedin"
                    >
                      {{ prospect.full_name }}
                    </a>
                  </div>
                  <div
                    v-if="prospect.headline"
                    class="text-sm text-gray-500 truncate max-w-xs"
                  >
                    {{ prospect.headline }}
                  </div>
                </div>
              </div>
            </td>

            <!-- Email -->
            <td class="px-6 py-4 whitespace-nowrap">
              <a
                v-if="prospect.email"
                :href="`mailto:${prospect.email}`"
                class="text-sm text-linkedin hover:underline"
              >
                {{ prospect.email }}
              </a>
              <span v-else class="text-sm text-gray-400">-</span>
            </td>

            <!-- Tags -->
            <td class="px-6 py-4">
              <div class="flex flex-wrap gap-1">
                <template v-if="prospect.tags && prospect.tags.length > 0">
                  <Tag
                    v-for="tag in prospect.tags"
                    :key="tag.id"
                    :name="tag.name"
                    :color="tag.color"
                    removable
                    :onRemove="() => handleRemoveTag(prospect.id, tag.id)"
                  />
                </template>
                <span v-else class="text-sm text-gray-400">No tags</span>
              </div>
            </td>

            <!-- Actions -->
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <div class="flex items-center justify-end space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  @click="onEdit(prospect)"
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  @click="onDelete(prospect)"
                >
                  Delete
                </Button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { getInitials } from '../../utils/helpers'
import Tag from '../common/Tag.vue'
import Button from '../common/Button.vue'
import { useDetachTag } from '../../composables/useProspects'

const props = defineProps({
  prospects: {
    type: Array,
    default: () => []
  },
  selectedProspects: {
    type: Array,
    default: () => []
  },
  onToggleProspect: {
    type: Function,
    required: true
  },
  onEdit: {
    type: Function,
    required: true
  },
  onDelete: {
    type: Function,
    required: true
  }
})

const detachTagMutation = useDetachTag()

const handleRemoveTag = async (prospectId, tagId) => {
  try {
    await detachTagMutation.mutateAsync({ prospectId, tagId })
  } catch (error) {
    console.error('Error removing tag:', error)
  }
}
</script>
