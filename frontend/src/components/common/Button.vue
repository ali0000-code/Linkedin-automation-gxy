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
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
    <slot />
  </button>
</template>

<script setup>
import { computed, useAttrs } from 'vue'

defineProps({
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'md' },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const attrs = useAttrs()
const filteredAttrs = computed(() => {
  const { class: _, ...rest } = attrs
  return rest
})

const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] select-none'

const variantStyles = {
  primary: 'bg-linkedin hover:bg-linkedin-dark text-white focus:ring-linkedin shadow-sm hover:shadow-md',
  secondary: 'bg-theme-overlay hover:opacity-80 text-theme-primary border border-theme focus:ring-gray-400',
  danger: 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-500 shadow-sm',
  ghost: 'bg-transparent hover:bg-theme-overlay text-theme-secondary focus:ring-gray-400',
  outline: 'bg-transparent border border-linkedin text-linkedin hover:bg-linkedin hover:text-white focus:ring-linkedin',
}

const sizeStyles = {
  xs: 'px-2.5 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-base',
}
</script>
