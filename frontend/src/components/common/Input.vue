<template>
  <div class="w-full">
    <label v-if="label" class="block text-sm font-medium text-gray-700 mb-1">
      {{ label }}
    </label>
    <input
      :type="type"
      :class="[
        'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-linkedin transition-colors',
        error
          ? 'border-red-500 focus:ring-red-500'
          : 'border-gray-300 focus:border-linkedin',
        $attrs.class
      ]"
      v-bind="filteredAttrs"
    />
    <p v-if="error" class="mt-1 text-sm text-red-500">{{ error }}</p>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'

defineProps({
  label: {
    type: String,
    default: ''
  },
  error: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'text'
  }
})

const attrs = useAttrs()

const filteredAttrs = computed(() => {
  const { class: _, ...rest } = attrs
  return rest
})
</script>
