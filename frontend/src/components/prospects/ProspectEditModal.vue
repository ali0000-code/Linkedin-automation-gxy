<template>
  <Modal :isOpen="isOpen" @close="onClose" title="Edit Prospect" size="lg">
    <form @submit.prevent="handleSubmit" class="space-y-4">
      <!-- Error Message -->
      <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {{ error }}
      </div>

      <!-- Full Name - Read Only -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Full Name
        </label>
        <input
          type="text"
          :value="prospect?.full_name || ''"
          disabled
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
        />
      </div>

      <!-- Connection Status -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Connection Status
        </label>
        <select
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-linkedin"
          :value="formData.connection_status"
          @change="handleChange('connection_status', $event.target.value)"
        >
          <option
            v-for="status in Object.values(CONNECTION_STATUS)"
            :key="status"
            :value="status"
          >
            {{ CONNECTION_STATUS_LABELS[status] }}
          </option>
        </select>
      </div>

      <!-- Tags Selection -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Tags
        </label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="tag in availableTags"
            :key="tag.id"
            type="button"
            @click="toggleTag(tag.id)"
            :class="[
              'px-3 py-1 rounded-full text-sm font-medium transition-all',
              selectedTagIds.includes(tag.id)
                ? 'bg-linkedin text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            ]"
            :style="selectedTagIds.includes(tag.id) ? {} : { borderColor: tag.color }"
          >
            {{ tag.name }}
          </button>
        </div>
        <p v-if="availableTags.length === 0" class="text-sm text-gray-500">
          No tags available. Create tags first.
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="flex justify-end space-x-3 pt-4 border-t">
        <Button
          type="button"
          variant="secondary"
          @click="onClose"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          :loading="updateMutation.isPending.value || attachTagsMutation.isPending.value"
        >
          Save Changes
        </Button>
      </div>
    </form>
  </Modal>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useUpdateProspect, useAttachTags } from '../../composables/useProspects'
import { useTags } from '../../composables/useTags'
import { CONNECTION_STATUS, CONNECTION_STATUS_LABELS } from '../../utils/constants'
import { getErrorMessage } from '../../utils/helpers'
import Modal from '../common/Modal.vue'
import Input from '../common/Input.vue'
import Button from '../common/Button.vue'
import Tag from '../common/Tag.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  prospect: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close'])

const onClose = () => {
  emit('close')
}

const formData = ref({
  connection_status: CONNECTION_STATUS.NOT_CONNECTED
})
const selectedTagIds = ref([])
const error = ref('')

const updateMutation = useUpdateProspect()
const attachTagsMutation = useAttachTags()
const { data: tagsData } = useTags()
const availableTags = computed(() => Array.isArray(tagsData.value) ? tagsData.value : [])

// Initialize form data when prospect changes
watch(() => props.prospect, (newProspect) => {
  if (newProspect) {
    formData.value = {
      connection_status: newProspect.connection_status || CONNECTION_STATUS.NOT_CONNECTED
    }
    const currentTagIds = newProspect.tags?.map(t => t.id) || []
    selectedTagIds.value = currentTagIds
  }
})

const handleChange = (field, value) => {
  formData.value = { ...formData.value, [field]: value }
}

const toggleTag = (tagId) => {
  if (selectedTagIds.value.includes(tagId)) {
    selectedTagIds.value = selectedTagIds.value.filter(id => id !== tagId)
  } else {
    selectedTagIds.value = [...selectedTagIds.value, tagId]
  }
}

const handleSubmit = async () => {
  error.value = ''

  try {
    // Update prospect details
    await updateMutation.mutateAsync({
      id: props.prospect.id,
      data: formData.value
    })

    // Update tags if changed
    const currentTagIds = props.prospect.tags?.map(t => t.id) || []
    const tagsChanged = JSON.stringify([...currentTagIds].sort()) !== JSON.stringify([...selectedTagIds.value].sort())

    if (tagsChanged && selectedTagIds.value.length > 0) {
      await attachTagsMutation.mutateAsync({
        prospectId: props.prospect.id,
        tagIds: selectedTagIds.value
      })
    }

    onClose()
  } catch (err) {
    error.value = getErrorMessage(err)
  }
}
</script>
