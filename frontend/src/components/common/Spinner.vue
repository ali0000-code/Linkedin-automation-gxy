<template>
  <div :class="['flex items-center justify-center', $attrs.class]">
    <div :class="['spinner', sizeStyles[size]]">
      <div class="spinner-ring" />
    </div>
  </div>
</template>

<script setup>
defineProps({
  size: { type: String, default: 'md' }
})

const sizeStyles = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
}
</script>

<style scoped>
.spinner {
  position: relative;
}
.spinner-ring {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2.5px solid var(--border);
  border-top-color: #0077b5;
  animation: spin 0.7s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
