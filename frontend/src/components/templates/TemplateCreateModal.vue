<template>
  <Modal :isOpen="isOpen" :title="`Create ${typeLabel} Template`" size="lg" @close="handleClose">
    <form @submit.prevent="handleSubmit" class="space-y-4">
      <!-- Template Name -->
      <div>
        <label for="name" class="block text-sm font-medium text-theme-secondary mb-1">
          Template Name <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          :value="formData.name"
          @input="handleChange('name', $event.target.value)"
          :class="[
            'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-linkedin',
            errors.name ? 'border-red-500' : 'border-theme'
          ]"
          placeholder="e.g., Tech Startup Outreach"
        />
        <p v-if="errors.name" class="text-red-500 text-sm mt-1">{{ errors.name }}</p>
      </div>

      <!-- Email Subject (only for email type) -->
      <div v-if="type === 'email'">
        <label for="subject" class="block text-sm font-medium text-theme-secondary mb-1">
          Email Subject <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="subject"
          name="subject"
          ref="subjectRef"
          :value="formData.subject"
          @input="handleChange('subject', $event.target.value)"
          :class="[
            'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-linkedin',
            errors.subject ? 'border-red-500' : 'border-theme'
          ]"
          placeholder="e.g., Quick question about your work"
        />
        <p v-if="errors.subject" class="text-red-500 text-sm mt-1">{{ errors.subject }}</p>
      </div>

      <!-- Info Banner -->
      <div v-if="type === 'invitation'" class="bg-blue-50 border-l-4 border-linkedin p-3">
        <p class="text-sm text-blue-700">
          Invitation messages are sent with connection requests and have a <strong>300 character limit</strong>.
        </p>
      </div>
      <div v-else-if="type === 'email'" class="bg-purple-50 border-l-4 border-purple-500 p-3">
        <p class="text-sm text-purple-700">
          Email templates require a <strong>subject line</strong>. Use personalization variables like
          <code class="bg-purple-100 px-1 rounded">{{ '{firstName}' }}</code>,
          <code class="bg-purple-100 px-1 rounded">{{ '{fullName}' }}</code>.
        </p>
      </div>

      <!-- Message Content -->
      <div>
        <label for="content" class="block text-sm font-medium text-theme-secondary mb-1">
          {{ type === 'email' ? 'Email Body' : 'Message Content' }} <span class="text-red-500">*</span>
        </label>
        <textarea
          id="content"
          name="content"
          ref="contentRef"
          :value="formData.content"
          @input="handleChange('content', $event.target.value)"
          :rows="type === 'email' ? 10 : 6"
          :maxlength="maxLength"
          :class="[
            'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-linkedin resize-none',
            errors.content ? 'border-red-500' : 'border-theme'
          ]"
          :placeholder="placeholder"
        />
        <div class="flex justify-between items-center mt-1">
          <div>
            <p v-if="errors.content" class="text-red-500 text-sm">{{ errors.content }}</p>
          </div>
          <p :class="['text-sm', currentLength > maxLength ? 'text-red-500' : 'text-theme-muted']">
            {{ currentLength }} / {{ maxLength }}
          </p>
        </div>
      </div>

      <!-- Personalization Variables Help -->
      <div class="bg-theme-overlay p-3 rounded-lg">
        <p class="text-xs text-theme-secondary font-medium mb-2">Available Variables (click to insert):</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="variable in availableVariables"
            :key="variable"
            type="button"
            @click="insertVariable(variable)"
            class="bg-gray-200 hover:bg-linkedin hover:text-white px-2 py-1 rounded text-xs font-mono transition-colors cursor-pointer"
          >
            {{ variable }}
          </button>
        </div>
      </div>

      <!-- Buttons -->
      <div class="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="secondary" @click="handleClose" :disabled="isPending">
          Cancel
        </Button>
        <Button type="submit" variant="primary" :disabled="isPending">
          {{ isPending ? 'Creating...' : 'Create Template' }}
        </Button>
      </div>
    </form>
  </Modal>
</template>

<script setup>
import { ref, computed } from 'vue'
import Modal from '../common/Modal.vue'
import Button from '../common/Button.vue'
import { useCreateTemplate } from '../../composables/useTemplates'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  type: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['close'])

const formData = ref({
  name: '',
  subject: '',
  content: '',
})
const errors = ref({})
const contentRef = ref(null)
const subjectRef = ref(null)

const { mutate: createTemplate, isPending } = useCreateTemplate()

const maxLength = computed(() => {
  if (props.type === 'invitation') return 300
  if (props.type === 'email') return 10000
  return 5000
})

const currentLength = computed(() => formData.value.content.length)

const typeLabel = computed(() => {
  if (props.type === 'invitation') return 'Invitation Message'
  if (props.type === 'email') return 'Email'
  return 'Direct Message'
})

const placeholder = computed(() => {
  if (props.type === 'invitation') {
    return "Hi {firstName}, I'd love to connect and learn more about your work..."
  }
  if (props.type === 'email') {
    return "Dear {firstName},\n\nI hope this email finds you well...\n\nBest regards"
  }
  return 'Write your message template here...'
})

const availableVariables = computed(() => {
  const vars = ['{firstName}', '{lastName}', '{fullName}']
  if (props.type === 'email') vars.push('{email}')
  return vars
})

const handleChange = (name, value) => {
  formData.value = { ...formData.value, [name]: value }

  // Clear error for this field
  if (errors.value[name]) {
    errors.value = { ...errors.value, [name]: null }
  }
}

const handleSubmit = () => {
  // Validation
  const newErrors = {}
  if (!formData.value.name.trim()) {
    newErrors.name = 'Template name is required'
  }
  if (props.type === 'email' && !formData.value.subject.trim()) {
    newErrors.subject = 'Email subject is required'
  }
  if (!formData.value.content.trim()) {
    newErrors.content = 'Message content is required'
  }
  if (formData.value.content.length > maxLength.value) {
    newErrors.content = `Message must be ${maxLength.value} characters or less`
  }

  if (Object.keys(newErrors).length > 0) {
    errors.value = newErrors
    return
  }

  // Build payload
  const payload = {
    name: formData.value.name,
    type: props.type,
    content: formData.value.content,
  }

  // Add subject for email templates
  if (props.type === 'email') {
    payload.subject = formData.value.subject
  }

  // Create template
  createTemplate(payload, {
    onSuccess: () => {
      formData.value = { name: '', subject: '', content: '' }
      errors.value = {}
      emit('close')
    },
    onError: (error) => {
      if (error.response?.data?.errors) {
        errors.value = error.response.data.errors
      }
    },
  })
}

const handleClose = () => {
  formData.value = { name: '', subject: '', content: '' }
  errors.value = {}
  emit('close')
}

const insertVariable = (variable, targetField = 'content') => {
  const input = targetField === 'subject' ? subjectRef.value : contentRef.value
  if (!input) return

  const start = input.selectionStart
  const end = input.selectionEnd
  const currentValue = formData.value[targetField]
  const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end)

  formData.value = { ...formData.value, [targetField]: newValue }

  // Restore cursor position after the inserted variable
  setTimeout(() => {
    input.focus()
    input.setSelectionRange(start + variable.length, start + variable.length)
  }, 0)
}
</script>
