<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-bold text-gray-900 mb-2">Select Tags</h2>
      <p class="text-sm text-gray-600">
        Choose which tagged prospects to include in this campaign
      </p>
    </div>

    <div v-if="tags.length === 0" class="text-center py-8 text-gray-500">
      <p class="mb-2">No tags with prospects found.</p>
      <p class="text-sm">Create some tags and add prospects to them first.</p>
    </div>

    <template v-else>
      <div class="space-y-2">
        <div
          v-for="tag in tags"
          :key="tag.id"
          @click="toggleTag(tag.id)"
          :class="[
            'p-4 border-2 rounded-lg cursor-pointer transition-all',
            campaignData.selectedTags.includes(tag.id)
              ? 'border-linkedin bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          ]"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <input
                type="checkbox"
                :checked="campaignData.selectedTags.includes(tag.id)"
                class="w-4 h-4 text-linkedin rounded focus:ring-linkedin"
                @click.stop
                @change="toggleTag(tag.id)"
              />
              <div>
                <div class="flex items-center space-x-2">
                  <span
                    class="w-3 h-3 rounded-full"
                    :style="{ backgroundColor: tag.color }"
                  />
                  <span class="font-medium text-gray-900">{{ tag.name }}</span>
                </div>
              </div>
            </div>
            <div class="text-sm text-gray-600">{{ tag.prospects_count }} prospects</div>
          </div>
        </div>
      </div>

      <div v-if="campaignData.selectedTags.length > 0" class="p-4 bg-linkedin-light rounded-lg">
        <div class="text-sm font-medium text-gray-900">
          Total prospects: <span class="text-linkedin font-bold">{{ totalProspects }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  tags: {
    type: Array,
    required: true
  },
  campaignData: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update'])

const totalProspects = computed(() => {
  return props.tags
    .filter(tag => props.campaignData.selectedTags.includes(tag.id))
    .reduce((sum, tag) => sum + (tag.prospects_count || 0), 0)
})

const toggleTag = (tagId) => {
  const isSelected = props.campaignData.selectedTags.includes(tagId)
  if (isSelected) {
    emit('update', {
      selectedTags: props.campaignData.selectedTags.filter(id => id !== tagId)
    })
  } else {
    emit('update', {
      selectedTags: [...props.campaignData.selectedTags, tagId]
    })
  }
}
</script>
