<template>
  <button
    :class="[
      baseStyles,
      variantStyles[variant],
      sizeStyles[size],
      $attrs.class
    ]"
    :disabled="disabled || loading"
    v-bind="filteredAttrs"
  >
    <svg
      v-if="loading"
      class="animate-spin -ml-1 mr-2 h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      ></circle>
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
    <slot />
  </button>
</template>

<script setup>
import { computed, useAttrs } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'primary'
  },
  size: {
    type: String,
    default: 'md'
  },
  loading: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const attrs = useAttrs()

const filteredAttrs = computed(() => {
  const { class: _, ...rest } = attrs
  return rest
})

const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed'

const variantStyles = {
  primary: 'bg-linkedin hover:bg-linkedin-dark text-white focus:ring-linkedin',
  secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800 focus:ring-gray-400',
  danger: 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-500',
  ghost: 'bg-transparent hover:bg-gray-100 text-gray-700 focus:ring-gray-400',
}

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
}
</script>
