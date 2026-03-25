<template>
  <div :class="['flex items-center justify-center', $attrs.class]">
    <div
      :class="[
        'animate-spin rounded-full border-b-2 border-linkedin',
        sizeStyles[size]
      ]"
    ></div>
  </div>
</template>

<script setup>
defineProps({
  size: {
    type: String,
    default: 'md'
  }
})

const sizeStyles = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
}
</script>
