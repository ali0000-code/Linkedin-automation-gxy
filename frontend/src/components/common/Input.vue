<template>
  <div class="w-full">
    <label v-if="label" class="block text-sm font-medium text-theme-secondary mb-1">
      {{ label }}
    </label>
    <input
      :type="type"
      :value="modelValue"
      :class="[
        'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-linkedin transition-colors bg-theme-raised text-theme-primary placeholder:text-theme-muted',
        error
          ? 'border-red-500 focus:ring-red-500'
          : 'border-theme focus:border-linkedin',
        $attrs.class
      ]"
      v-bind="filteredAttrs"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <p v-if="error" class="mt-1 text-sm text-red-500">{{ error }}</p>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'

defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
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

defineEmits(['update:modelValue'])

const attrs = useAttrs()

const filteredAttrs = computed(() => {
  const { class: _, 'onUpdate:modelValue': __, ...rest } = attrs
  return rest
})
</script>
