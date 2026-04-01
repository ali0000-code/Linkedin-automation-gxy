<template>
  <span
    :class="[
      'inline-flex items-center rounded-full font-medium',
      sizeStyles[size],
      $attrs.class
    ]"
    :style="{
      backgroundColor: color + '20',
      color: color,
      border: `1px solid ${color}40`,
    }"
  >
    {{ name }}
    <button
      v-if="removable && onRemove"
      type="button"
      @click="onRemove"
      class="ml-1 hover:opacity-75 focus:outline-none"
    >
      <svg
        class="h-3 w-3"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clip-rule="evenodd"
        />
      </svg>
    </button>
  </span>
</template>

<script setup>
const props = defineProps({
  name: {
    type: String,
    required: true
  },
  color: {
    type: String,
    default: '#3b82f6'
  },
  removable: {
    type: Boolean,
    default: false
  },
  onRemove: {
    type: Function,
    default: null
  },
  size: {
    type: String,
    default: 'sm'
  }
})

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
}
</script>
