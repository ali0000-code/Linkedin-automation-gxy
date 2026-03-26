<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto">
        <!-- Backdrop -->
        <Transition name="fade">
          <div
            v-if="isOpen"
            class="fixed inset-0 bg-black/50 backdrop-blur-sm"
            @click="closeOnBackdrop ? onClose() : undefined"
          />
        </Transition>

        <!-- Modal -->
        <div class="flex min-h-full items-center justify-center p-4">
          <div
            :class="[
              'relative bg-theme-raised rounded-xl shadow-2xl w-full border border-theme-subtle modal-content',
              sizeStyles[size]
            ]"
          >
            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-theme-subtle">
              <h3 class="text-lg font-semibold text-theme-primary">{{ title }}</h3>
              <button
                @click="onClose"
                class="text-theme-muted hover:text-theme-primary transition-colors p-1 rounded-lg hover:bg-theme-overlay"
              >
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Content -->
            <div class="p-6">
              <slot />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  title: { type: String, default: '' },
  size: { type: String, default: 'md' },
  closeOnBackdrop: { type: Boolean, default: true },
})

const emit = defineEmits(['close'])
const onClose = () => emit('close')

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
}

const handleEsc = (e) => {
  if (e.key === 'Escape' && props.isOpen) onClose()
}

onMounted(() => document.addEventListener('keydown', handleEsc))
onUnmounted(() => {
  document.removeEventListener('keydown', handleEsc)
  document.body.style.overflow = 'unset'
})

watch(() => props.isOpen, (val) => {
  document.body.style.overflow = val ? 'hidden' : 'unset'
})
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95) translateY(10px);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
